export type KisiDeviceCredential = {
  organizationId: number;
  loginId: number;
  secret: string;
  phoneKey: string;
  onlineCertificate: string;
  validFrom: number;
  validUntil: number;
};

export type KisiAccessModuleEvents = {
  onUnlock: (params: { success: boolean; error?: string }) => void;
  onReaderError: (params: { message: string }) => void;
};
