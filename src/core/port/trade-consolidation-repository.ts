export type TradeConsolidationJobStatus = "PLANNED" | "COMPLETED" | "FAILED";

export type TradeConsolidationLegStatus = "PLANNED" | "COMPLETED" | "FAILED";

export type TradeConsolidationLegWrite = {
  fromBotId: string;
  toBotId: string;
  sku: string;
  amount: number;
  status: TradeConsolidationLegStatus;
};

export type TradeConsolidationJobRecord = {
  id: string;
  controlBotId: string;
  appId: number;
  contextId: string;
  sku: string;
  requestedAmount: number;
  status: TradeConsolidationJobStatus;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  legs: Array<{
    id: string;
    fromBotId: string;
    toBotId: string;
    sku: string;
    amount: number;
    status: TradeConsolidationLegStatus;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

export interface TradeConsolidationRepository {
  createPlannedJob(input: {
    controlBotId: string;
    appId: number;
    contextId: string;
    sku: string;
    requestedAmount: number;
    status: TradeConsolidationJobStatus;
    legs: TradeConsolidationLegWrite[];
  }): Promise<TradeConsolidationJobRecord>;
  listJobs(input?: { limit?: number }): Promise<TradeConsolidationJobRecord[]>;
  findJobById(jobId: string): Promise<TradeConsolidationJobRecord | null>;
  updateLegStatus(input: { legId: string; status: TradeConsolidationLegStatus }): Promise<void>;
  updateJobStatus(input: {
    jobId: string;
    status: TradeConsolidationJobStatus;
    failureReason?: string | null;
  }): Promise<void>;
}
