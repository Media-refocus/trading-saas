# EA MQL5 Backtester - Backtester_Toni_CLEAN

> **Archivo**: `Backtester_Toni_CLEAN.mq5`
> **Propósito**: Backtesting de señales en MT5 Strategy Tester
> **Input**: `signals_simple.csv` (generado por el normalizador)

---

## Características del EA

### Funcionalidades

| Componente | Descripción |
|------------|-------------|
| **CSV Parser** | Lee `signals_simple.csv` con formato `ts_utc;kind;side;price_hint;range_id;message_id;confidence` |
| **Grid System** | Promedios escalonados con distancias variables (`InpGridSchedule`) |
| **L00** | Posición base con trailing SL (`InpTrailActPips`, `InpTrailStepPips`) |
| **S00** | Scalper que cierra en +20 pips (`InpScalperTpPips`) |
| **Niveles** | Máximo 40 niveles (`InpMaxLevels`) con cierre por profit (`InpProfitPips`) |
| **Cierres** | `range_open` → abre L00 + S00 + grid<br>`range_close` → cierra todo |
| **Export** | `ranges.csv` con estadísticas MFE/MAE/PnL por rango |

### Inputs Principales

```mql5
// Lotes
input double  InpLotEntry        = 0.03;  // L00
input double  InpLotGrid         = 0.03;  // L01..Ln
input double  InpLotScalper      = 0.03;  // S00

// Grid variable (reemplaza step fijo)
input string  InpGridSchedule    = "100:10,160:15,240:20,400:40,inf:50";

// Máximo adverse pips (limita niveles)
input double  InpMaxAdversePips  = 500.0;

// S00 scalper
input int     InpScalperTpPips   = 20;    // cierra S00 cuando SUPERA +20 pips

// Trailing L00
input int     InpTrailActPips    = 30;    // activa trailing en +30 pips
input int     InpTrailStepPips   = 10;    // cada +10 → mueve SL +10

// Otros
input double  InpSlippagePips    = 0.5;    // slippage de fill
input int     InpLatencySeconds  = 0;     // latencia artificial
input bool    InpExportCSVs      = true;  // export ranges.csv
```

---

## Cómo Funciona

### 1. Flujo Principal

```
OnTick()
  ↓
Verificar eventos del CSV según timestamp
  ↓
range_open → OpenRange()
  - Abre L00 (posición base)
  - Abre S00 (scalper)
  - Calcula niveles del grid (según InpGridSchedule)
  - Coloca órdenes LIMIT pendientes
  ↓
range_close → CloseRange()
  - Cierra todas las posiciones
  - Cierra todas las órdenes pendientes
  - Exporta estadísticas a ranges.csv
  ↓
UpdateMFE_MAE()          // Máximo favorables / adversos
UpdateTrailingL00()      // Trailing stop de L00
CloseTargetsAndRecycle() // Cierra niveles que alcanzan target
RebuildGrid()           // Recoloca órdenes LIMIT
```

### 2. Grid Variable

**Antes (step fijo):**
- Distancia fija entre niveles (ej: 10 pips)

**Ahora (schedule dinámico):**
```mql5
// Formato: "limit:step,limit:step,..."
input string  InpGridSchedule = "100:10,160:15,240:20,400:40,inf:50";

// Interpretación:
// 0-100 pips   → niveles cada 10 pips
// 100-160 pips → niveles cada 15 pips
// 160-240 pips → niveles cada 20 pips
// 240-400 pips → niveles cada 40 pips
// 400+ pips    → niveles cada 50 pips (inf = sin límite)
```

### 3. Sistema de Cierre de Niveles

- **S00**: Cierra cuando `gain > InpScalperTpPips` (20 pips)
- **L01-Ln**: Cierran cuando `gain >= targetGain - tolerance`
  - `targetGain` = distancia del nivel (dinámico según schedule)
  - `tolerance` = `targetGain * InpTolerancePct / 100`

### 4. Output: ranges.csv

```csv
range_id,side,open_ts,close_ts,mfe_pips,mae_pips,pnl_total_pips
rng,BUY,2025-10-08 07:36:45,2025-10-08 07:53:59,12.50,-3.20,150.00
```

---

## Adaptaciones Necesarias para Xisco

### Cambios Clave

| Aspecto | Toni (actual) | Xisco (necesario) |
|---------|---------------|-------------------|
| **Precio** | Sin precio en CSV | ✅ SÍ: `price_hint` en CSV |
| **Grid** | Variable schedule | ¿Mantener o simplificar? |
| **L00** | Trailing genérico | +60→BE+20, +90→BE+50 |
| **S00** | Scalper +20 pips | ¿Mantener? |
| **Max promedios** | 40 niveles | 4 niveles (1 base + 3) |
| **Restricciones** | No detecta | RIESGO, SIN PROMEDIOS |

---

## Próximos Pasos

1. **Guardar este EA** en el proyecto
2. **Adaptar a formato Xisco**:
   - Usar `price_hint` del CSV
   - Limitar a 4 niveles máx
   - Añadir detección de restricciones
3. **Probar en Strategy Tester**
4. **Analizar results.csv** para validar operativa

---

## Código del EA

Ver código completo adjunto (Backtester_Toni_CLEAN.mq5)
