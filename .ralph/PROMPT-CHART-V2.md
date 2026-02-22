# PROMPT - Ralph Loop: Gráfico MT5 + Features

## Contexto
Backtester de trading con componente de gráfico que se crashea al seleccionar un trade. El componente actual usa Canvas nativo pero tiene bugs.

---

## ORDEN DE PRIORIDAD (SEGUIR ESTRICTAMENTE)

### 1. FIX: Arreglar crash al seleccionar trade
**Archivo**: `components/simple-candle-chart.tsx`

**Problema**: El componente se crashea al seleccionar un trade. Posibles causas:
- Dependencia circular en useEffect de account state
- Null checks faltantes
- Acceso a propiedades de objetos null/undefined

**Acción**:
1. Leer el archivo completo
2. Buscar y arreglar:
   - Null checks en `trade`, `position`, `currentTick`
   - Dependencias circulares en useEffect
   - Accesos seguros a `trade.levels`, etc.
3. Añadir try-catch en funciones críticas
4. Verificar que el servidor compile sin errores

**Commit**: "fix: arreglar crash al seleccionar trade en grafico"

---

### 2. FIX: Formación de velas estilo MT5
**Problema**: Las velas deben formarse respetando el tiempo del timeframe:
- M1: cada vela = 60 segundos
- M5: cada vela = 300 segundos
- M15: cada vela = 900 segundos
- H1: cada vela = 3600 segundos

**Cómo funciona MT5**:
- Cada tick actualiza la vela ACTUAL
- Open = primer precio del período (fijo)
- High = máximo histórico (solo sube)
- Low = mínimo histórico (solo baja)
- Close = último tick (siempre cambia)
- Cuando el tick pertenece a otro período → nueva vela

**Acción**:
1. Verificar que `getCandleStartTime` calcula correctamente el inicio de vela
2. Verificar que `processTick` actualiza OHLC correctamente
3. Añadir logs temporales para debug si es necesario

**Commit**: "fix: formacion de velas respeta tiempo de timeframe"

---

### 3. FEATURE: Panel de cuenta estilo MT5 completo
**Objetivo**: Mostrar balance en tiempo real como MT5 Terminal

**Campos a mostrar**:
| Campo | Descripción |
|-------|-------------|
| Balance | Fondos cerrados (solo cambia al cerrar trades) |
| Equity | Balance + Floating P/L |
| Floating P/L | Ganancia/pérdida no realizada |
| Margin | Fondos bloqueados para posición abierta |
| Free Margin | Disponible para abrir nuevas posiciones |
| Margin Level | (Equity / Margin) × 100% |

**Acción**:
1. Verificar que el panel ya existe y funciona
2. Si falta algo, añadirlo
3. Añadir colores: verde si profit, rojo si loss
4. Añadir sección "Posición Abierta" cuando hay posición

**Commit**: "feat: panel de cuenta estilo MT5 completo"

---

### 4. FEATURE: Velas con tiempo real visible
**Objetivo**: Mostrar cuánto tiempo falta para que cierre la vela actual

**Acción**:
1. Calcular tiempo restante = endTime - currentTime
2. Mostrar en UI: "Vela actual: 45s restantes" (para M1)
3. Actualizar cada segundo

**Commit**: "feat: mostrar tiempo restante de vela actual"

---

### 5. FEATURE: Indicadores visuales en el gráfico
**Objetivo**: Marcar entrada, salida, TP, SL en el gráfico

**Acción**:
1. Flecha de entrada (▲ BUY / ▼ SELL) en la primera vela
2. Círculo de salida en la última vela (color según resultado)
3. Línea horizontal de Entry (azul punteado)
4. Línea horizontal de TP (verde punteado)
5. Línea horizontal de SL (rojo punteado)
6. Líneas de niveles de promedio (colores distintos)

**Commit**: "feat: indicadores visuales de entrada salida y niveles"

---

### 6. FEATURE: Zoom y scroll del gráfico
**Objetivo**: Poder hacer zoom in/out y scroll horizontal

**Acción**:
1. Añadir eventos de mouse wheel para zoom
2. Añadir drag para scroll horizontal
3. Mantener estado de viewport visible
4. Botones +/- para zoom

**Commit**: "feat: zoom y scroll en grafico"

---

### 7. FEATURE: Crosshair con precio y tiempo
**Objetivo**: Líneas cruzadas que sigan el mouse mostrando precio y tiempo

**Acción**:
1. Evento onMouseMove en canvas
2. Dibujar línea vertical y horizontal
3. Mostrar tooltip con precio y tiempo
4. Estilo como MT5 (líneas punteadas)

**Commit**: "feat: crosshair con precio y tiempo"

---

### 8. FEATURE: Tooltip de vela al hacer hover
**Objetivo**: Mostrar OHLC de la vela al pasar el mouse

**Acción**:
1. Detectar vela bajo el cursor
2. Mostrar tooltip con: Open, High, Low, Close, Time
3. Estilo flotante cerca del cursor

**Commit**: "feat: tooltip de vela al hacer hover"

---

### 9. FEATURE: Reproducción con controls de timeline
**Objetivo**: Barra de progreso interactiva para navegar

**Acción**:
1. Hacer la barra de progreso clickeable
2. Al hacer click, saltar a ese punto de la simulación
3. Añadir botones: |< < > >| (inicio, atrás, adelante, final)

**Commit**: "feat: timeline interactivo para navegacion"

---

### 10. FEATURE: Panel de estadísticas del trade
**Objetivo**: Mostrar stats detalladas del trade actual

**Datos a mostrar**:
- Duración del trade
- Máximo drawdown durante el trade
- Máximo profit durante el trade
- Pips ganados/perdidos
- Niveles abiertos
- Precio promedio de entrada

**Commit**: "feat: panel de estadisticas del trade"

---

## REGLAS IMPORTANTES

1. **Un feature = un commit**
2. **No romper código existente**
3. **Mensajes en español**
4. **Si hay error, fixear y continuar**
5. **Probar cada feature antes de commit**
6. **Hacer `npm run dev` y verificar que compile**

---

## VERIFICACIÓN

Después de cada commit:
```bash
cd C:\Users\guill\Projects\trading-bot-saas
npx tsc --noEmit
```

Si falla, fixear errores antes de continuar.

---

## COMPLETADO

Cuando todas las features funcionen, responder: **RALPH_CHART_V2_COMPLETE**

Incluir resumen de:
- Features implementadas
- Archivos modificados
- Bugs fixeados
- Pendientes (si hay)
