import type { PushMessage } from './types';

export function toPushMessage(message: {
  messageId?: string;
  sentTime?: number;
  notification?: { title?: string; body?: string };
  data?: { [key: string]: string | object };
}): PushMessage {
  return {
    id: message.messageId,
    sentAt: message.sentTime,
    title: message.notification?.title,
    body: message.notification?.body,
    route: message.data?.route,
  };
}
