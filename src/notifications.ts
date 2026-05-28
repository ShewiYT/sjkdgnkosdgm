import type { NotificationSettings } from './types';

// Send notification to Telegram
async function sendTelegram(settings: NotificationSettings, message: string): Promise<boolean> {
  if (!settings.enableTelegram || !settings.telegramBotToken || !settings.telegramAdminId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.telegramAdminId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

// Send notification to Discord webhook
async function sendDiscord(settings: NotificationSettings, message: string): Promise<boolean> {
  if (!settings.enableDiscord || !settings.discordWebhookUrl) return false;
  try {
    const res = await fetch(settings.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        username: 'SukaCombine Bot',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Unified notification sender
export async function sendNotification(settings: NotificationSettings, message: string, discordMsg?: string): Promise<void> {
  const promises: Promise<boolean>[] = [];
  if (settings.enableTelegram) {
    promises.push(sendTelegram(settings, message));
  }
  if (settings.enableDiscord) {
    promises.push(sendDiscord(settings, discordMsg || message.replace(/<[^>]*>/g, '')));
  }
  await Promise.allSettled(promises);
}

// Notification templates
export const NotificationTemplates = {
  accountsLoaded: (count: number) =>
    `🔄 <b>Загружены аккаунты</b>\nКоличество: <b>${count}</b> шт.`,

  newMessage: (senderName: string, steamId: string, preview: string) =>
    `💬 <b>Новое сообщение</b>\nОт: <b>${senderName}</b> (${steamId})\nСообщение: ${preview.substring(0, 100)}`,

  friendsProcessStart: (accountLogin: string, totalFriends: number) =>
    `👥 <b>Добавление в друзья начато</b>\nАккаунт: <b>${accountLogin}</b>\nОтправка запросов: ${totalFriends}`,

  friendsProcessEnd: (accountLogin: string, sent: number, accepted: number) =>
    `✅ <b>Добавление в друзья окончено</b>\nАккаунт: <b>${accountLogin}</b>\nОтправлено запросов: <b>${sent}</b>\nПриняли на данный момент: <b>${accepted}</b>`,

  accountLogin: (login: string, status: string) =>
    `🔑 <b>Вход в аккаунт</b>\nЛогин: <b>${login}</b>\nСтатус: ${status === 'online' ? '✅ Успешно' : '❌ Ошибка'}`,

  accountError: (login: string, error: string) =>
    `⚠️ <b>Ошибка аккаунта</b>\nЛогин: <b>${login}</b>\nОшибка: ${error}`,

  spamStarted: (accountLogin: string, targetCount: number) =>
    `📨 <b>Спам рассылка начата</b>\nАккаунт: <b>${accountLogin}</b>\nЦелей: ${targetCount}`,

  spamFinished: (accountLogin: string, sent: number, failed: number) =>
    `📩 <b>Спам рассылка завершена</b>\nАккаунт: <b>${accountLogin}</b>\nОтправлено: <b>${sent}</b>\nОшибок: <b>${failed}</b>`,

  tradeOffer: (partnerName: string, itemsCount: number) =>
    `📦 <b>Новый трейд оффер</b>\nОт: <b>${partnerName}</b>\nПредметов: ${itemsCount}`,
};

// Discord-friendly versions (no HTML tags)
export const DiscordTemplates = {
  accountsLoaded: (count: number) =>
    `🔄 **Загружены аккаунты**\nКоличество: **${count}** шт.`,

  newMessage: (senderName: string, steamId: string, preview: string) =>
    `💬 **Новое сообщение**\nОт: **${senderName}** (${steamId})\nСообщение: ${preview.substring(0, 100)}`,

  friendsProcessStart: (accountLogin: string, totalFriends: number) =>
    `👥 **Добавление в друзья начато**\nАккаунт: **${accountLogin}**\nОтправка запросов: ${totalFriends}`,

  friendsProcessEnd: (accountLogin: string, sent: number, accepted: number) =>
    `✅ **Добавление в друзья окончено**\nАккаунт: **${accountLogin}**\nОтправлено запросов: **${sent}**\nПриняли на данный момент: **${accepted}**`,

  accountLogin: (login: string, status: string) =>
    `🔑 **Вход в аккаунт**\nЛогин: **${login}**\nСтатус: ${status === 'online' ? '✅ Успешно' : '❌ Ошибка'}`,

  accountError: (login: string, error: string) =>
    `⚠️ **Ошибка аккаунта**\nЛогин: **${login}**\nОшибка: ${error}`,

  spamStarted: (accountLogin: string, targetCount: number) =>
    `📨 **Спам рассылка начата**\nАккаунт: **${accountLogin}**\nЦелей: ${targetCount}`,

  spamFinished: (accountLogin: string, sent: number, failed: number) =>
    `📩 **Спам рассылка завершена**\nАккаунт: **${accountLogin}**\nОтправлено: **${sent}**\nОшибок: **${failed}**`,

  tradeOffer: (partnerName: string, itemsCount: number) =>
    `📦 **Новый трейд оффер**\nОт: **${partnerName}**\nПредметов: ${itemsCount}`,
};
