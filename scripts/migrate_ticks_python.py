#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migracion de ticks de .gz a SQLite usando Python
Mucho mas eficiente en memoria que Node.js/Prisma

Uso: python scripts/migrate_ticks_python.py
"""

import gzip
import sqlite3
import os
import sys
from datetime import datetime
from pathlib import Path

# Fix encoding para Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Configuración - usar ruta absoluta
TICKS_DIR = Path(r"C:\Users\guill\Projects\trading-bot-saas\data\ticks")
DB_PATH = Path(r"C:\Users\guill\Projects\trading-bot-saas\prisma\dev.db")  # Ahora apunta a la BD correcta
BATCH_SIZE = 50000  # Insertar cada 50k ticks
SYMBOL = "XAUUSD"

def parse_tick_line(line: str) -> tuple | None:
    """Parsea una línea del CSV de ticks"""
    line = line.strip()
    if not line or line.startswith("timestamp"):
        return None

    parts = line.split(",")
    if len(parts) < 4:
        return None

    try:
        timestamp = parts[0]
        bid = float(parts[1])
        ask = float(parts[2])
        spread = float(parts[3])

        if bid <= 0 or ask <= 0:
            return None

        return (SYMBOL, timestamp, bid, ask, spread)
    except (ValueError, IndexError):
        return None

def process_gz_file(conn: sqlite3.Connection, cursor: sqlite3.Cursor,
                   file_path: Path) -> tuple[int, int]:
    """Procesa un archivo .gz e inserta ticks en lotes"""

    print(f"  [Procesando] {file_path.name}...")

    batch = []
    processed = 0
    inserted = 0
    skipped = 0

    with gzip.open(file_path, 'rt', encoding='utf-8', errors='ignore') as f:
        for line in f:
            tick = parse_tick_line(line)
            if tick:
                batch.append(tick)
                processed += 1

                # Insertar cuando el lote está lleno
                if len(batch) >= BATCH_SIZE:
                    try:
                        cursor.executemany(
                            "INSERT OR IGNORE INTO TickData (symbol, timestamp, bid, ask, spread) VALUES (?, ?, ?, ?, ?)",
                            batch
                        )
                        inserted += cursor.rowcount
                        conn.commit()
                    except Exception as e:
                        skipped += len(batch)

                    batch = []

                    # Log cada 500k
                    if processed % 500000 == 0:
                        mem_mb = round(sys.getsizeof(batch) / 1024 / 1024, 2)
                        print(f"    📊 {processed:,} procesados, {inserted:,} insertados")

    # Insertar lote final
    if batch:
        try:
            cursor.executemany(
                "INSERT OR IGNORE INTO TickData (symbol, timestamp, bid, ask, spread) VALUES (?, ?, ?, ?, ?)",
                batch
            )
            inserted += cursor.rowcount
            conn.commit()
        except Exception as e:
            skipped += len(batch)

    print(f"    ✅ Completado: {processed:,} procesados, {inserted:,} insertados")
    return processed, inserted

def main():
    print("=" * 60)
    print("MIGRACIÓN DE TICKS: .gz → SQLite (Python)")
    print("=" * 60)

    # Verificar directorio
    if not TICKS_DIR.exists():
        print(f"❌ Directorio no encontrado: {TICKS_DIR}")
        sys.exit(1)

    # Listar archivos .gz
    files = sorted(TICKS_DIR.glob("*.csv.gz"))

    if not files:
        print("❌ No hay archivos .csv.gz en el directorio")
        sys.exit(1)

    print(f"\n📁 Encontrados {len(files)} archivos:")
    for f in files:
        size_mb = f.stat().st_size / 1024 / 1024
        print(f"   - {f.name} ({size_mb:.1f} MB)")

    # Conectar a SQLite
    if not DB_PATH.exists():
        print(f"❌ Base de datos no encontrada: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Verificar tabla existe
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='TickData'")
    if not cursor.fetchone():
        print("❌ Tabla TickData no existe. Ejecuta: npx prisma migrate dev")
        conn.close()
        sys.exit(1)

    # Contar ticks actuales
    cursor.execute("SELECT COUNT(*) FROM TickData")
    existing = cursor.fetchone()[0]
    print(f"\n📊 Ticks existentes en BD: {existing:,}")

    # Configurar SQLite para máxima velocidad
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA cache_size = -64000")  # 64MB cache
    cursor.execute("PRAGMA temp_store = MEMORY")

    # Procesar cada archivo
    start_time = datetime.now()
    total_processed = 0
    total_inserted = 0

    for i, file_path in enumerate(files, 1):
        print(f"\n📄 [{i}/{len(files)}] {file_path.name}")

        try:
            processed, inserted = process_gz_file(conn, cursor, file_path)
            total_processed += processed
            total_inserted += inserted
        except Exception as e:
            print(f"    ❌ Error: {e}")

    # Restaurar configuración de SQLite
    cursor.execute("PRAGMA synchronous = NORMAL")
    conn.close()

    # Estadísticas finales
    elapsed = (datetime.now() - start_time).total_seconds()

    # Contar total final
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM TickData")
    final_count = cursor.fetchone()[0]

    # Obtener rango de fechas
    cursor.execute("SELECT MIN(timestamp), MAX(timestamp) FROM TickData")
    date_range = cursor.fetchone()
    conn.close()

    print("\n" + "=" * 60)
    print("MIGRACIÓN COMPLETADA")
    print("=" * 60)
    print(f"⏱️  Tiempo total: {elapsed:.1f}s")
    print(f"📝 Ticks procesados: {total_processed:,}")
    print(f"💾 Ticks insertados: {total_inserted:,}")
    print(f"📊 Total en BD: {final_count:,}")
    print(f"📅 Rango: {date_range[0]} a {date_range[1]}")

    # Tamaño de la BD
    db_size_mb = DB_PATH.stat().st_size / 1024 / 1024
    print(f"💿 Tamaño BD: {db_size_mb:.2f} MB")
    print("=" * 60)

if __name__ == "__main__":
    main()
