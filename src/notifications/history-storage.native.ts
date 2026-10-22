import { File, Paths } from 'expo-file-system';

function historyFile(owner: string) {
  return new File(Paths.document, `ttn-notification-history-${owner}.json`);
}

export function readNotificationHistory(owner: string): string | null {
  const file = historyFile(owner);
  return file.exists ? file.textSync() : null;
}

export function writeNotificationHistory(owner: string, value: string): void {
  historyFile(owner).write(value);
}
