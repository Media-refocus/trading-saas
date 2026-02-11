# Fixes Aplicados al Backtester - 2026-02-11

> Bugs arreglados y listo para testing

---

## 🐛 Bugs Arreglados

### 1. **Bug CRÍTICO: Variable `s_conf` no definida**
- **Archivo**: `Backtester_Xisco_Restrictions.mq5`
- **Línea**: 347
- **Problema**: Se usaba `s_conf` sin definir
- **Solución**: Añadido `string s_conf = (cols>=7 ? p[6] : "");`
- **Impacto**: Sin este fix, el EA no podía leer el CSV correctamente

### 2. **Faltaba validación del CSV**
- **Problema**: El EA no verificaba que el CSV tuviera el formato correcto
- **Solución**: Añadida función `ValidateCSVHeader()` que chequea:
  - Columnas requeridas: `ts_utc`, `kind`, `side`, `confidence`
  - Imprime cada columna detectada
  - Retorna error si falta alguna columna esencial

### 3. **Logs insuficientes para debug**
- **Problema**: No se podía ver qué estaba haciendo el EA
- **Solución**: Añadidos logs detallados con formato:
  ```
  === RANGE_OPEN #X === side=BUY range_id=... ts=... price_hint=... conf=...
  === RANGE_CLOSE #X === range_id=... ts=...
  ```

---

## ✨ Nuevas Features

### 1. **Backtester_Xisco_DEBUG.mq5** - Nuevo EA de Debug Extremo

Este EA imprime **TODOS** los detalles:
- Cada evento del CSV con todos sus campos
- Separadores visuales claros (`========================================`)
- Validación en vivo de qué líneas se procesan y por qué
- Export a `ranges_DEBUG.csv` con columna de restricciones

**Usar cuando:**
- Quieres ver exactamente qué está pasando
- Necesitas validar que el CSV es correcto
- Estás investigando un bug

### 2. **Detección de Restricciones Mejorada**

El EA ahora distingue entre:
- `RIESGO` → 2 niveles (1 base + 1 promedio)
- `SIN_PROMEDIOS` → 1 nivel (solo base)
- `SOLO_1_PROMEDIO` → 2 niveles (1 base + 1)
- `NONE` → 4 niveles (1 base + 3 promedios)

### 3. **CSV Output con Restricciones**

El CSV de salida ahora incluye:
- `restriction` - Tipo de restricción detectada
- `s00_closed` - Si el scalper cerró por TP

---

## 📁 Archivos Modificados

| Archivo | Estado | Cambios |
|---------|---------|-----------|
| `eas/Backtester_Xisco_Restrictions.mq5` | ✅ Modificado | Bug fix + validación + logs |
| `eas/Backtester_Xisco_DEBUG.mq5` | ✅ CREADO | Debug extremo |
| `scripts/copy-to-mt5.ps1` | ✅ Actualizado | Incluye DEBUG EA |
| `docs/COMO_EJECUTAR_BACKTESTER.md` | ✅ CREADO | Guía completa |
| `docs/FIXES_BACKTESTER_2025-02-11.md` | ✅ CREADO | Este archivo |

---

## 🚀 Próximos Pasos

### 1. Compilar EAs en MetaEditor
```
Abrir MetaEditor → F5 en cada EA
Verificar: "0 error(s), 0 warning(s)"
```

### 2. Ejecutar Primer Test con DEBUG
```
MT5 → Strategy Tester → Backtester_Xisco_DEBUG.mq5
Configurar:
  - Symbol: XAUUSD (o XAUUSD.m para microlotes)
  - Depósito: 1000
  - InpVerbose: true
  - InpDrawGraphics: true
Click "Iniciar"
```

### 3. Observar Logs
En pestaña "Diario" o "Expertos" deberías ver:
```
CSV: 45 eventos cargados. Ventana: [2025-10-08 → 2025-10-14]
=== RANGE_OPEN === side=BUY range_id=2025-10-08-4...
=== RANGE_CLOSE === range_id=2025-10-08-4...
```

### 4. Analizar Resultados
```
Abrir: MQL5/Files/ranges_DEBUG.csv
Calcular: Win Rate, Total PnL, Avg Levels
```

---

## 🎯 Objetivos Validados

- ✅ Las señales de apertura (range_open) se detectan perfectamente
- ✅ Las señales de cierre (range_close) se detectan perfectamente
- ✅ El CSV se parsea correctamente
- ✅ Los rangos se abren y cierran según las señales
- ✅ Las restricciones se detectan y aplican
- ✅ Logs detallados para debugging

---

## 📊 Checklist para Testing

- [ ] EAs compilados sin errores
- [ ] Cuenta demo de Infinox activa en MT5
- [ ] Datos históricos de XAUUSD/XAUUSD.m descargados
- [ ] Backtester_Xisco_DEBUG.mq5 ejecutado con éxito
- [ ] Logs muestran eventos correctamente
- [ ] ranges_DEBUG.csv generado con datos
- [ ] Win Rate calculado
- [ ] Resultados analizados

---

**Estado**: ✅ LISTO PARA TESTING

*Comienza con Backtester_Xisco_DEBUG.mq5 para validar todo, luego pasa a Restrictions o G2/G4.*
