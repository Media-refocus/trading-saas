//+------------------------------------------------------------------+
//|                                        Backtester_Toni_CLEAN     |
//| Replay CSV + grid + S00 + trailing L00 (MQL5 puro)               |
//| CSV (MQL5/Files): ts_utc;kind;side                               |
//| kind: range_open / range_close                                   |
//+------------------------------------------------------------------+
#property strict
#property tester_file "signals_simple.csv"

#include <Trade/Trade.mqh>
CTrade trade;

//============================= Inputs ===============================
input string  InpCsvFileName     = "signals_simple.csv"; // CSV en MQL5/Files
input bool    InpCsvIsUTC        = true;                 // El CSV viene en UTC
input int     InpCsvTzShiftHours = 0;                    // Ajuste manual extra (+/- h)

input string  InpSymbol          = "XAUUSD";             // sÃ­mbolo del tester
input double  InpPipSize         = 0.10;                 // 1 pip (XAUUSD)=0.10
input long    InpMagic           = 20250670;             // magic
input bool    InpRequireHedging  = true;                 // abortar si la cuenta es NETTING

// Lotes
input double  InpLotEntry        = 0.03;                 // L00
input double  InpLotGrid         = 0.03;                 // L01..Ln
input double  InpLotScalper      = 0.03;                 // S00

// Rejilla
input int     InpStepPips        = 10;                   // distancia entre niveles
input int     InpMaxLevels       = 40;                   // nÃºmero mÃ¡x niveles
input int     InpProfitPips      = 10;                   // objetivo por nivel
input double  InpTolerancePct    = 2.0;                  // tolerancia objetivo (%)

// Variable grid schedule and cap
// A comma-separated list of pairs "limit:step" where limit is the upper
// cumulative distance (in pips) and step is the distance between levels (in pips)
// for that bracket. The last entry can use "inf" for an unlimited cap.
// Example default: "100:10,160:15,240:20,400:40,inf:50"
input string  InpGridSchedule    = "100:10,160:15,240:20,400:40,inf:50";
// Maximum cumulative adverse pips allowed; no levels are created beyond this cap
input double  InpMaxAdversePips  = 500.0;

// S00
input int     InpScalperTpPips   = 20;                   // cierra S00 cuando SUPERA +20 pips
input bool    InpRecycleS00Limit = true;                 // recolocar LIMIT en precio de entry

// Trailing L00
input int     InpTrailActPips    = 30;                   // activa trailing en +30 pips
input int     InpTrailStepPips   = 10;                   // cada +10 -> mueve +10
input int     InpTrailBaseOff    = 10;                   // primer SL a 10
input int     InpTrailMinDelta   = 1;                    // mejora mÃ­nima (pips)

// SimulaciÃ³n / dibujo
input double  InpSlippagePips    = 0.5;                  // slippage de fill
input int     InpLatencySeconds  = 0;                    // latencia artificial (seg)
input bool    InpDrawGraphics    = true;                 // flechas/rectÃ¡ngulos/HLines
input bool    InpExportCSVs      = true;                 // export ranges.csv
input bool    InpVerbose         = true;                 // logs de depuraciÃ³n

//============================= Constantes ===========================
#define COMMENT_L00      "grid_L00"
#define COMMENT_LVL_FMT  "grid_L%02d"
#define COMMENT_S00      "grid_S00"
#define COMMENT_S00_PEND "grid_S00_pend"

//============================= Tipos ================================
struct EventRow { datetime ts; string kind; string side; };
EventRow g_events[];
int g_ev_idx=0;

struct Leg {
  string   name;
  double   vol;
  double   open_price;
  datetime ts_open;
};
struct RangeState {
  bool     open;
  string   side;         // BUY/SELL
  datetime ts_open_msg;
  datetime ts_close_msg;
  double   entry_price;  // precio base para mÃ©tricas y niveles (fill L00)
  double   mfe_pips;
  double   mae_pips;
  Leg      legs[110];
  int      legs_n;
};
RangeState g_rng;

//============================= Globals ==============================
int      g_digits=2;
double   g_pip=0.10, g_slip_pts=0.0;
int      g_serverOffsetSec=0;

int      g_ranges=INVALID_HANDLE;   // archivo salida ranges.csv
datetime g_last_grid=0;

// ----------------------------------------------------------------------
// Variable grid support
// g_schedLimits/g_schedSteps: arrays defining the schedule brackets for
// variable grid. Each entry pairs an upper cumulative pip limit with a
// step size (in pips).  For example, {100,160,240,400,DBL_MAX} and
// {10,15,20,40,50} create level distances of 10 pips until 100 pips,
// 15 pips until 160 pips, etc.
// g_levelDistPips holds the cumulative pip distance for each level.
// g_levelDistCount is the number of levels actually computed (â‰¤ InpMaxLevels).
double   g_schedLimits[];
double   g_schedSteps[];
double   g_levelDistPips[];
int      g_levelDistCount=0;

//============================= Debug helpers ========================
// Estructura para resumir descartes del CSV
struct CsvDiag {
  int total_lines;
  int skipped_empty;
  int skipped_header;
  int bad_cols;
  int bad_kind;
  int bad_side;
  int bad_ts;
  int kept;
} g_csvdiag;

// Devuelve un prefijo en hexadecimal de un buffer
string HexPrefix(const uchar &buf[], int n){
  int m = MathMin(n, ArraySize(buf));
  string s="";
  for(int i=0;i<m;i++){
    s += StringFormat("%02X ", buf[i]);
  }
  return s;
}

