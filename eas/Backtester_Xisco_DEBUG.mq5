//+------------------------------------------------------------------+
//|                                          Backtester_Xisco_DEBUG                      |
//| DEBUG EXTREMO - Imprime TODOS los detalles de cada evento        |
//| - Logs detallados de cada línea del CSV                         |
//| - Validación robusta de datos                                   |
//| - Distingue claramente range_open vs range_close                 |
//+------------------------------------------------------------------+
#property strict
#property tester_file "signals_simple.csv"
#property description "DEBUG EXTREMO - Imprime TODOS los detalles"

#include <Trade/Trade.mqh>
CTrade trade;

//============================= Inputs ===============================
// CSV
input string  InpCsvFileName     = "signals_simple.csv"; // CSV en MQL5/Files
input bool    InpCsvIsUTC        = true;                 // El CSV viene en UTC
input int     InpCsvTzShiftHours = 0;                    // Ajuste manual extra (+/- h)

// Símbolo
input string  InpSymbol          = "XAUUSD";             // símbolo del tester
input double  InpPipSize         = 0.10;                 // 1 pip (XAUUSD)=0.10
input long    InpMagic           = 20250673;             // magic
input bool    InpRequireHedging  = true;                 // abortar si NETTING

// Lotes
input double  InpLotEntry        = 0.01;                 // L00 - Posición base
input double  InpLotScalper      = 0.01;                 // S00 - Scalper
input double  InpLotGrid         = 0.01;                 // L01..L03 - Promedios

// Grid
input int     InpStepPips        = 20;                   // distancia entre promedios
input int     InpMaxLevels       = 4;                    // 1 base + 3 promedios

// S00 Scalper
input int     InpScalperTPPips   = 20;                   // TP de S00 en pips

// Simulación
input double  InpSlippagePips    = 0.5;                  // slippage de fill
input int     InpLatencySeconds  = 0;                    // latencia artificial (seg)
input bool    InpDrawGraphics    = true;                 // flechas/rectángulos/HLines
input bool    InpExportCSVs      = true;                 // export ranges.csv
input bool    InpVerbose         = true;                 // logs de depuración (SIEMPRE true)

//============================= Constantes ===========================
#define COMMENT_L00      "Xisco_L00"
#define COMMENT_S00      "Xisco_S00"
#define COMMENT_LVL_FMT  "Xisco_L%02d"

//============================= Tipos ================================
struct EventRow {
  datetime ts;
  string kind;
  string side;
  string price_hint;
  string range_id;
  string confidence;
};
EventRow g_events[];
int g_ev_idx=0;

// Enumeración de restricciones
enum ENUM_RESTRICTION {
  RESTRICTION_NONE,       // Sin restricción (4 niveles)
  RESTRICTION_RIESGO,     // RIESGO (2 niveles)
  RESTRICTION_NO_AVG,     // SIN PROMEDIOS (1 nivel)
  RESTRICTION_ONE_AVG     // SOLO 1 PROMEDIO (2 niveles)
};

struct Leg {
  string   name;
  double   vol;
  double   open_price;
  datetime ts_open;
};
struct RangeState {
  bool     open;
  string   side;
  string   range_id;
  datetime ts_open_msg;
  datetime ts_close_msg;
  double   entry_price;
  double   mfe_pips;
  double   mae_pips;
  Leg      legs[10];
  int      legs_n;
  bool     s00_closed;
  int      max_levels;
  ENUM_RESTRICTION restriction;
};
RangeState g_rng;

//============================= Globals ==============================
int      g_digits=2;
double   g_pip=0.10, g_slip_pts=0.0;
int      g_serverOffsetSec=0;
int      g_ranges=INVALID_HANDLE;
int      g_debug_line_counter=0;  // Contador de líneas procesadas

//============================= Utils ===============================
double PriceBid(){ return SymbolInfoDouble(InpSymbol,SYMBOL_BID); }
double PriceAsk(){ return SymbolInfoDouble(InpSymbol,SYMBOL_ASK); }
double RoundDigits(double px){ return (double)NormalizeDouble(px,g_digits); }
double Pips(double a,double b){ return (b-a)/g_pip; }

double StopsClamp(){
  long a=(long)SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_STOPS_LEVEL);
  long b=(long)SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_FREEZE_LEVEL);
  long lv=(a>b?a:b);
  return lv*SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
}

string Preview(const string &s, int n=120){
  if(StringLen(s)<=n) return s;
  return StringSubstr(s,0,n) + "...";
}

//============================= DEBUG FUNCTIONS ============================
void DebugSeparator(const string title){
  PrintFormat("========================================");
  PrintFormat("=== %s", title);
  PrintFormat("========================================");
}

void DebugEvent(const EventRow &ev, int idx){
  PrintFormat("--- EVENTO #%d DETALLADO ---", idx);
  PrintFormat("  ts_utc       : %s", TimeToString(ev.ts, TIME_DATE|TIME_SECONDS));
  PrintFormat("  kind         : %s", ev.kind);
  PrintFormat("  side         : %s", ev.side);
  PrintFormat("  price_hint   : %s", ev.price_hint);
  PrintFormat("  range_id     : %s", ev.range_id);
  PrintFormat("  confidence   : [%s]", ev.confidence);
}

