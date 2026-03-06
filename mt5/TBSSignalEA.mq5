//+------------------------------------------------------------------+
//|                                               TBSSignalEA.mq5   |
//|                              Trading Bot SaaS — Refocus Agency  |
//|                                        https://refocus.agency    |
//+------------------------------------------------------------------+
//
// INSTALACIÓN:
//  1. Copia este archivo en: MetaTrader5/MQL5/Experts/TBSSignalEA.mq5
//  2. Compila con MetaEditor (F7)
//  3. Arrastra el EA al gráfico XAUUSD (cualquier timeframe)
//  4. En MT5: Herramientas > Opciones > Asesores Expertos
//     → Activar "Permitir solicitudes Web para URL listadas"
//     → Añadir: https://trading-bot-saas.vercel.app
//  5. Introduce tu ApiKey del dashboard TBS
//
// SEGURIDAD:
//  - El EA envía tu número de cuenta MT5 en cada request
//  - Si la cuenta no coincide con tu suscripción → sin señales
//  - El EA es inútil sin credenciales válidas en el servidor
//
//+------------------------------------------------------------------+

#property copyright "Refocus Agency"
#property link      "https://refocus.agency"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

//--- Inputs
input string ApiKey         = "";                                          // API Key (del dashboard TBS)
input string ServerUrl      = "https://trading-bot-saas.vercel.app";      // URL del servidor
input string EASymbol       = "XAUUSD";                                   // Símbolo a operar
input double LotSize        = 0.01;                                        // Tamaño de lote
input int    Slippage       = 3;                                           // Slippage máximo (pips)
input int    MagicNumber    = 20260101;                                    // Magic number único
input int    PollSeconds    = 2;                                           // Intervalo de consulta señales (segundos)
input int    HeartbeatSeconds = 30;                                        // Intervalo de heartbeat (segundos)

