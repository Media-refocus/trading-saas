# Guia de Instalacion - Trading Bot

## Resumen

Este bot se ejecuta en **tu VPS Windows** y:
- Se conecta a tu cuenta de MT5 (localmente)
- Recibe configuracion del SaaS via API
- Opera automaticamente segun la estrategia configurada
- **NUNCA envia tus credenciales del broker fuera de tu VPS**

---

## Requisitos

### VPS Necesario

| Componente | Minimo | Recomendado |
|------------|--------|-------------|
| SO | Windows Server 2019 | Windows Server 2022 |
| RAM | 4 GB | 8 GB |
| CPU | 2 vCPU | 4 vCPU |
| Disco | 50 GB SSD | 100 GB SSD |
| Red | 100 Mbps | 1 Gbps |

### Proveedores Recomendados

| Proveedor | Plan Basico | Precio | Notas |
|-----------|-------------|--------|-------|
| Contabo | Windows VPS L | ~15 EUR/mes | Buen precio, Alemania |
| ForexVPS | Basic | ~30 EUR/mes | Optimizado para trading |
| Vultr | Windows 4GB | ~24 USD/mes | Buena red global |
| Contabo | Windows VPS M | ~25 EUR/mes | Mas recursos |

---

## Paso 1: Preparar el VPS

### 1.1 Contratar VPS
1. Elige un proveedor de la lista anterior
2. Selecciona un VPS con Windows Server
3. Ubicacion: preferiblemente cerca del servidor de tu broker

### 1.2 Acceder al VPS
- Desde Windows: usa **Remote Desktop Connection** (mstsc.exe)
- Desde Mac: usa **Microsoft Remote Desktop**
- Introduce la IP del VPS y las credenciales que te dieron

### 1.3 Instalar MetaTrader 5
1. Descarga MT5 desde tu broker (ICMarkets, Infinox, etc.)
2. Instala MT5 en el VPS
3. Abre MT5 y conecta con tu cuenta:
   - File -> Login to Trade Account
   - Introduce tu login y contraseña
   - Selecciona el servidor correcto
4. Verifica que XAUUSD aparece en Market Watch

---

## Paso 2: Instalar el Bot

### 2.1 Obtener API Key
1. Ve al dashboard del SaaS: `https://tu-saas.com/dashboard`
2. Ve a **Settings** -> **Bot Configuration**
3. Click en **Generate API Key**
4. Copia la API Key (empieza por `tb_`)

### 2.2 Ejecutar Instalador
1. Abre **PowerShell como Administrador**
2. Ejecuta:

```powershell
# Descargar instalador
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Media-refocus/trading-saas/master/provisioning/client-package/install.ps1" -OutFile "install.ps1"

# Ejecutar instalador
powershell -ExecutionPolicy Bypass -File install.ps1 -ApiKey "tb_TU_API_KEY_AQUI"
```

3. Sigue las instrucciones en pantalla
4. Cuando pregunte si iniciar el bot, responde **S**

---

## Paso 3: Verificar Funcionamiento

### 3.1 Comprobar que el bot esta online
1. Ve al dashboard del SaaS
2. En la seccion **Bot Monitor** deberias ver:
   - Estado: ONLINE (verde)
   - Ultimo heartbeat: hace menos de 1 minuto
   - Balance y equity de tu cuenta

### 3.2 Ver logs del bot
En el VPS, ejecuta:
```powershell
Get-Content C:\TradingBot\logs\bot.log -Tail 50 -Wait
```

---

## Comandos Utiles

### Desde PowerShell

```powershell
# Ver estado del servicio
Get-Service TradingBot

# Iniciar bot
Start-Service TradingBot

# Detener bot
Stop-Service TradingBot

# Reiniciar bot
Restart-Service TradingBot

# Ver logs en tiempo real
Get-Content C:\TradingBot\logs\bot.log -Tail 50 -Wait

# Ver ultimas 100 lineas
Get-Content C:\TradingBot\logs\bot.log -Tail 100
```

### Desde el Explorador

