export type BotOnboardingState =
  | "MANUAL_ONLY"
  | "AUTH_PENDING_CODE"
  | "ONBOARDING_LOCKED"
  | "AUTO_READY"
  | "FAILED";

export type Bot = {
  id: string;
  name: string;
  steamId: string;
  accountName: string;
  tradeToken: string | null;
  sharedSecret?: string | null;
  identitySecret?: string | null;
  revocationCode?: string | null;
  onboardingState?: BotOnboardingState;
  onboardingStartedAt?: Date | null;
  tradeLockedUntil?: Date | null;
};

export type BotSession = {
  botId: string;
  sessionToken: string;
  webCookies: string[];
  expiresAt: Date;
  lastCheckedAt: Date | null;
};

export type BotSessionStatus = {
  bot: Bot;
  hasSession: boolean;
  isValid: boolean;
  expiresAt: Date | null;
  lastCheckedAt: Date | null;
};

export function getBotTradeAutomationMode(bot: Bot): "AUTO" | "MANUAL" {
  return bot.sharedSecret ? "AUTO" : "MANUAL";
}

export function getBotTradeReadiness(
  bot: Bot,
  now: Date = new Date()
): { onboardingState: BotOnboardingState; tradable: boolean } {
  const storedState: BotOnboardingState = bot.onboardingState ?? (bot.sharedSecret ? "AUTO_READY" : "MANUAL_ONLY");
  let onboardingState = storedState;

  if (
    storedState === "ONBOARDING_LOCKED" &&
    bot.tradeLockedUntil &&
    bot.tradeLockedUntil.getTime() <= now.getTime()
  ) {
    onboardingState = "AUTO_READY";
  }

  if (!bot.sharedSecret && onboardingState === "AUTO_READY") {
    onboardingState = "MANUAL_ONLY";
  }

  return {
    onboardingState,
    tradable: onboardingState !== "ONBOARDING_LOCKED" && onboardingState !== "AUTH_PENDING_CODE",
  };
}
