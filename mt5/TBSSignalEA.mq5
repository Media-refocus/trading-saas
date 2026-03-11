//+------------------------------------------------------------------+
//|                                               TBSSignalEA.mq5   |
//|                              Trading Bot SaaS — Refocus Agency  |
//|                                        https://refocus.agency    |
//+------------------------------------------------------------------+
//
// CHANGELOG:
// 2026-03-11 v1.2: Trailing SL Virtual
//   - VirtualSL struct para trackear SL por posición
//   - UpdateVirtualStops() en OnTick()
//   - Trailing se activa cuando profit >= entryTrailingActivate
//   - SL virtual se mueve según entryTrailingBack
//   - Posición se cierra cuando precio toca SL virtual
//
// 2026-03-11 v1.1: Grid Management + Remote Config
//   - LoadRemoteConfig() carga config desde /api/bot/config
//   - GridLevel[] struct para trackear niveles abiertos
//   - InitializeGrid() calcula precios de niveles según restrictionType
//   - OpenGridLevel() abre órdenes en cada nivel
//   - CheckGridLevels() detecta cuando toca abrir nuevo nivel
//   - CloseAllGridLevels() cierra todo el grid
//
// INSTALACIÓN:
//  1. Copia este archivo en: MetaTrader5/MQL5/Experts/TBSSignalEA.mq5
//  2. Compila con MetaEditor (F7)
//  3. Arrastra el EA al gráfico XAUUSD (cualquier timeframe)
//  4. En MT5: Herramientas > Opciones > Asesores Expertos
//     - Activa "Permitir WebRequest hacia las siguientes URLs"
//     - Añade: https://trading-saas.vercel.app
//  5. Configura API Key en los inputs del EA
//
// USO:
//  - El EA consulta /api/bot/config al iniciar
//  - Carga gridStepPips, gridMaxLevels, gridLot, etc.
//  - Al recibir señal con restrictionType, inicializa grid
//  - Abre niveles automáticamente cuando precio llega
//
// SEGURIDAD:
//  - El EA envía tu número de cuenta MT5 en cada request
//  - Si la cuenta no coincide con tu suscripción → sin señales
//  - El EA es inútil sin credenciales válidas en el servidor
//
//+------------------------------------------------------------------+

#property copyright "Refocus Agency"
#property link      "https://refocus.agency"
#property version   "1.20"
#property strict

#include <Trade\Trade.mqh>

//--- Inputs
input string ApiKey         = "";                                          // API Key (del dashboard TBS)
input string ServerUrl      = "https://trading-bot-saas.vercel.app";      // URL del servidor
input string EASymbol       = "XAUUSD";                                   // Símbolo a operar
input double LotSize        = 0.01;                                       // Tamaño de lote (fallback si config remota falla)
input int    Slippage       = 3;                                          // Slippage máximo (pips)
input int    MagicNumber    = 20260101;                                   // Magic number único
input int    PollSeconds    = 2;                                          // Intervalo de consulta señales (segundos)
input int    HeartbeatSeconds = 30;                                       // Intervalo de heartbeat (segundos)

//--- Structs para configuración remota
struct BotConfig {
   // Entry params
   double   entryLot;
   int      entryNumOrders;
   int      entryTrailingActivate;
   int      entryTrailingStep;
   int      entryTrailingBack;
   int      entryTrailingBuffer;

   // Grid params
   int      gridStepPips;
   double   gridLot;
   int      gridMaxLevels;
   int      gridNumOrders;
   int      gridTolerancePips;

   // Restrictions
   string   restrictionType;
   int      maxLevels;
   double   dailyLossLimitPercent;
};

struct GridLevel {
   int      level;
   double   price;
   double   lotSize;
   ulong    ticket;
   bool     isOpen;
   datetime openedAt;
};

struct VirtualSL {
   ulong    ticket;
   double   entryPrice;
   double   virtualSL;
   double   highestPrice;  // Para BUY
   double   lowestPrice;   // Para SELL
   bool     trailingActivated;
   datetime lastUpdate;
};

//--- Globales
datetime g_lastPollTime        = 0;
datetime g_lastHeartbeatTime   = 0;
datetime g_lastConfigRefresh   = 0;
string   g_lastSignalId        = "";
CTrade   g_trade;

// Config remota
BotConfig g_botConfig;

