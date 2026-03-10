# Trading Bot SaaS - Lecciones Aprendidas

## Errores Comunes
| Fecha | Error | Cómo evitarlo |
|-------|-------|---------------|
| 2026-03-10 | `return (` sin `)` de cierre en componente JSX grande | El error "Expected ',', got '}'" indica paréntesis sin cerrar. Verificar que `return (` tenga su `);` antes del `}` final del componente |

## Patrones que Funcionan
-

## Anti-patrones a Evitar
-

---

## Recordatorios
- Siempre filtrar por `tenantId`
- Validar inputs con Zod
- NO usar `any`