//============================= Detección de Restricciones ===========================
ENUM_RESTRICTION DetectRestriction(const string text){
  string upper = text;
  StringToUpper(upper);

  if(StringFind(upper, "SIN PROMEDIOS") >= 0 ||
     StringFind(upper, "SIN_PROMEDIOS") >= 0 ||
     StringFind(upper, "NO AVERAGING") >= 0 ||
     StringFind(upper, "NO PROMEDIOS") >= 0){
    PrintFormat("  [RESTRICCIÓN DETECTADA]: SIN PROMEDIOS -> 1 nivel");
    return RESTRICTION_NO_AVG;
  }

  if(StringFind(upper, "RIESGO") >= 0 ||
     StringFind(upper, "RISK") >= 0){
    PrintFormat("  [RESTRICCIÓN DETECTADA]: RIESGO -> 2 niveles");
    return RESTRICTION_RIESGO;
  }

  if(StringFind(upper, "SOLO 1 PROMEDIO") >= 0 ||
     StringFind(upper, "SOLO_1_PROMEDIO") >= 0 ||
     StringFind(upper, "SOLO UN PROMEDIO") >= 0 ||
     StringFind(upper, "1 PROMEDIO MAX") >= 0){
    PrintFormat("  [RESTRICCIÓN DETECTADA]: SOLO 1 PROMEDIO -> 2 niveles");
    return RESTRICTION_ONE_AVG;
  }

  return RESTRICTION_NONE;
}

int GetMaxLevelsForRestriction(ENUM_RESTRICTION restr){
  switch(restr){
    case RESTRICTION_NO_AVG:   return 1;
    case RESTRICTION_RIESGO:   return 2;
    case RESTRICTION_ONE_AVG:  return 2;
    case RESTRICTION_NONE:
    default:                   return InpMaxLevels;
  }
}

string GetRestrictionName(ENUM_RESTRICTION restr){
  switch(restr){
    case RESTRICTION_NO_AVG:   return "SIN_PROMEDIOS";
    case RESTRICTION_RIESGO:   return "RIESGO";
    case RESTRICTION_ONE_AVG:  return "SOLO_1_PROMEDIO";
    case RESTRICTION_NONE:
    default:                   return "NONE";
  }
}

bool ParseTSFlexible(string src, datetime &out)
{
  StringTrimLeft(src);
  StringTrimRight(src);
  if(StringLen(src)==0){ out=0; return false; }

  string s0 = src;
  string s_iso = src;
  int pz = StringFind(s_iso, "Z");
  if(pz >= 0) s_iso = StringSubstr(s_iso, 0, pz);
  pz = StringFind(s_iso, "z");
  if(pz >= 0) s_iso = StringSubstr(s_iso, 0, pz);
  StringReplace(s_iso, "T", " ");
  StringReplace(s_iso, "t", " ");
  StringReplace(s_iso, "-", ".");
  StringReplace(s_iso, "/", ".");

  datetime dtt = StringToTime(s_iso);
  if(dtt != 0){
    out = dtt;
    PrintFormat("  [TS-OK] '%s' -> %s", Preview(s0,50), TimeToString(out, TIME_DATE|TIME_SECONDS));
    return true;
  }

  string s = src;
  s = StringToLower(s);
  int posz = StringFind(s,"z"); if(posz>=0) s = StringSubstr(s,0,posz);
  StringReplace(s,"t"," ");

  int groups[6];
  int gsz=0;
  int acc=0;
  bool in_num=false;
  for(int i=0;i<StringLen(s); i++){
    int ch = (int)StringGetCharacter(s, i);
    if(ch>='0' && ch<='9'){
      acc = acc*10 + (ch - '0');
      in_num=true;
    }
    else{
      if(in_num && gsz<6){ groups[gsz++] = acc; acc=0; }
      in_num=false;
    }
  }
  if(in_num && gsz<6) groups[gsz++] = acc;

  if(gsz < 3){
    PrintFormat("  [TS-FAIL] <3 grupos | src='%s'", Preview(s0,50));
    out=0; return false;
  }
  int y=groups[0], m=groups[1], d=groups[2];
  int H=(gsz>=4?groups[3]:0), M=(gsz>=5?groups[4]:0), S=(gsz>=6?groups[5]:0);
  if(y<=1970 || m<1||m>12 || d<1||d>31){
    PrintFormat("  [TS-FAIL] YMD inválido | src='%s'", Preview(s0,50));
    out=0; return false;
  }
  if(H<0||H>23 || M<0||M>59 || S<0||S>59){
    PrintFormat("  [TS-FAIL] HMS inválido | src='%s'", Preview(s0,50));
    out=0; return false;
  }
  MqlDateTime dt2; ZeroMemory(dt2);
  dt2.year=y; dt2.mon=m; dt2.day=d; dt2.hour=H; dt2.min=M; dt2.sec=S;
  out = StructToTime(dt2);
  PrintFormat("  [TS-OK-MANUAL] '%s' -> %s", Preview(s0,50), TimeToString(out, TIME_DATE|TIME_SECONDS));
  return (out>0);
}