// Grid management
GridLevel g_gridLevels[20];       // Max 20 niveles
string    g_currentSignalId      = "";
int       g_currentDirection     = 0;  // 1=BUY, -1=SELL
double    g_gridBasePrice        = 0.0;
int       g_gridMaxLevelsActive  = 0;

// Virtual SL management
VirtualSL g_virtualSLs[100];      // Max 100 posiciones
int       g_virtualSLCount = 0;

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
   Print("TBS EA | Symbol: ", EASymbol, " | Magic: ", MagicNumber);

   // Inicializar grid levels
   for(int i = 0; i < ArraySize(g_gridLevels); i++)
   {
      g_gridLevels[i].level = i;
      g_gridLevels[i].isOpen = false;
      g_gridLevels[i].ticket = 0;
      g_gridLevels[i].price = 0.0;
      g_gridLevels[i].lotSize = 0.0;
      g_gridLevels[i].openedAt = 0;
   }

   // Cargar configuración remota
   if(!LoadRemoteConfig())
   {
      Print("TBS EA | WARNING: No se pudo cargar config remota, usando valores por defecto");
      Print("TBS EA | entryLot: ", LotSize, " | gridStepPips: 10 | gridMaxLevels: 4");
      // Set defaults
      g_botConfig.entryLot = LotSize;
      g_botConfig.gridStepPips = 10;
      g_botConfig.gridMaxLevels = 4;
      g_botConfig.gridLot = LotSize;
      g_botConfig.entryNumOrders = 1;
      g_botConfig.maxLevels = 4;
   }
   else
   {
      Print("TBS EA | Config remota cargada OK");
      Print("TBS EA | entryLot: ", g_botConfig.entryLot, " | gridStepPips: ", g_botConfig.gridStepPips);
      Print("TBS EA | gridMaxLevels: ", g_botConfig.gridMaxLevels, " | restrictionType: ", g_botConfig.restrictionType);
   }

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

   // Refrescar config cada 5 minutos
   if(now - g_lastConfigRefresh >= 300)
   {
      LoadRemoteConfig();
      g_lastConfigRefresh = now;
   }

   // Heartbeat cada N segundos
   if(now - g_lastHeartbeatTime >= HeartbeatSeconds)
   {
      g_lastHeartbeatTime = now;
      SendHeartbeat();
   }

   // Check si toca abrir nuevo nivel de grid
   CheckGridLevels();

   // Actualizar trailing SL virtual
   UpdateVirtualStops();

   // Polling de señales cada N segundos
   if(now - g_lastPollTime < PollSeconds)
      return;

   g_lastPollTime = now;
   PollSignals();
}

//+------------------------------------------------------------------+
//| Carga configuración desde /api/bot/config                         |
//+------------------------------------------------------------------+
bool LoadRemoteConfig()
{
   string headers = BuildHeaders();
   char   data[], result[];
   string resultHeaders;

   int res = WebRequest("GET", ServerUrl + "/api/bot/config", headers, 5000, data, result, resultHeaders);

   if(res != 200)
   {
      Print("TBS EA | Error cargando config: HTTP ", res);
      return false;
   }

   string json = CharArrayToString(result);

   // Extraer sub-objetos JSON
   string entryObj = ExtractObject(json, "entry");
   string gridObj = ExtractObject(json, "grid");
   string restrictionsObj = ExtractObject(json, "restrictions");

   // Parsear entry params
   g_botConfig.entryLot = ParseDoubleField(entryObj, "lot");
   g_botConfig.entryNumOrders = ParseIntField(entryObj, "numOrders");

   // Parsear trailing si existe
   string trailingObj = ExtractObject(entryObj, "trailing");
   if(trailingObj != "")
   {
      g_botConfig.entryTrailingActivate = ParseIntField(trailingObj, "activate");
      g_botConfig.entryTrailingStep = ParseIntField(trailingObj, "step");
      g_botConfig.entryTrailingBack = ParseIntField(trailingObj, "back");
      g_botConfig.entryTrailingBuffer = ParseIntField(trailingObj, "buffer");
   }

   // Parsear grid params
   g_botConfig.gridStepPips = ParseIntField(gridObj, "stepPips");
   g_botConfig.gridLot = ParseDoubleField(gridObj, "lot");
   g_botConfig.gridMaxLevels = ParseIntField(gridObj, "maxLevels");
   g_botConfig.gridNumOrders = ParseIntField(gridObj, "numOrders");
   g_botConfig.gridTolerancePips = ParseIntField(gridObj, "tolerancePips");

   // Parsear restrictions
   g_botConfig.restrictionType = ParseStringField(restrictionsObj, "type");
   g_botConfig.maxLevels = ParseIntField(restrictionsObj, "maxLevels");

   return true;
}

