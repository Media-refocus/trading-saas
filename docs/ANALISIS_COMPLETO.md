# Análisis Completo del Proyecto - Bot de Trading Xisco

> **Fecha**: 2025-02-10
> **Estado**: Listo para desarrollo
> **Archivos analizados**: Código Python + Config YAML + 25,647 mensajes de Telegram

---

## 📊 Resumen Ejecutivo

Tenemos todo lo necesario para construir el producto:

| Recurso | Estado | Detalles |
|---------|--------|----------|
| **Código base** | ✅ | Python + Telethon + MT5 (grid scalping multicuenta) |
| **Configuración** | ✅ | YAML con cuentas, symbol XAUUSD, parámetros de operativa |
| **Datos históricos** | ✅ | 25,647 mensajes de Telegram (jun-sep 2024) |
| **Formato señales** | ✅ | Identificado: BUY/SELL + TP1/2/3 + SL |
| **Arquitectura** | ✅ | Definida: Listener Python + EA MQL5/MQL4 |

---

## 🏗️ Arquitectura Final del Producto

### Visión General

```
┌─────────────────────────────────────────────────────────────┐
│  CANAL DE TELEGRAM (Xisco)                                  │
│  - Señales: XAUUSD SELL/BUY + TP1/2/3 + SL                  │
│  - Modificaciones: "Movemos sl a XXXX"                      │
│  - Cierres: "Cerramos", "Cerramos +20pips"                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  LISTENER PYTHON (Servidor Central)                         │
│  - Escucha canal 24/7 via Telethon                          │
│  - Parsea señales según semántica                           │
│  - Detecta: ENTRY, SL_MODIFICATION, CLOSE                   │
│  - API REST para que los EAs consulten señales              │
└─────────────────────────────────────────────────────────────┘
                              ↓ API REST (polling)
┌─────────────────────────────────────────────────────────────┐
│  EA MQL5 / MQL4 (Instalado en terminal del cliente)         │
│  - Consulta señal actual al servidor cada 5-10s             │
│  - Ejecuta en MT4/MT5 del cliente                           │
│  - Parámetros configurables:                                │
│    * Capital, riesgo por operativa                          │
│    * Max promedios, distancia entre niveles                 │
│    * Gestión SL dinámica (+60→BE+20, +90→BE+50)            │
│    * Tipo de cuenta (cent, microlote, estándar)            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  TERMINAL MT4/MT5 DEL CLIENTE                               │
│  - Conectado a su broker (VT Markets, Infinox, etc)         │
│  - Ejecuta órdenes según el EA                              │
│  - Estado 100% local (sin compartir credenciales)           │
└─────────────────────────────────────────────────────────────┘
```

### Ventajas de Esta Arquitectura

| Aspecto | Bot Python Externo | EA Nativo MQL5/MQL4 ✅ |
|---------|-------------------|----------------------|
| **Seguridad** | Cliente comparte credenciales MT5 | ❌ No comparte nada ✅ |
| **Configuración** | Ajustes en servidor | ✅ Parámetros en el EA |
| **Riesgo** | Fijo o ajustable remoto | ✅ Cliente controla todo |
| **Broker** | Solo MT5 | ✅ MT4 + MT5 |
| **Dependencias** | Python, API MT5 | ✅ Solo terminal MT4/5 |
| **Comercialización** | Más complejo | ✅ "Instala y olvídate" |

---

## 📈 Análisis de Datos Históricos

### Dataset: `telegram_raw_messages.csv`

```
Total mensajes:      25,647
Periodo:             Junio 2024 - Septiembre 2024
Formato:             CSV con separador ;
Campos:              message_id, date_utc, text
```

### Patrones de Señales Identificados

#### 1. **Formato de Entrada**

```
Formatos detectados:
- "XAUUSD SELL"
- "Sell XAU/USD"
- "BUY XAUUSD"
- "sell XAUUSD" (case insensitive)

TP1, TP2, TP3:
- "tp 1 2316"
- "Tp2 2314"
- "tp 3 2313"

SL:
- "sl 2328"
- "SL 2326"
```

#### 2. **Modificaciones de SL**

```
Patrón:
- "Movemos sl a 2331"
- "Movemos sl a 2343"

Detectar: palabra "Movemos" + "sl" + número
```

#### 3. **Cierres**

```
Patrones:
- "Cerramos"
- "Cerramos +20pips"
- "Cerramos ambas +70pips"
- "Cerramos señal ✅✅✅"
- "Cerramos todo que hay noticias"
```

#### 4. **Confirmaciones de TP**

```
- "TP1✅✅✅"
- "TP2✅✅✅"
- "TP3✅✅✅"
- "Tocó tp2 pero me olvidé de avisar 😅😂"
```

### Estadísticas Aproximadas (muestreo de 100 mensajes)

