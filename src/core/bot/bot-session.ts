export type Bot = {
  id: string;
  name: string;
  steamId: string;
  accountName: string;
  tradeToken: string | null;
  sharedSecret?: string | null;
  identitySecret?: string | null;
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