//+------------------------------------------------------------------+
//| Inicializa grid de niveles                                        |
//+------------------------------------------------------------------+
void InitializeGrid(string id, string side, double basePrice, int maxLevels)
{
   g_currentSignalId = id;
   g_currentDirection = (side == "BUY") ? 1 : -1;
   g_gridBasePrice = basePrice;
   g_gridMaxLevelsActive = MathMin(maxLevels, ArraySize(g_gridLevels));

   // Reset todos los niveles
   for(int i = 0; i < ArraySize(g_gridLevels); i++)
   {
      g_gridLevels[i].level = i;
      g_gridLevels[i].isOpen = false;
      g_gridLevels[i].ticket = 0;
      g_gridLevels[i].price = 0.0;
      g_gridLevels[i].lotSize = 0.0;
      g_gridLevels[i].openedAt = 0;
   }

   // Calcular precios de grid
   // stepPips en puntos (0.01 para XAUUSD)
   double step = g_botConfig.gridStepPips * 0.01;

   for(int i = 0; i < g_gridMaxLevelsActive; i++)
   {
      // BUY: niveles abajo del precio base (promedio a la baja)
      // SELL: niveles arriba del precio base (promedio al alta)
      g_gridLevels[i].price = basePrice + (i * step * g_currentDirection * -1);
      g_gridLevels[i].lotSize = g_botConfig.gridLot;
   }

   Print("TBS EA | Grid inicializado: ", g_gridMaxLevelsActive, " niveles");
   Print("TBS EA | Base price: ", basePrice, " | Step: ", g_botConfig.gridStepPips, " pips");
   for(int i = 0; i < g_gridMaxLevelsActive; i++)
   {
      Print("TBS EA | Nivel ", i, " @ ", g_gridLevels[i].price);
   }
}

//+------------------------------------------------------------------+
//| Abre un nivel específico del grid                                 |
//+------------------------------------------------------------------+
bool OpenGridLevel(int levelIndex, double price)
{
   if(levelIndex >= ArraySize(g_gridLevels))
      return false;

   if(g_gridLevels[levelIndex].isOpen)
   {
      Print("TBS EA | Nivel ", levelIndex, " ya está abierto");
      return false;
   }

   double lotSize = g_gridLevels[levelIndex].lotSize;
   string symbol = EASymbol;

   // Obtener precios actuales
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);

   // Abrir orden
   bool success = false;
   if(g_currentDirection == 1) // BUY
   {
      success = g_trade.Buy(lotSize, symbol, ask, 0, 0, "TBS Grid L" + IntegerToString(levelIndex));
   }
   else // SELL
   {
      success = g_trade.Sell(lotSize, symbol, bid, 0, 0, "TBS Grid L" + IntegerToString(levelIndex));
   }

   if(success)
   {
      g_gridLevels[levelIndex].isOpen = true;
      g_gridLevels[levelIndex].ticket = g_trade.ResultOrder();
      g_gridLevels[levelIndex].openedAt = TimeCurrent();

      Print("TBS EA | Nivel ", levelIndex, " abierto @ ", price, " | Ticket: ", g_gridLevels[levelIndex].ticket);

      // Enviar trade event al servidor
      string side = (g_currentDirection == 1) ? "BUY" : "SELL";
      double execPrice = (g_currentDirection == 1) ? ask : bid;
      SendTradeEvent(g_currentSignalId, "OPEN", side, symbol, lotSize, execPrice, 0, 0, 0, g_gridLevels[levelIndex].ticket, levelIndex);
   }
   else
   {
      Print("TBS EA | Error abriendo nivel ", levelIndex, ": ", g_trade.ResultRetcode(), " | ", g_trade.ResultRetcodeDescription());
   }

   return success;
}

