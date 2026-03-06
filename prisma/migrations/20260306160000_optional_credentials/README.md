# Migration: Optional Credentials (Señales Puras)

**Fecha:** 2026-03-06
**Propósito:** Implementar arquitectura de "señales puras" para MT4/MT5 EAs

## Contexto
En la arquitectura de señales puras, el EA en MT4/MT5:
- No necesita credenciales de conexión (password, server) desde el dashboard
- El usuario instala el EA manualmente en su plataforma MT4/MT5
- El EA usa la API key para autenticarse y recibir señales
- El EA se conecta a su propia plataforma MT4/MT5 localmente

## Cambios
1. `passwordEnc` ahora es opcional (ya no se requiere para EAs)
2. `serverEnc` ahora es opcional (ya no se requiere para EAs)
3. Los datos existentes NO se borran (safe migration)

## Aplicación en VPS (si aplica)
```bash
# En la VPS PostgreSQL
ssh -i ~/.ssh/id_ed25519 root@91.98.238.147

# Aplicar migration manualmente si Prisma CLI no está disponible
psql -U postgres -d trading_bot_saas -f prisma/migrations/20260306160000_optional_credentials/migration.sql
```

## Rollback (si fuera necesario)
```sql
-- Solo si hay datos en todos los registros
ALTER TABLE "BotAccount" ALTER COLUMN "passwordEnc" SET NOT NULL;
ALTER TABLE "BotAccount" ALTER COLUMN "serverEnc" SET NOT NULL;
```
