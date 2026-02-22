# Backtester Trading Bot SaaS

Motor de backtesting para validar operativas antes de usar en cuentas reales.

## Estado

🚧 **En desarrollo** por Guillermo (local)

## Estructura

```
backtester/
├── engine/           # Motor de backtest (TypeScript/Python)
│   ├── backtest-engine.ts
│   ├── signals-parser.ts
│   └── ticks-loader.ts
├── data/             # Datos históricos
│   ├── signals/      # CSVs de señales
│   └── ticks/        # Datos de precio XAUUSD
├── results/          # Resultados de backtests
└── README.md
```

## Uso

```bash
# Ejecutar backtest con operativa específica
npm run backtest -- --operative xisco-progressive-v1 --period 2026-01

# Comparar operativas
npm run backtest -- --compare xisco-progressive-v1,xisco-hibrida-v2
```

## Métricas

- Total pips
- Win rate
- Drawdown máximo
- Profit factor
- Sharpe ratio

## Datos Requeridos

1. **Señales históricas** - CSV con formato:
   ```
   date,signal_type,entry_price,stop_loss,take_profit
   ```

2. **Ticks XAUUSD** - Datos de precio minuto a minuto

## Integración con Operativas

El backtester lee configuraciones de `../operative/configs/` y simula ejecución.

## Próximos Pasos

- [ ] Motor básico funcionando
- [ ] Cargar datos históricos
- [ ] Implementar operativa v1
- [ ] Comparar con trades reales
- [ ] Implementar operativa v2