//+------------------------------------------------------------------+
//| Verifica si toca abrir algún nivel de grid                        |
//+------------------------------------------------------------------+
void CheckGridLevels()
{
   if(g_currentSignalId == "" || g_currentDirection == 0)
      return;

   double bid = SymbolInfoDouble(EASymbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(EASymbol, SYMBOL_ASK);
   double tolerance = g_botConfig.gridTolerancePips * 0.01; // Convertir a precio

   for(int i = 0; i < g_gridMaxLevelsActive; i++)
   {
      if(g_gridLevels[i].isOpen)
         continue;

      if(g_gridLevels[i].price == 0.0)
         continue;

      bool shouldOpen = false;

      // BUY: abrir nivel cuando precio baja hasta nivel (con tolerancia)
      if(g_currentDirection == 1)
      {
         if(bid <= g_gridLevels[i].price + tolerance)
            shouldOpen = true;
      }
      // SELL: abrir nivel cuando precio sube hasta nivel (con tolerancia)
      else
      {
         if(ask >= g_gridLevels[i].price - tolerance)
            shouldOpen = true;
      }

      if(shouldOpen)
      {
         Print("TBS EA | Precio alcanzó nivel ", i, " (target: ", g_gridLevels[i].price, ", bid: ", bid, ", ask: ", ask, ")");
         OpenGridLevel(i, g_gridLevels[i].price);
      }
   }
}

//+------------------------------------------------------------------+
//| Cierra todos los niveles del grid                                 |
//+------------------------------------------------------------------+
void CloseAllGridLevels()
{
   int closedCount = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionSelectByTicket(PositionGetTicket(i)))
      {
         if(PositionGetInteger(POSITION_MAGIC) == MagicNumber)
         {
            ulong ticket = PositionGetInteger(POSITION_TICKET);
            if(g_trade.PositionClose(ticket))
            {
               closedCount++;
               Print("TBS EA | Posición cerrada | Ticket: ", IntegerToString(ticket));
            }
            else
            {
               Print("TBS EA | Error cerrando posición ", IntegerToString(ticket), ": ", g_trade.ResultRetcode());
            }
         }
      }
   }

   // Reset grid state
   g_currentSignalId = "";
   g_currentDirection = 0;
   g_gridBasePrice = 0.0;
   g_gridMaxLevelsActive = 0;

   for(int i = 0; i < ArraySize(g_gridLevels); i++)
   {
      g_gridLevels[i].isOpen = false;
      g_gridLevels[i].ticket = 0;
      g_gridLevels[i].price = 0.0;
   }

   // Limpiar todos los VirtualSLs
   g_virtualSLCount = 0;
   ArrayInitialize(g_virtualSLs, 0);

   Print("TBS EA | Grid cerrado | ", closedCount, " posición(es) cerrada(s)");
}

//+------------------------------------------------------------------+
//| Busca o crea un VirtualSL para una posición                       |
//+------------------------------------------------------------------+
int FindOrCreateVirtualSL(ulong ticket, double entryPrice, long type)
{
   // Buscar existente
   for(int i = 0; i < g_virtualSLCount; i++)
   {
      if(g_virtualSLs[i].ticket == ticket)
         return i;
   }

   // Crear nuevo
   if(g_virtualSLCount >= ArraySize(g_virtualSLs))
      return -1;

   int idx = g_virtualSLCount++;
   g_virtualSLs[idx].ticket = ticket;
   g_virtualSLs[idx].entryPrice = entryPrice;
   g_virtualSLs[idx].virtualSL = 0.0;
   g_virtualSLs[idx].highestPrice = entryPrice;
   g_virtualSLs[idx].lowestPrice = entryPrice;
   g_virtualSLs[idx].trailingActivated = false;
   g_virtualSLs[idx].lastUpdate = TimeCurrent();

   return idx;
}

//+------------------------------------------------------------------+
//| Elimina un VirtualSL por ticket                                   |
//+------------------------------------------------------------------+
void RemoveVirtualSL(ulong ticket)
{
   for(int i = 0; i < g_virtualSLCount; i++)
   {
      if(g_virtualSLs[i].ticket == ticket)
      {
         // Mover último elemento aquí
         g_virtualSLs[i] = g_virtualSLs[g_virtualSLCount - 1];
         g_virtualSLCount--;
         return;
      }
   }
}

