# Operativas de Trading

Este directorio contiene las estrategias de trading configurables para el SaaS.

## Estructura

```
operative/
├── configs/           # Configuraciones JSON de cada operativa
│   ├── xisco-progressive-v1.json
│   └── xisco-hibrida-v2.json
├── analysis/          # Análisis y documentación de cada operativa
│   ├── OPERATIVA-XAUUSD-001.md
│   └── COMPARATIVA-BOTS.md
└── README.md          # Este archivo
```

## Operativas Disponibles

### 1. Xisco Progressive v1
- **Archivo:** `configs/xisco-progressive-v1.json`
- **Tipo:** Martingala con promedios fijos
- **Niveles:** 40 máximo
- **Docs:** `analysis/OPERATIVA-XAUUSD-001.md`

### 2. Xisco Hibrida v2 (propuesta)
- **Archivo:** `configs/xisco-hibrida-v2.json`
- **Tipo:** Promedios inteligentes en zonas de liquidez
- **Niveles:** 12 máximo
- **Docs:** `analysis/COMPARATIVA-BOTS.md`

## Cómo añadir nueva operativa

1. Crear archivo JSON en `configs/` con la configuración
2. Documentar en `analysis/` con archivo MD
3. Actualizar este README

## Uso en el SaaS

Los clientes pueden:
- Seleccionar operativas pre-configuradas (las de Xisco)
- Crear sus propias operativas modificando parámetros
- Backtestear antes de usar en real
