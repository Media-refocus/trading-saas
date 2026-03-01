# Trading Architect Memory

## Decisiones Arquitectónicas

| Fecha | Decisión | Rationale |
|-------|----------|-----------|
| 2026-03-01 | Visor velas: Props drilling > Context | Solo 2 niveles de profundidad, graficos independientes |
| 2026-03-01 | Compresion OHLC en main thread | Web Worker overhead innecesario para datasets <500K |
| 2026-03-01 | Extraer canvas a hook useCanvasRenderer | Evitar duplicacion con equity-graph.tsx |
| 2026-03-01 | Cache de compresion por zoom level | Evitar recomputar al hacer scroll/zoom |

## Patrones de Diseño
- Multi-tenant via `tenantId` en todas las tablas
- tRPC para APIs internas, REST solo para webhooks externos
- SQLite por simplicidad (no Postgres necesario aún)

## Trade-offs Conocidos
- SQLite: menor escala pero más simple que Postgres
- NextAuth v5 beta: features modernas pero posible inestabilidad

## Pendiente de Decidir
- [ ]
