# PROMPT - Ralph Loop Trading Bot SaaS

## Contexto Actual
El backtester ya funciona con ticks reales de MT5. Tenemos:
- 80M ticks de XAUUSD (2024-2026)
- 154 señales de Telegram (Jun 2024 - Ene 2026)
- Backtester web funcional en http://localhost:3000

## Misión Actual: Optimización de Estrategias

Ejecutar múltiples backtests con diferentes configuraciones para encontrar las estrategias óptimas.

---

## Orden de Prioridad

### FASE 1: Ejecutar estrategias base (10 estrategias)
1. EJECUTAR estrategia CONSERVADORA - lotajeBase: 0.05, maxLevels: 2, takeProfitPips: 15, stopLossPips: 50
2. EJECUTAR estrategia AGRESIVA - lotajeBase: 0.2, numOrders: 2, maxLevels: 6, takeProfitPips: 30
3. EJECUTAR estrategia GRID AMPLIO - pipsDistance: 30, maxLevels: 3, takeProfitPips: 40
4. EJECUTAR estrategia GRID ESTRECHO - pipsDistance: 5, maxLevels: 8, takeProfitPips: 15
5. EJECUTAR estrategia SIN PROMEDIOS - maxLevels: 1, restrictionType: SIN_PROMEDIOS
6. EJECUTAR estrategia MODO RIESGO - restrictionType: RIESGO
7. EJECUTAR estrategia SCALPING - takeProfitPips: 10, pipsDistance: 8, stopLossPips: 25
8. EJECUTAR estrategia SWING - takeProfitPips: 50, pipsDistance: 15, stopLossPips: 80
9. EJECUTAR estrategia MULTI-ORDER - numOrders: 3, lotajeBase: 0.08
10. EJECUTAR estrategia BALANCEADA - pipsDistance: 15, takeProfitPips: 25, stopLossPips: 60

### FASE 2: Compilar y analizar resultados
11. GUARDAR todos los resultados en `backtest_results/strategies_comparison.json`
12. GENERAR `backtest_results/ranking_profit.md` ordenado por profit total
13. GENERAR `backtest_results/ranking_winrate.md` ordenado por win rate
14. GENERAR `backtest_results/ranking_profit_factor.md` ordenado por profit factor
15. GENERAR `backtest_results/MEJOR_ESTRATEGIA.md` con recomendación final

---

## Cómo ejecutar cada estrategia

### Comando base:
```bash
curl -X POST "http://localhost:3000/api/trpc/backtester.execute?batch=1" \
  -H "Content-Type: application/json" \
  -d '{"0":{"json":{"config":{"strategyName":"NOMBRE","lotajeBase":0.1,"numOrders":1,"pipsDistance":10,"maxLevels":4,"takeProfitPips":20,"useStopLoss":false,"signalsSource":"signals_parsed.csv","useRealPrices":true},"signalLimit":154}}}'
```

### Guardar resultado:
```bash
# Crear archivo en backtest_results/{strategyName}.json con el resultado
```

---

## Configuraciones Detalladas

| Estrategia | lotaje | orders | distance | levels | TP | SL | useSL | restriction |
|------------|--------|--------|----------|--------|-----|-----|-------|-------------|
| CONSERVADORA | 0.05 | 1 | 20 | 2 | 15 | 50 | true | SOLO_1_PROMEDIO |
| AGRESIVA | 0.2 | 2 | 10 | 6 | 30 | - | false | - |
| GRID_AMPLIO | 0.1 | 1 | 30 | 3 | 40 | 100 | true | - |
| GRID_ESTRECHO | 0.1 | 1 | 5 | 8 | 15 | 30 | true | - |
| SIN_PROMEDIOS | 0.15 | 1 | 10 | 1 | 25 | 20 | true | SIN_PROMEDIOS |
| MODO_RIESGO | 0.1 | 1 | 10 | 4 | 20 | 50 | true | RIESGO |
| SCALPING | 0.1 | 1 | 8 | 3 | 10 | 25 | true | - |
| SWING | 0.1 | 1 | 15 | 4 | 50 | 80 | true | - |
| MULTI_ORDER | 0.08 | 3 | 10 | 3 | 20 | - | false | - |
| BALANCEADA | 0.1 | 1 | 15 | 4 | 25 | 60 | true | - |

---

## Reglas
- Un backtest = un commit
- Mensajes en español
- signalLimit: 154 para usar todas las señales
- signalsSource: "signals_parsed.csv"
- useRealPrices: true
- Si hay error, fixear y continuar
- Si TODAS las estrategias están ejecutadas y analizadas, responder: RALPH_COMPLETE
