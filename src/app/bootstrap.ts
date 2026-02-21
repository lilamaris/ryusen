import { PrismaClient } from "@prisma/client";
import { PrismaBotInventoryRepository } from "../adapter/persistence/prisma/prisma-bot-inventory-repository";
import { PrismaBotSessionRepository } from "../adapter/persistence/prisma/prisma-bot-session-repository";
import { PrismaTradeConsolidationRepository } from "../adapter/persistence/prisma/prisma-trade-consolidation-repository";
import { SteamSessionAuthGateway } from "../adapter/steam/steam-auth-gateway";
import { SteamAuthenticatedInventoryProvider } from "../adapter/steam/steam-authenticated-inventory-provider";
import { ClusterStockService } from "../core/usecase/cluster-stock-service";
import { BotInventoryQueryService } from "../core/usecase/bot-inventory-query-service";
import { BotInventoryRefreshService } from "../core/usecase/bot-inventory-refresh-service";
import { BotInventoryViewService } from "../core/usecase/bot-inventory-view-service";
import { ControlBotConsolidationService } from "../core/usecase/control-bot-consolidation-service";
import type { DebugLogger } from "../core/usecase/debug-logger";
import { BotSessionService } from "../core/usecase/bot-session-service";
import { TradeConsolidationSettlementService } from "../core/usecase/trade-consolidation-settlement-service";

export type AppContext = {
  prisma: PrismaClient;
  steamProvider: SteamAuthenticatedInventoryProvider;
  botSessionRepository: PrismaBotSessionRepository;
  botInventoryRepository: PrismaBotInventoryRepository;
  tradeConsolidationRepository: PrismaTradeConsolidationRepository;
  botSessionService: BotSessionService;
  botInventoryRefreshService: BotInventoryRefreshService;
  botInventoryQueryService: BotInventoryQueryService;
  botInventoryViewService: BotInventoryViewService;
  clusterStockService: ClusterStockService;
  controlBotConsolidationService: ControlBotConsolidationService;
  tradeConsolidationSettlementService: TradeConsolidationSettlementService;
};

export function createAppContext(debugLogger: DebugLogger): AppContext {
  const prisma = new PrismaClient();
  const steamProvider = new SteamAuthenticatedInventoryProvider();
  const steamAuthGateway = new SteamSessionAuthGateway();
  const botSessionRepository = new PrismaBotSessionRepository(prisma);
  const botInventoryRepository = new PrismaBotInventoryRepository(prisma);
  const tradeConsolidationRepository = new PrismaTradeConsolidationRepository(prisma);
  const botSessionService = new BotSessionService(botSessionRepository, steamAuthGateway, debugLogger);
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
  const controlBotConsolidationService = new ControlBotConsolidationService(
    botSessionRepository,
    clusterStockService,
    tradeConsolidationRepository,
    debugLogger
  );
  const tradeConsolidationSettlementService = new TradeConsolidationSettlementService(
    tradeConsolidationRepository,
    debugLogger
  );

  return {
    prisma,
    steamProvider,
    botSessionRepository,
    botInventoryRepository,
    tradeConsolidationRepository,
    botSessionService,
    botInventoryRefreshService,
    botInventoryQueryService,
    botInventoryViewService,
    clusterStockService,
    controlBotConsolidationService,
    tradeConsolidationSettlementService,
  };
}
