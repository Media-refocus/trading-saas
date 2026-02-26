# Provisioning de VPS para Trading Bot

Este directorio contiene scripts para configurar automáticamente un VPS Windows
con todo lo necesario para ejecutar el bot de trading.

## Requisitos del VPS

- **SO**: Windows Server 2019/2022 o Windows 10/11 Pro
- **RAM**: Mínimo 4GB (recomendado 8GB)
- **CPU**: 2 vCPUs mínimo
- **Disco**: 50GB SSD
- **Red**: Latencia baja al broker MT5
- **Ubicación**: Cerca del servidor del broker (ej: Londres para ICMarkets)

## Proveedores Recomendados

| Proveedor | VPS | Precio aprox. | Notas |
|-----------|-----|---------------|-------|
| Contabo | Windows VPS | €15/mes | Buen precio, Alemania |
| Vultr | Windows | $24/mes | Buena red global |
| DigitalOcean | Droplet + Windows | $20-40/mes | Buena documentación |
| AWS | EC2 Windows | Variable | Más caro, pero fiable |
| Hetzner | (solo Linux) | - | Necesitaría Wine para MT5 |

## Instalación Rápida

### Opción 1: Script automático

1. Descargar el script de setup:
```powershell
# En el VPS, abrir PowerShell como Admin
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Media-refocus/trading-saas/master/provisioning/setup-vps.ps1" -OutFile "setup-vps.ps1"
```

2. Ejecutar con tus parámetros:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup-vps.ps1 -ApiKey "tb_tu_api_key" -SaasUrl "https://tu-saas.com"
```

### Opción 2: Instalación manual

Ver [MANUAL_SETUP.md](./MANUAL_SETUP.md)

## Estructura del VPS después del setup

```
C:\TradingBot\
├── bot\                    # Código del bot Python
│   ├── bot_operativo.py
│   ├── saas_client.py
│   ├── requirements.txt
│   └── config.json         # Configuración local
├── mt5\                    # MetaTrader 5
│   └── terminal64.exe
├── python\                 # Python 3.11+
├── logs\                   # Logs del bot
│   └── bot.log
└── start-bot.bat           # Script de inicio
```

## Servicios instalados

1. **TradingBot Service** - Servicio de Windows que ejecuta el bot
2. **Auto-start** - El bot se inicia automáticamente al arrancar Windows
3. **Auto-restart** - El bot se reinicia si falla
4. **Log rotation** - Logs rotados diariamente

## Comandos útiles

```powershell
# Ver estado del bot
Get-Service TradingBot

# Iniciar/Detener bot
Start-Service TradingBot
Stop-Service TradingBot

# Ver logs
Get-Content C:\TradingBot\logs\bot.log -Tail 50 -Wait

# Reiniciar bot
Restart-Service TradingBot
```

## Monitoreo

El bot reporta su estado al SaaS cada 30 segundos. Desde el dashboard puedes:
- Ver si está online/offline
- Ver posiciones abiertas
- Ver últimas señales y trades
- Enviar comandos (pausar, reanudar)

## Troubleshooting

### El bot no conecta con MT5
1. Verificar que MT5 está abierto
2. Verificar credenciales en el dashboard
3. Verificar que el símbolo está disponible

### El bot no recibe señales de Telegram
1. Verificar que la sesión de Telegram está activa
2. Verificar que los canales están configurados
3. Verificar permisos de la API de Telegram

### El servicio no arranca
```powershell
# Ver errores en Event Viewer
Get-EventLog -LogName Application -Source TradingBot -Newest 10

# Verificar configuración
Test-Path C:\TradingBot\bot\config.json
```

## Seguridad

- **API Key**: Guardar en variable de entorno, no en código
- **Firewall**: Solo permitir puertos necesarios (443 para SaaS, MT5 ports)
- **Updates**: Windows Update configurado para actualizaciones automáticas
- **Backups**: Configurar backup diario de `C:\TradingBot\logs\`

## Actualización del bot

```powershell
# Descargar última versión
cd C:\TradingBot\bot
git pull origin master

# Reiniciar servicio
Restart-Service TradingBot
```
