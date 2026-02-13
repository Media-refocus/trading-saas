# PRD - Optimización de Estrategias de Backtesting

## Objetivo
Ejecutar múltiples backtests con diferentes configuraciones para encontrar las estrategias óptimas para las señales de Telegram disponibles.

## Variables del Backtester

| Variable | Rango | Default | Descripción |
|----------|-------|---------|-------------|
| lotajeBase | 0.01 - 0.5 | 0.1 | Tamaño de lote base |
| numOrders | 1 - 3 | 1 | Órdenes por señal |
| pipsDistance | 5 - 50 | 10 | Distancia entre niveles (pips) |
| maxLevels | 1 - 10 | 4 | Máximo de promedios |
| takeProfitPips | 10 - 50 | 20 | TP desde precio promedio |
| stopLossPips | 0 - 200 | - | SL de emergencia |
| useStopLoss | true/false | false | Activar SL |
| restrictionType | ver abajo | - | Restricciones de canal |

## Estrategias a Probar

### 1. ESTRATEGIA CONSERVADORA
- Objetivo: Minimizar riesgo, pocas operaciones
- Config:
  - lotajeBase: 0.05
  - numOrders: 1
  - pipsDistance: 20
  - maxLevels: 2
  - takeProfitPips: 15
  - useStopLoss: true
  - stopLossPips: 50
  - restrictionType: SOLO_1_PROMEDIO

### 2. ESTRATEGIA AGRESIVA
- Objetivo: Maximizar ganancias con más riesgo
- Config:
  - lotajeBase: 0.2
  - numOrders: 2
  - pipsDistance: 10
  - maxLevels: 6
  - takeProfitPips: 30
  - useStopLoss: false

### 3. ESTRATEGIA GRID AMPLIO
- Objetivo: Pocos promedios pero con distancia grande
- Config:
  - lotajeBase: 0.1
  - numOrders: 1
  - pipsDistance: 30
  - maxLevels: 3
  - takeProfitPips: 40
  - useStopLoss: true
  - stopLossPips: 100

### 4. ESTRATEGIA GRID ESTRECHO
- Objetivo: Muchos promedios con distancia pequeña
- Config:
  - lotajeBase: 0.1
  - numOrders: 1
  - pipsDistance: 5
  - maxLevels: 8
  - takeProfitPips: 15
  - useStopLoss: true
  - stopLossPips: 30

### 5. ESTRATEGIA SIN PROMEDIOS
- Objetivo: Solo entrada base, sin grid
- Config:
  - lotajeBase: 0.15
  - numOrders: 1
  - pipsDistance: 10
  - maxLevels: 1
  - takeProfitPips: 25
  - useStopLoss: true
  - stopLossPips: 20
  - restrictionType: SIN_PROMEDIOS

### 6. ESTRATEGIA MODO RIESGO
- Objetivo: Simular operativa con restricción RIESGO del canal
- Config:
  - lotajeBase: 0.1
  - numOrders: 1
  - pipsDistance: 10
  - maxLevels: 4
  - takeProfitPips: 20
  - useStopLoss: true
  - stopLossPips: 50
  - restrictionType: RIESGO

### 7. ESTRATEGIA SCALPING
- Objetivo: TP pequeño, muchas operaciones rápidas
- Config:
  - lotajeBase: 0.1
  - numOrders: 1
  - pipsDistance: 8
  - maxLevels: 3
  - takeProfitPips: 10
  - useStopLoss: true
  - stopLossPips: 25

### 8. ESTRATEGIA SWING
- Objetivo: TP grande, aguantar más movimiento
- Config:
  - lotajeBase: 0.1
  - numOrders: 1
  - pipsDistance: 15
  - maxLevels: 4
  - takeProfitPips: 50
  - useStopLoss: true
  - stopLossPips: 80

### 9. ESTRATEGIA MULTI-ORDER
- Objetivo: Abrir múltiples órdenes por señal
- Config:
  - lotajeBase: 0.08
  - numOrders: 3
  - pipsDistance: 10
  - maxLevels: 3
  - takeProfitPips: 20
  - useStopLoss: false

### 10. ESTRATEGIA BALANCEADA
- Objetivo: Equilibrio entre riesgo y retorno
- Config:
  - lotajeBase: 0.1
  - numOrders: 1
  - pipsDistance: 15
  - maxLevels: 4
  - takeProfitPips: 25
  - useStopLoss: true
  - stopLossPips: 60

## Output Esperado

Para cada estrategia generar un JSON con:
```json
{
  "strategyName": "ESTRATEGIA_X",
  "config": { ... },
  "results": {
    "totalTrades": N,
    "totalProfit": N,
    "totalProfitPips": N,
    "winRate": N,
    "maxDrawdown": N,
    "profitFactor": N
  }
}
```

## Orden de Prioridad

1. Ejecutar estrategia CONSERVADORA
2. Ejecutar estrategia AGRESIVA
3. Ejecutar estrategia GRID AMPLIO
4. Ejecutar estrategia GRID ESTRECHO
5. Ejecutar estrategia SIN PROMEDIOS
6. Ejecutar estrategia MODO RIESGO
7. Ejecutar estrategia SCALPING
8. Ejecutar estrategia SWING
9. Ejecutar estrategia MULTI-ORDER
10. Ejecutar estrategia BALANCEADA
11. Guardar todos los resultados en `backtest_results/strategies_comparison.json`
12. Generar ranking de estrategias por profit
13. Generar ranking de estrategias por win rate
14. Identificar mejor estrategia general
