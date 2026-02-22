import type { SteamAuthResult, SteamGuardPrompts } from "../type/auth";

export interface SteamAuthGateway {
  authenticateWithCredentials(input: {
    accountName: string;
    password: string;
    prompts: SteamGuardPrompts;
  }): Promise<SteamAuthResult>;
}
