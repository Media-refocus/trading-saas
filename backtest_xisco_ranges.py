#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backtest_xisco_ranges.py - Normalizador de señales NUEVO formato (rangos y promedios)

Formato NUEVO (2026):
- "Sell 5014 XAUUSD rango"
- "Buy 4867 XAUUSD rango"
- Cierres: "Cerramos rango", "Cerramos todo"
- Progreso: "+20 pips", "+30 pips del promedio"

Output: signals_simple.csv compatible con EA de MT5
"""

import argparse
import re
import pandas as pd
from datetime import datetime, timezone
from dateutil import parser as dtparser
from typing import Optional, Dict, List

# Para fuzzy matching (opcional, instalar con: pip install rapidfuzz)
try:
    from rapidfuzz import fuzz
    HAS_FUZZY = True
except ImportError:
    HAS_FUZZY = False
    print("[INFO] rapidfuzz no instalado. Usando regex sin fuzzy matching.")

# ======================= CONFIGURACIÓN =======================
RAW_CSV = "telegram_raw_messages.csv"
OUTPUT_CSV = "signals_simple.csv"
CSV_SEP = ";"
UTC = timezone.utc

# ======================= REGEX NUEVO FORMATO =======================

# 1. ENTRADAS: "Sell 5014 XAUUSD rango" o "Buy 4867 XAUUSD rango"
# Fuzzy: permitimos typos como "Cel", "biy", etc.
RE_ENTRY_NEW = re.compile(
    r'\b(?P<side>BUY|SELL|buy|sell)\b\s+'              # BUY/SELL
    r'(?P<price>\d{4,5})\s+'                         # Precio: 5014, 4867
    r'XAUUSD\s*rango\b',                              # "XAUUSD rango"
    re.IGNORECASE
)

# 2. CIERRES: "Cerramos rango", "Cerramos todo", "cerramos td" (con typos)
RE_CLOSE_RANGE = re.compile(
    r'\b[cC]erramos\s+'                              # "cerramos"
    r'(?:rango|todo|td|el\s+rango)'                  # "rango", "todo", "td"
    r'\b',
    re.IGNORECASE
)

# 3. PROGRESO (opcional): "+20 pips", "+30 pips del promedio"
RE_PROGRESS = re.compile(
    r'\+\s*(?P<pips>\d+)\s*pips'                    # "+20 pips"
    r'(?:\s+del\s+promedio)?'                       # " del promedio" (opcional)
    r'\s*✅?',
    re.IGNORECASE
)

# ======================= FUZZY MATCHING =======================

# Diccionario de typos conocidos para BUY/SELL
SIDE_VARIANTS = {
    "BUY": ["buy", "biy", "byu", "bu", "biuy"],
    "SELL": ["sell", "sel", "sll", "cel", "cel", "cer"]
}

# Diccionario de typos para CERRAMOS
CLOSE_VARIANTS = [
    "cerramos", "cerrar", "cerramos td", "cerramo",
    "ceramos", "cerrramos", "cerramos todo", "cerramos rango",
    "cerramos el rango"
]

def fuzzy_match_side(text: str) -> Optional[str]:
    """Detecta BUY/SELL con fuzzy matching."""
    text_lower = text.lower()
    best_score = 0
    best_side = None

    for side, variants in SIDE_VARIANTS.items():
        for variant in variants:
            if HAS_FUZZY:
                score = fuzz.ratio(text_lower, variant)
            else:
                score = 100 if variant in text_lower else 0

            if score > best_score and score >= 75:  # 75% umbral
                best_score = score
                best_side = side

    return best_side

def fuzzy_match_close(text: str) -> bool:
    """Detecta si es mensaje de cierre con fuzzy matching."""
    text_lower = text.lower()

    for variant in CLOSE_VARIANTS:
        if HAS_FUZZY:
            if fuzz.ratio(text_lower, variant) >= 70:
                return True
        else:
            if variant in text_lower:
                return True

    return False

# ======================= UTILIDADES =======================

def to_iso_z(dt: datetime) -> str:
    """Convierte datetime a ISO-8601 UTC."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    else:
        dt = dt.astimezone(UTC)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def normalize_price(price_str: str) -> Optional[float]:
    """Normaliza precio a float."""
    try:
        return float(price_str.strip())
    except (ValueError, AttributeError):
        return None

def confidence_score(matches: Dict) -> float:
    """Calcula puntuación de confianza (0-1)."""
    score = 0.0

    # Precio presente y válido (4000-6000 rango para XAUUSD)
    if matches.get("price") and 4000 <= matches["price"] <= 6000:
        score += 0.4

    # Side claro
    if matches.get("side") in ["BUY", "SELL"]:
        score += 0.3

    # Contiene "rango"
    if matches.get("has_rango"):
        score += 0.2

    # Sin caracteres raros
    if not matches.get("has_strange_chars"):
        score += 0.1

    return score

# ======================= PARSERS =======================

