# Trading Bot SaaS - Estructura del Proyecto

> Plataforma multi-tenant para replicación automática de señales de trading de Telegram

---

## 📁 Estructura de Carpetas

```
trading-bot-saas/
│
├── .ralph/                          # ⭐ Sistema Ralph Loop
│   ├── PROMPT.md                    # Instrucciones de autodesarrollo
│   └── specs/
│       └── PRD.md                   # Product Requirements Document completo
│
├── docs/                            # 📚 Documentación del proyecto
│   └── [SUBE AQUÍ LA INFO]
│       ├── capturas-bot.png
│       ├── diagrama-flujo.md
│       ├── specs-tecnicas.md
│       └── etc...
│
├── codigo-existente/                # 💾 Código base actual (referencia)
│   └── [SUBE AQUÍ EL CÓDIGO DEL BOT]
│       ├── bot.py (o bot.js)
│       ├── config.py
│       └── etc...
│
├── CLAUDE.md                        # Convenciones del proyecto (stack, comandos)
├── ralph-loop.ps1                   # Script de autodesarrollo (se creará después)
└── README.md                        # Este archivo
```

---

## 🤖 ¿Qué es Ralph Loop?

**Ralph** es una técnica de desarrollo autónomo donde Claude Code se ejecuta en loop, implementando features una por una desde el PRD, haciendo commit después de cada una.

### Cómo funciona:

```
┌─────────────────────────────────────────────────────────────┐
│  ITERACIÓN 1                                                │
│  ├─ Lee PROMPT.md → "1. Setup proyecto Next.js"            │
│  ├─ Implementa el setup                                     │
│  ├─ Verifica que compila                                    │
│  └─ Commit: "feat: setup proyecto Next.js + TypeScript"    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ITERACIÓN 2                                                │
│  ├─ Lee PROMPT.md → "2. Configurar Prisma multi-tenant"    │
│  ├─ Implementa Prisma con schema                           │
│  ├─ Verifica que compila                                    │
│  └─ Commit: "feat: setup Prisma con esquema multi-tenant"  │
└─────────────────────────────────────────────────────────────┘
                              ↓
                        ... continúa ...
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ITERACIÓN N                                                │
│  ├─ No quedan features pendientes                          │
│  └─ Respuesta: "RALPH_COMPLETE"                            │
└─────────────────────────────────────────────────────────────┘
```

### Ventajas:

✅ **Automático**: No necesitas estar presente
✅ **Incremental**: Un commit por feature, fácil revertir
✅ **Traceable**: `git log` muestra todo el progreso
✅ **Sin distraerse**: Solo implementa lo del PRD
✅ **Continuo**: Puedes dejarlo trabajando toda la noche

---

## 🚀 Cómo Arrancar Ralph

### Paso 1: Sube la info del bot existente

Coloca en `docs/`:
- Capturas del bot funcionando
- Explicación de cómo funciona
- Diagramas de flujo
- Specs técnicas

Coloca en `codigo-existente/`:
- Todo el código del bot actual
- Configuraciones
- Archivos de entorno de ejemplo (sin secrets)

### Paso 2: Actualiza el PRD

Edita `.ralph/specs/PRD.md` y rellena:
- **Qué exchange usa** (Binance, Bybit, etc)
- **Qué librería de Telegram** usa
- **Formato de las señales** que parsea
- **Edge cases** que hayas encontrado
- **Cualquier detalle técnico importante**

### Paso 3: Lanza el loop

```powershell
# Entrar en el proyecto
cd C:\Users\guill\Projects\trading-bot-saas

# Inicializar git (si aún no está hecho)
git init
git add .
git commit -m "feat: initial project structure"

# Lanzar Ralph en background (monitoreo)
Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File ralph-loop.ps1 -Monitor'

# O lanzar Ralph sin monitoreo (más rápido)
powershell -ExecutionPolicy Bypass -File ralph-loop.ps1
```

### Paso 4: Monitorea el progreso

```powershell
# Ver log en tiempo real
Get-Content C:\Users\guill\Projects\trading-bot-saas\ralph-loop.log -Wait

# Ver commits
git log --oneline

# Ver estado actual
git status
```

---

## 🎯 Orden de Implementación

Ver `.ralph/PROMPT.md` para el orden completo de 32 features:

