export type SteamAuthResult = {
  sessionToken: string;
  webCookies: string[];
  expiresAt: Date;
};

export type SteamGuardPrompts = {
  requestGuardCode(message: string): Promise<string>;
  notifyPendingConfirmation(message: string): Promise<void>;
};

export type SteamTwoFactorBootstrapResult = {
  sharedSecret: string;
  identitySecret: string;
  revocationCode: string;
};
