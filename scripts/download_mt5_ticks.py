#!/usr/bin/env python3
"""
Script para descargar ticks históricos de MT5
=============================================

Descarga datos de ticks de XAUUSD (u otro símbolo) desde MetaTrader 5
y los guarda en formato CSV comprimido para usar en el backtester.

Uso:
    python scripts/download_mt5_ticks.py
    python scripts/download_mt5_ticks.py --symbol XAUUSD-STDc --days 365
    python scripts/download_mt5_ticks.py --start 2024-01-01 --end 2024-12-31

Requisitos:
    pip install MetaTrader5 pandas tqdm
"""

import argparse
import gzip
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    import MetaTrader5 as mt5
    import pandas as pd
    from tqdm import tqdm
except ImportError as e:
    print(f"Error: {e}")
    print("Instala las dependencias: pip install MetaTrader5 pandas tqdm")
    sys.exit(1)

# Configuración por defecto
DEFAULT_SYMBOL = "XAUUSD-STDc"
DEFAULT_DAYS = 365
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "ticks"


def init_mt5():
    """Inicializa conexión con MT5"""
    if not mt5.initialize():
        print(f"Error iniciando MT5: {mt5.last_error()}")
        return False
    print(f"MT5 conectado - Versión: {mt5.version()}")
    return True


def download_ticks(symbol: str, start: datetime, end: datetime) -> pd.DataFrame:
    """
    Descarga ticks históricos de MT5

    Args:
        symbol: Símbolo a descargar (ej: XAUUSD-STDc)
        start: Fecha inicio
        end: Fecha fin

    Returns:
        DataFrame con columnas: timestamp, bid, ask, spread
    """
    print(f"Descargando ticks de {symbol}")
    print(f"Período: {start.date()} a {end.date()}")

    # Verificar símbolo
    symbol_info = mt5.symbol_info(symbol)
    if symbol_info is None:
        print(f"Error: Símbolo {symbol} no encontrado")
        return pd.DataFrame()

    # Activar símbolo en Market Watch
    if not symbol_info.visible:
        mt5.symbol_select(symbol, True)

    # Descargar ticks por chunks (MT5 tiene límite de ticks por petición)
    all_ticks = []
    current_start = start
    chunk_size = timedelta(days=7)  # Descargar semana a semana

    total_days = (end - start).days
    with tqdm(total=total_days, desc="Descargando", unit="días") as pbar:
        while current_start < end:
            current_end = min(current_start + chunk_size, end)

            # Descargar ticks del chunk
            ticks = mt5.copy_ticks_range(
                symbol,
                current_start,
                current_end,
                mt5.COPY_TICKS_ALL
            )

            if ticks is not None and len(ticks) > 0:
                all_ticks.append(ticks)

            days_in_chunk = (current_end - current_start).days
            pbar.update(days_in_chunk)
            current_start = current_end

    if not all_ticks:
        print("No se descargaron ticks")
        return pd.DataFrame()

    # Combinar todos los chunks
    import numpy as np
    all_ticks_np = np.concatenate(all_ticks)

    # Convertir a DataFrame
    df = pd.DataFrame(all_ticks_np)

    # Procesar columnas
    df['timestamp'] = pd.to_datetime(df['time_msc'], unit='ms')
    df['spread'] = (df['ask'] - df['bid']) * 100  # Spread en pips (asumiendo 2 decimales)

    # Seleccionar columnas finales
    df = df[['timestamp', 'bid', 'ask', 'spread']]

    print(f"Total ticks descargados: {len(df):,}")
    print(f"Rango de precios: {df['bid'].min():.2f} - {df['bid'].max():.2f}")

    return df


def save_ticks(df: pd.DataFrame, symbol: str, start: datetime, end: datetime):
    """
    Guarda ticks en CSV comprimido (optimizado con pandas batch)

    Args:
        df: DataFrame con ticks
        symbol: Símbolo
        start: Fecha inicio
        end: Fecha fin
    """
    # Crear directorio si no existe
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Agrupar por año para archivos más manejables
    df['year'] = df['timestamp'].dt.year
    years = df['year'].unique()

    for year in sorted(years):
        year_df = df[df['year'] == year].drop(columns=['year'])

        filename = f"{symbol.replace('-', '')}_{year}.csv.gz"
        filepath = OUTPUT_DIR / filename

        print(f"Guardando {len(year_df):,} ticks en: {filepath}")

        # Formatear timestamp como ISO string
        year_df['timestamp'] = year_df['timestamp'].dt.strftime('%Y-%m-%dT%H:%M:%S.%f').str.rstrip('0').str.rstrip('.')

        # Guardar con pandas (mucho más rápido que iterrows)
        year_df.to_csv(
            filepath,
            index=False,
            compression='gzip',
            encoding='utf-8',
            float_format='%.5f'
        )

        # Estadísticas del archivo
        file_size = filepath.stat().st_size
        print(f"Archivo creado: {file_size / 1024 / 1024:.1f} MB")


def main():
    parser = argparse.ArgumentParser(
        description="Descarga ticks históricos de MT5"
    )
    parser.add_argument(
        "--symbol",
        default=DEFAULT_SYMBOL,
        help=f"Símbolo a descargar (default: {DEFAULT_SYMBOL})"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=DEFAULT_DAYS,
        help=f"Días hacia atrás desde hoy (default: {DEFAULT_DAYS})"
    )
    parser.add_argument(
        "--start",
        help="Fecha inicio (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--end",
        help="Fecha fin (YYYY-MM-DD)"
    )

    args = parser.parse_args()

    # Calcular fechas
    end_date = datetime.now() if not args.end else datetime.strptime(args.end, "%Y-%m-%d")
    end_date = end_date.replace(hour=23, minute=59, second=59)

    if args.start:
        start_date = datetime.strptime(args.start, "%Y-%m-%d")
    else:
        start_date = end_date - timedelta(days=args.days)

    start_date = start_date.replace(hour=0, minute=0, second=0)

    # Inicializar MT5
    if not init_mt5():
        sys.exit(1)

    try:
        # Descargar ticks
        df = download_ticks(args.symbol, start_date, end_date)

        if df.empty:
            print("No se obtuvieron datos")
            sys.exit(1)

        # Guardar
        save_ticks(df, args.symbol, start_date, end_date)

        print("Descarga completada")

    finally:
        mt5.shutdown()


if __name__ == "__main__":
    main()
