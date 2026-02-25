//+------------------------------------------------------------------+
//|                                        BotOperativaReceiver.mq4  |
//|                                    Refuel Agency - Bot Operativa |
//|                    Recibe señales del SaaS para MT4              |
//+------------------------------------------------------------------+
#property copyright "Refuel Agency"
#property link      "https://refuelparts.com"
#property version   "1.00"
#property strict
#property description "EA receptor para Bot Operativa - Conecta con el SaaS"
#property description "Recibe señales de trading automáticamente"

//--- Inputs
input string   ApiKey          = "";           // API Key del SaaS
input string   SaasUrl         = "https://bot.refuelparts.com";  // URL del SaaS
input int      PollInterval    = 3;            // Segundos entre consultas
input int      MagicNumber     = 123456;       // Magic Number para las órdenes
input double   DefaultLotSize  = 0.01;         // Lotaje por defecto
input int      MaxSlippage     = 3;            // Slippage máximo en puntos
input bool     EnableTrailing  = false;        // Habilitar Trailing Stop
input int      TrailingStart   = 20;           // Pips para activar trailing
input int      TrailingStep    = 5;            // Pips de paso del trailing
input bool     DebugMode       = false;        // Mostrar logs detallados

//--- Global variables
string gSymbol = "";
int gLastError = 0;
datetime gLastCheck = 0;
bool gIsConnected = false;
string gLastErrorMsg = "";

//--- Estructura de señal
struct Signal {
    string id;
    string action;       // BUY, SELL, CLOSE
    string symbol;
    double price;
    double lotSize;
    double stopLoss;
    double takeProfit;
    int    levels;
    string restriction;
    datetime timestamp;
};

Signal gCurrentSignal;

//+------------------------------------------------------------------+
//| Expert initialization function                                     |
//+------------------------------------------------------------------+
int OnInit()
{
    // Validar API Key
    if(StringLen(ApiKey) < 10) {
        Print("❌ ERROR: API Key no configurada. Introduce tu API Key del SaaS.");
        return INIT_FAILED;
    }

    // Configurar símbolo
    gSymbol = Symbol();

    // Verificar conexión inicial
    if(!CheckConnection()) {
        Print("⚠️ No se pudo conectar al SaaS. El EA seguirá intentando...");
    } else {
        Print("✅ Bot Operativa conectado al SaaS");
        Print("📊 Símbolo: ", gSymbol, " | Intervalo: ", PollInterval, "s");
    }

    // Crear timer para polling
    EventSetTimer(PollInterval);

    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    EventKillTimer();
    ReportStatus("DISCONNECTED", "EA detenido - Razón: " + IntegerToString(reason));
    Print("🔌 Bot Operativa desconectado");
}

//+------------------------------------------------------------------+
//| Timer function - Poll for signals                                  |
//+------------------------------------------------------------------+
void OnTimer()
{
    // Verificar conexión
    if(!CheckConnection()) {
        gIsConnected = false;
        return;
    }

    gIsConnected = true;

    // Obtener señales pendientes
    string signals = FetchSignals();

    if(StringLen(signals) > 0) {
        ProcessSignals(signals);
    }

    // Actualizar trailing stop si está habilitado
    if(EnableTrailing) {
        UpdateTrailingStops();
    }

    // Reportar estado periódicamente
    static int reportCounter = 0;
    reportCounter++;
    if(reportCounter >= 20) { // Cada ~60 segundos con poll de 3s
        ReportPositions();
        reportCounter = 0;
    }

    gLastCheck = TimeCurrent();
}

//+------------------------------------------------------------------+
//| Check connection to SaaS                                           |
//+------------------------------------------------------------------+
bool CheckConnection()
{
    string url = SaasUrl + "/api/mt4/health?apiKey=" + ApiKey;
    string response = "";
    string headers = "Content-Type: application/json\r\n";

    int timeout = 5000;
    char data[];
    char result[];
    string resultHeaders;

    int res = WebRequest("GET", url, headers, timeout, data, result, resultHeaders);

    if(res == -1) {
        gLastError = GetLastError();
        gLastErrorMsg = "Error de conexión: " + IntegerToString(gLastError);
        if(DebugMode) Print("❌ ", gLastErrorMsg);
        return false;
    }

    response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);

    if(StringFind(response, "\"status\":\"ok\"") >= 0) {
        return true;
    }

    return false;
}