// Devuelve un fragmento inicial de una cadena (para logs compactos)
string Preview(const string &s, int n=120){
  if(StringLen(s)<=n) return s;
  return StringSubstr(s,0,n) + "...";
}

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

// --------------------------- FUNCIÃ“N CORREGIDA 1 ---------------------------
// Analiza fechas flexibles en forma numÃ©rica
bool ParseTSFlexible(string src, datetime &out)
{
  StringTrimLeft(src);
  StringTrimRight(src);
  if(StringLen(src)==0){ out=0; return false; }

  string s0 = src; // copia original para logs

  // -------------------------------------------------------------------------
  // Intento rÃ¡pido: normalizamos la cadena con separadores ISO y usamos
  // StringToTime() directamente. Esto evita la complejidad de extraer
  // manualmente grupos numÃ©ricos y deberÃ­a reconocer formatos como
  // "2024-06-10T12:22:31Z" o "2024-06-10 12:22:31".
  string s_iso = src;
  // eliminar sufijo de zona horaria 'Z' o 'z'
  int pz;
  pz = StringFind(s_iso, "Z");
  if(pz >= 0) s_iso = StringSubstr(s_iso, 0, pz);
  pz = StringFind(s_iso, "z");
  if(pz >= 0) s_iso = StringSubstr(s_iso, 0, pz);
  // convertir separador 'T'/'t' a espacio
  StringReplace(s_iso, "T", " ");
  StringReplace(s_iso, "t", " ");
  // reemplazar guiones por puntos para adaptarse a StringToTime
  StringReplace(s_iso, "-", ".");
  // Si la cadena incluye barras '/', tambiÃ©n conviÃ©rtelas a puntos
  StringReplace(s_iso, "/", ".");
  // Intentar convertir a datetime
  datetime dtt = StringToTime(s_iso);
  if(dtt != 0)
  {
    out = dtt;
    if(InpVerbose) PrintFormat("TS-OK '%s' -> %s (iso)", Preview(s0), TimeToString(out, TIME_DATE|TIME_SECONDS));
    return true;
  }

  // -------------------------------------------------------------------------
  // Si StringToTime fallÃ³, procedemos con el algoritmo flexible anterior.
  // Hacemos una copia de la cadena y la pasamos a minÃºsculas usando la
  // sobrecarga que devuelve una nueva cadena. De este modo evitamos
  // invocar la versiÃ³n de StringToLower que modifica el argumento por
  // referencia y devuelve un entero/booleano. Esa variante puede
  // provocar que el valor devuelto se convierta implÃ­citamente a
  // "true"/"false" al asignarse a un string.
  string s  = src;
  s         = StringToLower(s);
  // Quitar 'z' final y convertir 't' en espacio
  int posz = StringFind(s,"z"); if(posz>=0) s = StringSubstr(s,0,posz);
  StringReplace(s,"t"," ");
  // Extraer grupos numÃ©ricos
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
    if(InpVerbose) PrintFormat("TS-FAIL <3 groups | src='%s' | norm='%s' | gsz=%d", Preview(s0), Preview(s), gsz);
    out=0;
    return false;
  }
  int y=groups[0], m=groups[1], d=groups[2];
  int H=(gsz>=4?groups[3]:0), M=(gsz>=5?groups[4]:0), S=(gsz>=6?groups[5]:0);
  if(y<=1970 || m<1||m>12 || d<1||d>31){
    if(InpVerbose) PrintFormat("TS-FAIL invalid YMD | src='%s' -> Y=%d M=%d D=%d", Preview(s0), y,m,d);
    out=0;
    return false;
  }
  if(H<0||H>23 || M<0||M>59 || S<0||S>59){
    if(InpVerbose) PrintFormat("TS-FAIL invalid HMS | src='%s' -> H=%d M=%d S=%d", Preview(s0), H,M,S);
    out=0;
    return false;
  }
  MqlDateTime dt2; ZeroMemory(dt2);
  dt2.year=y; dt2.mon=m; dt2.day=d; dt2.hour=H; dt2.min=M; dt2.sec=S;
  out = StructToTime(dt2);
  if(InpVerbose) PrintFormat("TS-OK '%s' -> %04d-%02d-%02d %02d:%02d:%02d (= %s)",
    Preview(s0), y,m,d,H,M,S, TimeToString(out, TIME_DATE|TIME_SECONDS));
  return (out>0);
}

