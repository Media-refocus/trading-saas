# 🚀 PROMPT PARA NUEVA TERMINAL (Claude Code)

## 📋 ESTADO ACTUAL - 13 FEB 2026

### ✅ LO QUE ESTÁ FUNCIONANDO

**1. Backtester Web Completo**
- UI en `app/(dashboard)/backtester/page.tsx`
- Router tRPC en `server/api/trpc/routers/backtester.ts`
- Motor de simulación en `lib/backtest-engine.ts`
- Parser de señales en `lib/parsers/signals-csv.ts`

**2. Datos Disponibles**
- `signals_simple.csv`: 774 señales (Oct 2025 - Feb 2026)
- `signals_parsed.csv`: 154 señales (Jun 2024 - Ene 2026) - parser básico
- `docs/telegram_raw_messages.csv`: 38,693 mensajes raw de Telegram

**3. Ticks MT5**
- Script: `scripts/download_mt5_ticks.py`
- 96 millones de ticks descargados de XAUUSD (2024-2026)
- Archivo: `data/ticks/XAUUSD_2024.csv.gz` (puede estar incompleto si se cortó)

---

## 🎯 PRÓXIMOS PASOS (cuando vuelvas)

### Inmediato:
1. Verificar que el archivo de ticks se guardó completo:
   ```bash
   ls -la data/ticks/
   ```
2. Si está incompleto o no existe, volver a ejecutar:
   ```bash
   python scripts/download_mt5_ticks.py --symbol XAUUSD --start 2024-01-01 --end 2026-02-13
   ```

### Para probar el backtester:
```bash
cd C:\Users\guill\projects\trading-bot-saas
npm run dev
# Ir a http://localhost:3000/login (crear cuenta)
# Ir a http://localhost:3000/backtester
```

### Mejoras pendientes:
1. **Integrar ticks reales** en el backtester (ahora usa sintéticos)
2. **Mejorar parser de señales** - el archivo `signals_simple.csv` tiene 774 señales pero los mensajes raw tienen datos desde Jun 2024
3. **Probar diferentes configuraciones** de grid/TP/SL

---

## 📂 ARCHIVOS CLAVE

| Archivo | Descripción |
|---------|-------------|
| `lib/backtest-engine.ts` | Motor de simulación con grid y trailing SL |
| `lib/parsers/signals-csv.ts` | Parser de CSV de señales |
| `server/api/trpc/routers/backtester.ts` | Router tRPC con endpoints |
| `app/(dashboard)/backtester/page.tsx` | UI del backtester |
| `scripts/download_mt5_ticks.py` | Script para descargar ticks de MT5 |
| `scripts/parse_telegram_signals.py` | Parser de mensajes de Telegram |

---

## 🔧 STACK TECNOLÓGICO

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Backend:** tRPC v11, Prisma ORM
- **UI:** shadcn/ui (Button, Card, Input, Label)
- **Database:** PostgreSQL (no usada aún en el backtester)

---

## 📊 PARÁMETROS DEL BACKTESTER

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| lotajeBase | 0.1 | Tamaño de lote |
| numOrders | 1 | Órdenes por señal |
| pipsDistance | 10 | Distancia entre niveles |
| maxLevels | 4 | Máximo promedios |
| takeProfitPips | 20 | TP desde precio promedio |
| useStopLoss | false | Activar SL de emergencia |
| restrictionType | - | RIESGO / SIN_PROMEDIOS / SOLO_1_PROMEDIO |

---

## 📝 COMMITS DE ESTA SESIÓN

1. `feat: backtester web funcional con grid y promedios`
2. `feat: script para descargar ticks historicos de MT5`
3. `feat: parser de senales de Telegram + senales extraidas`

---

## 🚀 ¡A CONTINUAR!

Cuando vuelvas, ejecuta:
```bash
cd C:\Users\guill\projects\trading-bot-saas
npm run dev
```

Y abre http://localhost:3000/backtester