//+------------------------------------------------------------------+
//| Fetch pending signals from SaaS                                    |
//+------------------------------------------------------------------+
string FetchSignals()
{
    string url = SaasUrl + "/api/mt4/signals?apiKey=" + ApiKey + "&symbol=" + gSymbol;
    string headers = "Content-Type: application/json\r\n";

    int timeout = 5000;
    char data[];
    char result[];
    string resultHeaders;

    int res = WebRequest("GET", url, headers, timeout, data, result, resultHeaders);

    if(res == -1) {
        if(DebugMode) Print("❌ Error obteniendo señales: ", GetLastError());
        return "";
    }

    return CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
}

//+------------------------------------------------------------------+
//| Process signals JSON                                               |
//+------------------------------------------------------------------+
void ProcessSignals(string jsonSignals)
{
    if(DebugMode) Print("📥 Señales recibidas: ", StringSubstr(jsonSignals, 0, 200));

    // Parsear JSON de señales
    // Formato esperado: {"signals":[{"id":"xxx","action":"BUY","symbol":"XAUUSD",...}]}

    int pos = 0;
    string token;

    // Buscar array de señales
    int signalsStart = StringFind(jsonSignals, "\"signals\":[");
    if(signalsStart == -1) return;

    string signalsArray = StringSubstr(jsonSignals, signalsStart);

    // Procesar cada señal (simplificado - en producción usar JSON parser completo)
    while(true) {
        int signalStart = StringFind(signalsArray, "{", pos);
        if(signalStart == -1) break;

        int signalEnd = StringFind(signalsArray, "}", signalStart);
        if(signalEnd == -1) break;

        string signalJson = StringSubstr(signalsArray, signalStart, signalEnd - signalStart + 1);

        // Parsear señal individual
        Signal sig;
        sig.id = ExtractJsonString(signalJson, "id");
        sig.action = ExtractJsonString(signalJson, "action");
        sig.symbol = ExtractJsonString(signalJson, "symbol");
        sig.price = StringToDouble(ExtractJsonString(signalJson, "price"));
        sig.lotSize = StringToDouble(ExtractJsonString(signalJson, "lotSize"));
        sig.stopLoss = StringToDouble(ExtractJsonString(signalJson, "stopLoss"));
        sig.takeProfit = StringToDouble(ExtractJsonString(signalJson, "takeProfit"));
        sig.levels = (int)StringToDouble(ExtractJsonString(signalJson, "maxLevels"));
        sig.restriction = ExtractJsonString(signalJson, "restriction");

        // Ejecutar señal
        ExecuteSignal(sig);

        pos = signalEnd + 1;
    }
}

//+------------------------------------------------------------------+
//| Extract string value from JSON                                     |
//+------------------------------------------------------------------+
string ExtractJsonString(string json, string key)
{
    string searchKey = "\"" + key + "\":";
    int keyPos = StringFind(json, searchKey);
    if(keyPos == -1) return "";

    int valueStart = keyPos + StringLen(searchKey);

    // Saltar espacios
    while(valueStart < StringLen(json) && StringGetCharacter(json, valueStart) == 32)
        valueStart++;

    // Verificar si es string o número
    int firstChar = StringGetCharacter(json, valueStart);

    if(firstChar == 34) { // Comillas - es string
        int valueEnd = StringFind(json, "\"", valueStart + 1);
        if(valueEnd == -1) return "";
        return StringSubstr(json, valueStart + 1, valueEnd - valueStart - 1);
    } else {
        // Número - buscar coma o cierre
        int valueEnd = valueStart;
        while(valueEnd < StringLen(json)) {
            int c = StringGetCharacter(json, valueEnd);
            if(c == 44 || c == 125 || c == 93) break; // coma, } o ]
            valueEnd++;
        }
        return StringSubstr(json, valueStart, valueEnd - valueStart);
    }
}

