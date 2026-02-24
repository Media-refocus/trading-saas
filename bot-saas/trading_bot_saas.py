#!/usr/bin/env python3
"""
Trading Bot SaaS - Bot de operativa conectado al SaaS
======================================================

Bot que recibe señales desde el SaaS en lugar de Telegram directo.
Incluye:
- Autenticación con API key
- Recepción de señales desde API
- Heartbeat periódico
- Fallback a modo offline (YAML) si el SaaS no responde

Uso:
    python trading_bot_saas.py --api-key tb_xxx --saas-url https://tu-saas.com
    python trading_bot_saas.py --config copiador.yml  # Modo legacy
"""

from __future__ import annotations
import argparse
import asyncio
import json
import logging
import threading
import time
import sys
import os
from pathlib import Path
from typing import Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

import requests
import yaml
import MetaTrader5 as mt

# ───────────────────────── logging ────────────────────────────────
FMT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATEFMT = "%Y-%m-%d %H:%M:%S"

_root = logging.getLogger()
_root.setLevel(logging.INFO)

_hdlr = logging.StreamHandler()
_hdlr.setFormatter(logging.Formatter(FMT, DATEFMT))
_root.addHandler(_hdlr)

for noisy in ("urllib3", "requests"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

log = logging.getLogger("bot_saas")

# ───────────────────────── Config ─────────────────────────────────
@dataclass
class BotConfig:
    """Configuración del bot (desde SaaS o YAML)"""
    # Identificación
    tenant_id: str = ""
    api_key: str = ""
    saas_url: str = "http://localhost:3000"

    # Trading
    symbol: str = "XAUUSD"
    lot_size: float = 0.01
    max_levels: int = 3
    grid_distance: float = 10.0  # pips
    take_profit: float = 20.0    # pips

    # Trailing SL
    trailing_activate: Optional[float] = 30.0
    trailing_step: Optional[float] = 10.0
    trailing_back: Optional[float] = 20.0

    # Restricciones
    default_restriction: Optional[str] = None  # "RIESGO", "SIN_PROMEDIOS"

    # MT5
    mt5_login: int = 0
    mt5_password: str = ""
    mt5_server: str = ""
    mt5_path: str = ""
    magic: int = 20250224

    # Features
    has_trailing_sl: bool = True
    has_advanced_grid: bool = False

    # Modo
    is_saas_mode: bool = True


# ───────────────────────── SaaS Client ─────────────────────────────
class SaaSClient:
    """Cliente para comunicarse con el SaaS"""

    def __init__(self, config: BotConfig):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json"
        })
        self.base_url = config.saas_url.rstrip("/")
        self.last_auth = None
        self.is_authenticated = False

    def authenticate(self) -> tuple[bool, Optional[dict]]:
        """Autentica con el SaaS y obtiene configuración"""
        try:
            resp = self.session.post(
                f"{self.base_url}/api/bot/auth",
                json={"apiKey": self.config.api_key},
                timeout=10
            )

            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    self.is_authenticated = True
                    self.last_auth = datetime.now()
                    log.info(f"✅ Autenticado con SaaS. Tenant: {data.get('tenantId', 'unknown')}")
                    return True, data.get("config", {})
                else:
                    log.error(f"❌ Error de autenticación: {data.get('error')}")
                    return False, None
            else:
                log.error(f"❌ Error HTTP {resp.status_code}")
                return False, None

        except Exception as e:
            log.error(f"❌ Error conectando al SaaS: {e}")
            return False, None

    def get_signals(self, since: Optional[str] = None) -> list[dict]:
        """Obtiene señales pendientes del SaaS"""
        try:
            url = f"{self.base_url}/api/bot/signals"
            if since:
                url += f"?since={since}"

            resp = self.session.get(url, timeout=10)

            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    signals = data.get("signals", [])
                    if signals:
                        log.info(f"📩 Recibidas {len(signals)} señales pendientes")
                    return signals
            return []

        except Exception as e:
            log.error(f"Error obteniendo señales: {e}")
            return []

    def mark_signal(self, delivery_id: str, status: str, error: Optional[str] = None) -> bool:
        """Marca una señal como ejecutada o fallida"""
        try:
            resp = self.session.post(
                f"{self.base_url}/api/bot/signals",
                json={"deliveryId": delivery_id, "status": status, "error": error},
                timeout=10
            )
            return resp.status_code == 200
        except Exception as e:
            log.error(f"Error marcando señal: {e}")
            return False

    def send_heartbeat(self, data: dict) -> Optional[dict]:
        """Envía heartbeat al SaaS"""
        try:
            resp = self.session.post(
                f"{self.base_url}/api/bot/heartbeat",
                json=data,
                timeout=10
            )

            if resp.status_code == 200:
                result = resp.json()
                if result.get("success"):
                    return result
            return None

        except Exception as e:
            log.error(f"Error enviando heartbeat: {e}")
            return None

    def get_config(self) -> Optional[dict]:
        """Obtiene la configuración actualizada del SaaS"""
        try:
            resp = self.session.get(
                f"{self.base_url}/api/bot/config",
                timeout=10
            )

            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    return data.get("config")
            return None

        except Exception as e:
            log.error(f"Error obteniendo config: {e}")
            return None