//--- Globales
datetime g_lastPollTime     = 0;
datetime g_lastHeartbeatTime = 0;
string   g_lastSignalId     = "";
CTrade   g_trade;

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   if(ApiKey == "")
   {
      Alert("TBS EA: ApiKey no configurada. Introduce tu API key del dashboard TBS.");
      return(INIT_PARAMETERS_INCORRECT);
   }

   // Configurar CTrade
   g_trade.SetExpertMagicNumber(MagicNumber);
   g_trade.SetDeviationInPoints(Slippage);
   g_trade.SetTypeFilling(ORDER_FILLING_IOC); // IOC para evitar requotes

   Print("TBS EA iniciado | Cuenta: ", IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)), " | Servidor: ", ServerUrl);
   Print("TBS EA | Symbol: ", EASymbol, " | Lot: ", LotSize, " | Magic: ", MagicNumber);
   Print("TBS EA | Heartbeat cada: ", HeartbeatSeconds, " segundos");

   // Test de conectividad inicial
   if(!TestConnection())
   {
      Alert("TBS EA: No se puede conectar al servidor. Verifica la URL y que WebRequest esté habilitado.");
      return(INIT_FAILED);
   }

   Print("TBS EA | Conexión OK. Esperando señales...");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("TBS EA desconectado. Razón: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                              |
//+------------------------------------------------------------------+
void OnTick()
{
   datetime now = TimeCurrent();

   // Heartbeat cada N segundos
   if(now - g_lastHeartbeatTime >= HeartbeatSeconds)
   {
      g_lastHeartbeatTime = now;
      SendHeartbeat();
   }

   // Polling de señales cada N segundos
   if(now - g_lastPollTime < PollSeconds)
      return;

   g_lastPollTime = now;
   PollSignals();
}

//+------------------------------------------------------------------+
//| Test de conectividad                                              |
//+------------------------------------------------------------------+
bool TestConnection()
{
   string headers = BuildHeaders();
   char   data[], result[];
   string resultHeaders;
   int timeout = 5000;
   string url = ServerUrl + "/api/health";

   int res = WebRequest("GET", url, headers, timeout, data, result, resultHeaders);
   return(res == 200);
}

//+------------------------------------------------------------------+
//| Construye los headers de autenticación                            |
//+------------------------------------------------------------------+
string BuildHeaders()
{
   string headers = "Authorization: Bearer " + ApiKey + "\r\n";
   headers       += "X-MT-Account: " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\r\n";
   headers       += "X-Platform: MT5\r\n";
   headers       += "Content-Type: application/json\r\n";
   return(headers);
}

//+------------------------------------------------------------------+
//| Envía heartbeat al servidor                                       |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string headers = BuildHeaders();
   char   data[], result[];
   string resultHeaders;

   // Construir JSON de heartbeat
   string json = "{";
   json += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   json += "\"openPositions\":[";

   // Recorrer posiciones abiertas
   bool first = true;
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      if(PositionSelectByTicket(PositionGetTicket(i)))
      {
         if(PositionGetInteger(POSITION_MAGIC) != MagicNumber)
            continue;

         if(!first) json += ",";
         first = false;

         long ticket = PositionGetInteger(POSITION_TICKET);
         string symbol = PositionGetString(POSITION_SYMBOL);
         long type = PositionGetInteger(POSITION_TYPE);
         double lots = PositionGetDouble(POSITION_VOLUME);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double profit = PositionGetDouble(POSITION_PROFIT);

         // Calcular pips (aprox para XAUUSD)
         double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
         double pips = 0.0;
         if(type == POSITION_TYPE_BUY)
            pips = (currentPrice - openPrice) / 0.01; // Asumiendo XAUUSD
         else
            pips = (openPrice - currentPrice) / 0.01;

         json += "{";
         json += "\"ticket\":" + IntegerToString(ticket) + ",";
         json += "\"symbol\":\"" + symbol + "\",";
         json += "\"type\":\"" + (type == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
         json += "\"lots\":" + DoubleToString(lots, 2) + ",";
         json += "\"openPrice\":" + DoubleToString(openPrice, 2) + ",";
         json += "\"profit\":" + DoubleToString(profit, 2) + ",";
         json += "\"pips\":" + DoubleToString(pips, 1);
         json += "}";
      }
   }

   json += "]}";

   StringToCharArray(json, data, 0, WHOLE_ARRAY);
   ArrayResize(data, ArraySize(data) - 1); // Eliminar null terminator

   int res = WebRequest("POST", ServerUrl + "/api/bot/heartbeat", headers, 5000, data, result, resultHeaders);

   if(res == 200)
      Print("TBS EA | Heartbeat enviado OK");
   else if(res != 401 && res != 403 && res != 429) // No spam con errores de auth
      Print("TBS EA | Error heartbeat HTTP: ", res);
}

//+------------------------------------------------------------------+
//| Consulta señales pendientes al servidor                           |
//+------------------------------------------------------------------+
void PollSignals()
{
   string headers = BuildHeaders();
   char   data[], result[];
   string resultHeaders;

   int res = WebRequest(
      "GET",
      ServerUrl + "/api/bot/signals/pending",
      headers,
      5000,
      data,
      result,
      resultHeaders
   );

   if(res == 401)
   {
      Print("TBS EA | Error 401: API key inválida o expirada. Verifica tu suscripción en el dashboard.");
      return;
   }

   if(res == 403)
   {
      Print("TBS EA | Error 403: Cuenta MT5 no autorizada. Esta cuenta no está registrada en tu suscripción TBS.");
      return;
   }

   if(res == 429)
   {
      Print("TBS EA | Rate limit alcanzado. Esperando...");
      return;
   }

   if(res != 200)
   {
      Print("TBS EA | Error HTTP: ", res);
      return;
   }

   // Parsear JSON
   string json = CharArrayToString(result);
   if(StringFind(json, "\"signals\"") < 0)
      return;

   // Extraer count
   int count = ParseIntField(json, "count");
   if(count <= 0)
      return;

   Print("TBS EA | ", count, " señal(es) pendiente(s)");
   ProcessSignalsJson(json);
}

//+------------------------------------------------------------------+
//| Procesa el JSON de señales                                        |
//+------------------------------------------------------------------+
void ProcessSignalsJson(string json)
{
   // Iterar sobre señales en el array (parseado manualmente)
   int pos = 0;
   while(true)
   {
      int start = StringFind(json, "{\"id\":", pos);
      if(start < 0) break;

      int end = StringFind(json, "}", start);
      if(end < 0) break;

      // Buscar el cierre del objeto completo (puede tener objetos anidados)
      end = FindObjectEnd(json, start);
      if(end < 0) break;

      string signalObj = StringSubstr(json, start, end - start + 1);
      ProcessSingleSignal(signalObj);

      pos = end + 1;
   }
}