bool ValidateCSVHeader(const string header_line, ushort sep)
{
  string cols[];
  int n = StringSplit(header_line, sep, cols);

  PrintFormat("========================================");
  PrintFormat("VALIDANDO HEADER del CSV");
  PrintFormat("========================================");
  PrintFormat("Columnas detectadas: %d", n);

  if(n < 2){
    PrintFormat("ERROR: Header tiene solo %d columnas (mínimo 2)", n);
    return false;
  }

  bool has_ts = false, has_kind = false, has_side = false, has_confidence = false;
  for(int i=0; i<n; i++){
    string col = cols[i];
    StringTrimLeft(col);
    StringTrimRight(col);
    PrintFormat("  Col[%d]: '%s'", i, col);

    string low = col;
    StringToLower(low);
    if(StringFind(low, "ts") >= 0 && StringFind(low, "utc") >= 0) has_ts = true;
    if(StringFind(low, "kind") >= 0) has_kind = true;
    if(StringFind(low, "side") >= 0) has_side = true;
    if(StringFind(low, "confidence") >= 0) has_confidence = true;
  }

  PrintFormat("Validación de columnas críticas:");
  PrintFormat("  ts_utc     : %s", has_ts ? "OK" : "FALTA");
  PrintFormat("  kind       : %s", has_kind ? "OK" : "FALTA");
  PrintFormat("  side       : %s", has_side ? "OK" : "FALTA");
  PrintFormat("  confidence : %s", has_confidence ? "OK" : "FALTA");

  if(!has_ts){
    PrintFormat("ERROR: Header no tiene columna 'ts_utc'");
    return false;
  }
  if(!has_kind){
    PrintFormat("ERROR: Header no tiene columna 'kind'");
    return false;
  }
  if(!has_side){
    PrintFormat("ERROR: Header no tiene columna 'side'");
    return false;
  }

  PrintFormat("HEADER VALIDADO OK");
  return true;
}

