const notificationRoutes = ['/', '/book', '/membership', '/reservations', '/account', '/notifications'] as const;
export type NotificationRoute = typeof notificationRoutes[number];

export function getNotificationRoute(value: unknown): NotificationRoute | null {
  return notificationRoutes.find((route) => route === value) ?? null;
}
