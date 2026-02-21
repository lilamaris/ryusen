import type { SteamGuardPrompts } from "./steam-auth-gateway";

export type SteamTwoFactorBootstrapResult = {
  sharedSecret: string;
  identitySecret: string;
  revocationCode: string;
};

export interface SteamMobileAuthGateway {
  enableAndFinalizeTwoFactor(input: {
    accountName: string;
    password: string;
    prompts: SteamGuardPrompts;
    requestActivationCode: (message: string) => Promise<string>;
  }): Promise<SteamTwoFactorBootstrapResult>;
}