bool LoadEvents()
{
  DebugSeparator("INICIANDO CARGA DE CSV");

  int h = FileOpen(InpCsvFileName, FILE_READ | FILE_BIN);
  if(h == INVALID_HANDLE){
    Print("ERROR: No se pudo abrir ", InpCsvFileName);
    return false;
  }
  PrintFormat("Archivo abierto OK: %s", InpCsvFileName);

  long fileSize = FileSize(h);
  PrintFormat("Tamaño del archivo: %ld bytes", fileSize);
  if(fileSize <= 0){
    FileClose(h);
    Print("ERROR: CSV vacío");
    return false;
  }

  uchar buffer[];
  ArrayResize(buffer, (int)fileSize);
  int bytesRead = FileReadArray(h, buffer);
  FileClose(h);

  if(bytesRead != fileSize){
    PrintFormat("ERROR: Leídos %d de %ld bytes", bytesRead, fileSize);
    return false;
  }
  PrintFormat("Bytes leídos: %d", bytesRead);

  string content = CharArrayToString(buffer, 0, -1, CP_UTF8);
  if(StringLen(content) >= 3 && StringGetCharacter(content,0)==0xEF &&
     StringGetCharacter(content,1)==0xBB && StringGetCharacter(content,2)==0xBF){
    content = StringSubstr(content,3);
    PrintFormat("BOM UTF-8 detectado y removido");
  }

  string lines[];
  int nlines = StringSplit(content, '\n', lines);
  PrintFormat("Líneas detectadas en CSV: %d", nlines);

  ArrayResize(g_events, 0);
  ushort SEP = 0;
  bool header_seen = false;
  datetime t_min = 0, t_max = 0;

  // Auto-detectar separador
  PrintFormat("Detectando separador...");
  for(int i=0; i<MathMin(nlines,10) && SEP==0; i++){
    string tmp = lines[i];
    StringReplace(tmp,"\r","");
    StringTrimLeft(tmp);
    StringTrimRight(tmp);
    if(tmp=="" || StringGetCharacter(tmp,0)=='#') continue;
    if(StringFind(tmp, "\t") >= 0) SEP = '\t';
    else if(StringFind(tmp, ";") >= 0 && StringFind(tmp, ",") < 0) SEP = ';';
    else if(StringFind(tmp, ",") >= 0) SEP = ',';
  }
  if(SEP==0) { SEP=';'; }
  PrintFormat("Separador detectado: '%c' (código 0x%04X)", (char)SEP, SEP);

  for(int i=0; i<nlines; i++){
    string ln = lines[i];
    StringReplace(ln,"\r","");
    StringTrimLeft(ln);
    StringTrimRight(ln);

    if(ln=="" || StringGetCharacter(ln,0)=='#') continue;

    if(!header_seen){
      string low = ln;
      StringToLower(low);
      if(StringFind(low, "ts_utc") >= 0 && StringFind(low, "kind") >= 0){
        header_seen = true;
        PrintFormat("========================================");
        PrintFormat("Header encontrado en línea %d", i);
        if(!ValidateCSVHeader(ln, SEP)){
          PrintFormat("ERROR: Header inválido");
          return false;
        }
        continue;
      }
    }

    string p[];
    int cols = StringSplit(ln, SEP, p);
    if(cols < 2) continue;
    for(int k=0;k<cols;k++){ StringTrimLeft(p[k]); StringTrimRight(p[k]); }

    if(cols < 2){
      PrintFormat("WARN: Línea %d tiene solo %d columnas, saltando", i, cols);
      continue;
    }

    string s_ts = p[0];
    StringToLower(p[1]);
    string s_kind = p[1];
    string s_side = (cols>=3 ? p[2] : "");
    string s_price = (cols>=4 ? p[3] : "");
    string s_rid = (cols>=5 ? p[4] : "");
    string s_conf = (cols>=7 ? p[6] : "");

    StringToUpper(s_side);

    PrintFormat("Línea %d parseada: kind=%s side=%s cols=%d", i, s_kind, s_side, cols);

    if(s_kind!="range_open" && s_kind!="range_close"){
      PrintFormat("  SKIP: kind no válido (%s)", s_kind);
      continue;
    }
    if(s_kind=="range_open" && s_side!="BUY" && s_side!="SELL"){
      PrintFormat("  SKIP: side no válido para range_open (%s)", s_side);
      continue;
    }

    datetime ts_raw;
    if(!ParseTSFlexible(s_ts, ts_raw)){
      PrintFormat("  SKIP: timestamp inválido (%s)", s_ts);
      continue;
    }

    datetime ts = ts_raw;
    if(InpCsvIsUTC){
      ts += g_serverOffsetSec;
      ts += (InpCsvTzShiftHours * 3600);
    }

    int z = ArraySize(g_events);
    ArrayResize(g_events, z+1);
    g_events[z].ts = ts;
    g_events[z].kind = s_kind;
    g_events[z].side = s_side;
    g_events[z].price_hint = s_price;
    g_events[z].range_id = s_rid;
    g_events[z].confidence = s_conf;

    PrintFormat("  -> EVENTO #%d AÑADIDO: %s %s range_id=%s conf=[%s]",
                z, TimeToString(ts, TIME_DATE|TIME_MINUTES),
                s_kind, s_side, s_rid, s_conf);

    if(t_min==0 || ts<t_min) t_min=ts;
    if(t_max==0 || ts>t_max) t_max=ts;
  }

  // Ordenar por timestamp
  PrintFormat("========================================");
  PrintFormat("Ordenando %d eventos por timestamp...", ArraySize(g_events));
  int m = ArraySize(g_events);
  for(int a=0; a<m-1; a++)
    for(int b=a+1; b<m; b++)
      if(g_events[a].ts > g_events[b].ts){
        EventRow t = g_events[a];
        g_events[a] = g_events[b];
        g_events[b] = t;
      }
  PrintFormat("Eventos ordenados");

  if(ArraySize(g_events)==0){
    Print("ERROR: 0 eventos válidos cargados");
    return false;
  }

  PrintFormat("========================================");
  PrintFormat("CSV CARGADO OK");
  PrintFormat("========================================");
  PrintFormat("Total eventos  : %d", ArraySize(g_events));
  PrintFormat("Ventana tiempo : [%s -> %s]",
              TimeToString(t_min, TIME_DATE|TIME_MINUTES),
              TimeToString(t_max, TIME_DATE|TIME_MINUTES));
  PrintFormat("========================================");

  return true;
}

double FillPrice(const string side){
  double px=(side=="BUY"? PriceAsk(): PriceBid());
  return (side=="BUY"? px+g_slip_pts: px-g_slip_pts);
}

void DrawArrow(const string name, datetime t, double price, color c){
  if(!InpDrawGraphics) return;
  ObjectCreate(0,name,OBJ_ARROW,0,t,price);
  ObjectSetInteger(0,name,OBJPROP_COLOR,c);
}
void DrawHLine(const string name, double price, color c){
  if(!InpDrawGraphics) return;
  ObjectCreate(0,name,OBJ_HLINE,0,TimeCurrent(),price);
  ObjectSetInteger(0,name,OBJPROP_COLOR,c);
  ObjectSetInteger(0,name,OBJPROP_STYLE,STYLE_DOT);
}

bool PosSelectByIndex(const int idx){
   ulong tk = PositionGetTicket(idx);
   if(tk==0) return false;
   return PositionSelectByTicket(tk);
}

//============================= Grid helpers ==========================
double LevelPrice(int lvl){
  if(lvl <= 0) return g_rng.entry_price;
  if(lvl > g_rng.max_levels) return 0.0;
  double dist_pips = lvl * InpStepPips;
  double dist_price = dist_pips * g_pip;
  return (g_rng.side=="BUY" ? g_rng.entry_price - dist_price : g_rng.entry_price + dist_price);
}

