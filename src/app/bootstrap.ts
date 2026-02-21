import { PrismaClient } from "@prisma/client";
import { PrismaBotInventoryRepository } from "../adapter/persistence/prisma/prisma-bot-inventory-repository";
import { PrismaBotSessionRepository } from "../adapter/persistence/prisma/prisma-bot-session-repository";
import { SteamSessionAuthGateway } from "../adapter/steam/steam-auth-gateway";
import { SteamMobileTwoFactorGateway } from "../adapter/steam/steam-mobile-auth-gateway";
import { SteamAuthenticatedInventoryProvider } from "../adapter/steam/steam-authenticated-inventory-provider";
import { SteamTradeOfferGateway } from "../adapter/steam/steam-trade-offer-gateway";
import { ClusterStockService } from "../core/usecase/cluster-stock-service";
import { BotInventoryQueryService } from "../core/usecase/bot-inventory-query-service";
import { BotInventoryRefreshService } from "../core/usecase/bot-inventory-refresh-service";
import { BotInventoryViewService } from "../core/usecase/bot-inventory-view-service";
import type { DebugLogger } from "../core/usecase/debug-logger";
import { BotSessionService } from "../core/usecase/bot-session-service";
import { BotTradeService } from "../core/usecase/bot-trade-service";

export type AppContext = {
  prisma: PrismaClient;
  steamProvider: SteamAuthenticatedInventoryProvider;
  botSessionRepository: PrismaBotSessionRepository;
  botInventoryRepository: PrismaBotInventoryRepository;
  botSessionService: BotSessionService;
  botInventoryRefreshService: BotInventoryRefreshService;
  botInventoryQueryService: BotInventoryQueryService;
  botInventoryViewService: BotInventoryViewService;
  clusterStockService: ClusterStockService;
  botTradeService: BotTradeService;
};

export function createAppContext(debugLogger: DebugLogger): AppContext {
  const prisma = new PrismaClient();
  const steamProvider = new SteamAuthenticatedInventoryProvider();
  const steamAuthGateway = new SteamSessionAuthGateway();
  const steamMobileAuthGateway = new SteamMobileTwoFactorGateway();
  const botSessionRepository = new PrismaBotSessionRepository(prisma);
  const botInventoryRepository = new PrismaBotInventoryRepository(prisma);
  const botSessionService = new BotSessionService(
    botSessionRepository,
    steamAuthGateway,
    steamMobileAuthGateway,
    debugLogger
  );
  const botInventoryRefreshService = new BotInventoryRefreshService(
    botSessionRepository,
    steamProvider,
    botInventoryRepository,
    debugLogger
  );
  const botInventoryQueryService = new BotInventoryQueryService(botSessionRepository, debugLogger);
  const botInventoryViewService = new BotInventoryViewService(
    botInventoryQueryService,
    steamProvider,
    debugLogger
  );
  const clusterStockService = new ClusterStockService(botInventoryRepository, debugLogger);
  const steamTradeOfferGateway = new SteamTradeOfferGateway();
  const botTradeService = new BotTradeService(
    botSessionRepository,
    steamProvider,
    steamTradeOfferGateway,
    debugLogger
  );

  return {
    prisma,
    steamProvider,
    botSessionRepository,
    botInventoryRepository,
    botSessionService,
    botInventoryRefreshService,
    botInventoryQueryService,
    botInventoryViewService,
    clusterStockService,
    botTradeService,
  };
}