def parse_entry_new_format(text: str) -> Optional[Dict]:
    """
    Parsea entrada del NUEVO formato:
    "Sell 5014 XAUUSD rango"

    Returns:
        {
            "kind": "range_open",
            "side": "BUY" or "SELL",
            "price": float (ej: 5014.0),
            "confidence": float (0-1)
        }
        OR None si no es entrada válida
    """
    if not text:
        return None

    text_stripped = text.strip()

    # Intentar regex primero
    m = RE_ENTRY_NEW.search(text_stripped)

    if m:
        side = m.group('side').upper()
        price = normalize_price(m.group('price'))

        # Validar precio
        if price is None or not (4000 <= price <= 6000):
            return None

        return {
            "kind": "range_open",
            "side": side,
            "price": price,
            "confidence": 0.95  # Alta confianza con regex exacto
        }

    # Si regex falla, intentar fuzzy
    # Buscar número que podría ser precio
    price_match = re.search(r'\b(\d{4,5})\b', text_stripped)
    if not price_match:
        return None

    price = normalize_price(price_match.group(1))
    if price is None or not (4000 <= price <= 6000):
        return None

    # Buscar side con fuzzy
    side = fuzzy_match_side(text_stripped)
    if not side:
        return None

    # Verificar que contiene "rango" (con fuzzy)
    has_rango = bool(re.search(r'rango', text_stripped, re.I))
    if not has_rango and HAS_FUZZY:
        # Fuzzy para "rango"
        for word in text_stripped.split():
            if fuzz.ratio(word.lower(), "rango") >= 75:
                has_rango = True
                break

    if not has_rango:
        return None

    # Calcular confianza
    conf = confidence_score({
        "price": price,
        "side": side,
        "has_rango": has_rango,
        "has_strange_chars": bool(re.search(r'[^a-zA-Z0-9\s+\-✅🚨⚠️]', text_stripped))
    })

    # Solo devolver si confianza >= 0.7
    if conf < 0.7:
        return None

    return {
        "kind": "range_open",
        "side": side,
        "price": price,
        "confidence": conf
    }

def parse_close(text: str) -> bool:
    """
    Detecta si es mensaje de cierre:
    "Cerramos rango", "Cerramos todo", etc.

    Returns:
        True si es cierre, False si no
    """
    if not text:
        return False

    # Primero intentar regex exacto
    if RE_CLOSE_RANGE.search(text):
        return True

    # Si falla, intentar fuzzy
    return fuzzy_match_close(text)

# ======================= MAIN FUNCTIONS =======================

def run_analyze(input_csv: str = RAW_CSV):
    """
    Analiza el CSV y genera:
    - signals_simple.csv (para el EA)
    - Estadísticas de detección
    """
    print(f"[INFO] Leyendo {input_csv}...")

    try:
        df = pd.read_csv(input_csv, sep=CSV_SEP)
    except FileNotFoundError:
        print(f"[ERROR] No existe {input_csv}")
        return

    if df.empty:
        print("[ERROR] CSV vacío")
        return

    df["text"] = df["text"].fillna("")
    df.sort_values("date_utc", inplace=True)

    rows = []
    day_seq = {}
    open_range = None
    stats = {
        "total_messages": len(df),
        "entries_detected": 0,
        "closes_detected": 0,
        "low_confidence_ignored": 0,
        "cross_day_ignored": 0,  # Nuevos: rangos que cruzan de día
        "ranges_opened": 0,
        "ranges_closed": 0,
        "ranges_valid": 0  # Solo mismo día
    }

    def next_range_id(ts_iso: str) -> str:
        day = ts_iso[:10]
        n = day_seq.get(day, 0) + 1
        day_seq[day] = n
        return f"{day}-{n}"

    print("\n[INFO] Procesando mensajes...")

    for idx, row in df.iterrows():
        ts_iso = row["date_utc"]
        txt = row["text"]

        # 1. Detectar entrada
        entry = parse_entry_new_format(txt)
        if entry:
            stats["entries_detected"] += 1

            if entry["confidence"] < 0.7:
                stats["low_confidence_ignored"] += 1
                continue

            if open_range is None:
                # Abrir nuevo rango
                rid = next_range_id(ts_iso)
                rows.append({
                    "ts_utc": ts_iso,
                    "kind": "range_open",
                    "side": entry["side"],
                    "price_hint": f"{entry['price']:.1f}",
                    "range_id": rid,
                    "message_id": int(row["message_id"]),
                    "confidence": f"{entry['confidence']:.2f}"
                })
                open_range = {
                    "range_id": rid,
                    "open_ts": ts_iso,
                    "side": entry["side"],
                    "entry_price": entry["price"]
                }
                stats["ranges_opened"] += 1
            else:
                # Ya hay rango abierto → es promedio (no generamos evento)
                pass

            continue

        # 2. Detectar cierre
        if parse_close(txt):
            stats["closes_detected"] += 1

            if open_range is not None:
                # VERIFICAR MISMO DÍA
                open_day = open_range["open_ts"][:10]  # YYYY-MM-DD
                close_day = ts_iso[:10]

                if open_day != close_day:
                    # Rango cruza de día → INVÁLIDO para backtesting
                    stats["cross_day_ignored"] += 1
                    open_range = None  # Descartar rango abierto
                    continue

                # Mismo día → VÁLIDO
                rid = open_range["range_id"]
                rows.append({
                    "ts_utc": ts_iso,
                    "kind": "range_close",
                    "side": "",
                    "price_hint": "",
                    "range_id": rid,
                    "message_id": int(row["message_id"]),
                    "confidence": ""
                })
                open_range = None
                stats["ranges_closed"] += 1
                stats["ranges_valid"] += 1
            # Si no hay rango abierto, ignorar cierre huérfano

            continue

    # Exportar
    if not rows:
        print("[AVISO] No se detectaron señales con el nuevo formato")
        return

    out = pd.DataFrame(rows)
    out["ts_utc_dt"] = pd.to_datetime(out["ts_utc"], utc=True)
    out.sort_values(["ts_utc_dt", "message_id"], inplace=True)
    out.drop(columns=["ts_utc_dt"], inplace=True)

    output_path = OUTPUT_CSV
    out.to_csv(output_path, index=False, sep=CSV_SEP)

    # Estadísticas
    print(f"\n{'='*60}")
    print(f"{'ESTADÍSTICAS':^60}")
    print(f"{'='*60}")
    print(f"Total mensajes procesados:  {stats['total_messages']}")
    print(f"Entradas detectadas:        {stats['entries_detected']}")
    print(f"Cierres detectados:         {stats['closes_detected']}")
    print(f"Ignorados (baja confianza): {stats['low_confidence_ignored']}")
    print(f"Ignorados (cruzan de día):  {stats['cross_day_ignored']}")
    print(f"\nRangos abiertos:            {stats['ranges_opened']}")
    print(f"Rangos cerrados:            {stats['ranges_closed']}")
    print(f"Rangos VÁLIDOS (mismo día):  {stats['ranges_valid']}")
    print(f"Rangos abiertos sin cerrar: {stats['ranges_opened'] - stats['ranges_closed']}")
    print(f"\n[OK] Output -> {output_path} ({len(out)} filas)")
    print(f"[INFO] Solo rangos donde apertura y cierre son el MISMO DÍA")
    print(f"{'='*60}\n")

