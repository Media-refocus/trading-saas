# Comparativa de Bots de Trading

**Fecha:** 2026-02-22
**Contexto:** Análisis de features de otro bot que usa señales de Toni

---

## Bot A: Xisco Progressive v1

| Feature | Valor |
|---------|-------|
| Promedios | 40 niveles fijos |
| Espaciado | 10-50 pips según nivel |
| Trailing | Fijo desde 30-40 pips |
| Análisis técnico | No |
| Zonas liquidez | No |
| Cierre | LIFO |
| Complejidad | Media |

---

## Bot B: Otro desarrollador

| Feature | Valor |
|---------|-------|
| Promedios | 12 máximo inteligentes |
| Espaciado | Dinámico en zonas de liquidez |
| Trailing | Dinámico 20% distancia |
| Análisis técnico | Sí (TF 15m, 1H, 4H) |
| Zonas liquidez | Sí (analiza 1500 pips) |
| Cierre | Por señal de Toni |
| Complejidad | Alta |

---

## Features del Bot B para merger

### 1. Zonas de Liquidez
```
Concepto: En lugar de promediar cada X pips fijos, analizar el gráfico
y promediar donde hay mayor concentración de órdenes (liquidez).

Implementación:
- Analizar velas con alto volumen
- Identificar niveles donde el precio ha rebotado antes
- Usar order book de MT5 si disponible
- Timeframes: 15m, 1H, 4H
```

**Beneficio:** Promedias en puntos donde el precio TIENE MÁS PROBABILIDAD de rebotar.

### 2. Trailing Dinámico
```
Concepto: En lugar de SL fijo, SL se adapta a volatilidad.

Implementación:
- Distancia = 20% del movimiento actual
- Si precio sube 100 pips → SL a 20 pips
- Si precio sube 200 pips → SL a 40 pips

Beneficio: Se adapta a volatilidad del momento.
```

### 3. Activación por Niveles
```
Concepto: Las 4 posiciones se activan en niveles específicos.

Niveles: 40, 70, 130, 200 pips

vs Xisco: 2 posiciones activas desde el principio
```

---

## Análisis de Viabilidad

### Zonas de Liquidez en MT5

| Método | Disponibilidad | Complejidad |
|--------|----------------|-------------|
| Order Book | Depende del broker | Media |
| Volumen velas | Siempre | Baja |
| Soportes/Resistencias | Siempre | Media |
| ICT/SMC concepts | Siempre | Alta |

**Recomendación:** Empezar con análisis de volumen + soportes/resistencias. Order book si el broker lo da.

### Trailing Dinámico

**Fácil de implementar:**
```python
def calculate_trailing(current_pips, distance_pct=20):
    return current_pips * (distance_pct / 100)
```

### Activación por Niveles

**Ya existe en el bot actual** (watchdog), solo hay que adaptarlo.

---

## Propuesta de Implementación

### Fase 1: Backtester
1. Implementar zonas de liquidez simuladas
2. Testear trailing dinámico
3. Comparar resultados vs operativa actual

### Fase 2: Bot Real
1. Añadir análisis de MT5 (volumen, niveles)
2. Implementar trailing dinámico
3. Testear en demo

### Fase 3: SaaS
1. Ofrecer ambas operativas (fija vs inteligente)
2. Cliente elige según preferencia
3. Backtest obligatorio antes de activar

---

## Preguntas Pendientes

1. **¿Xisco prefiere simple o inteligente?**
   - Simple: 40 niveles fijos, predecible
   - Inteligente: 12 niveles variables, más complejo

2. **¿Cómo conseguir zonas de liquidez?**
   - Volumen histórico
   - Order book MT5
   - Indicadores ICT/SMC

3. **¿El otro bot es público?** ¿Podemos contactar al desarrollador?

---

## Conclusión

El enfoque de "promedios inteligentes" es **más sofisticado** pero también **más complejo**.

**Recomendación:**
- Mantener Xisco Progressive v1 como opción base (simple)
- Desarrollar Xisco Hibrida v2 como opción avanzada
- Dejar que el backtester decida cuál es mejor
