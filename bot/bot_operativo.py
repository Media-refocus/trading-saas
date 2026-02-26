#!/usr/bin/env python3
"""
bot_operativo.py – Bot de trading con integración SaaS

Diferencias con la versión original:
- Configuración obtenida del SaaS (no de YAML local)
- Envía heartbeats cada 30s al SaaS
- Reporta señales y trades en tiempo real
- Recibe comandos del dashboard (PAUSE, RESUME, CLOSE_ALL)

Uso:
    python bot_operativo.py --api-key tb_xxx --saas-url https://tu-saas.com

O con variables de entorno:
    TRADING_BOT_API_KEY=tb_xxx
    TRADING_BOT_SAAS_URL=https://tu-saas.com
    python bot_operativo.py
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import sys
import threading
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import MetaTrader5 as mt
from telethon import TelegramClient, events
from telethon.tl.types import InputChannel

from saas_client import SaasClient, BotConfig, BotCommand
from telegram_bot import TelegramBot, create_telegram_bot_from_config

# ───────────────────────── logging ────────────────────────────────
FMT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATEFMT = "%Y-%m-%d %H:%M:%S"

_root = logging.getLogger()
_root.setLevel(logging.INFO)

_hdlr = logging.StreamHandler()
_hdlr.setFormatter(logging.Formatter(FMT, DATEFMT))
_root.addHandler(_hdlr)

for noisy in ("telethon", "asyncio", "urllib3"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

log = logging.getLogger("bot")
# ------------------------------------------------------------------


def strip_accents(txt: str) -> str:
    """Convierte 'cérramos' → 'cerramos' para no romper regex."""
    return "".join(
        c for c in unicodedata.normalize("NFD", txt)
        if unicodedata.category(c) != "Mn"
    )


# ───────────────────────── AccountBot ─────────────────────────────
class AccountBot:
    """Gestor de una única cuenta MT5 (grid infinita sin duplicados)."""

    mt_lock = threading.RLock()
    DIST_PIP = 0.10  # 1 pip ≈ 0.10 USD (XAU/USD típico)

    # Telegram bot para notificaciones (compartido entre instancias)
    telegram_bot: Optional[TelegramBot] = None

    def __init__(
        self,
        account_config: dict,
        bot_config: BotConfig,
        saas_client: SaasClient,
    ):
        # ── credenciales (descifradas) ─────────────────────────────
        self.account_id = account_config["id"]
        self.login = int(account_config["login"])
        self.password = account_config["password"]
        self.server = account_config["server"]
        self.path = account_config.get("path")
        self.SYMBOL = account_config.get("symbol", bot_config.symbol)
        self.MAGIC = account_config.get("magic", bot_config.magic_number)

        # ── referencia a config global y SaaS ──────────────────────
        self.bot_config = bot_config
        self.saas = saas_client

        # ── parámetros desde bot_config ───────────────────────────
        self.entry_lot = bot_config.entry_lot
        self.entry_num_orders = bot_config.entry_num_orders
        self.entry_trailing = bot_config.entry_trailing

        self.GRID_DIST = bot_config.grid_step_pips * self.DIST_PIP
        self.HALF_GRID = self.GRID_DIST / 2
        self.grid_lot = bot_config.grid_lot
        self.grid_max_levels = bot_config.grid_max_levels
        self.grid_num_orders = bot_config.grid_num_orders
        self.EPS = 1e-6

        # ── restricciones ─────────────────────────────────────────
        self.restriction_type = bot_config.restriction_type
        self.max_levels = bot_config.max_levels

        # ── estado persistente ────────────────────────────────────
        self.state_file = Path(f"state_{self.login}.json")
        self.state = {
            "side": None,  # BUY / SELL
            "entry": None,  # precio nivel 0
            "entry_open": False,
            "entry_sl": None,  # trailing-SL virtual
            "pending_levels": [],  # niveles con orden en curso
            "current_signal_id": None,  # señal activa del SaaS
        }
        self._load_state()
        self._sanitize_pending()

        # ── logger por cuenta ─────────────────────────────────────
        Path("logs").mkdir(exist_ok=True)
        self.log = logging.getLogger(f"bot.{self.login}")
        self.log.setLevel(logging.DEBUG)
        fh = logging.FileHandler(f"logs/bot_{self.login}.log", encoding="utf-8")
        fh.setFormatter(logging.Formatter(FMT, DATEFMT))
        self.log.addHandler(fh)

        self._mt5_ready = False  # cache de inicialización

        # ── trades abiertos para reportar al SaaS ─────────────────
        self._open_trades: dict[int, str] = {}  # mt5_ticket -> trade_id

    # ===== estado =====
    def _load_state(self) -> None:
        if self.state_file.exists():
            try:
                data = json.loads(self.state_file.read_text())
                if isinstance(data.get("pending_levels"), list):
                    if data["pending_levels"] and isinstance(
                        data["pending_levels"][0], int
                    ):
                        data["pending_levels"] = list(set(data["pending_levels"]))
                self.state.update(data)
            except Exception as e:
                self.log.error("state corrupt → reset (%s)", e)

    def _save_state(self) -> None:
        self.state_file.write_text(json.dumps(self.state, ensure_ascii=False))

    # ===== MetaTrader conexión =====
    def _mt5(self) -> bool:
        if self._mt5_ready and mt.terminal_info():
            return True

        ok = mt.initialize(
            login=self.login,
            password=self.password,
            server=self.server,
            path=self.path,
        )
        self._mt5_ready = bool(ok)

        if not ok:
            error = mt.last_error()
            self.log.error("MT5 init error: %s", error)
            self.saas.report_error(
                error_type="MT5_ERROR",
                message=f"MT5 initialization failed: {error}",
                is_fatal=False,
            )

        return self._mt5_ready

    # ===== precio / enviar / cerrar =====
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

    def send(
        self, side: str, lot: float, n: int = 1, *, set_entry=False, level=0
    ) -> bool:
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
            "comment": f"saas_L{level}",
            "type_time": mt.ORDER_TIME_GTC,
            "type_filling": getattr(mt, "ORDER_FILLING_IOC", 1),
        }

        success = False
        mt5_ticket = None

        with AccountBot.mt_lock:
            if not self._mt5():
                return False

            for i in range(n):
                r = mt.order_send(base)
                if r and r.retcode == 10009:
                    success = True
                    mt5_ticket = r.order
                    self.log.info(
                        "🚀 %s %.2f lot #%d L%d @ %.5f",
                        side,
                        lot,
                        mt5_ticket,
                        level,
                        r.price or px,
                    )

        if success and set_entry and self.state["entry"] is None:
            self.state["entry"] = px
            self._save_state()

        # Reportar al SaaS
        if success and mt5_ticket:
            trade_id = self.saas.report_trade_open(
                bot_account_id=self.account_id,
                mt5_ticket=mt5_ticket,
                side=side,
                symbol=self.SYMBOL,
                level=level,
                open_price=r.price if r and r.price else px,
                lot_size=lot,
                signal_id=self.state.get("current_signal_id"),
            )
            if trade_id:
                self._open_trades[mt5_ticket] = trade_id

            # Notificar por Telegram
            if AccountBot.telegram_bot:
                try:
                    asyncio.run_coroutine_threadsafe(
                        AccountBot.telegram_bot.notify_trade_open(
                            symbol=self.SYMBOL,
                            side=side,
                            price=r.price if r and r.price else px,
                            lot=lot,
                            level=level,
                            ticket=mt5_ticket,
                        ),
                        asyncio.get_event_loop(),
                    )
                except Exception as e:
                    self.log.warning(f"Error notificando por Telegram: {e}")

        return success

    def _close_ticket(self, pos, side: str, reason: str = "MANUAL") -> None:
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
            "comment": f"saas_close_{reason}",
            "type_time": mt.ORDER_TIME_GTC,
            "type_filling": getattr(mt, "ORDER_FILLING_IOC", 1),
        }

        with AccountBot.mt_lock:
            if self._mt5():
                result = mt.order_send(req)

                # Calcular profit
                if result and result.retcode == 10009:
                    profit_pips = 0.0
                    profit_money = 0.0

                    if side == "BUY":
                        profit_pips = (result.price - pos.price_open) / self.DIST_PIP
                    else:
                        profit_pips = (pos.price_open - result.price) / self.DIST_PIP

                    # Reportar al SaaS
                    if pos.ticket in self._open_trades:
                        self.saas.report_trade_close(
                            bot_account_id=self.account_id,
                            mt5_ticket=pos.ticket,
                            close_price=result.price,
                            close_reason=reason,
                            profit_pips=profit_pips,
                            profit_money=profit_money,
                        )
                        del self._open_trades[pos.ticket]

                    # Notificar por Telegram
                    if AccountBot.telegram_bot:
                        try:
                            asyncio.run_coroutine_threadsafe(
                                AccountBot.telegram_bot.notify_trade_close(
                                    symbol=self.SYMBOL,
                                    side=side,
                                    close_price=result.price,
                                    profit=profit_money,
                                    pips=profit_pips,
                                    reason=reason,
                                    ticket=pos.ticket,
                                ),
                                asyncio.get_event_loop(),
                            )
                        except Exception as e:
                            self.log.warning(f"Error notificando cierre por Telegram: {e}")

    # ===== sanitizar pendientes al arrancar =====
    def _sanitize_pending(self) -> None:
        if not self.state["pending_levels"]:
            return
        with AccountBot.mt_lock:
            if not self._mt5():
                return
            poss = mt.positions_get(symbol=self.SYMBOL) or []
            orders = mt.orders_get(symbol=self.SYMBOL) or []
        p0 = self.state["entry"] or 0
        vivos = {
            int((abs(p.price_open - p0) + self.HALF_GRID) // self.GRID_DIST)
            for p in poss
            if p.magic == self.MAGIC
        }
        en_mercado = {
            int((abs(o.price_open - p0) + self.HALF_GRID) // self.GRID_DIST)
            for o in orders
            if o.magic == self.MAGIC
        }
        self.state["pending_levels"] = [
            lv
            for lv in self.state["pending_levels"]
            if lv in vivos or lv in en_mercado
        ]
        self._save_state()

    # ===== CLOSE ALL =====
    def close_all(self, reason: str = "MANUAL"):
        self.is_closing = True
        with AccountBot.mt_lock:
            if self._mt5():
                while True:
                    poss = mt.positions_get(symbol=self.SYMBOL) or []
                    if not poss:
                        break
                    for pos in poss:
                        side = "BUY" if pos.type == 0 else "SELL"
                        self._close_ticket(pos, side, reason)
        self.log.info("🛑 posiciones cerradas (login %s)", self.login)
        self.state.update(
            {
                "side": None,
                "entry": None,
                "entry_open": False,
                "entry_sl": None,
                "pending_levels": [],
                "current_signal_id": None,
            }
        )
        self._save_state()
        self.is_closing = False

    # ===== trailing-SL virtual =====
    def _entry_trailing(self, p_close: float):
        if not self.entry_trailing or not self.state["entry_open"]:
            return

        side = self.state["side"]
        entry = self.state["entry"]

        spread = (mt.symbol_info(self.SYMBOL).spread or 0) * self.DIST_PIP
        buffer = self.entry_trailing.get("buffer", 1) * self.DIST_PIP + spread

        activate = self.entry_trailing.get("activate", 30) * self.DIST_PIP
        back = self.entry_trailing.get("back", 20) * self.DIST_PIP
        step = self.entry_trailing.get("step", 10) * self.DIST_PIP

        if side == "BUY":
            if p_close >= entry + activate:
                tgt = p_close - back
                cur = self.state.get("entry_sl")
                if cur is None or tgt - cur >= step - self.EPS:
                    self.state["entry_sl"] = tgt - buffer
        else:
            if p_close <= entry - activate:
                tgt = p_close + back
                cur = self.state.get("entry_sl")
                if cur is None or cur - tgt >= step - self.EPS:
                    self.state["entry_sl"] = tgt + buffer
        self._save_state()

    def _check_entry_sl_hit(self, p_close: float, niveles: dict[int, list]):
        sl = self.state.get("entry_sl")
        if sl is None:
            return
        side = self.state["side"]
        if (p_close <= sl and side == "BUY") or (p_close >= sl and side == "SELL"):
            for pos in niveles.get(0, []):
                self._close_ticket(pos, side, "VIRTUAL_SL")
            if niveles.get(0):
                self.log.info("🔒 SL virtual L0 ejecutado (login %s)", self.login)
            niveles.pop(0, None)
            self.state.update({"entry_open": False, "entry_sl": None})
            self._save_state()

    # ===== manage grid =====
    def manage_grid(self):
        if getattr(self, "is_closing", False) or not self.state["side"]:
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

        # trailing-SL
        self._entry_trailing(p_close)

        # ─ posiciones vivas agrupadas por nivel ────────────────────────
        niveles: dict[int, list] = {}
        with AccountBot.mt_lock:
            poss = mt.positions_get(symbol=self.SYMBOL) or []
        for pos in poss:
            if pos.magic != self.MAGIC:
                continue
            diff = abs(pos.price_open - p0)
            lvl = int((diff + self.HALF_GRID) // self.GRID_DIST)
            niveles.setdefault(lvl, []).append(pos)

        # revisar SL virtual
        self._check_entry_sl_hit(p_close, niveles)

        # ─ cierre escalones (profit) ──────────────────────────────────
        for lvl in list(niveles):
            if lvl == 0:
                continue
            lst = niveles[lvl]
            gain = (
                (p_close - lst[0].price_open)
                if side == "BUY"
                else (lst[0].price_open - p_close)
            )
            if gain >= self.GRID_DIST - self.EPS:
                for pos in lst:
                    self._close_ticket(pos, side, "GRID_STEP")
                niveles.pop(lvl, None)
                if lvl in self.state["pending_levels"]:
                    self.state["pending_levels"].remove(lvl)
                self.log.info("💰 Escalón %d cerrado (login %s)", lvl, self.login)

        # ─ depurar pendientes vs MT5 ──────────────────────────────────
        p_pending: set[int] = set(self.state["pending_levels"])
        for lv in list(p_pending):
            if niveles.get(lv):
                p_pending.discard(lv)

        with AccountBot.mt_lock:
            orders = mt.orders_get(symbol=self.SYMBOL) or []
        live_ord_lv = {
            int((abs(o.price_open - p0) + self.HALF_GRID) // self.GRID_DIST)
            for o in orders
            if o.magic == self.MAGIC
        }
        for lv in list(p_pending):
            if lv not in live_ord_lv and lv not in niveles:
                p_pending.discard(lv)

        # ─ apertura nuevos escalones ─────────────────────────────────
        against = (p0 - p_close) if side == "BUY" else (p_close - p0)
        if against >= self.GRID_DIST - self.EPS:
            deepest = int((against + self.HALF_GRID) // self.GRID_DIST)

            vivos_por_nivel = {
                lv: len(lst) for lv, lst in niveles.items() if lv >= 1
            }
            free_global = (
                self.grid_max_levels
                - sum(vivos_por_nivel.values())
                - len(p_pending)
            )

            for lvl in range(1, deepest + 1):
                max_lvl = self.grid_num_orders
                vivos = vivos_por_nivel.get(lvl, 0)
                en_cola = 1 if lvl in p_pending else 0
                dispo = max_lvl - vivos - en_cola
                if dispo <= 0 or free_global <= 0:
                    continue
                if self.send(side, self.grid_lot, 1, level=lvl):
                    p_pending.add(lvl)
                    free_global -= 1

        self.state["pending_levels"] = sorted(p_pending)
        self._save_state()

    # ===== handler señal BUY / SELL =====
    def handle_signal(self, side: str, signal_id: Optional[str] = None):
        self.state.update(
            {
                "side": side,
                "entry": None,
                "entry_open": False,
                "entry_sl": None,
                "pending_levels": [],
                "current_signal_id": signal_id,
            }
        )
        self._save_state()

        if self.send(
            side,
            self.entry_lot,
            self.entry_num_orders,
            set_entry=True,
            level=0,
        ):
            self.state["entry_open"] = True
            self._save_state()

    # ===== info para heartbeat =====
    def get_status(self) -> dict:
        """Retorna información de la cuenta para el heartbeat."""
        with AccountBot.mt_lock:
            if not self._mt5():
                return {
                    "login": self.login,
                    "server": self.server,
                    "connected": False,
                }

            info = mt.account_info()
            positions = mt.positions_get(symbol=self.SYMBOL) or []

            return {
                "login": self.login,
                "server": self.server,
                "connected": True,
                "balance": info.balance if info else 0,
                "equity": info.equity if info else 0,
                "margin": info.margin if info else 0,
                "openPositions": len([p for p in positions if p.magic == self.MAGIC]),
            }


# ──────────────────────── MAIN ─────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="Bot de trading con SaaS")
    parser.add_argument(
        "--api-key",
        default=os.environ.get("TRADING_BOT_API_KEY"),
        help="API key del SaaS (o variable TRADING_BOT_API_KEY)",
    )
    parser.add_argument(
        "--saas-url",
        default=os.environ.get("TRADING_BOT_SAAS_URL", "http://localhost:3000"),
        help="URL del SaaS (o variable TRADING_BOT_SAAS_URL)",
    )
    parser.add_argument(
        "--bot-version",
        default="1.0.0",
        help="Versión del bot",
    )
    return parser.parse_args()


async def main():
    args = parse_args()

    if not args.api_key:
        log.error("❌ API key requerida. Usa --api-key o TRADING_BOT_API_KEY")
        sys.exit(1)

    # ── Inicializar cliente SaaS ────────────────────────────────────
    saas = SaasClient(
        api_key=args.api_key,
        base_url=args.saas_url,
        bot_version=args.bot_version,
    )

    # ── Obtener configuración del SaaS ───────────────────────────────
    log.info("📡 Obteniendo configuración del SaaS...")
    try:
        config = saas.get_config()
    except Exception as e:
        log.error(f"❌ Error obteniendo config: {e}")
        sys.exit(1)

    log.info(f"✅ Config: {config.symbol}, {len(config.accounts)} cuentas")

    if not config.accounts:
        log.error("❌ No hay cuentas MT5 configuradas en el SaaS")
        sys.exit(1)

    # ── Crear bots por cuenta ────────────────────────────────────────
    bots: list[AccountBot] = []
    for acc in config.accounts:
        try:
            bot = AccountBot(acc, config, saas)
            bots.append(bot)
            log.info(f"✅ Cuenta {acc['login']} lista")
        except Exception as e:
            log.error(f"❌ Error creando bot para cuenta {acc.get('login')}: {e}")

    if not bots:
        log.error("❌ No se pudo inicializar ninguna cuenta")
        sys.exit(1)

    # ── Configurar Telegram si hay credenciales ──────────────────────
    client = None
    CHANNELS = []

    if config.telegram:
        tg = config.telegram
        API_ID = tg.get("apiId")
        API_HASH = tg.get("apiHash")
        SESSION = tg.get("session", "telegram_session")

        if API_ID and API_HASH:
            CHANNELS = [
                InputChannel(c["id"], c.get("access_hash", 0))
                if c.get("access_hash")
                else c["id"]
                for c in tg.get("channels", [])
            ]

            client = TelegramClient(SESSION, int(API_ID), API_HASH)

            log.info(f"📱 Telegram configurado: {len(CHANNELS)} canales")
        else:
            log.warning("⚠️ Telegram no configurado (faltan apiId/apiHash)")
    else:
        log.warning("⚠️ Telegram no configurado en el SaaS")

    # ── Configurar Bot de Telegram (notificaciones) ──────────────────
    tg_bot = None
    tg_config = {
        "telegramBotToken": os.environ.get("TELEGRAM_BOT_TOKEN"),
        "telegramChatId": os.environ.get("TELEGRAM_CHAT_ID"),
    }

    # También puede venir en config.json local
    config_file = Path(__file__).parent / "config.json"
    if config_file.exists():
        try:
            local_config = json.loads(config_file.read_text())
            tg_config["telegramBotToken"] = tg_config["telegramBotToken"] or local_config.get("telegramBotToken")
            tg_config["telegramChatId"] = tg_config["telegramChatId"] or local_config.get("telegramChatId")
        except:
            pass

    if tg_config["telegramBotToken"] and tg_config["telegramChatId"]:
        try:
            tg_bot = TelegramBot(
                token=tg_config["telegramBotToken"],
                chat_id=tg_config["telegramChatId"],
                saas_client=saas,
                on_pause=lambda: saas.set_paused(True, "Comando /pause"),
                on_resume=lambda: saas.set_paused(False, "Comando /resume"),
            )
            # Compartir con todos los AccountBot
            AccountBot.telegram_bot = tg_bot
            log.info("🤖 Telegram Bot configurado para notificaciones")
        except Exception as e:
            log.warning(f"⚠️ No se pudo configurar Telegram Bot: {e}")
    else:
        log.info("ℹ️ Telegram Bot no configurado (opcional)")

    # ── Patrones de señales ──────────────────────────────────────────
    BASE_PATTERN = "XAUUSD"  # Hardcoded por ahora
    SIG_RE = re.compile(
        rf"\b(BUY|SELL)\b\s+\d+(?:[.,]\d+)?\s+({BASE_PATTERN})(?:[-\w]*)",
        re.I,
    )
    CLOSE_RE = re.compile(r"cerramos[\W_]*rango", re.I | re.UNICODE)

    # ── Handlers de Telegram ────────────────────────────────────────
    if client:

        @client.on(events.NewMessage(chats=CHANNELS))
        async def on_message(ev):
            if saas.is_paused:
                return

            txt_raw = ev.message.message.strip()
            txt_norm = strip_accents(txt_raw.lower())

            # cierre total
            if CLOSE_RE.search(txt_norm):
                _root.info("📩 CERRAMOS RANGO → %s", txt_raw[:60])

                # Reportar al SaaS
                saas.report_signal(
                    side="BUY",  # No importa
                    symbol=config.symbol,
                    message_text=txt_raw,
                    is_close_signal=True,
                    channel_id=str(ev.chat_id),
                    message_id=str(ev.id),
                )

                for bot in bots:
                    await asyncio.get_event_loop().run_in_executor(
                        None, bot.close_all, "CLOSE_SIGNAL"
                    )
                return

            # señal BUY / SELL
            m = SIG_RE.search(txt_raw)
            if m:
                side = m.group(1).upper()
                _root.info("📩 Señal %s detectada (%s)", side, m.group(0))

                # Reportar al SaaS y obtener signal_id
                signal_id = saas.report_signal(
                    side=side,
                    symbol=config.symbol,
                    message_text=txt_raw,
                    channel_id=str(ev.chat_id),
                    message_id=str(ev.id),
                )

                for bot in bots:
                    await asyncio.get_event_loop().run_in_executor(
                        None, bot.handle_signal, side, signal_id
                    )

    # ── Loop de heartbeat ────────────────────────────────────────────
    start_time = time.time()

    async def heartbeat_loop():
        while True:
            try:
                # Recopilar estado de cuentas
                accounts_status = []
                total_positions = 0

                for bot in bots:
                    status = bot.get_status()
                    accounts_status.append(status)
                    total_positions += status.get("openPositions", 0)

                # Enviar heartbeat
                commands = saas.send_heartbeat(
                    mt5_connected=any(b.get_status().get("connected") for b in bots),
                    telegram_connected=client.is_connected() if client else False,
                    open_positions=total_positions,
                    pending_orders=0,
                    uptime_seconds=int(time.time() - start_time),
                    accounts=accounts_status,
                )

                # Procesar comandos
                for cmd in commands:
                    if cmd.type == "PAUSE":
                        saas.set_paused(True, cmd.reason or "Dashboard")
                    elif cmd.type == "RESUME":
                        saas.set_paused(False)
                    elif cmd.type == "CLOSE_ALL":
                        for bot in bots:
                            bot.close_all(cmd.reason or "Dashboard")
                    elif cmd.type == "UPDATE_CONFIG":
                        log.info("🔄 Actualizando configuración...")
                        try:
                            new_config = saas.get_config(force_refresh=True)
                            # TODO: Actualizar bots con nueva config
                        except Exception as e:
                            log.error(f"Error actualizando config: {e}")

            except Exception as e:
                log.error(f"Error en heartbeat: {e}")

            await asyncio.sleep(config.heartbeat_interval_seconds)

    # ── Loop de grid management ───────────────────────────────────────
    async def grid_loop():
        while True:
            if not saas.is_paused:
                for bot in bots:
                    await asyncio.get_event_loop().run_in_executor(
                        None, bot.manage_grid
                    )
            await asyncio.sleep(0.5)

    # ── Iniciar ──────────────────────────────────────────────────────
    log.info("🤖 Bot iniciado")
    log.info(f"   Cuentas: {len(bots)}")
    log.info(f"   Telegram: {'Sí' if client else 'No'}")
    log.info(f"   Telegram Bot: {'Sí' if tg_bot else 'No'}")
    log.info(f"   SaaS: {args.saas_url}")

    # Iniciar Telegram Bot en background para comandos
    if tg_bot:
        import threading
        def run_tg_bot():
            try:
                tg_bot.start()
            except Exception as e:
                log.error(f"Error en Telegram Bot: {e}")

        tg_thread = threading.Thread(target=run_tg_bot, daemon=True)
        tg_thread.start()
        log.info("🤖 Telegram Bot escuchando comandos...")

        # Notificar inicio
        await tg_bot.send_message(
            f"🟢 <b>Bot Iniciado</b>\n\n"
            f"📊 Cuentas: {len(bots)}\n"
            f"📡 SaaS: {args.saas_url}\n"
            f"⏰ {datetime.now().strftime('%d/%m %H:%M')}"
        )

    # Crear tareas
    tasks = [
        asyncio.create_task(heartbeat_loop()),
        asyncio.create_task(grid_loop()),
    ]

    if client:
        await client.start()
        log.info("🤖 Telegram conectado. Escuchando señales…")
        tasks.append(asyncio.create_task(client.run_until_disconnected()))

    # Esperar a que terminen (nunca terminan salvo error)
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("👋 Bot detenido por usuario")
