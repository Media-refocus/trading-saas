/**
 * Inicialización del servidor
 *
 * Con SQLite como cache de ticks:
 * - No necesitamos precargar nada en memoria
 * - Los ticks se consultan directamente desde la BD
 * - Bajo uso de memoria (~50MB vs ~1GB)
 * - Arranque instantáneo
 */

export async function register() {
  // Solo ejecutar en el servidor, no en edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Server] ========================================");
    console.log("[Server] Trading Bot SaaS - Backtester");
    console.log("[Server] ========================================");
    console.log("[Server] Arquitectura: SQLite para ticks");
    console.log("[Server] Memoria estimada: ~50MB");
    console.log("[Server] Listo para recibir peticiones.");
    console.log("[Server] ========================================");
  }
}
