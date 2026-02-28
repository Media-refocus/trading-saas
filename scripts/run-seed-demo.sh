#!/bin/bash
#
# Script para ejecutar seed-demo-data.ts en el VPS
#
# Uso: ./scripts/run-seed-demo.sh
#

set -e

VPS_HOST="root@91.98.238.147"
VPS_PATH="/opt/trading-bot-saas"
SSH_KEY="~/.ssh/id_ed25519"

echo "=== Deploy Seed Demo Data al VPS ==="
echo ""

# 1. Copiar script al VPS
echo "📤 Copiando seed-demo-data.ts al VPS..."
scp -i $SSH_KEY scripts/seed-demo-data.ts ${VPS_HOST}:${VPS_PATH}/scripts/

# 2. Ejecutar en el VPS
echo ""
echo "🚀 Ejecutando seed script en el VPS..."
echo ""

ssh -i $SSH_KEY ${VPS_HOST} << 'ENDSSH'
cd /opt/trading-bot-saas

# Cargar variables de entorno
export $(grep -v '^#' .env | xargs)

# Ejecutar script
npx tsx scripts/seed-demo-data.ts
ENDSSH

echo ""
echo "✅ Completado!"