// --------------------------- FUNCIÃ“N CORREGIDA 2 ---------------------------
// Carga los eventos del CSV con diagnÃ³stico detallado
bool LoadEvents()
{
  // Reiniciar contadores
  ZeroMemory(g_csvdiag);

  // Abrir en binario para manejo de BOM y codificaciÃ³n
  int h = FileOpen(InpCsvFileName, FILE_READ | FILE_BIN);
  if(h == INVALID_HANDLE)
  {
    Print("ERR: no se pudo abrir ", InpCsvFileName, " en modo BINARIO. Code=", GetLastError());
    return false;
  }

  long fileSize = FileSize(h);
  if(fileSize <= 0)
  {
    FileClose(h);
    Print("ERR: El archivo CSV estÃ¡ vacÃ­o o no se pudo determinar su tamaÃ±o.");
    return false;
  }
  uchar buffer[];
  ArrayResize(buffer, (int)fileSize);
  int bytesRead = FileReadArray(h, buffer);
  FileClose(h);

  if(bytesRead != fileSize)
  {
    Print("ERR: No se pudo leer el archivo CSV completo en memoria. bytesRead=", bytesRead, " size=", fileSize);
    return false;
  }

  // Log de cabecera binaria
  if(InpVerbose) PrintFormat("CSV bytes=%d | hex-prefix: %s", bytesRead, HexPrefix(buffer, 24));

  // Convertir a string UTF-8
  string content = CharArrayToString(buffer, 0, -1, CP_UTF8);

  // Eliminar BOM si existe
  if(StringLen(content) >= 3 && StringGetCharacter(content,0)==0xEF &&
     StringGetCharacter(content,1)==0xBB && StringGetCharacter(content,2)==0xBF)
  {
    content = StringSubstr(content,3);
    if(InpVerbose) Print("CSV: UTF-8 BOM detectado y retirado");
  }
  if(StringLen(content) >= 1 && StringGetCharacter(content,0)==0xFEFF)
  {
    content = StringSubstr(content,1);
    if(InpVerbose) Print("CSV: FEFF inicial retirado");
  }

  // Dividir en lÃ­neas
  string lines[];
  int nlines = StringSplit(content, '\n', lines);
  if(InpVerbose) PrintFormat("CSV: %d lÃ­neas detectadas (incluye cabecera/blank)", nlines);

  // Reset eventos
  ArrayResize(g_events, 0);
  ushort SEP = 0;
  bool header_seen = false;
  datetime t_min = 0, t_max = 0;

  // Inferir separador inspeccionando primeras lÃ­neas no vacÃ­as
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
  if(SEP==0) {
    SEP=',';
    if(InpVerbose) Print("CSV: no pude inferir separador; uso ',' por defecto");
  }
  else {
    if(InpVerbose) PrintFormat("CSV: separador inferido: '%c' (0x%02X)", (char)SEP, (int)SEP);
  }

  // Procesar cada lÃ­nea
  for(int i=0; i<nlines; i++)
  {
    g_csvdiag.total_lines++;
    string ln = lines[i];
    StringReplace(ln,"\r","");
    StringTrimLeft(ln);
    StringTrimRight(ln);

    // Ignorar vacÃ­as y comentarios
    if(ln=="" || StringGetCharacter(ln,0)=='#'){
      g_csvdiag.skipped_empty++;
      continue;
    }

    // Cabecera si contiene ts_utc y kind (solo una vez)
    if(!header_seen)
    {
      // Copiar la lÃ­nea y convertirla a minÃºsculas in situ. StringToLower() modifica la cadena y devuelve bool.
      string low = ln;
      StringToLower(low);
      if(StringFind(low, "ts_utc") >= 0 && StringFind(low, "kind") >= 0)
      {
        header_seen = true;
        g_csvdiag.skipped_header++;
        if(InpVerbose) PrintFormat("CSV: cabecera detectada y saltada -> '%s'", Preview(ln));
        continue;
      }
      // Si no detecta cabecera, deja un log informativo
      if(InpVerbose) PrintFormat("CSV: posible ausencia de cabecera estÃ¡ndar en lÃ­nea 1 -> '%s'", Preview(ln));
    }

    // Particionar por separador
    string p[];
    int cols = StringSplit(ln, SEP, p);
    if(cols < 2)
    {
      g_csvdiag.bad_cols++;
      if(InpVerbose) PrintFormat("CSV-REJECT col<2 | i=%d | ln='%s'", i+1, Preview(ln));
      continue;
    }
    for(int k=0;k<cols;k++){ StringTrimLeft(p[k]); StringTrimRight(p[k]); }

    string s_ts   = p[0];
    /*
      Normalizamos la columna Â«kindÂ» a minÃºsculas. Las funciones StringToLower
      y StringToUpper de MQL5 modifican la cadena pasada por referencia y
      devuelven un valor entero (bool) indicando el Ã©xito de la operaciÃ³n. Si
      asignamos ese valor devuelto a la propia cadena, la cadena queda
      reemplazada por "true"/"false" y se pierde el texto original.

      Por eso, en lugar de escribir:
        p[1] = StringToLower(p[1]);
      llamamos a StringToLower(p[1]) sin capturar su valor; esto modifica
      directamente p[1]. Luego copiamos el contenido normalizado a s_kind. Lo
      mismo aplica para la columna side.
    */
    // Normalizar campo kind a minÃºsculas
    StringToLower(p[1]);
    string s_kind = p[1];
    // Normalizar campo side a mayÃºsculas si existe
    string s_side = "";
    if(cols>=3)
    {
      StringToUpper(p[2]);
      s_side = p[2];
    }

    // Validar kind
    if(s_kind!="range_open" && s_kind!="range_close")
    {
      g_csvdiag.bad_kind++;
      if(InpVerbose && ((i<50) || (i%500==0))) PrintFormat("CSV-REJECT kind | i=%d | kind='%s' | ln='%s'", i+1, s_kind, Preview(ln));
      continue;
    }
    // Validar side cuando aplica
    if(s_kind=="range_open" && s_side!="BUY" && s_side!="SELL")
    {
      g_csvdiag.bad_side++;
      if(InpVerbose) PrintFormat("CSV-REJECT side | i=%d | side='%s' | ln='%s'", i+1, s_side, Preview(ln));
      continue;
    }

    // Parsear fecha
    datetime ts_raw;
    if(!ParseTSFlexible(s_ts, ts_raw))
    {
      g_csvdiag.bad_ts++;
      continue; // ParseTSFlexible ya imprime su propio log TS-FAIL
    }

    // Ajustes horarios
    datetime ts = ts_raw;
    if(InpCsvIsUTC)
    {
      ts += g_serverOffsetSec;
      ts += (InpCsvTzShiftHours * 3600);
    }

    // Guardar evento
    int z = ArraySize(g_events);
    ArrayResize(g_events, z+1);
    g_events[z].ts   = ts;
    g_events[z].kind = s_kind;
    g_events[z].side = s_side;
    g_csvdiag.kept++;

    if(t_min==0 || ts<t_min) t_min=ts;
    if(t_max==0 || ts>t_max) t_max=ts;

    // Log de primeras entradas
    if((z<=5) || (z<=50 && (z%10==0)) || (z%500==0))
    {
      if(InpVerbose) PrintFormat("CSV-OK  i=%d | ts=%s | kind=%s | side=%s",
        i+1, TimeToString(ts, TIME_DATE|TIME_SECONDS), s_kind, (s_side=="" ? "-" : s_side));
    }
  }

  // Ordenar por fecha
  int m = ArraySize(g_events);
  for(int a=0; a<m-1; a++)
    for(int b=a+1; b<m; b++)
      if(g_events[a].ts > g_events[b].ts)
      {
        EventRow t = g_events[a];
        g_events[a] = g_events[b];
        g_events[b] = t;
      }

  // Resumen diagnÃ³stico
  if(InpVerbose)
    PrintFormat("CSV-DIAG total=%d | empty#=%d | header#=%d | bad_cols#=%d | bad_kind#=%d | bad_side#=%d | bad_ts#=%d | kept#=%d",
      g_csvdiag.total_lines, g_csvdiag.skipped_empty, g_csvdiag.skipped_header,
      g_csvdiag.bad_cols, g_csvdiag.bad_kind, g_csvdiag.bad_side, g_csvdiag.bad_ts, g_csvdiag.kept);

  if(g_csvdiag.kept==0)
  {
    Print("WARN: 0 eventos vÃ¡lidos tras lectura. Revisa separador/fechas/codificaciÃ³n/formato de columnas.");
    return false;
  }

  PrintFormat("CSV OK: %d eventos. Ventana: [%s â†’ %s] (hora SERVIDOR) | sep='%c'",
              g_csvdiag.kept,
              TimeToString(t_min, TIME_DATE | TIME_MINUTES | TIME_SECONDS),
              TimeToString(t_max, TIME_DATE | TIME_MINUTES | TIME_SECONDS),
              (char)SEP);
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

// --- Wrapper seguro para seleccionar posiciÃ³n por Ã­ndice (sin usar PositionSelectByIndex)
bool PosSelectByIndex(const int idx){
   ulong tk = PositionGetTicket(idx);
   if(tk==0) return false;
   return PositionSelectByTicket(tk);
}

//============================= Grid helpers ==========================
double LevelPrice(int lvl){
  // Return theoretical price for a given level based on variable grid distances.
  // L0 returns the entry price; levels beyond the computed distances return 0.
  if(lvl <= 0) return g_rng.entry_price;
  if(lvl > g_levelDistCount)
    return 0.0;
  double dist_pips = g_levelDistPips[lvl - 1];
  double dist_price = dist_pips * g_pip;
  return (g_rng.side=="BUY" ? g_rng.entry_price - dist_price : g_rng.entry_price + dist_price);
}

// Return the profit target in pips for a given level. The first level uses the
// first cumulative distance; subsequent levels use the difference between the
// current and previous cumulative distances. A value of 0 indicates that no
// dynamic target is defined for the level.
double LevelProfitPipsDynamic(int lvl){
  if(lvl <= 0 || lvl > g_levelDistCount)
    return 0.0;
  if(lvl == 1)
    return g_levelDistPips[0];
  return g_levelDistPips[lvl - 1] - g_levelDistPips[lvl - 2];
}

// Determine the step size (in pips) given a cumulative distance in pips.
// Iterates through g_schedLimits to find the first bracket whose limit
// exceeds the current distance. Returns the associated step size; if no
// brackets are found, returns the last step or zero.
double StepForDistance(double dist_pips){
  int n = ArraySize(g_schedLimits);
  for(int i=0; i<n; i++){
    // use DBL_MAX for unlimited cap (inf)
    if(dist_pips < g_schedLimits[i])
      return g_schedSteps[i];
  }
  // fallback: last defined step
  if(n > 0)
    return g_schedSteps[n - 1];
  return 0.0;
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

bool ExistsPositionByPrefix(const string prefix){
  int total = (int)PositionsTotal();
  for(int idx=0; idx<total; idx++){
    if(PosSelectByIndex(idx)){
      if((long)PositionGetInteger(POSITION_MAGIC)  == InpMagic &&
         (string)PositionGetString(POSITION_SYMBOL) == InpSymbol)
      {
        string cm = (string)PositionGetString(POSITION_COMMENT);
        if(StringFind(cm, prefix, 0) == 0)
          return true;
      }
    }
  }
  return false;
}

bool SendPendingLimit(const string side, double vol, double px, const string cmt){
  MqlTradeRequest  req;  ZeroMemory(req);
  MqlTradeResult   res;  ZeroMemory(res);
  req.action       = TRADE_ACTION_PENDING;
  req.symbol       = InpSymbol;
  req.volume       = vol;
  req.price        = RoundDigits(px);
  req.deviation    = 100;
  req.magic        = InpMagic;
  req.type_time    = ORDER_TIME_GTC;
  req.type_filling = ORDER_FILLING_RETURN;
  req.type         = (side=="BUY"? ORDER_TYPE_BUY_LIMIT : ORDER_TYPE_SELL_LIMIT);
  req.comment      = cmt;
  bool ok = trade.OrderSend(req,res);
  if(!ok) Print("Pending fallo ", cmt, " ret=", res.retcode);
  return ok;
}

bool PlaceLimitLevel(int lvl){
  // Only place pending orders for levels within the computed range
  if(lvl < 1 || lvl > g_levelDistCount)
    return false;
  string cmt=StringFormat(COMMENT_LVL_FMT,lvl);
  if(ExistsOrderByComment(cmt))   return true;
  if(ExistsPositionByPrefix(cmt)) return true;

  double clamp=StopsClamp();
  double ref=(g_rng.side=="BUY"? PriceAsk(): PriceBid());
  double px=RoundDigits(LevelPrice(lvl));
  if(g_rng.side=="BUY"){ if(!(px <= ref - clamp)) return false; }
  else                  { if(!(px >= ref + clamp)) return false; }

  bool ok = SendPendingLimit(g_rng.side, InpLotGrid, px, cmt);
  if(ok){
    string nm = StringFormat("PEND_%s_%s", cmt, TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS));
    DrawHLine(nm, px, clrSilver);
  }
  return ok;
}

void RebuildGrid(){
  // throttle: ~cada 2s de tiempo simulado
  if(TimeCurrent() < g_last_grid + 2) return;
  g_last_grid = TimeCurrent();

  for(int lvl=1; lvl<=InpMaxLevels; ++lvl) PlaceLimitLevel(lvl);
}

bool PlaceS00RecycleLimit(){
  if(!InpRecycleS00Limit) return false;
  if(ExistsPositionByPrefix(COMMENT_S00) || ExistsOrderByComment(COMMENT_S00_PEND)) return false;

  double clamp=StopsClamp();
  double ref=(g_rng.side=="BUY"? PriceAsk(): PriceBid());
  double px=RoundDigits(g_rng.entry_price);
  if(g_rng.side=="BUY"){ if(!(px <= ref - clamp)) return false; }
  else                  { if(!(px >= ref + clamp)) return false; }

  bool ok = SendPendingLimit(g_rng.side, InpLotScalper, px, COMMENT_S00_PEND);
  if(ok){
    string nm = StringFormat("S00_PEND_%s", TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS));
    DrawHLine(nm, px, clrDarkGray);
  }
  return ok;
}