bool ExistsOrderByComment(const string cmt){
  int total=(int)OrdersTotal();
  for(int i=0;i<total;i++){
    ulong ticket=OrderGetTicket(i);
    if(ticket==0) continue;
    if(!OrderSelect(ticket)) continue;
    if((long)OrderGetInteger(ORDER_MAGIC)!=InpMagic) continue;
    if((string)OrderGetString(ORDER_SYMBOL)!=InpSymbol) continue;
    if((string)OrderGetString(ORDER_COMMENT)==cmt) return true;
  }
  return false;
}

bool ExistsPositionByComment(const string cmt){
  int total = (int)PositionsTotal();
  for(int idx=0; idx<total; idx++){
    if(PosSelectByIndex(idx)){
      if((long)PositionGetInteger(POSITION_MAGIC) == InpMagic &&
         (string)PositionGetString(POSITION_SYMBOL) == InpSymbol){
        string cm = (string)PositionGetString(POSITION_COMMENT);
        if(cm == cmt) return true;
      }
    }
  }
  return false;
}

bool ExistsPositionByPrefix(const string prefix){
  int total = (int)PositionsTotal();
  for(int idx=0; idx<total; idx++){
    if(PosSelectByIndex(idx)){
      if((long)PositionGetInteger(POSITION_MAGIC) == InpMagic &&
         (string)PositionGetString(POSITION_SYMBOL) == InpSymbol){
        string cm = (string)PositionGetString(POSITION_COMMENT);
        if(StringFind(cm, prefix, 0) == 0) return true;
      }
    }
  }
  return false;
}

bool SendPendingLimit(const string side, double vol, double px, const string cmt){
  MqlTradeRequest req; ZeroMemory(req);
  MqlTradeResult res; ZeroMemory(res);
  req.action = TRADE_ACTION_PENDING;
  req.symbol = InpSymbol;
  req.volume = vol;
  req.price = RoundDigits(px);
  req.deviation = 100;
  req.magic = InpMagic;
  req.type_time = ORDER_TIME_GTC;
  req.type_filling = ORDER_FILLING_RETURN;
  req.type = (side=="BUY"? ORDER_TYPE_BUY_LIMIT : ORDER_TYPE_SELL_LIMIT);
  req.comment = cmt;
  bool ok = trade.OrderSend(req,res);
  if(!ok) Print("Pending fallo ", cmt, " ret=", res.retcode);
  else PrintFormat("  [ORDER] Orden pendiente colocada: %s @ %.2f", cmt, px);
  return ok;
}

bool PlaceLimitLevel(int lvl){
  if(lvl < 1 || lvl >= g_rng.max_levels) return false;
  string cmt = StringFormat(COMMENT_LVL_FMT,lvl);
  if(ExistsOrderByComment(cmt)) return true;
  if(ExistsPositionByPrefix(cmt)) return true;

  double clamp = StopsClamp();
  double ref = (g_rng.side=="BUY"? PriceAsk(): PriceBid());
  double px = RoundDigits(LevelPrice(lvl));
  if(g_rng.side=="BUY"){ if(!(px <= ref - clamp)) return false; }
  else{ if(!(px >= ref + clamp)) return false; }

  bool ok = SendPendingLimit(g_rng.side, InpLotGrid, px, cmt);
  if(ok){
    string nm = StringFormat("PEND_%s_%s", cmt, TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS));
    DrawHLine(nm, px, clrSilver);
  }
  return ok;
}

void RebuildGrid(){
  PrintFormat("  [GRID] Reconstruyendo grid (max_levels=%d)...", g_rng.max_levels);
  for(int lvl=1; lvl<g_rng.max_levels; ++lvl)
    if(!PlaceLimitLevel(lvl))
      PrintFormat("    Nivel %d no pudo colocarse", lvl);
}

//============================= S00 Scalper ===========================
void CheckScalperTP(){
  if(!g_rng.open || g_rng.s00_closed) return;

  if(!ExistsPositionByComment(COMMENT_S00)) return;

  int total = (int)PositionsTotal();
  for(int i=0;i<total;i++){
    if(!PosSelectByIndex(i)) continue;
    if((long)PositionGetInteger(POSITION_MAGIC)!=InpMagic) continue;
    if((string)PositionGetString(POSITION_SYMBOL)!=InpSymbol) continue;

    string cm = (string)PositionGetString(POSITION_COMMENT);
    if(cm != COMMENT_S00) continue;

    double open = PositionGetDouble(POSITION_PRICE_OPEN);
    long typ = (long)PositionGetInteger(POSITION_TYPE);
    double last = (typ==POSITION_TYPE_BUY? PriceBid(): PriceAsk());
    double gain = (typ==POSITION_TYPE_BUY? last-open : open-last);

    if(gain >= InpScalperTPPips * g_pip){
      PrintFormat("  [S00] TP +%.0f pips alcanzado. Cerrando S00.", InpScalperTPPips);
      trade.SetExpertMagicNumber(InpMagic);
      trade.PositionClose((ulong)PositionGetInteger(POSITION_TICKET), 100);
      g_rng.s00_closed = true;
    }
    break;
  }
}