//+------------------------------------------------------------------+
//| Encuentra el cierre de un objeto JSON                             |
//+------------------------------------------------------------------+
int FindObjectEnd(string json, int start)
{
   int depth = 0;
   int len = StringLen(json);
   for(int i = start; i < len; i++)
   {
      ushort c = StringGetCharacter(json, i);
      if(c == '{') depth++;
      else if(c == '}') { depth--; if(depth == 0) return(i); }
   }
   return(-1);
}

//+------------------------------------------------------------------+
//| Procesa una señal individual                                      |
//+------------------------------------------------------------------+
void ProcessSingleSignal(string signalObj)
{
   string signalId   = ParseStringField(signalObj, "id");
   string signalType = ParseStringField(signalObj, "type");  // "ENTRY" o "CLOSE"
   string side       = ParseStringField(signalObj, "side");  // "BUY" o "SELL"
   double price      = ParseDoubleField(signalObj, "price");
   string symbol     = ParseStringField(signalObj, "symbol");

   if(signalId == "" || signalType == "")
   {
      Print("TBS EA | Señal malformada: ", signalObj);
      return;
   }

   // Evitar procesar la misma señal dos veces
   if(signalId == g_lastSignalId)
      return;

   Print("TBS EA | Procesando señal ", signalId, " | Tipo: ", signalType, " | Side: ", side);

   bool success = false;

   if(signalType == "ENTRY")
      success = ExecuteEntry(signalId, side, price, symbol);
   else if(signalType == "CLOSE")
      success = ExecuteClose(signalId, symbol);

   if(success)
   {
      g_lastSignalId = signalId;
      AckSignal(signalId);
   }
}

//+------------------------------------------------------------------+
//| Ejecuta una orden de entrada                                      |
//+------------------------------------------------------------------+
bool ExecuteEntry(string signalId, string side, double price, string symbol)
{
   ENUM_ORDER_TYPE orderType = (side == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   string sym = (symbol == "") ? EASymbol : symbol;

   // Obtener precios actuales
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);

   double orderPrice = (orderType == ORDER_TYPE_BUY) ? ask : bid;

   // Ejecutar orden usando CTrade
   bool result;
   if(orderType == ORDER_TYPE_BUY)
      result = g_trade.Buy(LotSize, sym, orderPrice, 0, 0, "TBS Signal");
   else
      result = g_trade.Sell(LotSize, sym, orderPrice, 0, 0, "TBS Signal");

   if(!result)
   {
      Print("TBS EA | Error al abrir orden: ", g_trade.ResultRetcode(), " | ", g_trade.ResultRetcodeDescription());
      return(false);
   }

   ulong ticket = g_trade.ResultOrder();
   Print("TBS EA | Orden abierta OK | Ticket: ", IntegerToString(ticket), " | ", side, " @ ", orderPrice);

   // Enviar trade event al servidor
   SendTradeEvent(signalId, "OPEN", side, sym, LotSize, orderPrice, 0, 0, 0, ticket);

   return(true);
}

//+------------------------------------------------------------------+
//| Cierra todas las posiciones del EA en el símbolo                  |
//+------------------------------------------------------------------+
bool ExecuteClose(string signalId, string symbol)
{
   string sym = (symbol == "") ? EASymbol : symbol;
   bool closed = false;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionSelectByTicket(PositionGetTicket(i)))
      {
         if(PositionGetString(POSITION_SYMBOL) != sym)
            continue;
         if(PositionGetInteger(POSITION_MAGIC) != MagicNumber)
            continue;

         ulong ticket = PositionGetInteger(POSITION_TICKET);
         long type = PositionGetInteger(POSITION_TYPE);
         double lots = PositionGetDouble(POSITION_VOLUME);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double profit = PositionGetDouble(POSITION_PROFIT);

         // Obtener precio actual para cerrar
         double closePrice = (type == POSITION_TYPE_BUY)
            ? SymbolInfoDouble(sym, SYMBOL_BID)
            : SymbolInfoDouble(sym, SYMBOL_ASK);

         // Calcular pips
         double pips = 0.0;
         if(type == POSITION_TYPE_BUY)
            pips = (closePrice - openPrice) / 0.01;
         else
            pips = (openPrice - closePrice) / 0.01;

         // Cerrar posición
         if(g_trade.PositionClose(ticket))
         {
            Print("TBS EA | Orden cerrada OK | Ticket: ", IntegerToString(ticket));
            closed = true;

            // Enviar trade event al servidor
            string side = (type == POSITION_TYPE_BUY) ? "BUY" : "SELL";
            SendTradeEvent(signalId, "CLOSE", side, sym, lots, openPrice, closePrice, profit, pips, ticket);
         }
         else
         {
            Print("TBS EA | Error al cerrar orden ", IntegerToString(ticket), ": ", g_trade.ResultRetcode());
         }
      }
   }

   return(closed);
}