//============================= Trailing L00 ==========================
void UpdateTrailingL00(){
  int total=(int)PositionsTotal();
  for(int i=0;i<total;i++){
    if(!PosSelectByIndex(i)) continue;
    if((long)PositionGetInteger(POSITION_MAGIC)!=InpMagic) continue;
    if((string)PositionGetString(POSITION_SYMBOL)!=InpSymbol) continue;
    string cm=(string)PositionGetString(POSITION_COMMENT);
    if(StringFind(cm,COMMENT_L00,0)!=0) continue;

    double open=PositionGetDouble(POSITION_PRICE_OPEN);
    long   typ =(long)PositionGetInteger(POSITION_TYPE);
    int    dir =(typ==POSITION_TYPE_BUY? +1: -1);
    double last=(typ==POSITION_TYPE_BUY? PriceBid(): PriceAsk());
    double prof_pips=(last-open)*dir/g_pip;
    if(prof_pips < InpTrailActPips) return;

    double extra=prof_pips - InpTrailActPips;
    int    steps=(int)MathFloor(extra/InpTrailStepPips)+1;
    double dist =(InpTrailBaseOff + (steps-1)*InpTrailStepPips)*g_pip;
    double desired=open + dir*dist;
    double clamp=StopsClamp();
    if(dir>0) desired=MathMin(desired, PriceBid()-clamp);
    else      desired=MathMax(desired, PriceAsk()+clamp);
    desired=RoundDigits(desired);

    double cur_sl=PositionGetDouble(POSITION_SL);
    double min_delta=InpTrailMinDelta*g_pip;
    if(cur_sl>0){
      if(dir>0 && desired < cur_sl + min_delta) return;
      if(dir<0 && desired > cur_sl - min_delta) return;
    }
    trade.SetExpertMagicNumber(InpMagic);
    trade.PositionModify((ulong)PositionGetInteger(POSITION_TICKET), desired, PositionGetDouble(POSITION_TP));
  }
}