| Tipo de Mensaje | Count | % |
|-----------------|-------|---|
| Señales (BUY/SELL) | ~15% | 3,850 |
| Modificaciones SL | ~10% | 2,565 |
| Cierres | ~8% | 2,052 |
| Confirmaciones TP | ~12% | 3,078 |
| Otros (conversación) | ~55% | 14,106 |

---

## 🔧 Análisis del Código Existente

### `señales_toni_v3_MONOCUENTA.py` (430 líneas)

#### Funcionalidades Implementadas

| Componente | Líneas | Descripción |
|------------|--------|-------------|
| **Telegram Listener** | 389-408 | Regex para BUY/SELL + "cerramos rango" |
| **MT5 Integration** | 104-125 | MetaTrader5 library, multi-cuenta |
| **Grid System** | 260-339 | Grid infinito sin duplicados, cierre por profit |
| **State Management** | 89-102 | JSON persistente (`state_{login}.json`) |
| **Trailing SL** | 218-243 | SL virtual con activate/back/step |
| **Multi-cuenta** | 44-84 | Soporta varias cuentas MT5 simultáneas |

#### Configuración YAML (`copiador_GUILLE.yml`)

```yaml
platform: MT5

telegram:
  api_id: 20993460
  api_hash: "ac9bc64d7e7ad98770a1ff17290a9fab"
  session: "bot_beta_demo.session"
  channels:
    - {id: 2164511324, access_hash: -4688926061597264256}  # Canal Xisco

accounts:
  - login: 11921504
    password: "^ss&m2aQ"
    server: "VTMarkets-Live"
    path: "C:/Bots/.../terminal64.exe"
    symbol: XAUUSD-STDc
    magic: 20250612

    entry:
      lot: 0.10
      num_orders: 1
      trailing:
        activate: 30      # +30 pips
        step: 10          # Mueve SL cada +10 pips

    promedios:
      step_pips: 10       # Distancia entre niveles
      lot: 0.10
      max: 40             # Max 40 niveles
      num_orders: 1
      tolerance_pips: 1
```

#### Diferencias con Operativa de Xisco

| Característica | Código (Toni) | Xisco (Resumen ChatGPT) |
|----------------|---------------|------------------------|
| **Max promedios** | 40 niveles | 4 (1 base + 3) |
| **Restricciones** | No detecta | RIESGO, SIN PROMEDIOS, SOLO 1 |
| **SL dinámico** | Trailing genérico | +60→BE+20, +90→BE+50 |
| **Formato señales** | "BUY XAUUSD" + "cerramos rango" | BUY/SELL + TP1/2/3 + SL + modificaciones |
| **Símbolo** | XAUUSD-STDc (VT Markets) | XAUUSD (varios brokers) |

**Conclusión**: El código de Toni es la **base técnica**, pero hay que adaptarlo a la operativa específica de Xisco.

---

## 🎯 Plan de Desarrollo Propuesto

### FASE 1: Backtester Fiable (Prioridad #1) - 2 semanas

#### 1.1 Normalizador de Señales Históricas

**Objetivo**: Convertir los 25,647 mensajes en un CSV limpio para backtesting.

**Script Python**: `signal_normalizer.py`

```python
# Input: telegram_raw_messages.csv (25,647 mensajes)
# Output: normalized_signals.csv

# Formato output:
timestamp;signal_type;side;price;tp1;tp2;tp3;sl;grid_level;restrictions;context
2024-06-10 12:22:31;ENTRY;SELL;2304;;2312;2310;2309;L00;[];new_signal
2024-06-10 12:31:09;CLOSE;SELL;;+20;;;;;ALL;[];manual_profit
2024-06-11 12:20:22;ENTRY;SELL;;2312;2310;2220;2315;L00;[];new_signal
2024-06-11 12:20:54;MODIFICATION;SELL;;;;2317;;L00;[];sl_adjusted
```

**Reglas de normalización**:
1. **ENTRY**: Detectar "BUY/SELL XAUUSD" + TP1/2/3 + SL
2. **MODIFICATION**: Detectar "Movemos sl a XXXX"
3. **CLOSE**: Detectar "Cerramos", "Cerramos +XXpips"
4. **CONTEXT**: Marcar si es nueva señal, modificación, o cierre

#### 1.2 EA MQL5 para Backtesting

**Objetivo**: EA que reproduzca la operativa en Strategy Tester de MT5.

**Características**:
- Leer `normalized_signals.csv`
- Reproducir entrada + grid + SL/TP + cierres
- Métricas: Win rate, DD, profit factor, trades totales
- Exportar resultados a CSV

**Output**:
```
=== BACKTEST RESULTS ===
Periodo:        2024-06-01 → 2024-09-30
Total señales:  127
Operaciones:    127
Win rate:       68.5%
Profit factor:  1.95
DD máximo:      -8.3%
Profit neto:    +$3,245
=========================
```

