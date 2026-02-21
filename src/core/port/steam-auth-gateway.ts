export type SteamAuthResult = {
  sessionToken: string;
  webCookies: string[];
  expiresAt: Date;
};

export type SteamGuardPrompts = {
  requestGuardCode(message: string): Promise<string>;
  notifyPendingConfirmation(message: string): Promise<void>;
};

export interface SteamAuthGateway {
  authenticateWithCredentials(input: {
    accountName: string;
    password: string;
    prompts: SteamGuardPrompts;
  }): Promise<SteamAuthResult>;
}