//============================= Cierres niveles =======================
void CloseTargetsAndRecycle(){
  // targetGain/tolerance will be calculated per level using LevelProfitPipsDynamic()

  int total=(int)PositionsTotal();
  for(int i=0;i<total;i++){
    if(!PosSelectByIndex(i)) continue;
    if((long)PositionGetInteger(POSITION_MAGIC)!=InpMagic) continue;
    if((string)PositionGetString(POSITION_SYMBOL)!=InpSymbol) continue;

    string cm=(string)PositionGetString(POSITION_COMMENT);
    if(StringFind(cm,COMMENT_L00,0)==0) continue;

    long   typ =(long)PositionGetInteger(POSITION_TYPE);
    double open=PositionGetDouble(POSITION_PRICE_OPEN);
    double cur =(typ==POSITION_TYPE_BUY? PriceBid(): PriceAsk());
    double gain=(typ==POSITION_TYPE_BUY? cur-open: open-cur);

    // S00: take-profit por pips absolutos
    if(StringFind(cm,COMMENT_S00,0)==0 || StringFind(cm,COMMENT_S00_PEND,0)==0){
      if(gain > InpScalperTpPips*g_pip){
        trade.SetExpertMagicNumber(InpMagic);
        trade.PositionClose((ulong)PositionGetInteger(POSITION_TICKET), 100);
        PlaceS00RecycleLimit();
      }
      continue;
    }

    // Lxx: cierre por objetivo con tolerancia y reposiciÃ³n del mismo nivel
    {
      // parse level from comment "grid_Lxx"; xx are two digits
      int lvl = -1;
      int pos_lvl = StringFind(cm, "grid_L", 0);
      if(pos_lvl >= 0 && StringLen(cm) >= pos_lvl + 8){
        string s = StringSubstr(cm, pos_lvl + 6, 2);
        lvl = (int)StringToInteger(s);
      }
      if(lvl >= 1){
        double profitPips = LevelProfitPipsDynamic(lvl);
        // fallback to uniform InpProfitPips if dynamic profit undefined
        if(profitPips <= 0.0)
          profitPips = InpProfitPips;
        double targetGain = profitPips * g_pip;
        double tolerance  = targetGain * InpTolerancePct / 100.0;
        if(gain >= targetGain - tolerance){
          trade.SetExpertMagicNumber(InpMagic);
          ulong tkt=(ulong)PositionGetInteger(POSITION_TICKET);
          trade.PositionClose(tkt, 100);
          // reposition pending limit at the same level
          PlaceLimitLevel(lvl);
        }
      }
    }
  }
}