1. **Foundation** (1-4): Setup, DB, Auth
2. **Core Bot** (5-8): Migración, exchange, Telegram, ejecución
3. **Dashboard Cliente** (9-13): UI, config, positions
4. **Dashboard Admin** (14-16): Gestión tenants
5. **Pagos** (17-20): Stripe, planes, webhooks
6. **Onboarding** (21-24): Flow guía, notificaciones
7. **Testing** (25-28): Tests, CI/CD, deploy
8. **Polish** (29-32): Performance, docs, landing

---

## 📋 Checklist Pre-Ralph

Antes de lanzar Ralph, asegúrate de:

- [ ] **Código existente** subido a `codigo-existente/`
- [ ] **Documentación** en `docs/` con specs del bot
- [ ] **PRD actualizado** con detalles técnicos específicos
- [ ] **Variables de entorno** identificadas (qué API keys necesita)
- [ ] **Diagrama de flujo** de la operativa actual

---

## 🔍 Sistema de Agentes (Alternativa)

Si prefieres no usar Ralph, también puedo lanzar **agentes especializados** para:

1. **Explore Agent**: Analiza todo el código existente
   ```bash
   Task: Explora codigo-existente/ y documenta:
   - Qué hace cada archivo
   - Dependencias clave
   - Patrones de diseño usados
   - Technical debt o problemas
   ```

2. **Plan Agent**: Diseña la arquitectura del SaaS
   ```bash
   Task: Diseña arquitectura multi-tenant para:
   - Schema de DB
   - Separación frontend/bot
   - Sistema de colas para trades
   - Estrategia de deployment
   ```

3. **General Purpose Agent**: Implementa features específicas
   ```bash
   Task: Implementa la integración con Binance API
   ```

---

## 🆘 Ayuda

- **Ver progresos**: `git log --oneline --graph`
- **Ver logs**: `cat ralph-loop.log`
- **Deter loop**: Ctrl+C en la terminal de Ralph
- **Reanudar**: Ralph detecta dónde se quedó y continúa

---

## 💾 Database Backups (Supabase)

> **Critical Production Documentation**

### Automatic Backups

Supabase proporciona backups automáticos diarios para todas las bases de datos:

| Feature | Detalle |
|---------|---------|
| **Frecuencia** | Daily (cada 24h) |
| **Retención** | 30 días |
| **Tipo** | Full database snapshot |
| **Incluye** | Schema + Data + Extensions |

### Cómo Restaurar desde Backup

1. **Acceder al Dashboard de Supabase**
   - URL: https://supabase.com/dashboard
   - Seleccionar el proyecto: Trading Bot SaaS

2. **Navegar a Backups**
   - Settings → Database → Backups
   - Ver lista de backups disponibles con fecha y hora

3. **Restaurar**
   - Click en "Restore" junto al backup deseado
   - Confirmar la acción (irreversible)
   - **⚠️ ADVERTENCIA:** La restauración sobrescribe toda la BD actual

### Procedimiento de Emergencia

```bash
# 1. Notificar al equipo
# Email/SMS a stakeholders sobre incidente

# 2. Acceder a Supabase Dashboard
# https://supabase.com/dashboard/project/[PROJECT_ID]/database/backups

# 3. Seleccionar el backup más reciente antes del incidente

# 4. Click "Restore" y confirmar

# 5. Verificar integridad post-restauración
# - Check tenant data isolation
# - Verify user authentication
# - Test critical API endpoints

# 6. Documentar incidente
# - Causa raíz
# - Tiempo de recuperación
# - Lecciones aprendidas
```

### Contacto de Soporte Supabase

| Canal | Detalle |
|-------|---------|
| **Dashboard Support** | https://supabase.com/dashboard/support |
| **Email** | support@supabase.com |
| **Docs** | https://supabase.com/docs/guides/platform/backups |
| **Status Page** | https://status.supabase.com |

### Best Practices

- ✅ Verificar backups semanales en el dashboard
- ✅ Documentar cualquier restauración en `tasks/incidents.md`
- ✅ Mantener secrets de Supabase seguros (no en código)
- ❌ No confiar únicamente en backups automáticos para datos críticos
- ❌ No hacer cambios de schema sin verificar backup reciente

### Backup Manual (Opcional)

Para backups adicionales antes de operaciones críticas:

```bash
# Usando pg_dump con Supabase connection string
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup manual
psql "$DATABASE_URL" < backup_20260308_120000.sql
```

---

## 📊 Estado Actual

- ✅ Estructura creada
- ⏳ Esperando documentación del bot existente
- ⏳ Esperando código base del bot
- ⏳ PRD pendiente de completar con specs específicas