# ───────────────────────── AccountBot ─────────────────────────────
class AccountBot:
    """Gestor de una única cuenta MT5 (grid infinita sin duplicados)."""

    mt_lock = threading.RLock()
    DIST_PIP = 0.10  # 1 pip ≈ 0.10 USD (XAU/USD típico)

    def __init__(self, config: BotConfig, saas_client: Optional[SaaSClient] = None):
        self.config = config
        self.saas = saas_client

        # Credenciales MT5
        self.login = config.mt5_login
        self.password = config.mt5_password
        self.server = config.mt5_server
        self.path = config.mt5_path
        self.SYMBOL = config.symbol
        self.MAGIC = config.magic

        # Parámetros desde config
        self.lot_size = config.lot_size
        self.max_levels = config.max_levels
        self.grid_distance = config.grid_distance * self.DIST_PIP
        self.take_profit = config.take_profit * self.DIST_PIP

        # Geometría grilla
        self.HALF_GRID = self.grid_distance / 2
        self.EPS = 1e-6

        # Estado persistente
        self.state_file = Path(f"state_{self.login}.json")
        self.state = {
            "side": None,
            "entry": None,
            "entry_open": False,
            "entry_sl": None,
            "pending_levels": [],
            "restriction": None,
        }
        self._load_state()

        # Logger por cuenta
        Path("logs").mkdir(exist_ok=True)
        self.log = logging.getLogger(f"bot.{self.login}")
        self.log.setLevel(logging.DEBUG)
        fh = logging.FileHandler(f"logs/bot_{self.login}.log", encoding="utf-8")
        fh.setFormatter(logging.Formatter(FMT, DATEFMT))
        self.log.addHandler(fh)

        self._mt5_ready = False
        self.is_closing = False

        # Métricas para heartbeat
        self.total_trades = 0
        self.total_profit = 0.0

    def _load_state(self) -> None:
        if self.state_file.exists():
            try:
                data = json.loads(self.state_file.read_text())
                if isinstance(data.get("pending_levels"), list):
                    if data["pending_levels"] and isinstance(data["pending_levels"][0], int):
                        data["pending_levels"] = list(set(data["pending_levels"]))
                self.state.update(data)
            except Exception as e:
                self.log.error("state corrupt → reset (%s)", e)

    def _save_state(self) -> None:
        self.state_file.write_text(json.dumps(self.state, ensure_ascii=False))

    def update_config(self, config_dict: dict) -> None:
        """Actualiza los parámetros de trading desde el SaaS"""
        updated = []

        if "lotSize" in config_dict and config_dict["lotSize"] != self.lot_size:
            self.lot_size = config_dict["lotSize"]
            self.config.lot_size = self.lot_size
            updated.append(f"lot={self.lot_size}")

        if "maxLevels" in config_dict and config_dict["maxLevels"] != self.max_levels:
            self.max_levels = config_dict["maxLevels"]
            self.config.max_levels = self.max_levels
            updated.append(f"levels={self.max_levels}")

        if "gridDistance" in config_dict:
            new_dist = config_dict["gridDistance"] * self.DIST_PIP
            if new_dist != self.grid_distance:
                self.grid_distance = new_dist
                self.HALF_GRID = self.grid_distance / 2
                self.config.grid_distance = config_dict["gridDistance"]
                updated.append(f"grid={config_dict['gridDistance']}")

        if "takeProfit" in config_dict:
            new_tp = config_dict["takeProfit"] * self.DIST_PIP
            if new_tp != self.take_profit:
                self.take_profit = new_tp
                self.config.take_profit = config_dict["takeProfit"]
                updated.append(f"TP={config_dict['takeProfit']}")

        if "trailingActivate" in config_dict:
            self.config.trailing_activate = config_dict["trailingActivate"]
            updated.append(f"trail_act={config_dict['trailingActivate']}")

        if "trailingStep" in config_dict:
            self.config.trailing_step = config_dict["trailingStep"]
            updated.append(f"trail_step={config_dict['trailingStep']}")

        if "trailingBack" in config_dict:
            self.config.trailing_back = config_dict["trailingBack"]
            updated.append(f"trail_back={config_dict['trailingBack']}")

        if updated:
            self.log.info(f"📋 Config actualizada desde SaaS: {', '.join(updated)}")

    def _mt5(self) -> bool:
        if self._mt5_ready and mt.terminal_info():
            return True
        ok = mt.initialize(
            login=self.login,
            password=self.password,
            server=self.server,
            path=self.path
        )
        self._mt5_ready = bool(ok)
        return self._mt5_ready

    def _price(self, side: str, retry: int = 30) -> Optional[float]:
        with AccountBot.mt_lock:
            if not self._mt5():
                self.log.error("MT5 init error: %s", mt.last_error())
                return None
            for _ in range(retry):
                mt.symbol_select(self.SYMBOL, True)
                t = mt.symbol_info_tick(self.SYMBOL)
                if t and t.bid and t.ask:
                    return t.ask if side == "BUY" else t.bid
                time.sleep(0.5)
        return None

    def send(self, side: str, lot: float, n: int = 1, *, set_entry=False) -> bool:
        px = self._price(side)
        if px is None:
            return False
        base = {
            "action": mt.TRADE_ACTION_DEAL,
            "symbol": self.SYMBOL,
            "volume": lot,
            "type": mt.ORDER_TYPE_BUY if side == "BUY" else mt.ORDER_TYPE_SELL,
            "price": px,
            "deviation": 100,
            "magic": self.MAGIC,
            "comment": "saas_bot",
            "type_time": mt.ORDER_TIME_GTC,
            "type_filling": getattr(mt, "ORDER_FILLING_IOC", 1),
        }
        success = False
        with AccountBot.mt_lock:
            if not self._mt5():
                return False
            for i in range(n):
                r = mt.order_send(base)
                if r and r.retcode == 10009:
                    success = True
                    self.total_trades += 1
                    self.log.info("🚀 %s %.2f lot #%d @ %.5f", side, lot, i+1, r.price or px)
        if success and set_entry and self.state["entry"] is None:
            self.state["entry"] = px
            self._save_state()
        return success

    def _close_ticket(self, pos, side: str) -> None:
        op = mt.ORDER_TYPE_BUY if side == "SELL" else mt.ORDER_TYPE_SELL
        px = self._price("BUY" if op == mt.ORDER_TYPE_BUY else "SELL")
        if px is None:
            return
        req = {
            "action": mt.TRADE_ACTION_DEAL,
            "symbol": self.SYMBOL,
            "volume": pos.volume,
            "type": op,
            "price": px,
            "deviation": 100,
            "magic": self.MAGIC,
            "position": pos.ticket,
            "comment": "saas_close",
            "type_time": mt.ORDER_TIME_GTC,
            "type_filling": getattr(mt, "ORDER_FILLING_IOC", 1),
        }
        with AccountBot.mt_lock:
            if self._mt5():
                result = mt.order_send(req)
                if result and result.retcode == 10009:
                    # Calcular profit aproximado
                    if side == "BUY":
                        profit = (result.price - pos.price_open) * pos.volume * 100
                    else:
                        profit = (pos.price_open - result.price) * pos.volume * 100
                    self.total_profit += profit

    def close_all(self):
        self.is_closing = True
        with AccountBot.mt_lock:
            if self._mt5():
                while True:
                    poss = mt.positions_get(symbol=self.SYMBOL) or []
                    if not poss:
                        break
                    for pos in poss:
                        side = "BUY" if pos.type == 0 else "SELL"
                        self._close_ticket(pos, side)
        self.log.info("🛑 posiciones cerradas (login %s)", self.login)
        self.state.update({
            "side": None, "entry": None, "entry_open": False,
            "entry_sl": None, "pending_levels": [], "restriction": None
        })
        self._save_state()
        self.is_closing = False

    def handle_signal(self, signal: dict) -> bool:
        """Procesa una señal recibida del SaaS"""
        signal_type = signal.get("type", "ENTRY")

        if signal_type == "CLOSE_RANGE":
            log.info(f"🔴 Señal CLOSE_RANGE recibida")
            self.close_all()
            if self.saas and signal.get("deliveryId"):
                self.saas.mark_signal(signal["deliveryId"], "EXECUTED")
            return True

        if signal_type == "ENTRY":
            side = signal.get("side", "").upper()
            if side not in ("BUY", "SELL"):
                log.warning(f"Señal inválida: side={side}")
                return False

            restriction = signal.get("restriction") or self.config.default_restriction

            log.info(f"🟢 Señal {side} recibida. Restriction: {restriction}")

            # Reset state
            self.state.update({
                "side": side,
                "entry": None,
                "entry_open": False,
                "entry_sl": None,
                "pending_levels": [],
                "restriction": restriction,
            })
            self._save_state()

            # Abrir posición base
            if self.send(side, self.lot_size, 1, set_entry=True):
                self.state["entry_open"] = True
                self._save_state()

                if self.saas and signal.get("deliveryId"):
                    self.saas.mark_signal(signal["deliveryId"], "EXECUTED")
                return True
            else:
                if self.saas and signal.get("deliveryId"):
                    self.saas.mark_signal(signal["deliveryId"], "FAILED", "Error abriendo posición")
                return False

        return False

    def _entry_trailing(self, p_close: float):
        if not self.config.has_trailing_sl:
            return
        if not self.state["entry_open"]:
            return

        side = self.state["side"]
        entry = self.state["entry"]

        activate = (self.config.trailing_activate or 30) * self.DIST_PIP
        back = (self.config.trailing_back or 20) * self.DIST_PIP
        step = (self.config.trailing_step or 10) * self.DIST_PIP

        if side == "BUY":
            if p_close >= entry + activate:
                tgt = p_close - back
                cur = self.state.get("entry_sl")
                if cur is None or tgt - cur >= step - self.EPS:
                    self.state["entry_sl"] = tgt
                    self.log.info(f"🔒 SL virtual actualizado: {tgt:.2f}")
        else:
            if p_close <= entry - activate:
                tgt = p_close + back
                cur = self.state.get("entry_sl")
                if cur is None or cur - tgt >= step - self.EPS:
                    self.state["entry_sl"] = tgt
                    self.log.info(f"🔒 SL virtual actualizado: {tgt:.2f}")
        self._save_state()

    def _check_entry_sl_hit(self, p_close: float, niveles: dict[int, list]):
        sl = self.state.get("entry_sl")
        if sl is None:
            return
        side = self.state["side"]
        if (p_close <= sl and side == "BUY") or (p_close >= sl and side == "SELL"):
            for pos in niveles.get(0, []):
                self._close_ticket(pos, side)
            if niveles.get(0):
                self.log.info("🔒 SL virtual L0 ejecutado")
            niveles.pop(0, None)
            self.state.update({"entry_open": False, "entry_sl": None})
            self._save_state()

    def manage_grid(self):
        if self.is_closing or not self.state["side"]:
            return
        side, p0 = self.state["side"], self.state["entry"]
        if not p0:
            return

        with AccountBot.mt_lock:
            if not self._mt5():
                return
            tick = mt.symbol_info_tick(self.SYMBOL)
        if not tick or not tick.bid or not tick.ask:
            return
        p_close = tick.bid if side == "BUY" else tick.ask

        # Trailing SL
        self._entry_trailing(p_close)

        # Posiciones vivas agrupadas por nivel
        niveles: dict[int, list] = {}
        with AccountBot.mt_lock:
            poss = mt.positions_get(symbol=self.SYMBOL) or []
        for pos in poss:
            if pos.magic != self.MAGIC:
                continue
            diff = abs(pos.price_open - p0)
            lvl = int((diff + self.HALF_GRID) // self.grid_distance)
            niveles.setdefault(lvl, []).append(pos)

        # Revisar SL virtual
        self._check_entry_sl_hit(p_close, niveles)

        # Restricciones
        restriction = self.state.get("restriction")
        effective_max_levels = self.max_levels
        if restriction == "SIN_PROMEDIOS":
            effective_max_levels = 0
        elif restriction == "RIESGO":
            effective_max_levels = min(1, self.max_levels)

        # Cierre escalones (profit)
        for lvl in list(niveles):
            if lvl == 0:
                continue
            lst = niveles[lvl]
            gain = (p_close - lst[0].price_open) if side == "BUY" else (lst[0].price_open - p_close)
            if gain >= self.grid_distance - self.EPS:
                for pos in lst:
                    self._close_ticket(pos, side)
                niveles.pop(lvl, None)
                if lvl in self.state["pending_levels"]:
                    self.state["pending_levels"].remove(lvl)
                self.log.info("💰 Escalón %d cerrado", lvl)

        # Apertura nuevos escalones
        against = (p0 - p_close) if side == "BUY" else (p_close - p0)
        if against >= self.grid_distance - self.EPS and effective_max_levels > 0:
            deepest = int((against + self.HALF_GRID) // self.grid_distance)

            vivos_por_nivel = {lv: len(lst) for lv, lst in niveles.items() if lv >= 1}
            p_pending: set[int] = set(self.state["pending_levels"])

            free_global = (effective_max_levels - sum(vivos_por_nivel.values()) - len(p_pending))

            for lvl in range(1, min(deepest + 1, effective_max_levels + 1)):
                vivos = vivos_por_nivel.get(lvl, 0)
                en_cola = 1 if lvl in p_pending else 0
                dispo = 1 - vivos - en_cola
                if dispo <= 0 or free_global <= 0:
                    continue
                if self.send(side, self.lot_size, 1):
                    p_pending.add(lvl)
                    free_global -= 1

            self.state["pending_levels"] = sorted(p_pending)
        self._save_state()

    def get_heartbeat_data(self) -> dict:
        """Obtiene datos para el heartbeat"""
        with AccountBot.mt_lock:
            mt5_ok = self._mt5() and mt.terminal_info() is not None
            poss = mt.positions_get(symbol=self.SYMBOL) if mt5_ok else []
            positions = [p for p in (poss or []) if p.magic == self.MAGIC]

        return {
            "status": "RUNNING" if not self.is_closing else "STOPPING",
            "mt5Connected": mt5_ok,
            "openPositions": len(positions),
            "currentLevel": max([0] + [int((abs(p.price_open - (self.state["entry"] or 0)) + self.HALF_GRID) // self.grid_distance) for p in positions]),
            "currentSide": self.state["side"],
            "totalTrades": self.total_trades,
            "totalProfit": round(self.total_profit, 2),
            "version": "1.0.0-saas",
            "platform": sys.platform,
        }


# ───────────────────────── Main Loop ──────────────────────────────
async def main_loop(config: BotConfig):
    """Loop principal del bot"""
    bot: Optional[AccountBot] = None
    saas: Optional[SaaSClient] = None

    if config.is_saas_mode and config.api_key:
        saas = SaaSClient(config)
        success, remote_config = saas.authenticate()
        if success and remote_config:
            # Actualizar config con valores del SaaS
            config.lot_size = remote_config.get("lotSize", config.lot_size)
            config.max_levels = remote_config.get("maxLevels", config.max_levels)
            config.grid_distance = remote_config.get("gridDistance", config.grid_distance)
            config.take_profit = remote_config.get("takeProfit", config.take_profit)
            config.trailing_activate = remote_config.get("trailingActivate")
            config.trailing_step = remote_config.get("trailingStep")
            config.trailing_back = remote_config.get("trailingBack")
            config.has_trailing_sl = remote_config.get("hasTrailingSL", True)
            log.info(f"📋 Configuración cargada desde SaaS: lot={config.lot_size}, levels={config.max_levels}")
    else:
        log.info("📋 Usando configuración local (modo legacy)")

    # Crear bot
    bot = AccountBot(config, saas)

    last_signal_check = 0
    last_heartbeat = 0
    last_config_refresh = 0
    SIGNAL_INTERVAL = 2  # segundos entre chequeos de señales
    HEARTBEAT_INTERVAL = 30  # segundos entre heartbeats
    CONFIG_REFRESH_INTERVAL = 60  # segundos entre refresco de config

    log.info("🤖 Bot iniciado. Esperando señales...")

    while True:
        try:
            now = time.time()

            # Chequear señales
            if saas and (now - last_signal_check) >= SIGNAL_INTERVAL:
                signals = saas.get_signals()
                for signal in signals:
                    try:
                        bot.handle_signal(signal)
                    except Exception as e:
                        log.error(f"Error procesando señal: {e}")
                last_signal_check = now

            # Gestionar grid
            bot.manage_grid()

            # Enviar heartbeat
            if saas and (now - last_heartbeat) >= HEARTBEAT_INTERVAL:
                heartbeat_data = bot.get_heartbeat_data()
                result = saas.send_heartbeat(heartbeat_data)
                if result:
                    log.debug("💚 Heartbeat enviado OK")
                last_heartbeat = now

            # Refrescar configuración desde SaaS
            if saas and (now - last_config_refresh) >= CONFIG_REFRESH_INTERVAL:
                remote_config = saas.get_config()
                if remote_config:
                    bot.update_config(remote_config)
                last_config_refresh = now

            await asyncio.sleep(0.5)

        except KeyboardInterrupt:
            log.info("⏹️ Deteniendo bot...")
            break
        except Exception as e:
            log.error(f"Error en loop principal: {e}")
            await asyncio.sleep(5)


# ───────────────────────── Config Loading ─────────────────────────
def load_config_from_yaml(yaml_path: str) -> BotConfig:
    """Carga configuración desde YAML (modo legacy)"""
    with open(yaml_path, "r", encoding="utf-8-sig") as f:
        cfg = yaml.safe_load(f)

    accounts = cfg.get("accounts", [])
    if not accounts:
        raise ValueError("No hay cuentas definidas en el YAML")

    # Usar primera cuenta
    acc = accounts[0]
    entry = acc.get("entry", {})
    prom = acc.get("promedios", {})

    config = BotConfig()
    config.is_saas_mode = False

    # MT5
    config.mt5_login = acc.get("login", 0)
    config.mt5_password = acc.get("password", "")
    config.mt5_server = acc.get("server", "")
    config.mt5_path = acc.get("path", "")
    config.symbol = acc.get("symbol", "XAUUSD")
    config.magic = acc.get("magic", 20250224)

    # Trading
    config.lot_size = entry.get("lot", 0.01)
    config.max_levels = prom.get("max", 3)
    config.grid_distance = prom.get("step_pips", 10.0)

    # Trailing
    trailing = entry.get("trailing", {})
    config.trailing_activate = trailing.get("activate")
    config.trailing_step = trailing.get("step")
    config.trailing_back = trailing.get("back", 20)

    return config


def load_config_from_args(args) -> BotConfig:
    """Carga configuración desde argumentos"""
    config = BotConfig()
    config.api_key = args.api_key
    config.saas_url = args.saas_url
    config.is_saas_mode = True

    # MT5 desde args o env
    config.mt5_login = args.mt5_login or int(os.environ.get("MT5_LOGIN", 0))
    config.mt5_password = args.mt5_password or os.environ.get("MT5_PASSWORD", "")
    config.mt5_server = args.mt5_server or os.environ.get("MT5_SERVER", "")
    config.mt5_path = args.mt5_path or os.environ.get("MT5_PATH", "")
    config.symbol = args.symbol or "XAUUSD"

    return config


# ───────────────────────── Entry Point ────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Trading Bot SaaS")

    # Modo SaaS
    parser.add_argument("--api-key", help="API key del SaaS")
    parser.add_argument("--saas-url", default="http://localhost:3000", help="URL del SaaS")

    # Modo legacy
    parser.add_argument("--config", help="Archivo YAML de configuración (modo legacy)")

    # MT5 (sobrescribir)
    parser.add_argument("--mt5-login", type=int, help="Login MT5")
    parser.add_argument("--mt5-password", help="Password MT5")
    parser.add_argument("--mt5-server", help="Servidor MT5")
    parser.add_argument("--mt5-path", help="Ruta a MT5")
    parser.add_argument("--symbol", default="XAUUSD", help="Símbolo a operar")

    args = parser.parse_args()

    # Cargar configuración
    if args.config:
        log.info(f"📋 Cargando configuración desde {args.config}")
        config = load_config_from_yaml(args.config)
    elif args.api_key:
        log.info("🔌 Modo SaaS activado")
        config = load_config_from_args(args)
    else:
        log.error("❌ Debes especificar --api-key o --config")
        sys.exit(1)

    # Validar MT5
    if not config.mt5_login or not config.mt5_password or not config.mt5_server:
        log.error("❌ Faltan credenciales MT5 (login, password, server)")
        sys.exit(1)

    # Ejecutar
    try:
        asyncio.run(main_loop(config))
    except KeyboardInterrupt:
        log.info("👋 Bot detenido")