//+------------------------------------------------------------------+
//| Execute trading signal                                             |
//+------------------------------------------------------------------+
bool ExecuteSignal(Signal &sig)
{
    if(DebugMode) Print("🎯 Ejecutando señal: ", sig.action, " ", sig.symbol);

    // Verificar símbolo
    if(sig.symbol != gSymbol && sig.symbol != "") {
        if(DebugMode) Print("⚠️ Señal para otro símbolo: ", sig.symbol);
        return false;
    }

    // Ejecutar según acción
    if(sig.action == "BUY") {
        return OpenOrder(OP_BUY, sig);
    }
    else if(sig.action == "SELL") {
        return OpenOrder(OP_SELL, sig);
    }
    else if(sig.action == "CLOSE") {
        return CloseAllOrders();
    }
    else if(sig.action == "CLOSE_BUY") {
        return CloseOrdersByType(OP_BUY);
    }
    else if(sig.action == "CLOSE_SELL") {
        return CloseOrdersByType(OP_SELL);
    }

    return false;
}

//+------------------------------------------------------------------+
//| Open order                                                         |
//+------------------------------------------------------------------+
bool OpenOrder(int orderType, Signal &sig)
{
    double lotSize = sig.lotSize;
    if(lotSize <= 0) lotSize = DefaultLotSize;

    double price;
    double sl = 0;
    double tp = 0;
    string comment = "BotOp_" + sig.id;

    if(orderType == OP_BUY) {
        price = Ask;
        if(sig.stopLoss > 0) sl = price - sig.stopLoss * Point;
        if(sig.takeProfit > 0) tp = price + sig.takeProfit * Point;
    } else {
        price = Bid;
        if(sig.stopLoss > 0) sl = price + sig.stopLoss * Point;
        if(sig.takeProfit > 0) tp = price - sig.takeProfit * Point;
    }

    // Normalizar precios
    price = NormalizeDouble(price, Digits);
    sl = NormalizeDouble(sl, Digits);
    tp = NormalizeDouble(tp, Digits);

    int ticket = OrderSend(
        gSymbol,
        orderType,
        lotSize,
        price,
        MaxSlippage,
        sl,
        tp,
        comment,
        MagicNumber,
        0,
        orderType == OP_BUY ? clrGreen : clrRed
    );

    if(ticket < 0) {
        int error = GetLastError();
        string errorMsg = "Error abriendo orden: " + IntegerToString(error);
        Print("❌ ", errorMsg);
        ReportStatus("ERROR", errorMsg);
        return false;
    }

    Print("✅ Orden abierta: #", ticket, " ", orderType == OP_BUY ? "BUY" : "SELL",
          " ", lotSize, " @ ", price);

    // Confirmar al SaaS
    ConfirmSignal(sig.id, ticket, "EXECUTED");

    return true;
}

//+------------------------------------------------------------------+
//| Close all orders                                                   |
//+------------------------------------------------------------------+
bool CloseAllOrders()
{
    int closed = 0;

    for(int i = OrdersTotal() - 1; i >= 0; i--) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderSymbol() == gSymbol && OrderMagicNumber() == MagicNumber) {
                if(OrderClose(OrderTicket(), OrderLots(), OrderClosePrice(), MaxSlippage, clrYellow)) {
                    closed++;
                    Print("✅ Orden cerrada: #", OrderTicket());
                }
            }
        }
    }

    return closed > 0;
}

//+------------------------------------------------------------------+
//| Close orders by type                                               |
//+------------------------------------------------------------------+
bool CloseOrdersByType(int orderType)
{
    int closed = 0;

    for(int i = OrdersTotal() - 1; i >= 0; i--) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderSymbol() == gSymbol &&
               OrderMagicNumber() == MagicNumber &&
               OrderType() == orderType) {
                if(OrderClose(OrderTicket(), OrderLots(), OrderClosePrice(), MaxSlippage, clrYellow)) {
                    closed++;
                    Print("✅ Orden cerrada: #", OrderTicket());
                }
            }
        }
    }

    return closed > 0;
}

