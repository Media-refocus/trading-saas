# Scripts - Trading Bot SaaS

Scripts de automatización para el proyecto de trading bot.

## 📁 Scripts Disponibles

### 1. download_mt5_ticks.py
**Propósito**: Descargar ticks históricos de MT5 para el backtester

**Uso**:
```bash
# Descargar último año de XAUUSD
python scripts/download_mt5_ticks.py

# Descargar símbolo específico y período
python scripts/download_mt5_ticks.py --symbol XAUUSD-STDc --days 365

# Descargar rango de fechas específico
python scripts/download_mt5_ticks.py --start 2024-01-01 --end 2024-12-31
```

**Qué hace**:
- Se conecta a MT5
- Descarga ticks históricos del símbolo especificado
- Guarda en `data/ticks/` en formato CSV comprimido (.gz)

**Requisitos**:
- MT5 instalado y abierto
- Python 3.7+
- MetaTrader5, pandas, tqdm: `pip install MetaTrader5 pandas tqdm`

**Output**:
```
data/ticks/XAUUSDSTDc_2024.csv.gz
```

Formato del CSV:
```
timestamp,bid,ask,spread
2024-01-01T00:00:00.123,2034.50000,2034.60000,10.00
```

---

### 2. copy-to-mt5.ps1
**Propósito**: Copiar EAs y CSVs a MetaTrader 5 automáticamente

**Uso**:
```powershell
.\scripts\copy-to-mt5.ps1
```

**Qué hace**:
- Busca todas las instalaciones de MT5 en `AppData\Roaming\MetaQuotes\Terminal`
- Copia EAs (*.mq5) a `MQL5/Experts/`
- Copia CSVs a `MQL5/Files/`
- Ofrece abrir MetaEditor para compilar

**Requisitos**:
- PowerShell
- MT5 instalado
- EAs compilados previamente generados

---

### 2. automejora_parametros.py
**Propósito**: Analizar resultados de backtesting y recomendar ajustes de parámetros

**Uso**:
```bash
# Optimización completa de todas las estrategias
python scripts/automejora_parametros.py

# Analizar solo una estrategia
python scripts/automejora_parametros.py analyze G2
python scripts/automejora_parametros.py analyze G4
python scripts/automejora_parametros.py analyze Restrictions
```

**Qué hace**:
1. Lee `backtest_results/ranges_*.csv`
2. Calcula métricas: win rate, profit factor, MFE/MAE
3. Genera recomendaciones de ajustes:
   - Scalper TP (InpScalperTPPips)
   - Grid distance (InpStepPips)
   - Max levels (InpMaxLevels)
4. Exporta reporte JSON a `optimizacion/reporte_*.json`
5. Genera código MQL5 optimizado

**Requisitos**:
- Python 3.7+
- pandas (`pip install pandas`)
- numpy (`pip install numpy`)

**Instalación**:
```bash
pip install pandas numpy
```

---

## 🔄 Flujo de Trabajo Completo

### Paso 1: Modificar EAs (si necesario)
Editar archivos en `eas/Backtester_Xisco_*.mq5`

### Paso 2: Copiar a MT5
```powershell
.\scripts\copy-to-mt5.ps1
```

### Paso 3: Compilar EAs
1. Abrir MetaEditor (F4 en MT5)
2. Compilar cada EA (F7)
3. Verificar que no hay errores

### Paso 4: Ejecutar Backtests
1. Abrir Strategy Tester (Ctrl+R)
2. Seleccionar EA
3. Configurar parámetros
4. Click "Start"
5. Esperar resultados

### Paso 5: Exportar Results
```bash
# Copiar CSVs generados a la carpeta del proyecto
cp "C:\Users\guill\AppData\Roaming\MetaQuotes\Terminal\*\MQL5\Files\ranges_*.csv" "C:\Users\guill\Projects\trading-bot-saas\backtest_results\"
```

### Paso 6: Ejecutar Automejora
```bash
python scripts/automejora_parametros.py
```

### Paso 7: Aplicar Recomendaciones
1. Revisar `optimizacion/reporte_*.json`
2. Leer recomendaciones
3. Modificar EAs con nuevos parámetros
4. Volver al Paso 2

---

## 📊 Métricas Calculadas

| Métrica | Descripción | Ideal |
|---------|-------------|-------|
| **Win Rate** | % de rangos ganadores | >60% |
| **Profit Factor** | Gross profit / Gross loss | >2.0 |
| **Avg PnL** | Beneficio promedio por rango | >50 pips |
| **MFE** | Maximum Favorable Excursion (pips max a favor) | Alto |
| **MAE** | Maximum Adverse Excursion (pips max en contra) | Bajo |
| **Max Levels Used** | Máximo nivel de promedio alcanzado | <MaxLevels |
| **S00 Closed Rate** | % de veces que S00 cerró en TP | 50-80% |

---

## 🎯 Recomendaciones que Genera

### Scalper TP
```
Si S00 cierra <30% → Reducir TP (20→15 pips) → Más cierres
Si S00 cierra >80% → Aumentar TP (20→25 pips) → Más profit
```

### Grid Distance
```
Si MAE max >4x step → Aumentar step (20→30) → Más cobertura
Si MAE max <2x step → Reducir step (20→15) → Más agresivo
```

### Max Levels
```
Si max_levels_used == InpMaxLevels → Aumentar (4→5) → No cortar
Si max_levels_used <50% → Reducir (4→3) → Simplificar
```

---

## 📁 Estructura de Archivos

```
trading-bot-saas/
├── scripts/
│   ├── copy-to-mt5.ps1              # Copia a MT5
│   ├── automejora_parametros.py      # Optimizador
│   └── README.md                      # Este archivo
├── eas/
│   ├── Backtester_Xisco_G2.mq5       # EA Guía 2
│   ├── Backtester_Xisco_G4.mq5       # EA Guía 4
│   └── Backtester_Xisco_Restrictions.mq5  # EA con restricciones
├── backtest_results/
│   ├── ranges_G2.csv                 # Resultados G2
│   ├── ranges_G4.csv                 # Resultados G4
│   └── ranges_Restrictions.csv       # Resultados Restrictions
└── optimizacion/
    ├── reporte_20260210_123456.json  # Reporte JSON
    └── ranges_G2_optimized_params.mqh  # Parámetros optimizados
```

---

## 🔧 Solución de Problemas

### Error: "No se encontraron carpetas MQL5"
- Verificar que MT5 está instalado
- Verificar ruta en script

### Error: "No module named 'pandas'"
```bash
pip install pandas numpy
```

### Error: "ranges_G2.csv not found"
- Copiar CSVs desde MT5 MQL5/Files/ a backtest_results/

---

## 📝 Notas

- Los scripts asumen que estás en Windows con MT5 instalado
- Las rutas son relativas al proyecto `trading-bot-saas`
- Los reports JSON pueden ser importados en Excel/Sheets para análisis
- El sistema de automejora es iterativo: requiere varios ciclos para optimizar

---

*Última actualización: 2026-02-10*
