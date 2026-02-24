#!/bin/bash
# Trading Bot SaaS - Instalador Linux
# =====================================
# Script de instalación para VPS Linux (Ubuntu/Debian)
#
# Uso:
#   chmod +x install-linux.sh
#   ./install-linux.sh --api-key "tb_xxx"

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parámetros
API_KEY="${1:-}"
SAAS_URL="${2:-https://tu-saas.com}"
INSTALL_DIR="${3:-/opt/tradingbot}"

# Banner
echo -e "${CYAN}"
╔════════════════════════════════════════════════════════════╗
║         TRADING BOT SAAS - Instalador Linux                   ║
╠════════════════════════════════════════════════════════════╣${NC}
"

# Verificar root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Ejecuta con sudo${NC}"
    exit 1
fi

# Verificar distribución
if [ ! -f /etc/os-release ]; then
    echo -e "${RED}❌ Distribución no soportada. Use Ubuntu/Debian.${NC}"
    exit 1
fi

echo -e "${CYAN}▶ Verificando requisitos...${NC}"

# Verificar arquitectura
ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ]; then
    echo -e "${RED}❌ Se requiere arquitectura x86_64${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Arquitectura: $ARCH${NC}"

# Verificar memoria
MEM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$MEM" -lt 1500 ]; then
    echo -e "${YELLOW}⚠️ Memoria recomendada: 4GB+ (actual: ${MEM}MB)${NC}"
else
    echo -e "${GREEN}✅ Memoria: ${MEM}MB${NC}"
fi

# ───────────────────────── Instalar dependencias ─────────────────────────
echo -e "${CYAN}▶ Instalando dependencias del sistema...${NC}"

apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv wget curl > /dev/null 2>&1

echo -e "${GREEN}✅ Dependencias instaladas${NC}"

# ───────────────────────── Crear directorios ─────────────────────────
echo -e "${CYAN}▶ Creando directorios...${NC}"

mkdir -p "$INSTALL_DIR"/bot-saas
mkdir -p "$INSTALL_DIR"/logs

echo -e "${GREEN}✅ Directorios creados${NC}"

# ───────────────────────── Descargar bot ─────────────────────────
echo -e "${CYAN}▶ Descargando bot...${NC}"

# Aquí descargarías el bot desde tu repositorio o lo copiarías
# Por ahora, creamos archivos de ejemplo
cat > "$INSTALL_DIR/bot-saas/trading_bot_saas.py" << 'EOF'
# Bot descargado desde SaaS
# El archivo real se descargaría desde tu servidor
EOF

echo -e "${YELLOW}⚠️ Descarga el bot desde el dashboard del SaaS${NC}"

# ───────────────────────── Crear entorno virtual ─────────────────────────
echo -e "${CYAN}▶ Creando entorno Python...${NC}"

python3 -m venv "$INSTALL_DIR/venv"
source "$INSTALL_DIR/venv/bin/activate"

pip install --upgrade pip -q
pip install MetaTrader5 requests PyYAML -q

echo -e "${GREEN}✅ Entorno Python creado${NC}"

# ───────────────────────── Crear servicio systemd ─────────────────────────
echo -e "${CYAN}▶ Creando servicio de auto-arranque...${NC}"

cat > /etc/systemd/system/trading-bot.service << EOF
[Unit]
Description=Trading Bot SaaS
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/bot-saas
Environment="MT5_LOGIN=YOUR_LOGIN"
Environment="MT5_PASSWORD=YOUR_PASSWORD"
Environment="MT5_SERVER=YOUR_SERVER"
ExecStart=$INSTALL_DIR/venv/bin/python trading_bot_saas.py --api-key $API_KEY --saas-url $SAAS_URL
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable trading-bot

echo -e "${GREEN}✅ Servicio creado${NC}"

# ───────────────────────── Resumen ─────────────────────────
echo -e "${CYAN}"
╔════════════════════════════════════════════════════════════╗
║              INSTALACIÓN COMPLETADA                              ║
╠════════════════════════════════════════════════════════════╣
║                                                              ║
║  Directorio: $INSTALL_DIR
║                                                              ║
║  PROXIMOS PASOS:                                             ║
║  1. Descarga el bot desde el dashboard                        ║
║  2. Edita /etc/systemd/system/trading-bot.service            ║
║     con tus credenciales MT5                                 ║
║  3. Ejecuta: systemctl start trading-bot                     ║
║  4. Verifica: systemctl status trading-bot                   ║
║                                                              ║
║  Comandos útiles:                                            ║
║  • Ver logs: journalctl -u trading-bot -f                    ║
║  • Reiniciar: systemctl restart trading-bot                 ║
║  • Detener: systemctl stop trading-bot                      ║
╚════════════════════════════════════════════════════════════╝
${NC}
