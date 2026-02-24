# Análisis de Estrategias - 50 Señales Intradía

**Fecha:** 2026-02-24
**Señales:** 50 de signals_intradia.csv
**Ticks:** 116M sintéticos

---

## Top 5 por Profit Absoluto

| # | Estrategia | Profit | Max DD | Trades |
|---|-----------|--------|--------|--------|
| 1 | AGRESIVO_1 | $7,010 | $3,405 | 43 |
| 2 | GRID_8 | $4,658 | $2,220 | 43 |
| 3 | GRID_10 | $3,626 | $1,888 | 40 |
| 4 | MULTI_3_TIGHT | $3,128 | $1,473 | 43 |
| 5 | GRID_12 | $2,934 | $1,549 | 36 |

---

## Top 5 por Ratio Profit/DD (Eficiencia)

| # | Estrategia | Profit | Max DD | Ratio |
|---|-----------|--------|--------|-------|
| 1 | SWING_50 | $1,049 | $616 | **1.70** |
| 2 | CONSERV_PROM | $255 | $130 | **1.96** |
| 3 | CONSERV_10 | $338 | $183 | **1.85** |
| 4 | CONSERV_5 | $427 | $210 | **2.03** |
| 5 | MULTI_3 | $1,668 | $819 | **2.04** |

---

## Mejor por Perfil de Riesgo

### Conservador (bajo DD, profit estable)
**CONSERV_PROM**: $255 profit, $130 DD (ratio 1.96)

### Balanceado (equilibrio)
**SWING_50**: $1,049 profit, $616 DD (ratio 1.70, 11 trades)

### Agresivo (maximizar ganancias)
**AGRESIVO_1**: $7,010 profit, $3,405 DD (43 trades)

---

## Observaciones

1. **AGRESIVO_1** domina en profit absoluto pero con DD del 34% del capital
2. **SWING_50** tiene el mejor balance profit/riesgo con pocos trades
3. Las estrategias **CONSERV** tienen los mejores ratios pero bajo profit
4. **GRID_8** vs **GRID_10**: 8 pips genera más profit pero más DD

---

## Próximos Pasos

- [ ] Probar con 200 señales para más representatividad
- [ ] Descargar ticks reales de MT5
- [ ] Optimizar parámetros de SWING_50 (mejor ratio)
