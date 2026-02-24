import { PrismaClient } from "@prisma/client";
import { PrismaBotInventoryRepository } from "../adapter/prisma/inventory/inventory-repository";
import { PrismaJobRepository } from "../adapter/prisma/job/job-repository";
import { PrismaListingPolicyRepository } from "../adapter/prisma/listing/listing-policy-repository";
import { PrismaPriceCacheRepository } from "../adapter/prisma/pricing/price-cache-repository";
import { PrismaBotSessionRepository } from "../adapter/prisma/session/session-repository";
import { SteamSessionAuthGateway } from "../adapter/steam/session/auth-gateway";
import { SteamMobileTwoFactorGateway } from "../adapter/steam/session/mobile-auth-gateway";
import { SteamAuthenticatedInventoryProvider } from "../adapter/steam/inventory/authenticated-inventory-provider";
import { SteamTradeOfferGateway } from "../adapter/steam/trade/trade-offer-gateway";
import { BackpackTfPricer } from "../adapter/backpack/pricing/backpack-pricer";
import { ClusterStockService } from "../core/inventory/usecase/stock";
import { BotInventoryQueryService } from "../core/inventory/usecase/query";
import { BotInventoryRefreshService } from "../core/inventory/usecase/refresh";
import { BotInventoryViewService } from "../core/inventory/usecase/view";
import { ListingPolicyService } from "../core/listing/usecase/policy";
import { JobService } from "../core/job/usecase/job";
import { JobStateMachineService } from "../core/job/usecase/job-state-machine";
import { JobWorkerService } from "../core/job/usecase/job-worker";
import { MarketPriceService } from "../core/pricing/usecase/price";
import type { DebugLogger } from "../core/shared/type/debug-logger";
import { BotSessionService } from "../core/session/usecase/session";
import { BotTradeService } from "../core/trade/usecase/trade";

export type AppContext = {
  prisma: PrismaClient;
  steamProvider: SteamAuthenticatedInventoryProvider;
  botSessionRepository: PrismaBotSessionRepository;
  botInventoryRepository: PrismaBotInventoryRepository;
  jobRepository: PrismaJobRepository;
  listingPolicyRepository: PrismaListingPolicyRepository;
  botSessionService: BotSessionService;
  jobService: JobService;
  jobWorkerService: JobWorkerService;
  listingPolicyService: ListingPolicyService;
  botInventoryRefreshService: BotInventoryRefreshService;
  botInventoryQueryService: BotInventoryQueryService;
  botInventoryViewService: BotInventoryViewService;
  clusterStockService: ClusterStockService;
  botTradeService: BotTradeService;
  marketPriceService: MarketPriceService;
};

export function createAppContext(debugLogger: DebugLogger): AppContext {
  const prisma = new PrismaClient();
  const steamProvider = new SteamAuthenticatedInventoryProvider();
  const steamAuthGateway = new SteamSessionAuthGateway();
  const steamMobileAuthGateway = new SteamMobileTwoFactorGateway();
  const botSessionRepository = new PrismaBotSessionRepository(prisma);
  const botInventoryRepository = new PrismaBotInventoryRepository(prisma);
  const jobRepository = new PrismaJobRepository(prisma);
  const listingPolicyRepository = new PrismaListingPolicyRepository(prisma);
  const priceCacheRepository = new PrismaPriceCacheRepository(prisma);
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
  const backpackTfPricer = new BackpackTfPricer();
  const marketPriceService = new MarketPriceService([backpackTfPricer], priceCacheRepository, debugLogger);
  const jobStateMachineService = new JobStateMachineService(jobRepository, debugLogger);
  const jobService = new JobService(jobRepository, jobStateMachineService, debugLogger);
  const listingPolicyService = new ListingPolicyService(listingPolicyRepository, debugLogger);
  const jobWorkerService = new JobWorkerService(
    jobRepository,
    jobStateMachineService,
    {
      TRADE_OFFER_CREATE: async (payload) => {
        await botTradeService.createOffer(payload);
      },
    },
    debugLogger
  );

  return {
    prisma,
    steamProvider,
    botSessionRepository,
    botInventoryRepository,
    jobRepository,
    listingPolicyRepository,
    botSessionService,
    jobService,
    jobWorkerService,
    listingPolicyService,
    botInventoryRefreshService,
    botInventoryQueryService,
    botInventoryViewService,
    clusterStockService,
    botTradeService,
    marketPriceService,
  };
}