//+------------------------------------------------------------------+
//| Actualiza trailing stops virtuales                                |
//+------------------------------------------------------------------+
void UpdateVirtualStops()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);

      if(!PositionSelectByTicket(ticket))
         continue;

      // Solo posiciones de este EA
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber)
         continue;

      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
      long type = PositionGetInteger(POSITION_TYPE);
      string symbol = PositionGetString(POSITION_SYMBOL);

      // Solo para símbolo configurado
      if(symbol != EASymbol)
         continue;

      // Buscar o crear VirtualSL
      int idx = FindOrCreateVirtualSL(ticket, openPrice, type);
      if(idx < 0) continue;

      // Calcular pips de beneficio
      double profitPips = 0.0;
      if(type == POSITION_TYPE_BUY)
         profitPips = (currentPrice - openPrice) / 0.01;
      else
         profitPips = (openPrice - currentPrice) / 0.01;

      // Actualizar highest/lowest
      if(type == POSITION_TYPE_BUY)
      {
         if(currentPrice > g_virtualSLs[idx].highestPrice)
            g_virtualSLs[idx].highestPrice = currentPrice;
      }
      else
      {
         if(currentPrice < g_virtualSLs[idx].lowestPrice)
            g_virtualSLs[idx].lowestPrice = currentPrice;
      }

      // Activar trailing si supera activate
      if(profitPips >= g_botConfig.entryTrailingActivate && !g_virtualSLs[idx].trailingActivated)
      {
         g_virtualSLs[idx].trailingActivated = true;
         Print("TBS EA | Trailing activado para ticket ", ticket, " | Profit: ", profitPips, " pips");
      }

      // Mover SL virtual si trailing activo
      if(g_virtualSLs[idx].trailingActivated)
      {
         double newSL = 0.0;

         if(type == POSITION_TYPE_BUY)
         {
            // BUY: SL sigue subiendo
            newSL = currentPrice - (g_botConfig.entryTrailingBack * 0.01);

            if(newSL > g_virtualSLs[idx].virtualSL)
            {
               g_virtualSLs[idx].virtualSL = newSL;
               Print("TBS EA | SL virtual BUY actualizado: ", newSL);
            }
         }
         else
         {
            // SELL: SL sigue bajando
            newSL = currentPrice + (g_botConfig.entryTrailingBack * 0.01);

            if(newSL < g_virtualSLs[idx].virtualSL || g_virtualSLs[idx].virtualSL == 0)
            {
               g_virtualSLs[idx].virtualSL = newSL;
               Print("TBS EA | SL virtual SELL actualizado: ", newSL);
            }
         }
      }

      // Verificar si toca cerrar por SL virtual
      bool shouldClose = false;

      if(type == POSITION_TYPE_BUY)
      {
         if(currentPrice <= g_virtualSLs[idx].virtualSL && g_virtualSLs[idx].trailingActivated)
            shouldClose = true;
      }
      else
      {
         if(currentPrice >= g_virtualSLs[idx].virtualSL && g_virtualSLs[idx].trailingActivated)
            shouldClose = true;
      }

      if(shouldClose)
      {
         Print("TBS EA | Cerrando posición por SL virtual | Ticket: ", ticket);

         if(g_trade.PositionClose(ticket))
         {
            // Enviar CLOSE event
            string side = (type == POSITION_TYPE_BUY) ? "BUY" : "SELL";
            SendTradeEvent(g_currentSignalId, "CLOSE", side, symbol,
                          PositionGetDouble(POSITION_VOLUME),
                          currentPrice, 0, 0, 0, ticket, -1);

            // Remover VirtualSL
            RemoveVirtualSL(ticket);
         }
      }
   }
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
   int maxLevels     = ParseIntField(signalObj, "max_levels");

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
   {
      // Verificar si hay grid activo previo y cerrarlo
      if(g_currentSignalId != "")
      {
         Print("TBS EA | Cerrando grid previo antes de nueva señal");
         CloseAllGridLevels();
      }

      // Inicializar grid y abrir nivel 0
      InitializeGrid(signalId, side, price, maxLevels > 0 ? maxLevels : g_botConfig.gridMaxLevels);
      success = OpenGridLevel(0, price);
   }
   else if(signalType == "CLOSE")
   {
      CloseAllGridLevels();
      success = true;
   }

   if(success)
   {
      g_lastSignalId = signalId;
      AckSignal(signalId);
   }
}

