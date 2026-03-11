# Trading Bot SaaS - Lecciones Aprendidas

## Errores Comunes
| Fecha | Error | Cómo evitarlo |
|-------|-------|---------------|
| 2026-03-10 | `return (` sin `)` de cierre en componente JSX grande | El error "Expected ',', got '}'" indica paréntesis sin cerrar. Verificar que `return (` tenga su `);` antes del `}` final del componente |
| 2026-03-11 | JSON anidado en MQL5 requiere parser manual | MQL5 no tiene librería JSON nativa. Usar `ExtractObject()` + `ParseDoubleField()` para objetos anidados |

## Patrones que Funcionan
- **Grid en MQL5:** Usar array de structs GridLevel con isOpen/price/ticket para trackear estado
- **Refresh config:** Usar datetime g_lastConfigRefresh + OnTick() para refrescar cada 5 min
- **Parsing JSON anidado:** Extraer sub-objeto con `ExtractObject(json, "key")` luego parsear campos
- **Grid pricing:** BUY niveles abajo (price - step), SELL niveles arriba (price + step)
- **Trailing SL virtual en MQL5:**
  - Usar struct VirtualSL para trackear SL por ticket
  - Activar trailing solo cuando profit >= threshold (entryTrailingActivate)
  - BUY: SL virtual sube con precio (currentPrice - back)
  - SELL: SL virtual baja con precio (currentPrice + back)
  - Cerrar posición cuando precio toca SL virtual
  - Limpiar array de VirtualSLs al cerrar grid
- **Comandos remotos en MQL5:**
  - Usar heartbeat para recibir comandos del servidor (bidireccional)
  - Enum para estados finitos (RUNNING/PAUSED)
  - Parsear respuesta JSON inmediatamente después de WebRequest
  - PAUSE: bloquear nuevas entradas pero mantener posiciones abiertas
  - RESUME: restaurar operativa normal
  - CLOSE_ALL: kill switch que cierra todo y pausa
  - CLOSE signals siempre se ejecutan (incluso si pausado) - safety feature

## Anti-patrones a Evitar
-

---

## Recordatorios
- Siempre filtrar por `tenantId`
- Validar inputs con Zod
- NO usar `any`
