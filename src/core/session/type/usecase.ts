import type { BotOnboardingState } from "./session";

export type BotDeclarationAccount = {
  alias: string;
  steamId: string;
  account: string;
  password: string;
};

export type BotTradeSecretsDeclaration = {
  sharedSecret?: string;
  identitySecret?: string;
};

export type BotSyncResult = {
  total: number;
  succeeded: number;
  failed: number;
  rows: Array<{
    alias: string;
    steamId: string;
    status: "ok" | "error";
    message: string;
  }>;
};

export type BotSecretSyncResult = {
  total: number;
  updated: number;
  failed: number;
  rows: Array<{
    steamId: string;
    status: "updated" | "error";
    message: string;
  }>;
};

export type BotAuthenticatorBootstrapResult = {
  botName: string;
  steamId: string;
  onboardingState: BotOnboardingState;
  tradable: boolean;
  tradeLockedUntil: Date;
  revocationCode: string;
};
