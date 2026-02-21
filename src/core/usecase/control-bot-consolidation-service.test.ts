import assert from "node:assert/strict";
import test from "node:test";
import type { Bot, BotSession } from "../bot/bot-session";
import type { BotSessionRepository } from "../port/bot-session-repository";
import type {
  TradeConsolidationJobRecord,
  TradeConsolidationRepository,
} from "../port/trade-consolidation-repository";
import { ClusterStockService } from "./cluster-stock-service";
import { ControlBotConsolidationService } from "./control-bot-consolidation-service";
import type { BotInventoryRepository, BotItemHolder, BotSkuHolding } from "../port/bot-inventory-repository";

class FakeSessionRepository implements BotSessionRepository {
  constructor(private readonly bots: Bot[]) {}

  createBot(): Promise<Bot> {
    return Promise.reject(new Error("not used"));
  }

  findBotByName(name: string): Promise<Bot | null> {
    return Promise.resolve(this.bots.find((bot) => bot.name === name) ?? null);
  }

  listBots(): Promise<Bot[]> {
    return Promise.resolve(this.bots);
  }

  listBotsWithSessions(): Promise<Array<{ bot: Bot; session: BotSession | null }>> {
    return Promise.resolve(this.bots.map((bot) => ({ bot, session: null })));
  }

  upsertSession(): Promise<BotSession> {
    return Promise.reject(new Error("not used"));
  }

  findSessionByBotId(): Promise<BotSession | null> {
    return Promise.resolve(null);
  }

  markSessionChecked(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeInventoryRepository implements BotInventoryRepository {
  constructor(private readonly holdings: BotSkuHolding[]) {}

  replaceBotHoldings(): Promise<void> {
    return Promise.reject(new Error("not used"));
  }

  listBotsBySku(): Promise<BotItemHolder[]> {
    return Promise.reject(new Error("not used"));
  }

  listBotSkuHoldings(): Promise<BotSkuHolding[]> {
    return Promise.resolve(this.holdings);
  }
}

class FakeTradeConsolidationRepository implements TradeConsolidationRepository {
  public jobs: TradeConsolidationJobRecord[] = [];

  createPlannedJob(input: {
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
    const now = new Date("2026-02-21T10:00:00.000Z");
    const job: TradeConsolidationJobRecord = {
      id: `job-${this.jobs.length + 1}`,
      controlBotId: input.controlBotId,
      appId: input.appId,
      contextId: input.contextId,
      sku: input.sku,
      requestedAmount: input.requestedAmount,
      status: input.status,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
      legs: input.legs.map((item, idx) => ({
        id: `leg-${idx + 1}`,
        fromBotId: item.fromBotId,
        toBotId: item.toBotId,
        sku: item.sku,
        amount: item.amount,
        status: item.status,
        createdAt: now,
        updatedAt: now,
      })),
    };
    this.jobs.push(job);
    return Promise.resolve(job);
  }

  listJobs(): Promise<TradeConsolidationJobRecord[]> {
    return Promise.resolve(this.jobs);
  }

  findJobById(jobId: string): Promise<TradeConsolidationJobRecord | null> {
    return Promise.resolve(this.jobs.find((item) => item.id === jobId) ?? null);
  }

  updateLegStatus(): Promise<void> {
    return Promise.reject(new Error("not used"));
  }

  updateJobStatus(): Promise<void> {
    return Promise.reject(new Error("not used"));
  }
}

void test("createPlan allocates donors to satisfy control-bot required amount", async () => {
  const bots: Bot[] = [
    { id: "control", name: "control", steamId: "1", accountName: "c" },
    { id: "d1", name: "donor-a", steamId: "2", accountName: "a" },
    { id: "d2", name: "donor-b", steamId: "3", accountName: "b" },
  ];
  const stockService = new ClusterStockService(
    new FakeInventoryRepository([
      { botId: "control", botName: "control", steamId: "1", amount: 1, lastSeenAt: new Date() },
      { botId: "d1", botName: "donor-a", steamId: "2", amount: 1, lastSeenAt: new Date() },
      { botId: "d2", botName: "donor-b", steamId: "3", amount: 2, lastSeenAt: new Date() },
    ])
  );
  const tradeRepository = new FakeTradeConsolidationRepository();
  const service = new ControlBotConsolidationService(
    new FakeSessionRepository(bots),
    stockService,
    tradeRepository
  );

  const result = await service.createPlan({
    controlBotName: "control",
    appId: 440,
    contextId: "2",
    sku: "5500",
    requiredAmount: 3,
  });

  assert.equal(result.status, "PLANNED");
  assert.equal(result.legs.length, 1);
  assert.equal(result.legs[0]?.amount, 2);
  assert.equal(tradeRepository.jobs.length, 1);
});

void test("createPlan fails when total cluster stock is insufficient", async () => {
  const bots: Bot[] = [{ id: "control", name: "control", steamId: "1", accountName: "c" }];
  const stockService = new ClusterStockService(
    new FakeInventoryRepository([{ botId: "control", botName: "control", steamId: "1", amount: 1, lastSeenAt: new Date() }])
  );
  const service = new ControlBotConsolidationService(
    new FakeSessionRepository(bots),
    stockService,
    new FakeTradeConsolidationRepository()
  );

  await assert.rejects(
    service.createPlan({
      controlBotName: "control",
      appId: 440,
      contextId: "2",
      sku: "5500",
      requiredAmount: 2,
    }),
    /Insufficient cluster stock/
  );
});
