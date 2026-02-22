import { Prisma, PrismaClient } from "@prisma/client";
import { debugLog } from "../../../debug";
import type { BotInventoryRepository } from "../../../core/inventory/interface/inventory-repository";
import type { BotInventoryWriteItem, BotItemHolder, BotSkuHolding } from "../../../core/inventory/type/holding";

export class PrismaBotInventoryRepository implements BotInventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  async replaceBotHoldings(
    botId: string,
    appId: number,
    contextId: string,
    items: BotInventoryWriteItem[]
  ): Promise<void> {
    debugLog("PrismaBotInventoryRepository", "replaceBotHoldings:start", {
      botId,
      appId,
      contextId,
      itemCount: items.length,
    });

    await this.prisma.$transaction(async (tx) => {
      const keptItemIds: string[] = [];

      for (const item of items) {
        const upsertedItem = await tx.item.upsert({
          where: {
            appId_contextId_sku: {
              appId: item.appId,
              contextId: item.contextId,
              sku: item.sku,
            },
          },
          create: {
            appId: item.appId,
            contextId: item.contextId,
            sku: item.sku,
            itemKey: item.itemKey,
            name: item.name,
            marketHashName: item.marketHashName,
            iconUrl: item.iconUrl ?? null,
          },
          update: {
            itemKey: item.itemKey,
            name: item.name,
            marketHashName: item.marketHashName,
            iconUrl: item.iconUrl ?? null,
          },
          select: {
            id: true,
          },
        });

        keptItemIds.push(upsertedItem.id);

        await tx.botHasItem.upsert({
          where: {
            botId_itemId: {
              botId,
              itemId: upsertedItem.id,
            },
          },
          create: {
            botId,
            itemId: upsertedItem.id,
            amount: item.amount,
            rawPayload: this.toJsonValue(item.rawPayload),
            lastSeenAt: item.lastSeenAt,
          },
          update: {
            amount: item.amount,
            rawPayload: this.toJsonValue(item.rawPayload),
            lastSeenAt: item.lastSeenAt,
          },
        });
      }

      await tx.botHasItem.deleteMany({
        where: {
          botId,
          item: {
            appId,
            contextId,
          },
          itemId: {
            notIn: keptItemIds.length > 0 ? keptItemIds : [""],
          },
        },
      });
    });

    debugLog("PrismaBotInventoryRepository", "replaceBotHoldings:done", {
      botId,
      appId,
      contextId,
      itemCount: items.length,
    });
  }

  async listBotsBySku(input: {
    appId: number;
    contextId: string;
    sku: string;
  }): Promise<BotItemHolder[]> {
    debugLog("PrismaBotInventoryRepository", "listBotsBySku:start", input);
    const rows = await this.prisma.botHasItem.findMany({
      where: {
        item: {
          appId: input.appId,
          contextId: input.contextId,
          sku: input.sku,
        },
      },
      orderBy: {
        bot: {
          name: "asc",
        },
      },
      select: {
        amount: true,
        lastSeenAt: true,
        bot: {
          select: {
            name: true,
            steamId: true,
          },
        },
      },
    });

    debugLog("PrismaBotInventoryRepository", "listBotsBySku:done", { count: rows.length });

    return rows.map((row) => ({
      botName: row.bot.name,
      steamId: row.bot.steamId,
      amount: row.amount,
      lastSeenAt: row.lastSeenAt,
    }));
  }

  async listBotSkuHoldings(input: {
    appId: number;
    contextId: string;
    sku: string;
  }): Promise<BotSkuHolding[]> {
    debugLog("PrismaBotInventoryRepository", "listBotSkuHoldings:start", input);
    const rows = await this.prisma.botHasItem.findMany({
      where: {
        item: {
          appId: input.appId,
          contextId: input.contextId,
          sku: input.sku,
        },
      },
      orderBy: {
        bot: {
          name: "asc",
        },
      },
      select: {
        amount: true,
        lastSeenAt: true,
        bot: {
          select: {
            id: true,
            name: true,
            steamId: true,
          },
        },
      },
    });

    debugLog("PrismaBotInventoryRepository", "listBotSkuHoldings:done", { count: rows.length });

    return rows.map((row) => ({
      botId: row.bot.id,
      botName: row.bot.name,
      steamId: row.bot.steamId,
      amount: row.amount,
      lastSeenAt: row.lastSeenAt,
    }));
  }
}
