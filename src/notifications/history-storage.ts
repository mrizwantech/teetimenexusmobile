export function readNotificationHistory(owner: string): string | null {
  return localStorage.getItem(`ttn-notification-history-${owner}`);
}

export function writeNotificationHistory(owner: string, value: string): void {
  localStorage.setItem(`ttn-notification-history-${owner}`, value);
}
