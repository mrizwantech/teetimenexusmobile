import { NativeModule, requireOptionalNativeModule } from 'expo';

import { KisiAccessModuleEvents, KisiDeviceCredential } from './KisiAccess.types';

declare class KisiAccessModule extends NativeModule<KisiAccessModuleEvents> {
  initialize(partnerId: number, credential: KisiDeviceCredential): Promise<void>;
  clearCredentials(): Promise<void>;
}

export default requireOptionalNativeModule<KisiAccessModule>('KisiAccess');
