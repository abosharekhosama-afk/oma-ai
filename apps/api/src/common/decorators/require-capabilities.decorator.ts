import { SetMetadata } from '@nestjs/common';

export const REQUIRE_CAPABILITIES_KEY = 'require_capabilities';
export const RequireCapabilities = (...codes: string[]) =>
  SetMetadata(REQUIRE_CAPABILITIES_KEY, codes);
