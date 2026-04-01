const TelegramBot = require('node-telegram-bot-api');

let bot = null;

if (process.env.ENABLE_TELEGRAM === 'true' && process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
}

async function sendToTelegram(asset, briefText) {
  if (!bot) {
    console.log('[Telegram] Bot is disabled or missing token. Skipping Telegram delivery.');
    return;
  }

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.log('[Telegram] Missing TELEGRAM_CHAT_ID. Skipping Telegram delivery.');
    return;
  }

  try {
    // Format output with code blocks or pure Markdown
    // Telegram API restricts some markdown, we'll use HTML mode mostly or basic Markdown
    await bot.sendMessage(chatId, `⚡ <b>CryptoScope Alert: ${asset}</b>\n\n${briefText}`, {
      parse_mode: 'HTML'
    });
    console.log(`[Telegram] Brief sent to Telegram chat ${chatId}`);
  } catch (error) {
    console.error('[Telegram] Failed to send message:', error.message);
  }
}

module.exports = { sendToTelegram };
