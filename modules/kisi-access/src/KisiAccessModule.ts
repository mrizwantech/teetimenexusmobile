import { NativeModule, requireOptionalNativeModule } from 'expo';

import { KisiAccessModuleEvents, KisiDeviceCredential } from './KisiAccess.types';

declare class KisiAccessModule extends NativeModule<KisiAccessModuleEvents> {
  initialize(partnerId: number, credential: KisiDeviceCredential): Promise<void>;
  clearCredentials(): Promise<void>;
  startReaderScan(): Promise<void>;
  stopReaderScan(): Promise<void>;
  proximityProof(lockId: number): Promise<string>;
}

export default requireOptionalNativeModule<KisiAccessModule>('KisiAccess');
