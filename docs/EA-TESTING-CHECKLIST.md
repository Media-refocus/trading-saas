# EA MT5 v1.3 — Testing Checklist

**EA:** `mt5/TBSSignalEA.mq5` (v1.3, ~1200 líneas)
**Fecha:** 2026-03-11
**Commits:** 4 (auditoría + grid/config + trailing + comandos)
**Build:** npm run build ✅

---

## 📋 PRE-TESTING

### 1. Compilar EA en MetaEditor
- [ ] Copiar `mt5/TBSSignalEA.mq5` a `MetaTrader5/MQL5/Experts/`
- [ ] Abrir MetaEditor (F4 desde MT5)
- [ ] Compilar EA (F7)
- [ ] Verificar: "0 errors, 0 warnings"
- [ ] Si hay errores → copiar logs y enviar a Vegeta

### 2. Configurar WebRequest
- [ ] MT5 → Herramientas → Opciones → Asesores Expertos
- [ ] Activar "Permitir WebRequest hacia las siguientes URLs"
- [ ] Añadir: `https://trading-bot-saas.vercel.app`
- [ ] Aplicar → OK

### 3. Configurar API Key
- [ ] Obtener API Key desde dashboard TBS (`/bot`)
- [ ] Arrastrar EA al gráfico XAUUSD
- [ ] En inputs → ApiKey → pegar API Key
- [ ] Verificar: ServerUrl = `https://trading-bot-saas.vercel.app`
- [ ] MagicNumber = 20260101 (o único para esta cuenta)

---

## 🧪 FASE 1: CONFIG REMOTA

### Test 1.1: Carga de config
- [ ] Iniciar EA (click "Auto Trading" → EA en gráfico)
- [ ] Verificar en pestaña "Experts": 
  - `TBS EA | Config remota cargada OK`
  - `TBS EA | Grid: stepPips=X, maxLevels=X, lot=X`
- [ ] Si error → enviar logs completos

### Test 1.2: Refresco de config
- [ ] Esperar 5 minutos
- [ ] Verificar: `TBS EA | Config refrescada (5 min)`
- [ ] Cambiar config en dashboard
- [ ] Esperar 5 min → verificar que EA recibe nuevos valores

---

## 🧪 FASE 2: GRID MANAGEMENT

### Test 2.1: Inicialización de grid
- [ ] Crear señal manual en dashboard:
  - Type: ENTRY
  - Side: BUY
  - Symbol: XAUUSD
  - Price: 2850.00 (precio actual aproximado)
  - maxLevels: 4
  - restrictionType: R:10
- [ ] Verificar en logs:
  - `TBS EA | Señal ENTRY recibida: BUY XAUUSD @ 2850.00`
  - `TBS EA | Grid inicializado: 4 niveles`
  - `TBS EA | Nivel 0 @ 2850.00`
  - `TBS EA | Nivel 1 @ 2840.00`
  - `TBS EA | Nivel 2 @ 2830.00`
  - `TBS EA | Nivel 3 @ 2820.00`

### Test 2.2: Apertura de nivel 0
- [ ] Verificar que se abrió orden con:
  - Comment: "TBS Grid L0"
  - Lot: según config (gridLot)
  - Symbol: XAUUSD
  - Magic: 20260101
- [ ] Verificar en Trade tab:
  - Ticket visible
  - Precio cercano a 2850.00 (con slippage)

### Test 2.3: Apertura de niveles 1-3
- [ ] Esperar que precio baje 10 pips (2850 → 2840)
- [ ] Verificar: `TBS EA | Nivel 1 abierto @ 2840.00 | Ticket: XXXXX`
- [ ] Verificar orden con comment "TBS Grid L1"
- [ ] Repetir para niveles 2 y 3 cuando precio llegue

### Test 2.4: Cierre de grid
- [ ] Crear señal manual:
  - Type: CLOSE
  - Symbol: XAUUSD
- [ ] Verificar: `TBS EA | Cerrando todos los niveles del grid`
- [ ] Verificar que TODAS las posiciones se cerraron
- [ ] Verificar en logs: "TBS EA | Grid cerrado completamente"

---

## 🧪 FASE 3: TRAILING SL VIRTUAL

### Test 3.1: Apertura con trailing params
- [ ] Configurar en dashboard:
  - entryTrailingActivate: 10
  - entryTrailingBack: 20
- [ ] Crear señal ENTRY BUY con maxLevels=1
- [ ] Verificar que nivel 0 se abre

### Test 3.2: Activación de trailing
- [ ] Esperar que posición tenga +10 pips profit
- [ ] Verificar en logs:
  - `TBS EA | Trailing activado para ticket XXXXX | Profit: 10 pips`
  - `TBS EA | SL virtual BUY actualizado: [precio]`

