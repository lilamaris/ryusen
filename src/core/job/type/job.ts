export type JobType = "TRADE_OFFER_CREATE";

export type JobStatus =
  | "PENDING"
  | "RUNNING"
  | "RETRY_WAIT"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED";

export type TradeOfferCreateJobPayload = {
  fromBotName: string;
  toBotName: string;
  toBotTradeToken?: string;
  appId: number;
  contextId: string;
  sku: string;
  amount: number;
  message?: string;
};

export type JobRecord = {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: unknown;
  attemptCount: number;
  maxAttempts: number;
  nextRunAt: Date;
  claimedBy: string | null;
  claimExpiresAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  completedAt: Date | null;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type JobTransitionRecord = {
  id: string;
  jobId: string;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  reasonCode: string | null;
  reasonMessage: string | null;
  actor: string;
  createdAt: Date;
};