#### 1.3 Validación

- Comparar backtest con operativa real (si hay datos)
- Ajustar normalizador hasta >95% precisión
- Documentar edge cases y cómo se resuelven

---

### FASE 2: EA MQL5/MQL4 para Producción - 3 semanas

#### 2.1 EA Base (MQL5 + MQL4)

**Funcionalidades**:
1. **Conexión al servidor central**:
   - HTTP GET cada 5-10s a API REST
   - Obtener señal actual: `{side, tp1, tp2, tp3, sl, restrictions}`
   - Cache local de última señal

2. **Sistema de promedios**:
   - Max 4 niveles (1 base + 3 promedios)
   - Distancias: -30, -60, -90 pips (configurable)
   - Dinámico según restricciones del canal

3. **Gestión SL dinámica**:
   - +60 pips → SL a BE +20
   - +90 pips → SL a BE +50
   - Sin BE prematuro

4. **Cierres**:
   - Detectar "Cerramos TODO" → cerrar todo
   - Detectar "Cerramos PROMEDIO" → cerrar promedios
   - Cierre por TP1/2/3

5. **Parámetros configurables**:
   ```mql5
   input double Capital = 500;           // Capital disponible
   input double RiskPercent = 2.0;       // Riesgo por operativa (%)
   input int MaxPromedios = 3;           // Max promedios (0-3)
   input int PromedioStep1 = 30;         // Distancia promedio 1 (pips)
   input int PromedioStep2 = 60;         // Distancia promedio 2 (pips)
   input int PromedioStep3 = 90;         // Distancia promedio 3 (pips)
   input int BETrigger1 = 60;            // Trigger BE+20 (pips)
   input int BETrigger2 = 90;            // Trigger BE+50 (pips)
   input string AccountType = "cent";    // cent/standard/microlote
   ```

#### 2.2 Calculadora de Riesgo

**Algoritmo**:
```mql5
// 1. Riesgo máximo = Capital × (RiskPercent / 100)
double maxRisk = Capital * (RiskPercent / 100.0);

// 2. SL promedio (de la señal)
double slPips = MathAbs(slPrice - entryPrice) / _Point;

// 3. Valor por pip = maxRisk / slPips
double valuePerPip = maxRisk / slPips;

// 4. Lote según tipo de cuenta
double lot = valuePerPip / getPipValue(AccountType);
```

**Adaptadores por broker**:
```mql5
enum ENUM_BROKER {
    BROKER_VTMARKETS,      // Cent account
    BROKER_INFINOX,        // Microlote
    BROKER_GENERIC         // Standard
};

double getPipValue(ENUM_BROKER broker) {
    switch(broker) {
        case BROKER_VTMARKETS:  return 10.0;   // $10/pip/lot
        case BROKER_INFINOX:    return 0.10;   // $0.10/pip/lot (microlote)
        case BROKER_GENERIC:    return 10.0;   // $10/pip/lot
    }
}
```

---

### FASE 3: Servidor Central (Python) - 2 semanas

#### 3.1 Listener de Telegram

**Basado en**: `señales_toni_v3_MONOCUENTA.py`

**Modificaciones**:
- Adaptar regex a formato de Xisco (TP1/2/3, SL)
- Detectar restricciones: "RIESGO", "SIN PROMEDIOS", "SOLO 1 PROMEDIO"
- Parsear "Movemos sl a XXXX"
- Parsear cierres parciales

**Estado persistente**:
```python
{
    "current_signal": {
        "side": "BUY",
        "entry": 2315.0,
        "tp1": 2317.0,
        "tp2": 2319.0,
        "tp3": 2321.0,
        "sl": 2295.0,
        "restrictions": [],
        "updated_at": "2024-06-10T12:22:31Z"
    },
    "is_active": True
}
```

#### 3.2 API REST

**Endpoints**:
```
GET /api/v1/signal
Response: {
    "side": "BUY",
    "entry": 2315.0,
    "tp1": 2317.0,
    "tp2": 2319.0,
    "tp3": 2321.0,
    "sl": 2295.0,
    "restrictions": [],
    "updated_at": "2024-06-10T12:22:31Z"
}

GET /api/v1/health
Response: {"status": "ok", "uptime": 123456}
```

**Stack**:
- FastAPI (Python)
- Uvicorn (ASGI server)
- Health checks + monitoring

---

### FASE 4: Dashboard Web + Multi-tenant - 3 semanas

#### 4.1 Onboarding

1. **Registro**: Email + password
2. **Configuración inicial**:
   - Capital disponible
   - Riesgo por operativa (%)
   - Broker (VT Markets, Infinox, Otro)
   - Tipo de cuenta (cent, microlote, estándar)
