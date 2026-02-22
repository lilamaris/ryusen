import type { SteamGuardPrompts, SteamTwoFactorBootstrapResult } from "../type/auth";

export interface SteamMobileAuthGateway {
  enableAndFinalizeTwoFactor(input: {
    accountName: string;
    password: string;
    prompts: SteamGuardPrompts;
    requestActivationCode: (message: string) => Promise<string>;
  }): Promise<SteamTwoFactorBootstrapResult>;
}
