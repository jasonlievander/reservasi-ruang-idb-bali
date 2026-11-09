import type { Role } from "@prisma/client";

export type SsoIdentity = {
  email: string;
  name: string;
  role?: Role;
};

export type SsoProvider = {
  getAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<SsoIdentity>;
};

export function getSsoProvider(): SsoProvider | null {
  return null;
}
