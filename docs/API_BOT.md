# API REST del Bot

Documentación de los endpoints que el bot Python usa para comunicarse con el SaaS.

## Autenticación

Todos los endpoints requieren el header:
```
Authorization: Bearer tb_xxxxxxxxxxxxx
X-Bot-Version: 1.0.0
```

---

## GET /api/bot/config

Obtiene la configuración del bot desde el SaaS.

### Request
```http
GET /api/bot/config
Authorization: Bearer tb_xxx
X-Bot-Version: 1.0.0
```

### Response (200)
```json
{
  "botId": "clx123...",
  "symbol": "XAUUSD",
  "magicNumber": 20250101,
  "entry": {
    "lot": 0.1,
    "numOrders": 1,
    "trailing": {
      "activate": 30,
      "step": 10,
      "back": 20,
      "buffer": 1
    }
  },
  "grid": {
    "stepPips": 10,
    "lot": 0.1,
    "maxLevels": 4,
    "numOrders": 1,
    "tolerancePips": 1
  },
  "restrictions": {
    "type": null,
    "maxLevels": 4
  },
  "accounts": [
    {
      "id": "clx456...",
      "login": "12345678",
      "password": "secret",
      "server": "Broker-Demo",
      "symbol": "XAUUSD",
      "magic": 20250101
    }
  ],
  "telegram": {
    "apiId": "12345",
    "apiHash": "xxxx",
    "session": "optional_session_string",
    "channels": [
      {"id": 123456789, "accessHash": "xxx"}
    ]
  },
  "heartbeatIntervalSeconds": 30,
  "configRefreshIntervalSeconds": 300
}
```

### Errors
- `401` - API key inválida o faltante
- `403` - Bot pausado
- `404` - Configuración no encontrada

---

## POST /api/bot/heartbeat

Reporta el estado del bot y recibe comandos pendientes.

### Request
```http
POST /api/bot/heartbeat
Authorization: Bearer tb_xxx
Content-Type: application/json

{
  "timestamp": "2026-02-26T14:00:00Z",
  "mt5Connected": true,
  "telegramConnected": true,
  "openPositions": 3,
  "pendingOrders": 0,
  "uptimeSeconds": 3600,
  "metrics": {
    "memoryMB": 150.5,
    "cpuPercent": 2.3
  },
  "accounts": [
    {
      "login": 12345678,
      "server": "Broker-Demo",
      "balance": 10000.00,
      "equity": 10150.00,
      "margin": 500.00,
      "openPositions": 3
    }
  ]
}
```

### Response (200)
```json
{
  "success": true,
  "serverTime": "2026-02-26T14:00:01Z",
  "commands": [
    {"type": "PAUSE", "reason": "Manual pause from dashboard"}
  ]
}
```

### Comandos disponibles
| Tipo | Descripción |
|------|-------------|
| `PAUSE` | Dejar de operar |
| `RESUME` | Reanudar operación |
| `CLOSE_ALL` | Cerrar todas las posiciones |
| `UPDATE_CONFIG` | Recargar configuración |
| `RESTART` | Reiniciar el bot |

### Errors
- `401` - API key inválida
- `400` - JSON inválido

---

## POST /api/bot/signal

Reporta una señal detectada de Telegram.

### Request
```http
POST /api/bot/signal
Authorization: Bearer tb_xxx
Content-Type: application/json

{
  "side": "BUY",
  "symbol": "XAUUSD",
  "price": 2650.50,
  "messageText": "BUY XAUUSD 2650.50",
  "channelId": "123456789",
  "channelName": "Trading Signals",
  "messageId": "9876",
  "isCloseSignal": false,
  "receivedAt": "2026-02-26T14:00:00Z"
}
```

### Response (200)
```json
{
  "success": true,
  "signalId": "clx789...",
  "action": "EXECUTE"
}
```

### Actions
| Valor | Descripción |
|-------|-------------|
| `EXECUTE` | Proceder con la señal |
| `SKIP` | Ignorar (bot pausado) |
| `PAUSE` | Bot debe pausarse |

### Errors
- `401` - API key inválida
- `400` - Faltan campos requeridos (side, symbol)

---

## POST /api/bot/trade

Reporta operaciones de trading.

### Abrir trade
```http
POST /api/bot/trade
Authorization: Bearer tb_xxx
Content-Type: application/json

{
  "action": "OPEN",
  "botAccountId": "clx456...",
  "signalId": "clx789...",
  "mt5Ticket": 12345,
  "side": "BUY",
  "symbol": "XAUUSD",
  "level": 0,
  "openPrice": 2650.50,
  "lotSize": 0.1,
  "stopLoss": 2640.00,
  "takeProfit": 2670.00,
  "virtualSL": null,
  "openedAt": "2026-02-26T14:00:05Z"
}
```

### Cerrar trade
```http
POST /api/bot/trade
Authorization: Bearer tb_xxx
Content-Type: application/json

{
  "action": "CLOSE",
  "botAccountId": "clx456...",
  "mt5Ticket": 12345,
  "closePrice": 2665.00,
  "closeReason": "TAKE_PROFIT",
  "profitPips": 14.5,
  "profitMoney": 145.00,
  "commission": -7.00,
  "swap": 0,
  "closedAt": "2026-02-26T15:30:00Z"
}
```

### Actualizar posición
```http
POST /api/bot/trade
Authorization: Bearer tb_xxx
Content-Type: application/json

{
  "action": "UPDATE",
  "botAccountId": "clx456...",
  "mt5Ticket": 12345,
  "currentPrice": 2655.00,
  "virtualSL": 2652.00,
  "unrealizedPL": 45.00,
  "unrealizedPips": 4.5
}
```

### Close reasons
| Valor | Descripción |
|-------|-------------|
| `TAKE_PROFIT` | Take profit alcanzado |
| `STOP_LOSS` | Stop loss ejecutado |
| `VIRTUAL_SL` | Trailing SL virtual ejecutado |
| `GRID_STEP` | Escalón cerrado por profit |
| `MANUAL` | Cierre manual |

### Response (200)
```json
{
  "success": true,
  "tradeId": "clxabc..."
}
```

### Errors
- `401` - API key inválida
- `400` - Acción inválida
- `404` - Cuenta o trade no encontrado
- `409` - Trade ya existe (duplicado)

---

## Códigos de error

| Código | Descripción |
|--------|-------------|
| `MISSING_FIELDS` | Faltan campos requeridos |
| `INVALID_BODY` | JSON inválido |
| `INVALID_ACTION` | Acción no reconocida |
| `INVALID_SIDE` | Side debe ser BUY o SELL |
| `ACCOUNT_NOT_FOUND` | BotAccount no existe |
| `TRADE_EXISTS` | Trade con ese ticket ya existe |
| `TRADE_NOT_FOUND` | Trade no encontrado |
| `POSITION_NOT_FOUND` | Posición no encontrada |
| `BOT_PAUSED` | Bot está pausado |

---

## Rate limiting

| Endpoint | Límite |
|----------|--------|
| `/heartbeat` | 120/min |
| `/signal` | 60/min |
| `/trade` | 120/min |
| `/config` | 30/min |