//============================= Open/Close rango ======================
void OpenL00(const string side){
  double px = FillPrice(side);
  trade.SetExpertMagicNumber(InpMagic);
  trade.SetDeviationInPoints(100);
  bool ok = (side=="BUY" ? trade.Buy(InpLotEntry, InpSymbol, px, 0.0, 0.0, COMMENT_L00)
                         : trade.Sell(InpLotEntry, InpSymbol, px, 0.0, 0.0, COMMENT_L00));
  if(ok){
    PrintFormat("  [L00] Abierto: %s @ %.2f lotes=%.2f", side, px, InpLotEntry);
    int total=(int)PositionsTotal();
    g_rng.entry_price = px;
    for(int i=0;i<total;i++){
      if(!PosSelectByIndex(i)) continue;
      if((long)PositionGetInteger(POSITION_MAGIC)!=InpMagic) continue;
      if((string)PositionGetString(POSITION_SYMBOL)!=InpSymbol) continue;
      string cm=(string)PositionGetString(POSITION_COMMENT);
      if(StringFind(cm,COMMENT_L00,0)==0){
        g_rng.entry_price = PositionGetDouble(POSITION_PRICE_OPEN);
        break;
      }
    }
    g_rng.legs_n = 0;
    g_rng.legs[0].name = "L00";
    g_rng.legs[0].vol = InpLotEntry;
    g_rng.legs[0].open_price = g_rng.entry_price;
    g_rng.legs[0].ts_open = g_rng.ts_open_msg;
    g_rng.legs_n++;

    string nm_ent = StringFormat("ENT_L00_%s", TimeToString(g_rng.ts_open_msg, TIME_DATE|TIME_SECONDS));
    DrawArrow(nm_ent, g_rng.ts_open_msg, g_rng.entry_price, (side=="BUY"? clrLime: clrRed));
  } else {
    PrintFormat("  [L00] FALLÓ: %d", _LastError);
  }
}

void OpenS00(const string side){
  double px = FillPrice(side);
  trade.SetExpertMagicNumber(InpMagic);
  trade.SetDeviationInPoints(100);
  bool ok = (side=="BUY" ? trade.Buy(InpLotScalper, InpSymbol, px, 0.0, 0.0, COMMENT_S00)
                         : trade.Sell(InpLotScalper, InpSymbol, px, 0.0, 0.0, COMMENT_S00));
  if(ok){
    PrintFormat("  [S00] Abierto: %s @ %.2f lotes=%.2f", side, px, InpLotScalper);
    g_rng.s00_closed = false;
    string nm_ent = StringFormat("ENT_S00_%s", TimeToString(g_rng.ts_open_msg, TIME_DATE|TIME_SECONDS));
    DrawArrow(nm_ent, g_rng.ts_open_msg, px, clrBlue);
  } else {
    PrintFormat("  [S00] FALLÓ: %d", _LastError);
  }
}

void OpenRange(const EventRow &ev){
  if(g_rng.open){
    PrintFormat("WARN: Rango ya abierto, ignorando nuevo range_open");
    return;
  }
  if(ev.side!="BUY" && ev.side!="SELL") return;

  PrintFormat("========================================");
  PrintFormat("ABRIENDO NUEVO RANGO");
  PrintFormat("========================================");
  DebugEvent(ev, g_ev_idx);

  g_rng.open = true;
  g_rng.side = ev.side;
  g_rng.range_id = ev.range_id;
  g_rng.ts_open_msg = ev.ts + InpLatencySeconds;
  g_rng.s00_closed = false;

  ENUM_RESTRICTION restr = DetectRestriction(ev.confidence);
  g_rng.restriction = restr;
  g_rng.max_levels = GetMaxLevelsForRestriction(restr);

  PrintFormat("Configuración del rango:");
  PrintFormat("  side         : %s", ev.side);
  PrintFormat("  range_id     : %s", ev.range_id);
  PrintFormat("  max_levels   : %d", g_rng.max_levels);
  PrintFormat("  restricción  : %s", GetRestrictionName(restr));
  PrintFormat("  confidence   : [%s]", ev.confidence);

  OpenL00(g_rng.side);
  OpenS00(g_rng.side);
  RebuildGrid();

  g_rng.mfe_pips = -1e9;
  g_rng.mae_pips = 1e9;
  PrintFormat("RANGO ABIERTO");
  PrintFormat("========================================");
}

void EnsureRangesCSV(){
  if(!InpExportCSVs) return;
  if(g_ranges==INVALID_HANDLE){
    g_ranges = FileOpen("ranges_DEBUG.csv",FILE_WRITE|FILE_CSV|FILE_ANSI,';');
    if(FileTell(g_ranges)==0)
      FileWrite(g_ranges,"range_id,side,open_ts,close_ts,mfe_pips,mae_pips,pnl_total_pips,max_levels,s00_closed,restriction");
  }
}

