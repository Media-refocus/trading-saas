# Guía de Instalación - Trading Bot SaaS (Windows)

Esta guía te ayudará a instalar el bot de trading en tu VPS Windows paso a paso.

---

## Requisitos Previos

Antes de empezar, necesitas:

1. **VPS Windows** - Recomendamos:
   - **Contabo** (VPS Windows M) - Desde €15/mes - [Enlace afiliado]
   - Mínimo 4GB RAM, 2 vCPU
   - Windows Server 2019 o superior

2. **Cuenta de broker** con MT5:
   - Login (número de cuenta)
   - Contraseña
   - Nombre del servidor (ej: "VTMarkets-Live")

3. **Suscripción activa** en el SaaS:
   - API Key generada desde el dashboard

---

## Paso 1: Conectar al VPS

### Opción A: Escritorio Remoto (RDP)

1. En tu PC local, presiona `Win + R`
2. Escribe `mstsc` y presiona Enter
3. Introduce la IP de tu VPS
4. Usuario: `Administrator`
5. Contraseña: (la que te envió el proveedor)

### Opción B: Desde el panel del proveedor

La mayoría de proveedores tienen un botón "Console" o "VNC" en su panel de control.

---

## Paso 2: Preparar MT5

1. **Descarga MT5** desde tu broker
   - Ve a la web de tu broker
   - Busca "Descargar MT5" o "MetaTrader 5"
   - Descarga la versión Windows

2. **Instala MT5**
   - Ejecuta el instalador descargado
   - Sigue los pasos del asistente
   - Importante: Recuerda la ruta de instalación (ej: `C:\Program Files\BrokerName\MetaTrader5`)

3. **Abre MT5 y haz login**
   - Introduce tu login y contraseña
   - Verifica que conecta correctamente
   - **Deja MT5 abierto** durante la instalación del bot

---

## Paso 3: Descargar el instalador

1. Abre **PowerShell como Administrador**
   - Click derecho en el botón Inicio
   - "Windows PowerShell (Admin)"
   - O busca "PowerShell", click derecho, "Ejecutar como administrador"

2. Descarga el instalador:

```powershell
# Crear directorio
mkdir C:\TradingBot
cd C:\TradingBot

# Descargar instalador (reemplaza con tu URL real)
Invoke-WebRequest -Uri "https://tu-saas.com/downloads/install-windows.ps1" -OutFile "install-windows.ps1"
```

---

## Paso 4: Ejecutar el instalador

```powershell
# Ejecutar con tu API key
.\install-windows.ps1 -ApiKey "tb_tu_api_key_aqui"
```

El instalador:
- ✅ Verifica requisitos del sistema
- ✅ Instala Python 3.11 si no está
- ✅ Descarga el bot
- ✅ Crea entorno virtual
- ✅ Instala dependencias
- ✅ Crea servicio de auto-arranque

---

## Paso 5: Configurar credenciales MT5

```powershell
# Ejecutar configurador
.\configure.ps1 `
    -ApiKey "tb_tu_api_key" `
    -Mt5Login "12345678" `
    -Mt5Password "tu_password" `
    -Mt5Server "VTMarkets-Live" `
    -Symbol "XAUUSD"
```

---

## Paso 6: Iniciar el bot

```powershell
# Iniciar servicio
Start-Service TradingBotSaaS

# Verificar estado
Get-Service TradingBotSaaS
```

Deberías ver:
```
Status   Name               DisplayName
------   ----               -----------
Running  TradingBotSaaS     Trading Bot SaaS
```

---

## Paso 7: Verificar funcionamiento

### Ver logs en tiempo real

```powershell
Get-Content C:\TradingBot\bot-saas\logs\bot_*.log -Wait
```

### Verificar conexión con SaaS

```powershell
.\check-status.ps1
```

Deberías ver algo como:
```
✅ Bot conectado al SaaS
✅ MT5 conectado
✅ Esperando señales...
```

---

## Solución de Problemas

### El servicio no inicia

```powershell
# Ver errores
Get-EventLog -LogName Application -Source TradingBotSaaS -Newest 10

# Verificar Python
C:\TradingBot\venv\Scripts\python.exe --version

# Ejecutar manualmente para ver errores
cd C:\TradingBot\bot-saas
C:\TradingBot\venv\Scripts\python.exe trading_bot_saas.py --api-key "tb_xxx"
```

### Error de conexión con SaaS

1. Verifica que la URL del SaaS es correcta
2. Verifica que la API key es válida (desde el dashboard)
3. Verifica que tu suscripción está activa

### Error de conexión con MT5

1. Verifica que MT5 está abierto
2. Verifica login/password/server
3. Verifica que el símbolo XAUUSD está disponible

### El bot se detiene

```powershell
# Reiniciar
Restart-Service TradingBotSaaS

# Ver logs
Get-Content C:\TradingBot\bot-saas\logs\*.log -Tail 50
```

---

## Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `Start-Service TradingBotSaaS` | Iniciar bot |
| `Stop-Service TradingBotSaaS` | Detener bot |
| `Restart-Service TradingBotSaaS` | Reiniciar bot |
| `Get-Service TradingBotSaaS` | Ver estado |
| `Get-Content ... -Wait` | Ver logs en vivo |

---

## Actualizar el bot

```powershell
cd C:\TradingBot
.\install-windows.ps1 -ApiKey "tb_tu_api_key" -Update
```

---

## Desinstalar

```powershell
cd C:\TradingBot
.\uninstall.ps1
```

---

## Soporte

Si tienes problemas:
1. Email: soporte@tu-saas.com
2. Incluye:
   - Screenshot del error
   - Contenido de `C:\TradingBot\bot-saas\logs\bot_*.log`
   - Tu API key (parcial: `tb_abc...`)