//+------------------------------------------------------------------+
//| Confirma señal procesada al servidor                              |
//+------------------------------------------------------------------+
void AckSignal(string signalId)
{
   string headers = BuildHeaders();
   char   data[], result[];
   string resultHeaders;

   int res = WebRequest(
      "GET",
      ServerUrl + "/api/bot/signals/" + signalId + "/ack",
      headers,
      5000,
      data,
      result,
      resultHeaders
   );

   if(res == 200)
      Print("TBS EA | Señal ", signalId, " confirmada OK");
   else
      Print("TBS EA | Error confirmando señal ", signalId, ": HTTP ", res);
}

//+------------------------------------------------------------------+
//| Envía evento de trade al servidor                                 |
//+------------------------------------------------------------------+
void SendTradeEvent(string signalId, string type, string side, string symbol,
                    double lots, double openPrice, double closePrice,
                    double profit, double pips, ulong ticket)
{
   string headers = BuildHeaders();
   char   data[], result[];
   string resultHeaders;

   // Construir JSON
   string json = "{";
   json += "\"signalId\":\"" + signalId + "\",";
   json += "\"type\":\"" + type + "\",";
   json += "\"side\":\"" + side + "\",";
   json += "\"symbol\":\"" + symbol + "\",";
   json += "\"lots\":" + DoubleToString(lots, 2) + ",";
   json += "\"openPrice\":" + DoubleToString(openPrice, 2) + ",";

   if(type == "CLOSE")
   {
      json += "\"closePrice\":" + DoubleToString(closePrice, 2) + ",";
      json += "\"profit\":" + DoubleToString(profit, 2) + ",";
      json += "\"pips\":" + DoubleToString(pips, 1) + ",";
   }

   json += "\"ticket\":" + IntegerToString(ticket);
   json += "}";

   StringToCharArray(json, data, 0, WHOLE_ARRAY);
   ArrayResize(data, ArraySize(data) - 1);

   int res = WebRequest("POST", ServerUrl + "/api/bot/trade", headers, 5000, data, result, resultHeaders);

   if(res == 200)
      Print("TBS EA | Trade event enviado OK | ", type, " ", ticket);
   else
      Print("TBS EA | Error enviando trade event: HTTP ", res);
}

//+------------------------------------------------------------------+
//| Helpers de parsing JSON (sin librerías externas)                  |
//+------------------------------------------------------------------+
string ParseStringField(string json, string field)
{
   string search = "\"" + field + "\":\"";
   int start = StringFind(json, search);
   if(start < 0) return("");
   start += StringLen(search);
   int end = StringFind(json, "\"", start);
   if(end < 0) return("");
   return(StringSubstr(json, start, end - start));
}

double ParseDoubleField(string json, string field)
{
   string search = "\"" + field + "\":";
   int start = StringFind(json, search);
   if(start < 0) return(0.0);
   start += StringLen(search);
   int end = start;
   int len = StringLen(json);
   while(end < len)
   {
      ushort c = StringGetCharacter(json, end);
      if(c == ',' || c == '}' || c == ']') break;
      end++;
   }
   string val = StringSubstr(json, start, end - start);
   return(StringToDouble(val));
}

int ParseIntField(string json, string field)
{
   return((int)ParseDoubleField(json, field));
}
//+------------------------------------------------------------------+