void ExportRangeClose(){
  if(!InpExportCSVs) return;
  EnsureRangesCSV();

  double last = (g_rng.side=="BUY"? PriceBid(): PriceAsk());
  double pnl_tot = 0.0;

  for(int i=0;i<g_rng.legs_n;i++){
    double pnl = (g_rng.side=="BUY"? Pips(g_rng.legs[i].open_price,last)
                                   : Pips(last,g_rng.legs[i].open_price));
    pnl_tot += pnl * g_rng.legs[i].vol;
  }
  FileWrite(g_ranges,g_rng.range_id,g_rng.side,
            TimeToString(g_rng.ts_open_msg, TIME_DATE|TIME_SECONDS),
            TimeToString(g_rng.ts_close_msg, TIME_DATE|TIME_SECONDS),
            DoubleToString(g_rng.mfe_pips,2),
            DoubleToString(g_rng.mae_pips,2),
            DoubleToString(pnl_tot,2),
            IntegerToString(g_rng.legs_n),
            (g_rng.s00_closed ? "1" : "0"),
            GetRestrictionName(g_rng.restriction));
}

void CloseAll(){
  trade.SetExpertMagicNumber(InpMagic);

  PrintFormat("  [CLOSE] Cerrando todas las posiciones y órdenes...");

  for(int i=(int)PositionsTotal()-1;i>=0;i--){
    if(!PosSelectByIndex(i)) continue;
    if((long)PositionGetInteger(POSITION_MAGIC)!=InpMagic) continue;
    if((string)PositionGetString(POSITION_SYMBOL)!=InpSymbol) continue;
    ulong ticket = (ulong)PositionGetInteger(POSITION_TICKET);
    PrintFormat("    Cerrando posición ticket=%d", ticket);
    trade.PositionClose(ticket, 100);
  }

  for(int j=(int)OrdersTotal()-1;j>=0;j--){
    ulong ticket=OrderGetTicket(j);
    if(ticket==0) continue;
    if(!OrderSelect(ticket)) continue;
    if((long)OrderGetInteger(ORDER_MAGIC)!=InpMagic) continue;
    if((string)OrderGetString(ORDER_SYMBOL)!=InpSymbol) continue;
    PrintFormat("    Borrando orden ticket=%d", ticket);
    trade.OrderDelete(ticket);
  }
}

void CloseRange(const EventRow &ev){
  if(!g_rng.open) return;

  PrintFormat("========================================");
  PrintFormat("CERRANDO RANGO");
  PrintFormat("========================================");
  DebugEvent(ev, g_ev_idx);

  g_rng.ts_close_msg = ev.ts + InpLatencySeconds;

  PrintFormat("Resumen del rango:");
  PrintFormat("  range_id     : %s", g_rng.range_id);
  PrintFormat("  side         : %s", g_rng.side);
  PrintFormat("  legs         : %d", g_rng.legs_n);
  PrintFormat("  mfe_pips     : %.2f", g_rng.mfe_pips);
  PrintFormat("  mae_pips     : %.2f", g_rng.mae_pips);
  PrintFormat("  s00_closed   : %s", g_rng.s00_closed ? "SI" : "NO");
  PrintFormat("  restricción  : %s", GetRestrictionName(g_rng.restriction));

  ExportRangeClose();
  CloseAll();

  if(InpDrawGraphics){
    double p0 = g_rng.entry_price + 50*g_pip;
    double p1 = g_rng.entry_price - 50*g_pip;
    string nm = StringFormat("RANGE_%s", TimeToString(g_rng.ts_close_msg, TIME_DATE|TIME_SECONDS));
    ObjectCreate(0,nm,OBJ_RECTANGLE,0, g_rng.ts_open_msg,p0, g_rng.ts_close_msg,p1);
    ObjectSetInteger(0,nm,OBJPROP_BACK,true);
    ObjectSetInteger(0,nm,OBJPROP_COLOR,(g_rng.side=="BUY"?clrLime:clrRed));
    ObjectSetInteger(0,nm,OBJPROP_FILL,true);
    ObjectSetInteger(0,nm,OBJPROP_STYLE,STYLE_SOLID);
    ObjectSetInteger(0,nm,OBJPROP_WIDTH,1);
  }

  ZeroMemory(g_rng);
  g_rng.open = false;
  PrintFormat("RANGO CERRADO");
  PrintFormat("========================================");
}

//============================= Estado en tick =======================
void UpdateMFE_MAE(){
  if(!g_rng.open) return;
  double last = (g_rng.side=="BUY"? PriceBid(): PriceAsk());
  double pnl = Pips(g_rng.entry_price,last);
  if(g_rng.side=="SELL") pnl = -pnl;
  if(pnl>g_rng.mfe_pips) g_rng.mfe_pips = pnl;
  if(pnl<g_rng.mae_pips) g_rng.mae_pips = pnl;
}

