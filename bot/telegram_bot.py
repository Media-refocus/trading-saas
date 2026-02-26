"""
telegram_bot.py - Bot de Telegram para notificaciones y control

Permite:
- Recibir notificaciones de trades abiertos/cerrados
- Enviar comandos para controlar el bot
- Ver estado y estadísticas desde Telegram

Configuración necesaria en config.json:
{
    "telegramBotToken": "123456789:ABCdef...",
    "telegramChatId": "tu_chat_id"
}

Para crear el bot:
1. Abre @BotFather en Telegram
2. Envía /newbot y sigue las instrucciones
3. Copia el token a config.json

Para obtener tu Chat ID:
1. Abre @userinfobot en Telegram
2. Te enviará tu ID
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Optional, Callable

# Telegram bot library
try:
    from telegram import Update
    from telegram.ext import Application, CommandHandler, ContextTypes
    TELEGRAM_AVAILABLE = True
except ImportError:
    TELEGRAM_AVAILABLE = False
    print("⚠️ python-telegram-bot no instalado. Ejecuta: pip install python-telegram-bot")

log = logging.getLogger("telegram_bot")


class TelegramBot:
    """
    Bot de Telegram para notificaciones y control del trading bot.

    Uso:
        bot = TelegramBot(token="...", chat_id="...", saas_client=client)

        # Enviar notificación
        await bot.send_message("🟢 NUEVA POSICIÓN: BUY XAUUSD @ 2650")

        # Iniciar bot (para recibir comandos)
        bot.start()
    """

    def __init__(
        self,
        token: str,
        chat_id: str,
        saas_client=None,
        on_pause: Optional[Callable] = None,
        on_resume: Optional[Callable] = None,
        on_close_all: Optional[Callable] = None,
    ):
        if not TELEGRAM_AVAILABLE:
            raise ImportError("python-telegram-bot no está instalado")

        self.token = token
        self.chat_id = chat_id
        self.saas_client = saas_client
        self.on_pause = on_pause
        self.on_resume = on_resume
        self.on_close_all = on_close_all

        self.application: Optional[Application] = None
        self._running = False

        log.info(f"TelegramBot inicializado para chat {chat_id}")

    # ==================== SENDING MESSAGES ====================

    async def send_message(self, text: str, parse_mode: Optional[str] = "HTML"):
        """
        Envía un mensaje al chat configurado.
        """
        if not self.application:
            log.error("Bot no iniciado. Llama a start() primero.")
            return False

        try:
            await self.application.bot.send_message(
                chat_id=self.chat_id,
                text=text,
                parse_mode=parse_mode,
            )
            return True
        except Exception as e:
            log.error(f"Error enviando mensaje: {e}")
            return False

    # ==================== NOTIFICATION HELPERS ====================

    async def notify_trade_open(
        self,
        symbol: str,
        side: str,
        price: float,
        lot: float,
        level: int,
        ticket: int,
    ):
        """Notifica un trade abierto."""
        emoji = "🟢" if side == "BUY" else "🔴"
        level_text = "Entry" if level == 0 else f"Grid L{level}"

        message = f"""{emoji} <b>NUEVA POSICIÓN</b>

<b>{side}</b> {symbol}
📊 Precio: {price:.2f}
📈 Lote: {lot}
🎯 Nivel: {level_text}
🎫 Ticket: #{ticket}
⏰ {datetime.now().strftime("%H:%M:%S")}"""
        await self.send_message(message)

    async def notify_trade_close(
        self,
        symbol: str,
        side: str,
        close_price: float,
        profit: float,
        pips: float,
        reason: str,
        ticket: int,
    ):
        """Notifica un trade cerrado."""
        emoji = "💰" if profit >= 0 else "📉"
        profit_str = f"+${profit:.2f}" if profit >= 0 else f"-${abs(profit):.2f}"
        pips_str = f"+{pips:.1f}" if pips >= 0 else f"{pips:.1f}"

        message = f"""{emoji} <b>POSICIÓN CERRADA</b>

<b>{side}</b> {symbol}
📊 Precio: {close_price:.2f}
💵 P&L: {profit_str}
📈 Pips: {pips_str}
📝 Razón: {reason}
🎫 Ticket: #{ticket}
⏰ {datetime.now().strftime("%H:%M:%S")}"""
        await self.send_message(message)

    async def notify_signal(
        self,
        side: str,
        symbol: str,
        message_text: str,
        action: str = "EJECUTAR",
    ):
        """Notifica una señal recibida."""
        emoji = "📥" if action == "EJECUTAR" else "⏭️"

        msg = f"""{emoji} <b>SEÑAL RECIBIDA</b>

<b>{side}</b> {symbol}
📝 {message_text[:100]}
🎯 Acción: {action}
⏰ {datetime.now().strftime("%H:%M:%S")}"""
        await self.send_message(msg)

    async def notify_alert(self, title: str, message: str, level: str = "WARNING"):
        """Envía una alerta."""
        emojis = {
            "WARNING": "⚠️",
            "ERROR": "❌",
            "INFO": "ℹ️",
            "SUCCESS": "✅",
        }
        emoji = emojis.get(level, "⚠️")

        msg = f"""{emoji} <b>{title}</b>

