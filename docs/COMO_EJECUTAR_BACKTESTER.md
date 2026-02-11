# Cómo Ejecutar el Backtester de MT5

> Fecha: 2026-02-11
> Estado: ✅ Bugs arreglados, listo para testing

---

## 📋 Índice

1. [Preparativos](#preparativos)
2. [Copiar EAs y CSVs](#copiar-eas-y-csvs)
3. [Configurar MT5](#configurar-mt5)
4. [Ejecutar Backtest](#ejecutar-backtest)
5. [Analizar Resultados](#analizar-resultados)
6. [Troubleshooting](#troubleshooting)

---

## Preparativos

### Requisitos

1. ✅ **MetaTrader 5** instalado
2. ✅ **Cuenta demo de Infinox** (o VT Markets)
3. ✅ **Datos históricos de XAUUSD** descargados

### Símbolos Importantes

| Broker | Símbolo Normal | Símbolo Microlotes | Cuándo Usar |
|---------|----------------|---------------------|--------------|
| **Infinox** | `XAUUSD` | `XAUUSD.m` | XAUUSD.m para cuentas < $500 |
| **VT Markets** | `XAUUSD` | N/A | Siempre XAUUSD |

---

## Copiar EAs y CSVs

### Opción 1: Script Automático (Recomendado)

```powershell
cd C:\Users\guill\projects\trading-bot-saas
.\scripts\copy-to-mt5.ps1
```

Este script:
- Copia los 4 EAs a todas las instalaciones de MT5
- Copia `signals_simple.csv` a la carpeta `MQL5/Files`
- Te ofrece abrir MetaEditor para compilar

### Opción 2: Manual

1. **Copiar EAs** a:
   ```
   C:\Users\guill\AppData\Roaming\MetaQuotes\Terminal\[HASH]\MQL5\Experts\
   ```

   Archivos:
   - `Backtester_Xisco_G2.mq5` (Guía $250-$500)
   - `Backtester_Xisco_G4.mq5` (Guía $1000-$1500)
   - `Backtester_Xisco_Restrictions.mq5` (Con restricciones)
   - `Backtester_Xisco_DEBUG.mq5` (Debug extremo)

2. **Copiar CSV** a:
   ```
   C:\Users\guill\AppData\Roaming\MetaQuotes\Terminal\[HASH]\MQL5\Files\
   ```

   Archivo:
   - `signals_simple.csv`

---

## Configurar MT5

### 1. Abrir MetaEditor

En MT5: presiona `F4` o menú `Herramientas → MetaQuotes Language Editor`

### 2. Compilar los EAs

En MetaEditor:
1. Navega a la carpeta `Experts`
2. Click derecho en cada EA → `Compilar`
3. Verifica que no haya errores en el log de compilación

Debería ver:
```
0 error(s), 0 warning(s)
```

### 3. Abrir Strategy Tester

En MT5: presiona `Ctrl+R` o click en el icono del Strategy Tester

---

## Ejecutar Backtest

### Configuración del Tester

**Pestaña "Configuración":**

| Parámetro | Valor |
|-----------|--------|
| **Expert** | `Backtester_Xisco_DEBUG.mq5` (primero usa este) |
| **Símbolo** | `XAUUSD` o `XAUUSD.m` (según tu cuenta) |
| **Modelo** | "Every tick" (más preciso) o "Open prices only" (más rápido) |
| **Periodo** | `M1` o `M5` |
| **Depósito** | `1000` (o el capital de tu guía) |
| **Leverage** | `1:100` o `1:500` |

**Pestaña "Entradas":**

Parámetros del EA:

```mql5
// CSV
InpCsvFileName = "signals_simple.csv"  // NO CAMBIAR
InpCsvIsUTC = true                   // NO CAMBIAR
InpCsvTzShiftHours = 0               // Ajuste horario si es necesario

// Símbolo
InpSymbol = "XAUUSD"                // Debe coincidir con el símbolo del tester
InpPipSize = 0.10                   // 1 pip = 0.10 para XAUUSD
InpMagic = 20250673                  // Magic number
InpRequireHedging = true             // Asegúrate que la cuenta permita hedging

// Lotes
InpLotEntry = 0.01                  // Lote base
InpLotScalper = 0.01               // S00 scalper
InpLotGrid = 0.01                   // Promedios

// Grid
InpStepPips = 20                    // Distancia entre promedios
InpMaxLevels = 4                     // Niveles máximos (1 base + 3)

// S00 Scalper
InpScalperTPPips = 20              // TP de S00

// Simulación
InpSlippagePips = 0.5              // Slippage
InpLatencySeconds = 0                // Latencia artificial
InpDrawGraphics = true               // Dibujar flechas/rectángulos
InpExportCSVs = true                // Exportar ranges_DEBUG.csv
InpVerbose = true                    // LOGS DETALLADOS - IMPORTANTE!
```

**Pestaña "Fecha":**

```
Desde: 2025-10-01 (o fecha del CSV)
Hasta: 2025-10-31 (o fecha del CSV)
```

### Ejecutar

1. Click en **"Iniciar"** en el Strategy Tester
2. Observa la pestaña **"Diario"** o **"Expertos"** para ver los logs
3. Con `InpVerbose=true`, verás logs como:
   ```
   CSV: 45 eventos cargados. Ventana: [2025-10-08 00:00 → 2025-10-14 23:59]
   === RANGE_OPEN === side=BUY range_id=2025-10-08-4 ts=2025-10-08 10:44:47
   === RANGE_CLOSE === range_id=2025-10-08-4 ts=2025-10-08 11:22:22
   ```

---

## Analizar Resultados

### Archivos Generados

El EA genera un CSV en:
```
C:\Users\guill\AppData\Roaming\MetaQuotes\Terminal\[HASH]\MQL5\Files\ranges_DEBUG.csv
```

### Formato del CSV

```csv
range_id;side;open_ts;close_ts;mfe_pips;mae_pips;pnl_total_pips;max_levels;s00_closed;restriction
2025-10-08-4;BUY;2025-10-08 10:44:47;2025-10-08 11:22:22;15.3;-3.2;12.0;2;1;NONE
```

### Métricas Clave

| Métrica | Descripción |
|---------|-------------|
| **Win Rate** | % de rangos en verde (pnl_total_pips > 0) |
| **MFE** (Maximum Favorable Excursion) | Máximo pips a favor alcanzados |
| **MAE** (Maximum Adverse Excursion) | Máximo pips en contra sufridos |
| **Avg Levels Used** | Promedio de niveles de promedio usados |
| **PnL per Range** | Beneficio/pérdida promedio por rango |

### Analizar en Excel/Google Sheets

1. Abrir `ranges_DEBUG.csv`
2. Crear pivot tables:
   - **Win Rate**: =COUNTIF(pnl_total_pips>0)/COUNTA()
   - **Total PnL**: =SUM(pnl_total_pips)
   - **Avg Levels**: =AVERAGE(max_levels)
3. Filtrar por `restriction`:
   - `NONE` = Sin restricciones (4 niveles)
   - `RIESGO` = Solo 2 niveles
   - `SIN_PROMEDIOS` = Solo 1 nivel
   - `SOLO_1_PROMEDIO` = 2 niveles

---

## Troubleshooting

### ❌ "No se pudo abrir signals_simple.csv"

**Síntoma:** El EA no carga eventos

**Solución:**
1. Verifica que el CSV existe en `MQL5/Files/`
2. Verifica que el nombre coincida exactamente: `signals_simple.csv`
3. Verifica que el CSV tenga la cabecera correcta:
   ```csv
   ts_utc;kind;side;price_hint;range_id;message_id;confidence
   ```

### ❌ "CSV vacío o inválido"

**Síntoma:** El EA falla al iniciar

**Solución:**
1. Verifica que el CSV no esté vacío
2. Verifica que tenga al menos 2 filas (cabecera + datos)
3. Regenera el CSV:
   ```powershell
   cd C:\Users\guill\projects\trading-bot-saas
   python backtest_xisco_ranges.py analyze
   ```

### ❌ "Cuenta en modo NETTING"

**Síntoma:** El EA falla en `OnInit`

**Solución:**
1. Abre MT5
2. `Herramientas → Opciones → Empleo de cuenta`
3. Activa **"Permitir operación opuesta en una misma herramienta"**
4. Reinicia MT5

### ❌ Tester se congela al iniciar

**Síntoma:** Barra de progreso no se mueve, MT5 no responde

**Causas Posibles:**

1. **Datos históricos no descargados**
   - **Solución:** Abre un gráfico de XAUUSD, presiona `Home` varias veces para cargar historial

2. **Modelo "Every tick" muy lento**
   - **Solución:** Cambia a "Open prices only" para testing rápido

3. **Periodo de fechas demasiado grande**
   - **Solución:** Prueba con 1 mes primero

4. **Símbolo incorrecto**
   - **Solución:** Verifica que el símbolo coincida con tu cuenta:
     - Cuenta normal: `XAUUSD`
     - Cuenta microlotes: `XAUUSD.m`

### ❌ "No aparecen flechas ni gráficos"

**Síntoma:** EA ejecuta pero no dibuja nada

**Solución:**
1. Verifica que `InpDrawGraphics = true`
2. En el Strategy Tester, pestaña "Gráfico" → verifica que esté activo
3. Presiona `F5` en el gráfico para refrescar

### ❌ Logs muestran eventos raros

**Síntoma:** `range_open` sin `side`, o `range_close` sin `range_id`

**Solución:**
1. El CSV está mal formado
2. Regenera el CSV:
   ```powershell
   python backtest_xisco_ranges.py analyze --input telegram_raw_messages.csv
   ```

---

## Próximos Pasos

### 1. Primer Test (DEBUG)

Usa `Backtester_Xisco_DEBUG.mq5`:
- Verifica que las señales se carguen correctamente
- Observa los logs detallados
- Verifica que los ranges se abran y cierren correctamente

### 2. Segundo Test (Restrictions)

Usa `Backtester_Xisco_Restrictions.mq5`:
- `InpVerbose = true`
- Verifica que las restricciones se detecten (RIESGO, SIN_PROMEDIOS, etc.)
- Analiza `ranges_Restrictions.csv`

### 3. Comparar Guías

Ejecuta tests con:
- `Backtester_Xisco_G2.mq5` (Guía $250-$500)
- `Backtester_Xisco_G4.mq5` (Guía $1000-$1500)

Compara:
- Win Rate
- PnL total
- Max drawdown

### 4. Ajustar Parámetros

Si los resultados no son buenos:
- Cambia `InpStepPips` (distancia entre promedios)
- Cambia `InpScalperTPPips` (TP del scalper)
- Cambia `InpMaxLevels` (máximos niveles)

---

## Checklist Antes de Empezar

- [ ] MT5 instalado y cuenta demo activa
- [ ] Datos históricos de XAUUSD descargados
- [ ] Script `copy-to-mt5.ps1` ejecutado
- [ ] EAs compilados sin errores
- [ ] `signals_simple.csv` en `MQL5/Files/`
- [ ] Strategy Tester configurado correctamente
- [ ] `InpVerbose = true` en los inputs del EA
- [ ] Símbolo del tester coincide con la cuenta (XAUUSD vs XAUUSD.m)

---

## Soporte

Si encuentras problemas:
1. Activa `InpVerbose = true`
2. Copia los logs de la pestaña "Diario"
3. Copia las primeras 10 filas de `signals_simple.csv`
4. Revisa este documento

---

*Actualizado: 2026-02-11 - Bugs arreglados, EA DEBUG añadido*
