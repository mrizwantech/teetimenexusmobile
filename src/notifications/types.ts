export type PushPermission = 'not-determined' | 'denied' | 'authorized' | 'provisional' | 'unsupported';

export type PushState = {
  permission: PushPermission;
  token: string | null;
  notice?: string;
  connectionError?: string;
};

export type PushMessage = {
  title?: string;
  body?: string;
  route?: unknown;
};

export type PushListeners = {
  onMessage: (message: PushMessage) => void;
  onOpen: (message: PushMessage) => void;
  onTokenRefresh: () => void;
};
