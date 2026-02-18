#!/usr/bin/env python3
"""
Parser de señales de Telegram
==============================

Extrae señales estructuradas de los mensajes raw de Telegram.
Solo detecta señales con formato "rango" (desde agosto 2024).

Formatos soportados:
1. Formato con ID: "Sell 5016 XAUUSD rango corto"
2. Formato sin ID: "SELL XAUUSD rango corto"

Patrones de cierre:
- "Cerramos rango" -> cierra el último rango abierto
- "Cerramos todo" -> cierra TODOS los rangos abiertos
- "Rango inhabilitado/anulado" -> cierra el rango actual

Uso:
    python scripts/parse_telegram_signals.py

Input:  docs/telegram_raw_messages.csv
Output: signals_parsed.csv
"""

import csv
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

INPUT_FILE = Path(__file__).parent.parent / "docs" / "telegram_raw_messages.csv"
OUTPUT_FILE = Path(__file__).parent.parent / "signals_parsed.csv"


@dataclass
class Signal:
    timestamp: datetime
    kind: str  # range_open, range_close
    side: Optional[str]  # BUY, SELL
    price_hint: Optional[float]
    range_id: str
    message_id: int
    confidence: float
    raw_text: str
    signal_number: Optional[int] = None


def parse_price(text: str, pattern: str) -> Optional[float]:
    """Extrae un precio del texto usando un patr�n."""
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1).replace(",", "."))
        except ValueError:
            pass
    return None


def detect_cierre_rango(text: str) -> tuple[bool, bool]:
    """
    Detecta si el mensaje es un cierre de rango.

    Returns:
        (is_cierre, is_cerrar_todo)
        - is_cierre: True si es un mensaje de cierre
        - is_cerrar_todo: True si debe cerrar TODOS los rangos abiertos
    """
    text_upper = text.upper()
    text_lower = text.lower()

    # Detectar "Cerramos todo" o variantes - cierra TODOS los rangos
    if re.search(r"CERRAMOS\s*TODO", text_upper):
        return True, True

    # Detectar "Cerramos rango" o variantes (incluyendo typos como "cerramoa")
    if re.search(r"CERRAM[OA]S?\s*RANGO", text_upper):
        return True, False

    # Detectar cierres explícitos del rango actual
    close_patterns = [
        r"CERRAMOS\s*EN\s*BE",
        r"CERRAMOS\s*LA\s*OPERACION",
        r"RANGO\s*INHABILITADO",
        r"RANGO\s*ANULADO",
        r"RANGO\s*QUEDA\s*CERRADO",
        r"RANGO\s*INACTIVO",
        r"SL\s*DE\s*RANGO",
        r"RANGO\s*CORTO\s*CERRADO",
    ]
    for pattern in close_patterns:
        if re.search(pattern, text_upper):
            return True, False

    # Detectar "+XX pips cerramos rango" (formato inverso)
    if re.search(r"\d+\s*PIPS?.*CERRAM[OA]S?\s*RANGO", text_upper):
        return True, False

    return False, False


def detect_apertura_rango(text: str) -> tuple[Optional[str], Optional[float], Optional[int]]:
    """
    Detecta si el mensaje es una apertura de rango.

    Returns:
        (side, price, signal_number)
        - side: "BUY" o "SELL"
        - price: precio de entrada si se encuentra
        - signal_number: número de señal si existe (ej: 5016)
    """
    text_upper = text.upper()

    # Debe contener "rango corto" o "rango largo" para ser válido
    # Excluye "Rango operativo" que es un formato antiguo/diferente
    if "RANGO CORTO" not in text_upper and "RANGO LARGO" not in text_upper:
        # También aceptar solo "rango" si tiene el formato con ID numérico
        if not re.search(r"(SELL|BUY)\s+\d{3,5}\s+XAUUSD", text_upper):
            return None, None, None

    # Debe contener XAUUSD
    if "XAUUSD" not in text_upper:
        return None, None, None

    # Formato con ID: "Sell 5016 XAUUSD rango" o "Buy 4032 XAUUSD rango"
    match_nuevo_id = re.search(
        r"(SELL|BUY|VENTA|COMPRA)\s+(\d{3,5})\s+XAUUSD",
        text_upper
    )
    if match_nuevo_id:
        side = "BUY" if match_nuevo_id.group(1) in ["BUY", "COMPRA"] else "SELL"
        signal_number = int(match_nuevo_id.group(2))

        # Buscar precio en "Entrada"
        price = None
        entrada_match = re.search(r"ENTRADA\s*:?\s*(\d{4}[.,]\d{1,2})", text_upper)
        if entrada_match:
            price = float(entrada_match.group(1).replace(",", "."))

        return side, price, signal_number

    # Formato sin ID: "SELL XAUUSD rango corto" o "BUY XAUUSD rango"
    match_nuevo = re.search(
        r"(SELL|BUY|VENTA|COMPRA)\s+XAUUSD",
        text_upper
    )
    if match_nuevo:
        side = "BUY" if match_nuevo.group(1) in ["BUY", "COMPRA"] else "SELL"

        # Buscar precio en el formato "2502-2495" o "Entrada:"
        price = None

        # Formato con rango de precios "2502-2495"
        rango_match = re.search(r"(\d{4})\s*[-–]\s*(\d{4})", text)
        if rango_match:
            price = float(rango_match.group(1))

        # O buscar "Entrada"
        if not price:
            entrada_match = re.search(r"ENTRADA\s*:?\s*(\d{4}[.,]\d{1,2})", text_upper)
            if entrada_match:
                price = float(entrada_match.group(1).replace(",", "."))

        return side, price, None

    return None, None, None


