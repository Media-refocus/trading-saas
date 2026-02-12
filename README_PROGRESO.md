# Trading Bot SaaS - Estado del Desarrollo

## 📊 Última actualización: 12 Feb 2025

---

## ✅ FASE 1: FUNDACIÓN COMPLETADA

### Commit 1: Setup Next.js 14 con TypeScript y Tailwind
- ✅ Proyecto Next.js 15 creado
- ✅ TypeScript strict mode
- ✅ Tailwind CSS con tema custom
- ✅ ESLint + Prettier configurados
- ✅ Landing page básica

### Commit 2: Schema Multi-tenant Prisma
- ✅ Modelos: Tenant, User, TradingAccount, Signal, Position, Subscription
- ✅ Multi-tenancy implementado (tenantId en todas las tablas)
- ✅ Cliente Prisma singleton
- ✅ Variables de entorno configuradas

### Commit 3: NextAuth.js
- ✅ Provider Credentials con email/password
- ✅ Login/Registro funcionales
- ✅ TenantId en sesión para multi-tenancy
- ✅ Pages: /login, /register

### Commit 4: tRPC Server y Cliente
- ✅ tRPC v11 configurado
- ✅ Routers: auth, tenant
- ✅ Superjson para serialización
- ✅ API route /api/trpc/[trpc]
- ✅ Provider React configurado

### Commit 5: Componentes shadcn/ui
- ✅ Button, Card, Input, Label
- ✅ Utilidad cn() para class merging
- ✅ Tailwind theme completo

### Commit 6: Estructura de Carpetas y Layouts
- ✅ Layout de dashboard con navegación
- ✅ Páginas: Dashboard, Backtester, Settings
- ✅ Navbar con links
- ✅ Protección de rutas con auth

### Commit 7: Schema Backtester
- ✅ Modelo Backtest (ejecuciones y resultados)
- ✅ Modelo SimulatedTrade (operaciones de simulación)
- ✅ Relaciones multi-tenant
- ✅ Parámetros como JSON
- ✅ Métricas: profit, winRate, maxDrawdown, profitFactor

---

## 🚧 FASE 2: BACKTESTER WEB (En progreso)

### Pendiente:
- [ ] Descargar ticks históricos XAUUSD (18 meses)
- [ ] Motor de simulación en TypeScript
- [ ] API endpoints tRPC
- [ ] Interfaz de configuración
- [ ] Visualizador en tiempo real con acelerador
- [ ] Página de resultados

---

## 📋 FASE 3: SISTEMA DE SEÑALES (Pendiente)

### Pendiente:
- [ ] Bot Python modificado para leer de API SaaS
- [ ] Endpoint: GET /api/signals/pending
- [ ] Distribución automática a bots conectados
- [ ] Logs de ejecución por cliente

---

## 💳 FASE 4: PAGOS Y SUSCRIPCIONES (Pendiente)

### Pendiente:
- [ ] Integración Stripe completa
- [ ] Planes: Free, Pro, Enterprise
- [ ] Sistema de desactivación por no pago
- [ ] API key rotativa mensual

---

## 📐 MODELO DE NEGOCIO CONFIRMADO

### Bot de Trading
- **Ubicación:** VPS del cliente (NO tocamos su dinero)
- **Arquitectura:**
  ```
  Cliente → Web SaaS → Configura operativa
                    ↓
  Bot Python (VPS cliente) → Lee de API SaaS
                    ↓
  MT5 del cliente → Ejecuta operaciones
  ```
- **Protección:** Bot se autentica contra SaaS, si no paga → DEJA de funcionar
- **Código:** NUNCA sale de nuestro servidor (seguro)

### Backtester Web
- **100% web:** No requiere MT5 instalado
- **Datos:** CSV señales + Ticks XAUUSD (18 meses)
- **Modos:**
  - Rápido: Resultados en segundos
  - Visualización: Reproduce ticks en tiempo real con acelerador (1x-100x)

### VPS Afiliados
- **Proveedor:** Contabo (recomendado)
  - Datacenter cerca de Londres
  - Programa de afiliados 10% recurrente
  - Precio: ~5-8€/mes por 4GB RAM

---

## 📁 ESTRUCTURA DEL PROYECTO

```
trading-bot-saas/
├── app/
│   ├── (auth)/          # Login, Register
│   ├── (dashboard)/     # Dashboard protegido
│   ├── api/            # API routes
│   ├── globals.css
│   └── layout.tsx
├── components/
│   └── ui/             # shadcn/ui components
├── lib/
│   ├── auth.ts         # NextAuth config
│   ├── prisma.ts       # Prisma client
│   ├── trpc.ts         # tRPC client
│   └── utils.ts
├── prisma/
│   └── schema.prisma   # Database schema
├── server/
│   └── api/trpc/       # tRPC server
└── codigo-existente/    # Bot Python (referencia)
```

---

## 🎯 PRÓXIMOS PASOS (Priorizados)

### IMEDIATO (Hoy/Mañana):
1. **Documentación para OpenClaw**
   - README con instrucciones de setup
   - Comandos npm necesarios
   - Estructura explicada

2. **Motor de Backtester**
   - Implementar lógica del grid
   - Implementar trailing SL virtual
   - Simulación de operaciones

### CORTO PLAZO (Esta semana):
3. **API de Backtester**
   - Endpoints tRPC
   - Cola de ejecuciones
   - Storage de resultados

4. **Interfaz de Backtester**
   - Formulario de parámetros
   - Visualizador en tiempo real
   - Tabla de resultados

### MEDIO PLAZO (Próximas 2 semanas):
5. **Sistema de Señales**
   - Modificar bot Python
   - API de distribución
   - Conexión multi-tenant

---

## 💬 PREGUNTAS PENDIENTES (Para usuario)

1. **Bot Python:** ¿num_orders = 1 o 2 por señal?
2. **Bot Python:** ¿TP siempre 20 pips desde precio promedio?
3. **Backtester:** ¿Qué alertas de riesgo mostrar?
4. **GitHub:** ¿Crear repositorio nuevo o usar uno existente?

---

## 🔗 RECURSOS

- **Documentación Next.js:** https://nextjs.org/docs
- **Prisma:** https://www.prisma.io/docs
- **tRPC:** https://trpc.io/docs
- **shadcn/ui:** https://ui.shadcn.com

---

## 👤 CLAUDE CODE

Para trabajar en este proyecto desde OpenClaw:

```bash
# 1. Clonar el repositorio
git clone https://github.com/[REPO]/trading-bot-saas.git

# 2. Instalar dependencias
npm install

# 3. Iniciar desarrollo
npm run dev

# 4. La web estará en http://localhost:3000
```

**Archivos clave que abrir en OpenClaw:**
- `app/(dashboard)/backtester/page.tsx` - Página del backtester
- `server/api/trpc/routers/` - Routers tRPC
- `lib/auth.ts` - Configuración de autenticación
- `prisma/schema.prisma` - Schema de base de datos

**Comandos útiles:**
- `npm run build` - Compilar para producción
- `npm run lint` - Verificar errores
- `npm run format` - Formatear código