3. **Descarga del EA**:
   - Generar EA personalizado con config
   - Instrucciones de instalación en MT4/MT5

#### 4.2 Dashboard

- Estado de señal actual
- Posiciones abiertas
- PnL del día/semana/mes
- Histórico de operaciones
- Configuración de parámetros

#### 4.3 Multi-tenant + Pagos

- PostgreSQL + Prisma (schema multi-tenant)
- Stripe integration
- Planes: Basic ($49), Pro ($99), Enterprise ($249)

---

### FASE 5: Testing + Deploy - 1 semana

- Tests E2E del EA en MT5 Strategy Tester
- Load testing del API REST
- Deploy a VPS (Listener)
- Landing page de ventas
- Documentación de usuario

---

## 📁 Estructura Final del Proyecto

```
trading-bot-saas/
├── backend/                      # Servidor Central (Python)
│   ├── src/
│   │   ├── telegram_listener.py  # Listener de Telegram
│   │   ├── signal_parser.py      # Parser de señales
│   │   ├── api.py                # FastAPI REST
│   │   └── state_manager.py      # Estado persistente
│   ├── config.yml                # Configuración (Telegram API)
│   └── requirements.txt
│
├── eas/                          # Expert Advisors MQL5/MQL4
│   ├── XiscoBot_MQL5/            # EA para MT5
│   │   ├── XiscoBot.mq5          # Código fuente
│   │   └── XiscoBot.ex5          # Compilado
│   └── XiscoBot_MQL4/            # EA para MT4
│       ├── XiscoBot.mq4
│       └── XiscoBot.ex4
│
├── backtester/                   # Herramientas de backtesting
│   ├── signal_normalizer.py      # Normaliza CSV de Telegram
│   ├── normalized_signals.csv    # Output limpio
│   └── BacktesterEA.mq5          # EA para Strategy Tester
│
├── web/                          # Dashboard Next.js
│   ├── app/
│   ├── components/
│   └── lib/
│
├── docs/
│   ├── telegram_raw_messages.csv # 25,647 mensajes
│   ├── ANALISIS_COMPLETO.md      # Este documento
│   └── datos-historicos/
│
├── codigo-existente/             # Código original (referencia)
│   ├── señales_toni_v3_MONOCUENTA.py
│   └── copiador_GUILLE.yml
│
└── .ralph/specs/
    ├── PRD.md                    # PRD actualizado
    └── BACKTEST_SPECS.md         # Specs del backtester
```

---

## 🚀 Próximos Pasos Inmediatos

### 1. Commit del estado actual

```powershell
cd C:\Users\guill\Projects\trading-bot-saas
git add .
git commit -m "feat: add existing code and telegram data

- Added señales_toni_v3_MONOCUENTA.py (reference code)
- Added copiador_GUILLE.yml (config)
- Added telegram_raw_messages.csv (25,647 messages)
- Created ANALISIS_COMPLETO.md with full analysis
- Updated PRD with EA MQL5/MQL4 architecture"
```

### 2. Lanzar Agente Explore

Analizar en profundidad:
- Estructura del código Python
- Patrones de las señales en los 25,647 mensajes
- Edge cases a considerar

### 3. Decidir: ¿Ralph Loop o Desarrollo Manual?

**Opción A: Ralph Loop**
- Ventaja: Desarrollo autónomo de todo el sistema
- Requiere: PRD ultra-detallado con specs técnicas

**Opción B: Desarrollo Manual con Agentes**
- Ventaja: Más control sobre cada componente
- Enfoque: Feature por feature con oversight

**Recomendación**: Para este proyecto, **Opción B** (desarrollo manual con agentes especializados) porque:
1. El backtester requiere análisis cuidadoso de los datos
2. El EA MQL5/MQL4 requiere testing meticuloso
3. La arquitectura es compleja ( Listener Python + EA nativo)

---

## ❓ Preguntas Pendientes

1. **¿Quieres un export más reciente de Telegram?** (Los datos son de septiembre 2024)
2. **¿Prioridad absoluta**: Backtester primero, o quieres desarrollo paralelo del EA?
3. **¿Servidor central**: ¿Lo hosting tú o lo incluimos en el SaaS?
4. **¿Nombre del producto**? (Para branding, dominio, etc.)

---

## 📊 Métricas de Éxito

### Backtester
- ✅ Precisión >95% vs operativa real
- ✅ Velocidad: 1 año en <5 minutos
- ✅ Métricas claras: DD, win rate, profit factor

### EA MQL5/MQL4
- ✅ Sin errores en Strategy Tester (1000+ trades)
- ✅ Latencia: Señal → Ejecución <3s
- ✅ 100% configuración por parámetros (sin hardcode)

### Producto SaaS
- ✅ Time-to-first-trade: <15 minutos
- ✅ Onboarding autoservicio
- ✅ Churn rate: <5% mensual
