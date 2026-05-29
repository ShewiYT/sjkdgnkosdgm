import type { NotificationSettings } from './types';

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

export const NotificationTemplates = {
  accountsLoaded: (count: number) =>
    `🔄 <b>Загружены аккаунты</b>\nКоличество: <b>${count}</b> шт.`,
  newMessage: (senderName: string, steamId: string, preview: string) =>
    `💬 <b>Новое сообщение</b>\nОт: <b>${senderName}</b> (${steamId})\nСообщение: ${preview.substring(0, 100)}`,
  accountLogin: (login: string, status: string) =>
    `🔑 <b>Вход в аккаунт</b>\nЛогин: <b>${login}</b>\nСтатус: ${status === 'online' ? '✅ Успешно' : '❌ Ошибка'}`,
  accountError: (login: string, error: string) =>
    `⚠️ <b>Ошибка аккаунта</b>\nЛогин: <b>${login}</b>\nОшибка: ${error}`,
  friendRequestSent: (login: string, target: string) =>
    `👤 <b>Запрос в друзья</b>\nОт: <b>${login}</b>\nКому: ${target}`,
};

export const DiscordTemplates = {
  accountsLoaded: (count: number) =>
    `🔄 **Загружены аккаунты**\nКоличество: **${count}** шт.`,
  newMessage: (senderName: string, steamId: string, preview: string) =>
    `💬 **Новое сообщение**\nОт: **${senderName}** (${steamId})\nСообщение: ${preview.substring(0, 100)}`,
  accountLogin: (login: string, status: string) =>
    `🔑 **Вход в аккаунт**\nЛогин: **${login}**\nСтатус: ${status === 'online' ? '✅ Успешно' : '❌ Ошибка'}`,
  accountError: (login: string, error: string) =>
    `⚠️ **Ошибка аккаунта**\nЛогин: **${login}**\nОшибка: ${error}`,
  friendRequestSent: (login: string, target: string) =>
    `👤 **Запрос в друзья**\nОт: **${login}**\nКому: ${target}`,
};
