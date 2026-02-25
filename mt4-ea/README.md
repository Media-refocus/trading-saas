# Bot Operativa - EA para MetaTrader 4

## Instalación

### Paso 1: Descargar el EA
Descarga el archivo `BotOperativaReceiver.ex4` (o compila `BotOperativaReceiver.mq4`).

### Paso 2: Copiar a la carpeta de MT4
1. Abre MetaTrader 4
2. Ve a **Archivo → Abrir carpeta de datos**
3. Navega a `MQL4/Experts/`
4. Copia el archivo `BotOperativaReceiver.ex4` en esa carpeta

### Paso 3: Configurar URLs permitidas
**IMPORTANTE:** MT4 bloquea conexiones externas por defecto.

1. Ve a **Herramientas → Opciones**
2. Pestaña **Expertos asesores**
3. Marca **"Permitir WebRequest para las siguientes URL"**
4. Añade: `https://bot.refuelparts.com`
5. Haz clic en **OK**

### Paso 4: Obtener tu API Key
1. Accede a tu panel en https://bot.refuelparts.com
2. Ve a **Configuración → API**
3. Copia tu API Key personal

### Paso 5: Configurar el EA
1. En MT4, arrastra el EA `BotOperativaReceiver` al gráfico de tu símbolo (ej: XAUUSD)
2. En la ventana de configuración, introduce:
   - **ApiKey**: Tu API Key del paso 4
   - **SaasUrl**: `https://bot.refuelparts.com` (por defecto)
   - **PollInterval**: `3` segundos (recomendado)
   - **DefaultLotSize**: Tu lotaje preferido
   - **MagicNumber**: `123456` (no cambiar si tienes varias cuentas)

3. Asegúrate de que **"Permitir comercio en vivo"** está activado
4. Haz clic en **OK**

### Paso 6: Verificar conexión
En la pestaña **Expertos** de MT4, deberías ver:
```
✅ Bot Operativa conectado al SaaS
📊 Símbolo: XAUUSD | Intervalo: 3s
```

## Parámetros de Configuración

| Parámetro | Descripción | Valor por defecto |
|-----------|-------------|-------------------|
| ApiKey | Tu API Key del SaaS | (requerido) |
| SaasUrl | URL del servidor | https://bot.refuelparts.com |
| PollInterval | Segundos entre consultas | 3 |
| MagicNumber | Identificador de órdenes | 123456 |
| DefaultLotSize | Lotaje si no se especifica | 0.01 |
| MaxSlippage | Slippage máximo (puntos) | 3 |
| EnableTrailing | Habilitar Trailing Stop | false |
| TrailingStart | Pips para activar trailing | 20 |
| TrailingStep | Pips de paso del trailing | 5 |
| DebugMode | Mostrar logs detallados | false |

## Funcionamiento

### Recepción de señales
El EA consulta al SaaS cada `PollInterval` segundos para obtener señales pendientes.

### Tipos de señales soportadas
- **BUY**: Abrir posición larga
- **SELL**: Abrir posición corta
- **CLOSE**: Cerrar todas las posiciones
- **CLOSE_BUY**: Cerrar solo compras
- **CLOSE_SELL**: Cerrar solo ventas

### Trailing Stop
Si `EnableTrailing = true`, el EA moverá el Stop Loss automáticamente:
- Se activa cuando el precio se mueve `TrailingStart` pips a favor
- Mueve el SL cada `TrailingStep` pips adicionales

## Solución de Problemas

### Error: "Error de conexión: 4060"
**Causa:** URLs no configuradas en MT4
**Solución:** Ver Paso 3

### Error: "API Key no configurada"
**Causa:** Falta la API Key
**Solución:** Introduce tu API Key en los parámetros del EA

### Error: "API Key inválida"
**Causa:** API Key incorrecta o expirada
**Solución:** Genera una nueva API Key en el panel del SaaS

### El EA no abre operaciones
1. Verifica que el botón **AutoTrading** está activado (verde)
2. Comprueba que tienes margen suficiente
3. Revisa los logs en la pestaña **Expertos**

### El EA no recibe señales
1. Verifica que tu plan está activo en el SaaS
2. Comprueba que el símbolo del gráfico coincide con las señales
3. Activa `DebugMode = true` para más información

## Seguridad

- **Nunca compartas tu API Key**
- La API Key solo permite recibir señales, no acceder a tu cuenta
- Puedes regenerar tu API Key desde el panel del SaaS en cualquier momento

## Soporte

- **Telegram:** @refuelparts
- **Email:** soporte@refuelparts.com
- **Web:** https://bot.refuelparts.com/help

---

**Versión:** 1.0.0
**Actualizado:** Febrero 2026
**Desarrollado por:** Refuel Agency
