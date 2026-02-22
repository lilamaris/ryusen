import { PrismaClient } from "@prisma/client";
import { PrismaBotInventoryRepository } from "../adapter/prisma/inventory/inventory-repository";
import { PrismaBotSessionRepository } from "../adapter/prisma/session/session-repository";
import { SteamSessionAuthGateway } from "../adapter/steam/session/auth-gateway";
import { SteamMobileTwoFactorGateway } from "../adapter/steam/session/mobile-auth-gateway";
import { SteamAuthenticatedInventoryProvider } from "../adapter/steam/inventory/authenticated-inventory-provider";
import { SteamTradeOfferGateway } from "../adapter/steam/trade/trade-offer-gateway";
import { ClusterStockService } from "../core/inventory/usecase/stock";
import { BotInventoryQueryService } from "../core/inventory/usecase/query";
import { BotInventoryRefreshService } from "../core/inventory/usecase/refresh";
import { BotInventoryViewService } from "../core/inventory/usecase/view";
import type { DebugLogger } from "../core/shared/type/debug-logger";
import { BotSessionService } from "../core/session/usecase/session";
import { BotTradeService } from "../core/trade/usecase/trade";

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
