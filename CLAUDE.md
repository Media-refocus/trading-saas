# 🚀 PROMPT PARA NUEVA TERMINAL (Claude Code)

## 📋 ESTADO ACTUAL - 13 FEB 2026 (FIN DE SESION)

### ⚠️ PROBLEMA PENDIENTE - BASE DE DATOS

**Situación:** La base de datos SQLite (`prisma/dev.db`) quedó en estado inconsistente:
- El archivo existe pero está vacío (0 bytes)
- No se pudo eliminar porque quedó bloqueado por un proceso
- El registro de usuarios no funciona hasta que se arregle

**Solución al retomar:**
```bash
cd C:\Users\guill\projects\trading-bot-saas

# 1. Asegurarse de que no hay procesos node corriendo
taskkill /F /IM node.exe

# 2. Eliminar la BD corrupta
rm -f prisma/dev.db prisma/dev.db-journal

# 3. Recrear la BD
npx prisma db push

# 4. Regenerar el cliente Prisma
npx prisma generate

# 5. Arrancar el servidor
npm run dev
```

---

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
- Archivo: `data/ticks/XAUUSD_2024.csv.gz`

**4. Sistema de Autenticación**
- Registro: `app/api/register/route.ts`
- Login: Usa NextAuth con credentials
- Schema Prisma completo con Tenant, User, Session, etc.

---

## 🎯 PRÓXIMOS PASOS (cuando vuelvas)

### Paso 1: Arreglar la base de datos
Ejecutar los comandos de arriba para recrear la BD.

### Paso 2: Probar el registro
```bash
# Crear usuario de prueba
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"123456"}'
```

### Paso 3: Probar el backtester
- Ir a http://localhost:3000/login
- Crear cuenta / loguearse
- Ir a http://localhost:3000/backtester

### Mejoras pendientes:
1. **Integrar ticks reales** en el backtester (ahora usa sintéticos)
2. **Mejorar parser de señales** - el archivo `signals_simple.csv` tiene 774 señales pero los mensajes raw tienen datos desde Jun 2024
3. **Probar diferentes configuraciones** de grid/TP/SL

---

## 📂 ARCHIVOS CLAVE

| Archivo | Descripción |
|---------|-------------|
| `prisma/schema.prisma` | Schema completo: Tenant, User, Signal, Position, Backtest, etc. |
| `app/api/register/route.ts` | Endpoint de registro de usuarios |
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
- **Database:** SQLite (desarrollo local) / PostgreSQL (producción)
- **Auth:** NextAuth con credentials provider

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

1. `b375cfa` feat: cambiar a SQLite para desarrollo local
2. `d3d185d` docs: actualizar CLAUDE.md con estado de la sesion 13 Feb 2026
3. `7f47a3b` feat: parser de senales de Telegram + senales extraidas
4. `3166a80` feat: script para descargar ticks historicos de MT5
5. `bd332da` feat: backtester web funcional con grid y promedios

---

## 🚀 ¡A CONTINUAR!

```bash
cd C:\Users\guill\projects\trading-bot-saas

# Si la BD está rota:
taskkill /F /IM node.exe
rm -f prisma/dev.db prisma/dev.db-journal
npx prisma db push
npx prisma generate

# Arrancar:
npm run dev
```

Y abre http://localhost:3000/backtester
