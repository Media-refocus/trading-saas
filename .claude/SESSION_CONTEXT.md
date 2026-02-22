# Contexto de Sesión - Trading Bot SaaS

**Última actualización:** 2026-02-22

---

## Estado Actual del Backtester

### Fix del Crash del Gráfico (YA APLICADO)
- **Commit:** `f5c7c16`
- **Problema:** Al seleccionar un trade para visualizar, el gráfico crasheaba
- **Causa:** `TradeChartWrapper` ejecutaba `new Date(trade.entryTime)` sin validar que el dato existía y era válido
- **Solución:** Añadida función `isValidTradeForChart()` que valida TODAS las propiedades antes de renderizar:
  - `entryPrice` y `exitPrice` existen y son números válidos
  - `entryTime` y `exitTime` existen
  - Las fechas son válidas (no `Invalid Date`)
  - `signalSide` existe

### Archivos Modificados
- `app/(dashboard)/backtester/page.tsx` - Función `isValidTradeForChart()` y `TradeChartWrapper`
- `components/simple-candle-chart.tsx` - Validaciones y null checks

---

## Playwright MCP - TESTING DE NAVEGADOR

### Estado de Instalación
- ✅ `@playwright/mcp` instalado globalmente (`npm install -g @playwright/mcp`)
- ✅ `.mcp.json` creado en el proyecto con configuración del servidor
- ⏳ **PENDIENTE:** Reiniciar Claude Code para activar el MCP

### Cómo Reiniciar Claude Code
1. Escribe `/exit` o cierra esta terminal
2. Abre una nueva terminal en el proyecto:
   ```powershell
   cd C:\Users\guill\Projects\trading-bot-saas
   claude
   ```
3. El MCP de Playwright se cargará automáticamente

### Qué Permite Playwright MCP
- Abrir navegador y navegar a `http://localhost:3000/backtester`
- Interactuar con formularios, botones, selects
- Tomar screenshots y analizarlos visualmente
- Ver el contenido del DOM
- Testear si el gráfico se renderiza correctamente
- Hacer clicks en Play, Reset, cambiar timeframes

### Comandos Playwright MCP (una vez activo)
```
# Navegar a una URL
playwright_navigate url="http://localhost:3000/backtester"

# Tomar screenshot
playwright_screenshot

# Click en elemento
playwright_click selector="button"

# Escribir en input
playwright_type selector="input" text="10"

# Obtener contenido
playwright_evaluate script="document.body.innerHTML"
```

---

## Tests a Realizar con Playwright

### 1. Test Básico de Carga
1. Navegar a `http://localhost:3000/backtester`
2. Verificar que la página carga sin errores
3. Tomar screenshot

### 2. Test de Backtest
1. Seleccionar archivo de señales (`signals_simple.csv`)
2. Configurar parámetros:
   - Lot Size: 0.1
   - Take Profit Pips: 20
   - Pips Distance: 10
   - Max Levels: 3
3. Click en "Ejecutar Backtest"
4. Esperar resultados
5. Verificar que aparecen métricas

### 3. Test del Gráfico de Trade
1. Después de ejecutar backtest
2. Seleccionar un trade del dropdown
3. Verificar que el gráfico aparece sin crashear
4. Click en "Play" para simular
5. Verificar que las velas se forman
6. Cambiar timeframe (M1, M5, M15, H1)
7. Click en "Reset"

### 4. Test de Validación
1. Intentar seleccionar trade sin ejecutar backtest
2. Verificar mensaje de "Datos incompletos" si aplica

---

## Estructura del Proyecto

```
trading-bot-saas/
├── app/(dashboard)/backtester/
│   └── page.tsx              # Página principal + TradeChartWrapper
├── components/
│   └── simple-candle-chart.tsx  # Gráfico de velas Canvas
├── lib/
│   ├── backtest-engine.ts    # Motor de simulación
│   ├── ticks-cache.ts        # Cache de ticks
│   └── parsers/              # Parsers de señales
├── server/api/trpc/routers/
│   └── backtester.ts         # Endpoints tRPC
├── .mcp.json                 # Configuración Playwright MCP
└── CLAUDE.md                 # Instrucciones del proyecto
```

---

## Comandos Útiles

```powershell
# Arrancar servidor dev
cd C:\Users\guill\Projects\trading-bot-saas
npm run dev

# Verificar TypeScript
npx tsc --noEmit

# Git status
git status

# Git pull (desde openclaw)
git pull origin master

# Ver commits recientes
git log --oneline -10
```

---

## Issues Conocidos

1. **Ticks reales limitados:** Solo hay ticks de enero 2024, el resto son sintéticos
2. **Señales intradía:** 1516 señales pero sin ticks completos para todas

---

## Próximos Pasos

1. **Reiniciar Claude Code** para activar Playwright MCP
2. **Arrancar servidor:** `npm run dev`
3. **Testear backtester** con Playwright
4. **Fixear cualquier issue** que aparezca
5. **Commit y push** los cambios

---

## Contacto / Repositorio

- **GitHub:** https://github.com/Media-refocus/trading-saas
- **Branch:** master
- **Último commit:** `f5c7c16` - fix: validación completa de trade
