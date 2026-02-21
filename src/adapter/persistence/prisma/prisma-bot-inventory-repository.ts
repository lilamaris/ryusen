import { Prisma, PrismaClient } from "@prisma/client";
import type {
  BotInventoryRepository,
  BotInventoryWriteItem,
  BotItemHolder,
} from "../../../core/port/bot-inventory-repository";

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
  }

  async listBotsBySku(input: {
    appId: number;
    contextId: string;
    sku: string;
  }): Promise<BotItemHolder[]> {
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

    return rows.map((row) => ({
      botName: row.bot.name,
      steamId: row.bot.steamId,
      amount: row.amount,
      lastSeenAt: row.lastSeenAt,
    }));
  }
}