```
C:\TradingBot\
├── start-bot.bat      <- Doble click para iniciar manualmente
├── stop-bot.bat       <- Doble click para detener
├── status-bot.bat     <- Doble click para ver estado
├── bot\
│   ├── bot.py         <- Codigo del bot
│   ├── config.json    <- Configuracion (API Key, URL)
│   └── requirements.txt
└── logs\
    ├── bot.log        <- Log principal
    ├── bot-stdout.log <- Salida estandar
    └── bot-stderr.log <- Errores
```

---

## Configuracion desde el Dashboard

El bot lee su configuracion del SaaS cada 5 minutos. Desde el dashboard puedes:

### Parametros de Trading
- **Simbolo**: XAUUSD (por defecto)
- **Lote base**: Tamaño de la primera orden
- **Niveles maximos**: Cuantos promedios hacer
- **Distancia entre niveles**: Pips entre cada nivel
- **Take Profit**: Pips para cerrar con beneficio

### Protecciones
- **Daily Loss Limit**: % maximo de perdida diaria
- **Kill Switch**: Boton de emergencia para parar todo

### Canales de Telegram
- Anade los canales de donde quieres recibir senales

---

## Troubleshooting

### El bot no inicia

**Sintoma**: El servicio no arranca o se detiene inmediatamente

**Solucion**:
1. Verifica que MT5 esta abierto y conectado
2. Verifica que la API Key es correcta
3. Revisa los logs:
   ```powershell
   Get-Content C:\TradingBot\logs\bot-stderr.log
   ```

### El bot muestra OFFLINE en el dashboard

**Sintoma**: El dashboard muestra el bot como offline

**Solucion**:
1. Verifica que el servicio esta corriendo:
   ```powershell
   Get-Service TradingBot
   ```
2. Si esta detenido, iniciarlo:
   ```powershell
   Start-Service TradingBot
   ```
3. Verifica la conexion a internet del VPS

### Error: "API Key invalida"

**Sintoma**: El bot no puede conectar con el SaaS

**Solucion**:
1. Ve al dashboard -> Settings -> Bot Configuration
2. Verifica que tu suscripcion esta activa
3. Regenera la API Key si es necesario
4. Actualiza la configuracion:
   ```powershell
   # Editar config.json con la nueva API Key
   notepad C:\TradingBot\bot\config.json
   # Reiniciar bot
   Restart-Service TradingBot
   ```

### Error: "MT5 not connected"

**Sintoma**: El bot no puede conectar con MetaTrader 5

**Solucion**:
1. Abre MT5 manualmente
2. Conecta con tu cuenta (File -> Login)
3. Verifica que el simbolo XAUUSD esta disponible
4. Reinicia el bot:
   ```powershell
   Restart-Service TradingBot
   ```

### El VPS se reinicio y el bot no arranca

**Sintoma**: Despues de reiniciar el VPS, el bot no funciona

**Solucion**:
1. El servicio esta configurado para auto-iniciarse
2. Espera 2-3 minutos despues del reinicio
3. Si no arranca, inicia manualmente:
   ```powershell
   Start-Service TradingBot
   ```
4. Verifica que MT5 tambien se abrio automaticamente

---

## Seguridad

### Que NUNCA debes hacer
- Compartir tu API Key con nadie
- Usar la misma API Key en multiples VPS
- Dejar MT5 abierto sin el bot (posiciones desprotegidas)

### Que es SEGURO
- Tu contraseña de MT5 nunca sale del VPS
- El bot solo envia datos de operativa (no dinero)
- Puedes cerrar el RDP sin afectar al bot

### Backups
Recomendamos hacer backup semanal de:
```
C:\TradingBot\bot\config.json
C:\TradingBot\logs\
```

---

## Actualizaciones

Para actualizar el bot a la ultima version:

```powershell
# Detener bot
Stop-Service TradingBot

# Descargar ultima version
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Media-refocus/trading-saas/master/provisioning/client-package/bot.py" -OutFile "C:\TradingBot\bot\bot.py"

# Reiniciar bot
Start-Service TradingBot
```

---

## Soporte

- **Email**: soporte@tradingbot.com
- **Dashboard**: https://tu-saas.com/dashboard
- **Logs**: Adjunta `C:\TradingBot\logs\bot.log` al reportar problemas