def run_show_samples(input_csv: str = RAW_CSV, n: int = 20):
    """Muestra N ejemplos de entradas y cierres detectados."""
    print(f"[INFO] Leyendo {input_csv}...")

    df = pd.read_csv(input_csv, sep=CSV_SEP)
    df["text"] = df["text"].fillna("")

    # Buscar entradas
    print(f"\n{'='*80}")
    print(f"{'EJEMPLOS DE ENTRADAS DETECTADAS':^80}")
    print(f"{'='*80}\n")

    entries_count = 0
    for _, row in df.iterrows():
        entry = parse_entry_new_format(row["text"])
        if entry and entry["confidence"] >= 0.7:
            entries_count += 1
            print(f"[{row['date_utc']}] {entry['side']} @ {entry['price']:.1f} (conf: {entry['confidence']:.2f})")
            # Limpiar texto para evitar errores de encoding
            text_clean = row['text'][:100].encode('ascii', 'ignore').decode('ascii')
            print(f"  Texto: {text_clean}...")
            print()
            if entries_count >= n:
                break

    if entries_count == 0:
        print("[AVISO] No se detectaron entradas válidas")

    # Buscar cierres
    print(f"\n{'='*80}")
    print(f"{'EJEMPLOS DE CIERRES DETECTADOS':^80}")
    print(f"{'='*80}\n")

    closes_count = 0
    for _, row in df.iterrows():
        if parse_close(row["text"]):
            closes_count += 1
            print(f"[{row['date_utc']}] CIERRE")
            text_clean = row['text'][:100].encode('ascii', 'ignore').decode('ascii')
            print(f"  Texto: {text_clean}...")
            print()
            if closes_count >= n:
                break

    if closes_count == 0:
        print("[AVISO] No se detectaron cierres válidos")

# ======================= CLI =======================

def main():
    p = argparse.ArgumentParser(
        description="Normalizador de señales Xisco - NUEVO formato (rangos y promedios)"
    )
    p.add_argument(
        "cmd",
        choices=["analyze", "export", "samples"],
        help="Comando: analyze (analiza y exporta), export (solo exporta), samples (muestra ejemplos)"
    )
    p.add_argument(
        "--input",
        default=RAW_CSV,
        help=f"Input CSV (default: {RAW_CSV})"
    )
    p.add_argument(
        "--samples",
        type=int,
        default=20,
        help="Número de muestras a mostrar (default: 20)"
    )

    args = p.parse_args()

    if args.cmd == "analyze":
        run_analyze(args.input)
    elif args.cmd == "export":
        run_analyze(args.input)
    elif args.cmd == "samples":
        run_show_samples(args.input, args.samples)

if __name__ == "__main__":
    main()