//============================= Open/Close rango ======================
void OpenL00(const string side){
  double px=FillPrice(side);
  trade.SetExpertMagicNumber(InpMagic);
  trade.SetDeviationInPoints(100);
  bool ok = (side=="BUY" ? trade.Buy (InpLotEntry, InpSymbol, px, 0.0, 0.0, COMMENT_L00)
                         : trade.Sell(InpLotEntry, InpSymbol, px, 0.0, 0.0, COMMENT_L00));
  if(ok){
    // Confirmar el precio real de fill de L00
    int total=(int)PositionsTotal();
    g_rng.entry_price=px;
    for(int i=0;i<total;i++){
      if(!PosSelectByIndex(i)) continue;
      if((long)PositionGetInteger(POSITION_MAGIC)!=InpMagic) continue;
      if((string)PositionGetString(POSITION_SYMBOL)!=InpSymbol) continue;
      string cm=(string)PositionGetString(POSITION_COMMENT);
      if(StringFind(cm,COMMENT_L00,0)==0){
        g_rng.entry_price=PositionGetDouble(POSITION_PRICE_OPEN);
        break;
      }
    }
    // Registrar L00 como primera pierna
    g_rng.legs_n=0;
    g_rng.legs[g_rng.legs_n].name       ="L00";
    g_rng.legs[g_rng.legs_n].vol        =InpLotEntry;
    g_rng.legs[g_rng.legs_n].open_price =g_rng.entry_price;
    g_rng.legs[g_rng.legs_n].ts_open    = g_rng.ts_open_msg;
    g_rng.legs_n++;

    string nm_ent = StringFormat("ENT_L00_%s", TimeToString(g_rng.ts_open_msg, TIME_DATE|TIME_SECONDS));
    DrawArrow(nm_ent, g_rng.ts_open_msg, g_rng.entry_price, (side=="BUY"? clrLime: clrRed));
    string nm_hl  = StringFormat("ENTRY_LINE_%s", TimeToString(g_rng.ts_open_msg, TIME_DATE|TIME_SECONDS));
    DrawHLine(nm_hl, g_rng.entry_price, clrDarkSlateGray);
  } else {
    Print("L00 falla: ", _LastError);
  }
}

void OpenS00(const string side){
  double px = FillPrice(side);
  trade.SetExpertMagicNumber(InpMagic);
  trade.SetDeviationInPoints(100);
  bool ok = (side=="BUY" ? trade.Buy (InpLotScalper, InpSymbol, px, 0.0, 0.0, COMMENT_S00)
                         : trade.Sell(InpLotScalper, InpSymbol, px, 0.0, 0.0, COMMENT_S00));
  if(!ok) Print("S00 falla: ", _LastError);
}

void OpenRange(const EventRow &ev){
  if(g_rng.open) return;
  if(ev.side!="BUY" && ev.side!="SELL") return;

  g_rng.open=true;
  g_rng.side=ev.side;
  g_rng.ts_open_msg=ev.ts + InpLatencySeconds;

  OpenL00(g_rng.side);
  OpenS00(g_rng.side);
  RebuildGrid();

  g_rng.mfe_pips=-1e9;
  g_rng.mae_pips= 1e9;
}

void EnsureRangesCSV(){
  if(!InpExportCSVs) return;
  if(g_ranges==INVALID_HANDLE){
    g_ranges=FileOpen("ranges.csv",FILE_WRITE|FILE_CSV|FILE_ANSI,';');
    if(FileTell(g_ranges)==0)
      FileWrite(g_ranges,"range_id,side,open_ts,close_ts,mfe_pips,mae_pips,pnl_total_pips");
  }
}

