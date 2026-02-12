# Guía para OpenClaw - Trading Bot SaaS

## 🚀 Setup Inicial (Una sola vez)

### 1. Instalar dependencias necesarias

```bash
# Node.js y npm (si no están instalados)
# En Windows: Descargar installer desde nodejs.org

# Instalar dependencias del proyecto
npm install
```

### 2. Configurar variables de entorno

El proyecto ya tiene `.env.local` configurado. NO tocar a menos que sea necesario.

### 3. Iniciar servidor de desarrollo

```bash
npm run dev
```

El servidor arrancará en: **http://localhost:3000**

---

## 📂 Estructura del Proyecto

### Archivos principales para trabajar:

```
app/
├── (dashboard)/
│   ├── backtester/page.tsx     ⭐ PÁGINA PRINCIPAL DEL BACKTESTER
│   ├── dashboard/page.tsx      # Dashboard principal
│   └── settings/page.tsx        # Configuración de cuenta
├── api/
│   └── trpc/
│       └── routers/              ⭐ ENDPOINTS API
lib/
├── auth.ts                    # Configuración NextAuth
├── prisma.ts                  # Cliente base de datos
└── trpc-provider.tsx          # Provider de tRPC
```

---

## 🎯 Tareas Actuales

### Estamos en: FASE 2 - BACKTESTER WEB

**Ya completado:**
- ✅ Schema de base de datos para backtester
- ✅ Modelos: Backtest, SimulatedTrade

**Trabajando AHORA:**
- 🚧 Motor de simulación de trading
- 🚧 API endpoints del backtester
- 🚧 Interfaz de configuración

---

## 💻 Cómo trabajar en este proyecto

### Modificar páginas React/Next.js:

1. **Abrir el archivo** que quieres modificar
2. **Los cambios se reflejan automáticamente** en http://localhost:3000
3. **Si hay errores de TypeScript:**
   - Leer terminal
   - Corregir y guardar

### Añadir nuevas funcionalidades:

1. **Routers tRPC** (server/api/trpc/routers/):
   ```typescript
   // Ejemplo de nuevo endpoint
   export const backtesterRouter = router({
     nuevoEndpoint: procedure
       .input(z.object({ /* validación */ }))
       .mutation(async ({ input }) => {
         // lógica aquí
       }),
   });
   ```

2. **Páginas** (app/):
   - Usar componentes de `components/ui/`
   - Usar tRPC para llamar a la API
   - Ejemplo en `app/(dashboard)/backtester/page.tsx`

### Base de datos (Prisma):

```bash
# Para ver el schema actual
cat prisma/schema.prisma

# Para generar el cliente después de cambios
npx prisma generate

# Para hacer migración (cuando tengamos BD real)
npx prisma migrate dev
```

---

## 🔧 Comandos útiles

```bash
# Desarrollo
npm run dev              # Arrancar servidor dev
npm run build            # Compilar para producción
npm run start            # Arrancar servidor prod

# Base de datos
npx prisma studio       # Interfaz gráfica de BD
npx prisma generate     # Regenerar cliente tras schema changes

# Calidad de código
npm run lint            # Verificar errores
npm run format          # Formatear todo el código
```

---

## 📝 Lógica del Backtester (Para implementar)

### Referencia: Código Python

Ver archivo: `codigo-existente/señales_toni_v3_MONOCUENTA.py`

### Funcionalidades clave:

1. **Trailing Stop Loss Virtual** (línea 218-243)
   - Activa después de X pips a favor
   - Se mueve con el precio
   - Cierra operaciones si retrocede

2. **Grid Infinito** (línea 260-339)
   - Distancia entre niveles: `step_pips`
   - Cada nivel puede tener múltiples operaciones
   - Se cierran por escalones (20 pips de profit)

3. **Cierre Escalonado**
   - Cada nivel se cierra independientemente
   - Nivel 0 se cierra por SL virtual
   - El resto se cierra en +20 pips

---

## 🤝 Siguiente pasos para OpenClaw

### PRIORIDAD ALTA (Esta semana):

1. **Completar motor de backtester**
   - Archivo: `lib/backtest-engine.ts`
   - Simular operaciones como el bot Python

2. **Crear API endpoints**
   - Archivo: `server/api/trpc/routers/backtester.ts`
   - Ruta para ejecutar backtests
   - Ruta para obtener resultados

3. **Interfaz de backtester**
   - Archivo: `app/(dashboard)/backtester/page.tsx`
   - Formulario de parámetros
   - Botón ejecutar

### PRIORIDAD MEDIA (Próximas 2 semanas):

4. **Visualizador en tiempo real**
   - Gráfico de precio con operaciones
   - Acelerador 1x-100x
   - Ver cómo se ejecuta la operativa

5. **Resultados de backtest**
   - Métricas: profit, drawdown, win rate
   - Gráficos de equity
   - Tabla de operaciones

---

## ❓ Dudas frecuentes

**P: ¿Cómo pruebo que funciona?**
R: Entra a http://localhost:3000, haz login, ve a /backtester

**P: ¿Necesito base de datos real?**
R: No aún. Estamos en desarrollo. Cuando necesites:
   - Instalar PostgreSQL local o usar Supabase
   - Copiar DATABASE_URL de .env.local

**P: ¿Cómo sé qué archivos modificar?**
R: Lee README_PROGRESO.md para ver el estado actual

**P: ¿Puedo hacer commits?**
R: ¡SÍ! Haz commits con mensajes descriptivos.

---

## 📞 Contacto con Claude

Si hay dudas:
- **Revisar:** README_PROGRESO.md (estado detallado)
- **Preguntar:** En el chat actual
- **Contexto:** Todo está documentado en este archivo

---

## 🎯 Objetivo: Lanzar MVP en 4-6 semanas

Fase actual: **Backtester Web** (Semana 2 de 8)

Siguiente fase: **Sistema de Señales + Bot Python** (Semana 4-6)