//+------------------------------------------------------------------+
//| Update trailing stops                                              |
//+------------------------------------------------------------------+
void UpdateTrailingStops()
{
    for(int i = OrdersTotal() - 1; i >= 0; i--) {
        if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
        if(OrderSymbol() != gSymbol) continue;
        if(OrderMagicNumber() != MagicNumber) continue;

        double newSL = 0;
        double currentSL = OrderStopLoss();
        double openPrice = OrderOpenPrice();

        if(OrderType() == OP_BUY) {
            double bid = MarketInfo(gSymbol, MODE_BID);
            if(bid - openPrice > TrailingStart * Point) {
                newSL = bid - TrailingStep * Point;
                if(newSL > currentSL) {
                    OrderModify(OrderTicket(), OrderOpenPrice(),
                               NormalizeDouble(newSL, Digits),
                               OrderTakeProfit(), 0, clrGreen);
                }
            }
        }
        else if(OrderType() == OP_SELL) {
            double ask = MarketInfo(gSymbol, MODE_ASK);
            if(openPrice - ask > TrailingStart * Point) {
                newSL = ask + TrailingStep * Point;
                if(newSL < currentSL || currentSL == 0) {
                    OrderModify(OrderTicket(), OrderOpenPrice(),
                               NormalizeDouble(newSL, Digits),
                               OrderTakeProfit(), 0, clrRed);
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Confirm signal execution to SaaS                                   |
//+------------------------------------------------------------------+
void ConfirmSignal(string signalId, int ticket, string status)
{
    string url = SaasUrl + "/api/mt4/signals/confirm";
    string headers = "Content-Type: application/json\r\n";

    string body = "{\"apiKey\":\"" + ApiKey + "\",\"signalId\":\"" + signalId +
                  "\",\"ticket\":" + IntegerToString(ticket) +
                  ",\"status\":\"" + status + "\"}";

    char data[];
    char result[];
    string resultHeaders;

    StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
    ArrayResize(data, ArraySize(data) - 1); // Remove null terminator

    int res = WebRequest("POST", url, headers, 5000, data, result, resultHeaders);

    if(DebugMode && res != -1) {
        Print("📤 Confirmación enviada: ", signalId);
    }
}

//+------------------------------------------------------------------+
//| Report status to SaaS                                              |
//+------------------------------------------------------------------+
void ReportStatus(string status, string message)
{
    string url = SaasUrl + "/api/mt4/status";
    string headers = "Content-Type: application/json\r\n";

    int openPositions = 0;
    double totalProfit = 0;

    for(int i = 0; i < OrdersTotal(); i++) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderSymbol() == gSymbol && OrderMagicNumber() == MagicNumber) {
                openPositions++;
                totalProfit += OrderProfit();
            }
        }
    }

    string body = "{\"apiKey\":\"" + ApiKey + "\"," +
                  "\"status\":\"" + status + "\"," +
                  "\"message\":\"" + message + "\"," +
                  "\"openPositions\":" + IntegerToString(openPositions) + "," +
                  "\"totalProfit\":" + DoubleToString(totalProfit, 2) + "," +
                  "\"symbol\":\"" + gSymbol + "\"}";

    char data[];
    char result[];
    string resultHeaders;

    StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
    ArrayResize(data, ArraySize(data) - 1);

    WebRequest("POST", url, headers, 5000, data, result, resultHeaders);
}

//+------------------------------------------------------------------+
//| Report positions to SaaS                                           |
//+------------------------------------------------------------------+
void ReportPositions()
{
    string url = SaasUrl + "/api/mt4/positions";
    string headers = "Content-Type: application/json\r\n";

    // Construir JSON de posiciones
    string positionsJson = "[";
    int count = 0;

    for(int i = 0; i < OrdersTotal(); i++) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderSymbol() == gSymbol && OrderMagicNumber() == MagicNumber) {
                if(count > 0) positionsJson += ",";
                positionsJson += "{\"ticket\":" + IntegerToString(OrderTicket()) + "," +
                                "\"type\":" + IntegerToString(OrderType()) + "," +
                                "\"lots\":" + DoubleToString(OrderLots(), 2) + "," +
                                "\"openPrice\":" + DoubleToString(OrderOpenPrice(), Digits) + "," +
                                "\"sl\":" + DoubleToString(OrderStopLoss(), Digits) + "," +
                                "\"tp\":" + DoubleToString(OrderTakeProfit(), Digits) + "," +
                                "\"profit\":" + DoubleToString(OrderProfit(), 2) + "}";
                count++;
            }
        }
    }

    positionsJson += "]";

    string body = "{\"apiKey\":\"" + ApiKey + "\"," +
                  "\"symbol\":\"" + gSymbol + "\"," +
                  "\"positions\":" + positionsJson + "}";

    char data[];
    char result[];
    string resultHeaders;

    StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
    ArrayResize(data, ArraySize(data) - 1);

    WebRequest("POST", url, headers, 5000, data, result, resultHeaders);
}
//+------------------------------------------------------------------+