void ExportRangeClose(){
  if(!InpExportCSVs) return;
  EnsureRangesCSV();

  // Precio en el momento del cierre (lado del rango)
  double last=(g_rng.side=="BUY"? PriceBid(): PriceAsk());
  double pnl_tot=0.0;

  for(int i=0;i<g_rng.legs_n;i++){
    double pnl = (g_rng.side=="BUY"? Pips(g_rng.legs[i].open_price,last)
                                   : Pips(last,g_rng.legs[i].open_price));
    pnl_tot += pnl * g_rng.legs[i].vol;
  }
  FileWrite(g_ranges,"rng",g_rng.side,
            TimeToString(g_rng.ts_open_msg, TIME_DATE|TIME_SECONDS),
            TimeToString(g_rng.ts_close_msg, TIME_DATE|TIME_SECONDS),
            DoubleToString(g_rng.mfe_pips,2),
            DoubleToString(g_rng.mae_pips,2),
            DoubleToString(pnl_tot,2));
}

void CloseAll(){
  trade.SetExpertMagicNumber(InpMagic);

  for(int i=(int)PositionsTotal()-1;i>=0;i--){
    if(!PosSelectByIndex(i)) continue;
    if((long)PositionGetInteger(POSITION_MAGIC)!=InpMagic) continue;
    if((string)PositionGetString(POSITION_SYMBOL)!=InpSymbol) continue;
    trade.PositionClose((ulong)PositionGetInteger(POSITION_TICKET), 100);
  }

  for(int j=(int)OrdersTotal()-1;j>=0;j--){
    ulong ticket=OrderGetTicket(j);
    if(ticket==0) continue;
    if(!OrderSelect(ticket)) continue;
    if((long)OrderGetInteger(ORDER_MAGIC)!=InpMagic) continue;
    if((string)OrderGetString(ORDER_SYMBOL)!=InpSymbol) continue;
    trade.OrderDelete(ticket);
  }
}

void CloseRange(const EventRow &ev){
  if(!g_rng.open) return;
  g_rng.ts_close_msg=ev.ts + InpLatencySeconds;

  ExportRangeClose();
  CloseAll();

  if(InpDrawGraphics){
    double p0=g_rng.entry_price + 50*g_pip;
    double p1=g_rng.entry_price - 50*g_pip;
    string nm = StringFormat("RANGE_%s", TimeToString(g_rng.ts_close_msg, TIME_DATE|TIME_SECONDS));
    ObjectCreate(0,nm,OBJ_RECTANGLE,0, g_rng.ts_open_msg,p0, g_rng.ts_close_msg,p1);
    ObjectSetInteger(0,nm,OBJPROP_BACK,true);
    ObjectSetInteger(0,nm,OBJPROP_FILL,true);
  }

  ZeroMemory(g_rng);
  g_rng.open=false;
}

//============================= Estado en tick =======================
void UpdateMFE_MAE(){
  if(!g_rng.open) return;
  double last=(g_rng.side=="BUY"? PriceBid(): PriceAsk());
  double pnl=Pips(g_rng.entry_price,last);
  if(g_rng.side=="SELL") pnl=-pnl;
  if(pnl>g_rng.mfe_pips) g_rng.mfe_pips=pnl;
  if(pnl<g_rng.mae_pips) g_rng.mae_pips=pnl;
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

    string sym   = (string)HistoryDealGetString(deal, DEAL_SYMBOL);
    long   magic = (long)HistoryDealGetInteger(deal, DEAL_MAGIC);
    long   entry = (long)HistoryDealGetInteger(deal, DEAL_ENTRY);

    if(sym!=InpSymbol || magic!=InpMagic || entry!=DEAL_ENTRY_IN) return;

    string cm    = (string)HistoryDealGetString(deal, DEAL_COMMENT);
    double vol   = HistoryDealGetDouble(deal, DEAL_VOLUME);
    double price = HistoryDealGetDouble(deal, DEAL_PRICE);
    datetime t   = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);

    // Registrar entradas de rejilla y S00 (L00 ya se registra en OpenL00)
    if(StringFind(cm, "grid_L", 0)==0 || StringFind(cm, COMMENT_S00, 0)==0){
      int n = g_rng.legs_n;
      if(n < ArraySize(g_rng.legs)){
        g_rng.legs[n].name       = cm;
        g_rng.legs[n].vol        = vol;
        g_rng.legs[n].open_price = price;
        g_rng.legs[n].ts_open    = t;
        g_rng.legs_n = n+1;
      }
    }
  }
}