### Test 3.3: Movimiento de SL virtual
- [ ] Precio sube 5 pips más → SL virtual sube 5 pips
- [ ] Verificar en logs: `TBS EA | SL virtual BUY actualizado: [nuevo_precio]`
- [ ] SL virtual siempre = currentPrice - 20 pips (entryTrailingBack)

### Test 3.4: Cierre por SL virtual
- [ ] Precio retrocede y toca SL virtual
- [ ] Verificar en logs:
  - `TBS EA | Cerrando posición por SL virtual | Ticket: XXXXX`
- [ ] Verificar que posición se cerró automáticamente
- [ ] Verificar que se envió CLOSE event al servidor

---

## 🧪 FASE 4: COMANDOS DASHBOARD

### Test 4.1: PAUSE
- [ ] Desde dashboard → click "Pause Bot"
- [ ] Verificar en logs (dentro de 30s):
  - `TBS EA | Comando recibido: PAUSE | Razón: Manual pause from dashboard`
  - `TBS EA | Bot PAUSADO — no se abrirán nuevas posiciones`
- [ ] Crear señal ENTRY → verificar que NO se abre
- [ ] Verificar en logs: `TBS EA | Señal ENTRY ignorada — bot pausado`

### Test 4.2: RESUME
- [ ] Desde dashboard → click "Resume Bot"
- [ ] Verificar en logs:
  - `TBS EA | Comando recibido: RESUME`
  - `TBS EA | Bot REANUDADO — operativa normal`
- [ ] Crear señal ENTRY → verificar que SÍ se abre

### Test 4.3: CLOSE_ALL (Kill Switch)
- [ ] Abrir 3 posiciones (grid con 3 niveles)
- [ ] Desde dashboard → click "Kill Switch" / "Close All"
- [ ] Verificar en logs:
  - `TBS EA | Comando recibido: CLOSE_ALL | Razón: Kill switch from dashboard`
  - `TBS EA | KILL SWITCH ACTIVADO — cerrando todo`
  - `TBS EA | Todos los niveles de grid cerrados`
- [ ] Verificar que TODAS las posiciones se cerraron
- [ ] Verificar que bot quedó en estado PAUSED

---

## 🧪 EDGE CASES

### Test 5.1: Config remota falla
- [ ] Pausar servidor o usar API key inválida
- [ ] Reiniciar EA
- [ ] Verificar: `TBS EA | Error cargando config: HTTP 401`
- [ ] Verificar que EA usa inputs fallback (LotSize, etc.)
- [ ] Verificar que EA sigue funcionando con config básica

### Test 5.2: Grid con 0 niveles
- [ ] Crear señal ENTRY con maxLevels=0
- [ ] Verificar que NO se abre ninguna orden
- [ ] Verificar en logs: `TBS EA | Grid con 0 niveles — señal ignorada`

### Test 5.3: Señal CLOSE sin posiciones
- [ ] Cerrar todas las posiciones manualmente
- [ ] Crear señal CLOSE
- [ ] Verificar que NO crashea
- [ ] Verificar en logs: `TBS EA | No hay posiciones para cerrar`

### Test 5.4: Trailing sin activación
- [ ] Posición con profit < entryTrailingActivate
- [ ] Verificar que trailing NO se activa
- [ ] Verificar que SL virtual NO se mueve

---

## 📊 VALIDACIÓN FINAL

### ✅ Criterios de éxito:
- [ ] Todas las tests pasan sin errores
- [ ] No hay crashes del EA
- [ ] Logs son claros y útiles
- [ ] Métricas en dashboard coinciden con MT5
- [ ] Comandos PAUSE/RESUME/CLOSE_ALL funcionan
- [ ] Grid se abre/cierra correctamente
- [ ] Trailing SL cierra posiciones automáticamente

### ❌ Si algo falla:
1. Copiar logs completos de pestaña "Experts"
2. Anotar pasos exactos que causaron el error
3. Enviar a Vegeta con:
   - Screenshot del error en MT5
   - Logs completos
   - Config usada (inputs del EA)
   - Señal enviada (type, side, price, maxLevels)

---

## 🚀 POST-TESTING

### Si todo OK:
- [ ] Commitear resultados en `docs/EA-TESTING-RESULTS-2026-03-11.md`
- [ ] Actualizar ROADMAP.md con estado Fase 6 (EA inteligente ✅)
- [ ] Deploy a VPS de clientes (con cuenta demo primero)

### Si hay bugs:
- [ ] Crear issues en GitHub con logs + steps to reproduce
- [ ] Vegeta corrige + lanza CC con fix
- [ ] Repetir testing

---

**Notas:**
- Todos los tiempos de espera son aproximados (30s heartbeat, 5 min config refresh)
- Usar cuenta DEMO para testing inicial
- No usar lotes reales hasta validar todo
- Documentar cualquier comportamiento inesperado