//+------------------------------------------------------------------+
//| Ejecuta una orden de entrada (DEPRECATED - usar OpenGridLevel)    |
//+------------------------------------------------------------------+
bool ExecuteEntry(string signalId, string side, double price, string symbol)
{
   // Esta función ya no se usa directamente, mantenida para compatibilidad
   // El grid se maneja con OpenGridLevel
   ENUM_ORDER_TYPE orderType = (side == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   string sym = (symbol == "") ? EASymbol : symbol;

   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   double orderPrice = (orderType == ORDER_TYPE_BUY) ? ask : bid;

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

   SendTradeEvent(signalId, "OPEN", side, sym, LotSize, orderPrice, 0, 0, 0, ticket, 0);

   return(true);
}

//+------------------------------------------------------------------+
//| Cierra todas las posiciones del EA en el símbolo                  |
//+------------------------------------------------------------------+
bool ExecuteClose(string signalId, string symbol)
{
   // Esta función ya no se usa directamente, mantenida para compatibilidad
   // El grid se cierra con CloseAllGridLevels
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
         double profit = PositionGetDouble(ACCOUNT_PROFIT);

         double closePrice = (type == POSITION_TYPE_BUY)
            ? SymbolInfoDouble(sym, SYMBOL_BID)
            : SymbolInfoDouble(sym, SYMBOL_ASK);

         double pips = 0.0;
         if(type == POSITION_TYPE_BUY)
            pips = (closePrice - openPrice) / 0.01;
         else
            pips = (openPrice - closePrice) / 0.01;

         if(g_trade.PositionClose(ticket))
         {
            Print("TBS EA | Orden cerrada OK | Ticket: ", IntegerToString(ticket));
            closed = true;

            string side = (type == POSITION_TYPE_BUY) ? "BUY" : "SELL";
            SendTradeEvent(signalId, "CLOSE", side, sym, lots, openPrice, closePrice, profit, pips, ticket, 0);
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
                    double profit, double pips, ulong ticket, int level = 0)
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
   json += "\"openPrice\":" + DoubleToString(openPrice, 5) + ",";
   json += "\"ticket\":" + IntegerToString(ticket) + ",";
   json += "\"level\":" + IntegerToString(level);

   if(type == "CLOSE")
   {
      json += ",\"closePrice\":" + DoubleToString(closePrice, 5) + ",";
      json += "\"profit\":" + DoubleToString(profit, 2) + ",";
      json += "\"pips\":" + DoubleToString(pips, 1);
   }

   json += "}";

   StringToCharArray(json, data, 0, WHOLE_ARRAY);
   ArrayResize(data, ArraySize(data) - 1);

   int res = WebRequest("POST", ServerUrl + "/api/bot/trade", headers, 5000, data, result, resultHeaders);

   if(res == 200)
      Print("TBS EA | Trade event enviado OK | ", type, " ", ticket, " L", level);
   else
      Print("TBS EA | Error enviando trade event: HTTP ", res);
}

//+------------------------------------------------------------------+
//| Helpers de parsing JSON (sin librerías externas)                  |
//+------------------------------------------------------------------+

// Extrae un objeto anidado del JSON: { "entry": { "lot": 0.1 } } → { "lot": 0.1 }
string ExtractObject(string json, string key)
{
   string search = "\"" + key + "\":";
   int start = StringFind(json, search);
   if(start < 0) return("");

   start += StringLen(search);

   // Skip whitespace
   while(start < StringLen(json))
   {
      ushort c = StringGetCharacter(json, start);
      if(c != ' ' && c != '\t' && c != '\n' && c != '\r') break;
      start++;
   }

   if(start >= StringLen(json)) return("");

   // Si no empieza con {, es un valor primitivo (null, string, number)
   if(StringGetCharacter(json, start) != '{')
   {
      // Para null o valores primitivos, retornar el substring hasta , o }
      int end = start;
      int len = StringLen(json);
      while(end < len)
      {
         ushort c = StringGetCharacter(json, end);
         if(c == ',' || c == '}') break;
         end++;
      }
      return StringSubstr(json, start, end - start);
   }

   // Es un objeto, encontrar el cierre }
   return ExtractObjectBlock(json, start);
}

// Extrae un bloque de objeto completo desde { hasta }
string ExtractObjectBlock(string json, int start)
{
   if(StringGetCharacter(json, start) != '{') return("");

   int depth = 0;
   int len = StringLen(json);
   int end = start;

   for(int i = start; i < len; i++)
   {
      ushort c = StringGetCharacter(json, i);
      if(c == '{') depth++;
      else if(c == '}')
      {
         depth--;
         if(depth == 0)
         {
            end = i;
            break;
         }
      }
   }

   return StringSubstr(json, start, end - start + 1);
}

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
