import { PrismaClient } from "@prisma/client";
import { debugLog } from "../../../debug";
import type {
  TradeConsolidationJobRecord,
  TradeConsolidationRepository,
} from "../../../core/port/trade-consolidation-repository";

export class PrismaTradeConsolidationRepository implements TradeConsolidationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createPlannedJob(input: {
    controlBotId: string;
    appId: number;
    contextId: string;
    sku: string;
    requestedAmount: number;
    status: "PLANNED";
    legs: Array<{
      fromBotId: string;
      toBotId: string;
      sku: string;
      amount: number;
      status: "PLANNED";
    }>;
  }): Promise<TradeConsolidationJobRecord> {
    debugLog("PrismaTradeConsolidationRepository", "createPlannedJob:start", {
      controlBotId: input.controlBotId,
      appId: input.appId,
      contextId: input.contextId,
      sku: input.sku,
      requestedAmount: input.requestedAmount,
      legCount: input.legs.length,
    });

    const record = await this.prisma.tradeConsolidationJob.create({
      data: {
        controlBotId: input.controlBotId,
        appId: input.appId,
        contextId: input.contextId,
        sku: input.sku,
        requestedAmount: input.requestedAmount,
        status: input.status,
        legs: {
          create: input.legs,
        },
      },
      include: {
        legs: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    debugLog("PrismaTradeConsolidationRepository", "createPlannedJob:done", {
      jobId: record.id,
      legCount: record.legs.length,
    });

    return {
      id: record.id,
      controlBotId: record.controlBotId,
      appId: record.appId,
      contextId: record.contextId,
      sku: record.sku,
      requestedAmount: record.requestedAmount,
      status: record.status,
      failureReason: record.failureReason,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      legs: record.legs.map((item) => ({
        id: item.id,
        fromBotId: item.fromBotId,
        toBotId: item.toBotId,
        sku: item.sku,
        amount: item.amount,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }

  async listJobs(input?: { limit?: number }): Promise<TradeConsolidationJobRecord[]> {
    const limit = input?.limit ?? 20;
    debugLog("PrismaTradeConsolidationRepository", "listJobs:start", { limit });

    const rows = await this.prisma.tradeConsolidationJob.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        legs: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    debugLog("PrismaTradeConsolidationRepository", "listJobs:done", { count: rows.length });

    return rows.map((row) => ({
      id: row.id,
      controlBotId: row.controlBotId,
      appId: row.appId,
      contextId: row.contextId,
      sku: row.sku,
      requestedAmount: row.requestedAmount,
      status: row.status,
      failureReason: row.failureReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      legs: row.legs.map((item) => ({
        id: item.id,
        fromBotId: item.fromBotId,
        toBotId: item.toBotId,
        sku: item.sku,
        amount: item.amount,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    }));
  }

  async findJobById(jobId: string): Promise<TradeConsolidationJobRecord | null> {
    debugLog("PrismaTradeConsolidationRepository", "findJobById:start", { jobId });
    const row = await this.prisma.tradeConsolidationJob.findUnique({
      where: { id: jobId },
      include: {
        legs: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!row) {
      debugLog("PrismaTradeConsolidationRepository", "findJobById:notFound", { jobId });
      return null;
    }

    return {
      id: row.id,
      controlBotId: row.controlBotId,
      appId: row.appId,
      contextId: row.contextId,
      sku: row.sku,
      requestedAmount: row.requestedAmount,
      status: row.status,
      failureReason: row.failureReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      legs: row.legs.map((item) => ({
        id: item.id,
        fromBotId: item.fromBotId,
        toBotId: item.toBotId,
        sku: item.sku,
        amount: item.amount,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }

  async updateLegStatus(input: { legId: string; status: "PLANNED" | "COMPLETED" | "FAILED" }): Promise<void> {
    debugLog("PrismaTradeConsolidationRepository", "updateLegStatus", input);
    await this.prisma.tradeConsolidationLeg.update({
      where: { id: input.legId },
      data: { status: input.status },
    });
  }

  async updateJobStatus(input: {
    jobId: string;
    status: "PLANNED" | "COMPLETED" | "FAILED";
    failureReason?: string | null;
  }): Promise<void> {
    debugLog("PrismaTradeConsolidationRepository", "updateJobStatus", input);
    await this.prisma.tradeConsolidationJob.update({
      where: { id: input.jobId },
      data: {
        status: input.status,
        failureReason: input.failureReason ?? null,
      },
    });
  }
}