{message}
⏰ {datetime.now().strftime("%H:%M:%S")}"""
        await self.send_message(msg)

    # ==================== COMMAND HANDLERS ====================

    async def _cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Maneja el comando /start"""
        if str(update.effective_chat.id) != self.chat_id:
            await update.message.reply_text("⛔ No autorizado")
            return

        welcome = """🤖 <b>Trading Bot Control</b>

Comandos disponibles:

/status - Ver estado del bot
/stats - Ver estadísticas del día
/pause - Pausar el bot
/resume - Reanudar el bot
/close_all - Cerrar todas las posiciones
/help - Ver esta ayuda

El bot te notificará automáticamente cuando:
• Se abra una nueva posición
• Se cierre una posición
• Se reciba una señal
• Hay alertas o errores"""
        await update.message.reply_text(welcome, parse_mode="HTML")

    async def _cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Maneja el comando /help"""
        await self._cmd_start(update, context)

    async def _cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Maneja el comando /status"""
        if str(update.effective_chat.id) != self.chat_id:
            return

        if not self.saas_client:
            await update.message.reply_text("❌ SaaS client no configurado")
            return

        try:
            # Obtener estado del SaaS
            config = self.saas_client.get_config()

            # Status emoji
            status_emoji = "🟢" if self.saas_client._config else "🔴"

            message = f"""{status_emoji} <b>Estado del Bot</b>

📊 <b>Configuración:</b>
• Symbol: {config.symbol}
• Magic: {config.magic_number}
• Entry Lot: {config.entry_lot}
• Grid Step: {config.grid_step_pips} pips

👤 <b>Cuentas:</b> {len(config.accounts)} configuradas

⏰ {datetime.now().strftime("%d/%m %H:%M:%S")}"""
            await update.message.reply_text(message, parse_mode="HTML")

        except Exception as e:
            await update.message.reply_text(f"❌ Error obteniendo estado: {e}")

    async def _cmd_stats(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Maneja el comando /stats"""
        if str(update.effective_chat.id) != self.chat_id:
            return

        # TODO: Implementar llamada a /api/bot/stats
        await update.message.reply_text(
            "📊 <b>Estadísticas</b>\n\n"
            "Ver detalles en el dashboard web.\n"
            "Próximamente: stats completas por aquí.",
            parse_mode="HTML"
        )

    async def _cmd_pause(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Maneja el comando /pause"""
        if str(update.effective_chat.id) != self.chat_id:
            return

        if self.on_pause:
            self.on_pause()
            await update.message.reply_text(
                "⏸️ <b>Bot pausado</b>\n\n"
                "No se abrirán nuevas posiciones.\n"
                "Las posiciones actuales se mantienen.",
                parse_mode="HTML"
            )
        else:
            await update.message.reply_text("❌ Función de pausa no configurada")

    async def _cmd_resume(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Maneja el comando /resume"""
        if str(update.effective_chat.id) != self.chat_id:
            return

        if self.on_resume:
            self.on_resume()
            await update.message.reply_text(
                "▶️ <b>Bot reanudado</b>\n\n"
                "El bot volverá a operar normalmente.",
                parse_mode="HTML"
            )
        else:
            await update.message.reply_text("❌ Función de reanudar no configurada")

    async def _cmd_close_all(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Maneja el comando /close_all"""
        if str(update.effective_chat.id) != self.chat_id:
            return

        if self.on_close_all:
            await update.message.reply_text(
                "🔴 <b>Cerrando todas las posiciones...</b>\n\n"
                "Se enviarán órdenes de cierre para todas las posiciones abiertas.",
                parse_mode="HTML"
            )
            self.on_close_all()
        else:
            await update.message.reply_text("❌ Función close_all no configurada")

    # ==================== LIFECYCLE ====================

    def start(self):
        """Inicia el bot de Telegram."""
        if self._running:
            log.warning("Bot ya está corriendo")
            return

        # Crear aplicación
        self.application = Application.builder().token(self.token).build()

        # Registrar comandos
        self.application.add_handler(CommandHandler("start", self._cmd_start))
        self.application.add_handler(CommandHandler("help", self._cmd_help))
        self.application.add_handler(CommandHandler("status", self._cmd_status))
        self.application.add_handler(CommandHandler("stats", self._cmd_stats))
        self.application.add_handler(CommandHandler("pause", self._cmd_pause))
        self.application.add_handler(CommandHandler("resume", self._cmd_resume))
        self.application.add_handler(CommandHandler("close_all", self._cmd_close_all))

        # Iniciar en background
        self.application.run_polling(allowed_updates=Update.ALL_TYPES)
        self._running = True

        log.info("Telegram Bot iniciado")

    def stop(self):
        """Detiene el bot."""
        if self.application:
            self.application.stop()
        self._running = False
        log.info("Telegram Bot detenido")


# ==================== INTEGRATION HELPER ====================

def create_telegram_bot_from_config(config: dict, saas_client=None, **callbacks):
    """
    Crea un TelegramBot desde configuración.

    Args:
        config: Dict con telegramBotToken y telegramChatId
        saas_client: Cliente SaaS para obtener estado
        callbacks: on_pause, on_resume, on_close_all

    Returns:
        TelegramBot o None si no está configurado
    """
    token = config.get("telegramBotToken")
    chat_id = config.get("telegramChatId")

    if not token or not chat_id:
        log.info("Telegram Bot no configurado (falta token o chat_id)")
        return None

    return TelegramBot(
        token=token,
        chat_id=chat_id,
        saas_client=saas_client,
        on_pause=callbacks.get("on_pause"),
        on_resume=callbacks.get("on_resume"),
        on_close_all=callbacks.get("on_close_all"),
    )