def parse_messages(input_file: Path) -> list[Signal]:
    """Parsea todos los mensajes y extrae señales."""
    signals = []
    range_counter = 0

    # Lista de rangos actualmente abiertos
    open_ranges: list[dict] = []

    with open(input_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")

        for row in reader:
            message_id = int(row["message_id"])
            date_str = row["date_utc"]
            text = row["text"] or ""

            try:
                timestamp = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except ValueError:
                continue

            # Detectar apertura de rango
            side, price, signal_number = detect_apertura_rango(text)

            if side:
                # Nueva señal de entrada
                range_counter += 1
                date_prefix = timestamp.strftime("%Y-%m-%d")

                # Usar message_id para garantizar unicidad
                # Incluir signal_number si existe para referencia
                range_id = f"{date_prefix}-msg{message_id}"

                signal = Signal(
                    timestamp=timestamp,
                    kind="range_open",
                    side=side,
                    price_hint=price,
                    range_id=range_id,
                    message_id=message_id,
                    confidence=0.90,
                    raw_text=text[:100],
                    signal_number=signal_number
                )

                signals.append(signal)

                # Añadir a la lista de rangos abiertos
                open_ranges.append({
                    "range_id": range_id,
                    "open_signal": signal
                })

            # Detectar cierre de rango
            else:
                is_cierre, is_cerrar_todo = detect_cierre_rango(text)

                if is_cierre and open_ranges:
                    if is_cerrar_todo:
                        # Cerrar TODOS los rangos abiertos
                        ranges_to_close = open_ranges.copy()
                        open_ranges.clear()
                    else:
                        # Cerrar solo el último rango
                        ranges_to_close = [open_ranges.pop()] if open_ranges else []

                    for range_info in ranges_to_close:
                        signals.append(Signal(
                            timestamp=timestamp,
                            kind="range_close",
                            side=None,
                            price_hint=None,
                            range_id=range_info["range_id"],
                            message_id=message_id,
                            confidence=0.95,
                            raw_text=text[:100]
                        ))

    return signals


def save_signals(signals: list[Signal], output_file: Path):
    """Guarda las señales en formato CSV."""
    with open(output_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow([
            "ts_utc", "kind", "side", "price_hint",
            "range_id", "message_id", "confidence", "signal_number"
        ])

        for s in signals:
            writer.writerow([
                s.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                s.kind,
                s.side or "",
                s.price_hint or "",
                s.range_id,
                s.message_id,
                s.confidence,
                s.signal_number or ""
            ])

    print(f"Guardadas {len(signals)} señales en {output_file}")


def print_stats(signals: list[Signal]):
    """Imprime estadísticas de las señales."""
    opens = [s for s in signals if s.kind == "range_open"]
    closes = [s for s in signals if s.kind == "range_close"]

    buys = [s for s in opens if s.side == "BUY"]
    sells = [s for s in opens if s.side == "SELL"]

    # Contar rangos con cierre vs sin cierre
    open_ids = {s.range_id for s in opens}
    close_ids = {s.range_id for s in closes}
    unclosed = open_ids - close_ids

    print("\n=== ESTADÍSTICAS ===")
    print(f"Total señales: {len(opens)} rangos abiertos")
    print(f"Señales BUY: {len(buys)}")
    print(f"Señales SELL: {len(sells)}")
    print(f"Cierres detectados: {len(closes)}")
    print(f"Rangos CON cierre: {len(open_ids & close_ids)}")
    print(f"Rangos SIN cierre: {len(unclosed)}")

    if opens:
        print(f"\nPrimera señal: {opens[0].timestamp.date()}")
        print(f"Última señal: {opens[-1].timestamp.date()}")

        # Por mes
        months = {}
        for s in opens:
            month_key = s.timestamp.strftime("%Y-%m")
            months[month_key] = months.get(month_key, 0) + 1

        print("\nSeñales por mes:")
        for month in sorted(months.keys()):
            print(f"  {month}: {months[month]} señales")


def main():
    print("=== PARSER DE SEÑALES DE TELEGRAM ===")
    print(f"Input: {INPUT_FILE}")
    print(f"Output: {OUTPUT_FILE}")

    if not INPUT_FILE.exists():
        print(f"Error: No existe {INPUT_FILE}")
        return

    print("\nParseando mensajes...")
    signals = parse_messages(INPUT_FILE)

    print_stats(signals)

    print(f"\nGuardando en {OUTPUT_FILE}...")
    save_signals(signals, OUTPUT_FILE)

    print("\n¡Listo!")


if __name__ == "__main__":
    main()