//============================= Trade Transactions ===================
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult&  result)
{
  if(!g_rng.open) return;

  if(trans.type==TRADE_TRANSACTION_DEAL_ADD){
    ulong deal = trans.deal;
    if(!HistoryDealSelect(deal)) return;

    string sym = (string)HistoryDealGetString(deal, DEAL_SYMBOL);
    long magic = (long)HistoryDealGetInteger(deal, DEAL_MAGIC);
    long entry = (long)HistoryDealGetInteger(deal, DEAL_ENTRY);

    if(sym!=InpSymbol || magic!=InpMagic || entry!=DEAL_ENTRY_IN) return;

    string cm = (string)HistoryDealGetString(deal, DEAL_COMMENT);
    double vol = HistoryDealGetDouble(deal, DEAL_VOLUME);
    double price = HistoryDealGetDouble(deal, DEAL_PRICE);
    datetime t = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);

    if(StringFind(cm, "Xisco_", 0)==0){
      int n = g_rng.legs_n;
      if(n < ArraySize(g_rng.legs)){
        g_rng.legs[n].name = cm;
        g_rng.legs[n].vol = vol;
        g_rng.legs[n].open_price = price;
        g_rng.legs[n].ts_open = t;
        g_rng.legs_n = n+1;
        PrintFormat("  [DEAL] Nueva leg: %s vol=%.2f px=%.2f", cm, vol, price);
      }
    }
  }
}

//============================= Eventos EA ===========================
int OnInit(){
  PrintFormat("========================================");
  PrintFormat("BACKTESTER XISCO - DEBUG MODE");
  PrintFormat("========================================");
  PrintFormat("Modo VERBOSE ACTIVADO");
  PrintFormat("Todos los eventos serán impresos");
  PrintFormat("========================================");

  g_digits = (int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
  g_pip = InpPipSize;
  g_slip_pts = InpSlippagePips*g_pip;

  PrintFormat("Configuración:");
  PrintFormat("  Símbolo      : %s", InpSymbol);
  PrintFormat("  Dígitos      : %d", g_digits);
  PrintFormat("  Pip size     : %.4f", g_pip);
  PrintFormat("  Slippage     : %.1f pips", InpSlippagePips);
  PrintFormat("  Latency      : %d seg", InpLatencySeconds);
  PrintFormat("  Magic        : %d", InpMagic);

  if(!SymbolSelect(InpSymbol,true)){
    PrintFormat("ERROR: No se pudo seleccionar %s", InpSymbol);
    return INIT_FAILED;
  }

  g_serverOffsetSec = (int)((long)TimeCurrent() - (long)TimeGMT());
  PrintFormat("Offset servidor: %d seg (%.1f horas)", g_serverOffsetSec, g_serverOffsetSec/3600.0);

  string chart_sym = Symbol();
  if(chart_sym != InpSymbol){
    PrintFormat("AVISO: EA corre sobre '%s' pero InpSymbol='%s'", chart_sym, InpSymbol);
  }

  if(InpRequireHedging){
    ENUM_ACCOUNT_MARGIN_MODE mm = (ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE);
    if(mm==ACCOUNT_MARGIN_MODE_RETAIL_NETTING || mm==ACCOUNT_MARGIN_MODE_EXCHANGE){
      PrintFormat("ERROR: Cuenta en modo NETTING. Activa 'Hedging'");
      return INIT_FAILED;
    }
    PrintFormat("Modo Hedging: OK");
  }

  PrintFormat("Lotes:");
  PrintFormat("  L00 (base)   : %.2f", InpLotEntry);
  PrintFormat("  S00 (scalp)  : %.2f", InpLotScalper);
  PrintFormat("  Grid (avg)   : %.2f", InpLotGrid);
  PrintFormat("Grid:");
  PrintFormat("  Step pips    : %d", InpStepPips);
  PrintFormat("  Max levels  : %d", InpMaxLevels);
  PrintFormat("S00 Scalper:");
  PrintFormat("  TP pips      : %d", InpScalperTPPips);
  PrintFormat("========================================");

  if(!LoadEvents()){
    PrintFormat("ERROR: CSV vacío o inválido");
    return INIT_FAILED;
  }

  g_ev_idx = 0;
  ZeroMemory(g_rng);

  PrintFormat("========================================");
  PrintFormat("INIT COMPLETADO - Iniciando backtest");
  PrintFormat("========================================");

  return INIT_SUCCEEDED;
}

void OnDeinit(const int reason){
  if(g_ranges!=INVALID_HANDLE){ FileClose(g_ranges); g_ranges=INVALID_HANDLE; }
  PrintFormat("========================================");
  PrintFormat("BACKTEST FINALIZADO");
  PrintFormat("Razón: %d", reason);
  PrintFormat("========================================");
}

void OnTick(){
  datetime now = TimeCurrent();

  while(g_ev_idx<ArraySize(g_events)){
    datetime t = g_events[g_ev_idx].ts + InpLatencySeconds;
    if(t>now) break;

    EventRow ev = g_events[g_ev_idx];

    PrintFormat("========================================");
    PrintFormat("TICK EVENTO #%d - %s",
                g_ev_idx, TimeToString(ev.ts, TIME_DATE|TIME_SECONDS));
    PrintFormat("========================================");
    DebugEvent(ev, g_ev_idx);

    if(ev.kind=="range_open"){
      PrintFormat("ACCION: ABRIR RANGO");
      OpenRange(ev);
    } else if(ev.kind=="range_close"){
      PrintFormat("ACCION: CERRAR RANGO");
      CloseRange(ev);
    }

    g_ev_idx++;
  }

  if(g_rng.open){
    UpdateMFE_MAE();
    CheckScalperTP();
    RebuildGrid();
  }
}
