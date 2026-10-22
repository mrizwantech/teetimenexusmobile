export type PushPermission = 'not-determined' | 'denied' | 'authorized' | 'provisional' | 'unsupported';

export type PushState = {
  permission: PushPermission;
  token: string | null;
  notice?: string;
  connectionError?: string;
};

export type PushMessage = {
  id?: string;
  sentAt?: number;
  title?: string;
  body?: string;
  route?: unknown;
};

export type PushListeners = {
  onMessage: (message: PushMessage) => void;
  onOpen: (message: PushMessage) => boolean | void;
  onTokenRefresh: () => void;
};
