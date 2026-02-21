export type Bot = {
  id: string;
  name: string;
  steamId: string;
};

export type BotSession = {
  botId: string;
  sessionToken: string;
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