//============================= Eventos EA ===========================
int OnInit(){
  g_digits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
  g_pip=InpPipSize;
  g_slip_pts=InpSlippagePips*g_pip;

  if(!SymbolSelect(InpSymbol,true)){
    Print("No se pudo seleccionar ",InpSymbol);
    return INIT_FAILED;
  }

  // Offset horario coherente con el histÃ³rico del tester
  g_serverOffsetSec = (int)((long)TimeCurrent() - (long)TimeGMT());

  // Aviso si sÃ­mbolo del grÃ¡fico â‰  InpSymbol
  string chart_sym = Symbol();
  if(chart_sym != InpSymbol){
    PrintFormat("AVISO: el EA corre sobre '%s' pero InpSymbol='%s'. "
                "En tester, usa el mismo sÃ­mbolo o cambia InpSymbol.",
                chart_sym, InpSymbol);
  }

  // Debug inicial
  if(InpVerbose) PrintFormat("INIT: sÃ­mbolo chart='%s' | InpSymbol='%s' | digits=%d | pip=%.5f | slip_pts=%.5f",
    Symbol(), InpSymbol, g_digits, g_pip, g_slip_pts);
  if(InpVerbose) PrintFormat("INIT: serverOffsetSec = TimeCurrent(%s) - TimeGMT(%s) = %d s",
    TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS),
    TimeToString(TimeGMT(), TIME_DATE|TIME_SECONDS),
    g_serverOffsetSec);
  if(InpVerbose) PrintFormat("INIT: Intentando abrir CSV '%s' en MQL5/Files (tester)", InpCsvFileName);

  // Requerir HEDGING en el tester (opcional)
  if(InpRequireHedging){
    ENUM_ACCOUNT_MARGIN_MODE mm = (ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE);
    if(mm==ACCOUNT_MARGIN_MODE_RETAIL_NETTING || mm==ACCOUNT_MARGIN_MODE_EXCHANGE){
      Print("ERROR: La cuenta del Strategy Tester estÃ¡ en modo NETTING. Activa 'Hedging' para este EA.");
      return INIT_FAILED;
    }
  }

  // Cargar CSV
  if(!LoadEvents()){
    Print("CSV vacÃ­o o invÃ¡lido");
    return INIT_FAILED;
  }

  // ------------------------------------------------------------------
  // Initialize variable grid schedule and cumulative distances
  // If no schedule entries are parsed, use a single bracket with InpStepPips as step
  ArrayResize(g_schedLimits, 0);
  ArrayResize(g_schedSteps, 0);
  ArrayResize(g_levelDistPips, 0);
  g_levelDistCount = 0;
  // Parse schedule string into pairs
  string pairs[];
  int npairs = StringSplit(InpGridSchedule, ',', pairs);
  for(int i=0; i<npairs; i++){
    string kv[];
    int nkv = StringSplit(StringTrim(pairs[i]), ':', kv);
    if(nkv >= 2){
      string sLimit = StringTrim(kv[0]);
      string sStep  = StringTrim(kv[1]);
      double limitVal;
      if(sLimit == "inf" || sLimit == "INF" || sLimit == "Inf")
        limitVal = DBL_MAX;
      else
        limitVal = StrToDouble(sLimit);
      double stepVal = StrToDouble(sStep);
      int idx = ArraySize(g_schedLimits);
      ArrayResize(g_schedLimits, idx + 1);
      ArrayResize(g_schedSteps, idx + 1);
      g_schedLimits[idx] = limitVal;
      g_schedSteps[idx]  = stepVal;
    }
  }
  // Fallback to single bracket if none defined
  if(ArraySize(g_schedLimits) == 0){
    ArrayResize(g_schedLimits, 1);
    ArrayResize(g_schedSteps, 1);
    g_schedLimits[0] = DBL_MAX;
    g_schedSteps[0]  = InpStepPips;
  }
  // Build cumulative distances for each level
  double dist = 0.0;
  for(int lvl = 1; lvl <= InpMaxLevels; lvl++){
    // Determine step for current distance
    double stepPips = 0.0;
    int nSched = ArraySize(g_schedLimits);
    for(int j = 0; j < nSched; j++){
      if(dist < g_schedLimits[j]){
        stepPips = g_schedSteps[j];
        break;
      }
    }
    if(nSched > 0 && stepPips <= 0.0)
      stepPips = g_schedSteps[nSched - 1];
    // Break if step is zero
    if(stepPips <= 0.0)
      break;
    // Cap cumulative distance
    if(dist + stepPips > InpMaxAdversePips)
      break;
    dist += stepPips;
    int idx2 = ArraySize(g_levelDistPips);
    ArrayResize(g_levelDistPips, idx2 + 1);
    g_levelDistPips[idx2] = dist;
    g_levelDistCount++;
  }

  g_ev_idx=0;
  ZeroMemory(g_rng);
  return INIT_SUCCEEDED;
}

void OnDeinit(const int reason){
  if(g_ranges!=INVALID_HANDLE){ FileClose(g_ranges); g_ranges=INVALID_HANDLE; }
}

void OnTick(){
  datetime now=TimeCurrent();

  // Disparar eventos segÃºn su timestamp (con latencia aplicada al trigger)
  while(g_ev_idx<ArraySize(g_events)){
    datetime t = g_events[g_ev_idx].ts + InpLatencySeconds;
    if(t>now) break;

    if(InpVerbose){
        if(g_events[g_ev_idx].kind=="range_open")
          PrintFormat("TRIGGER OPEN %s @ %s",
                      g_events[g_ev_idx].side,
                      TimeToString(g_events[g_ev_idx].ts, TIME_DATE|TIME_SECONDS));
        else if(g_events[g_ev_idx].kind=="range_close")
          PrintFormat("TRIGGER CLOSE @ %s",
                      TimeToString(g_events[g_ev_idx].ts, TIME_DATE|TIME_SECONDS));
    }

    if(g_events[g_ev_idx].kind=="range_open")
      OpenRange(g_events[g_ev_idx]);
    else if(g_events[g_ev_idx].kind=="range_close")
      CloseRange(g_events[g_ev_idx]);

    g_ev_idx++;
  }

  if(g_rng.open){
    UpdateMFE_MAE();
    UpdateTrailingL00();
    CloseTargetsAndRecycle();
    RebuildGrid();
  }
}
