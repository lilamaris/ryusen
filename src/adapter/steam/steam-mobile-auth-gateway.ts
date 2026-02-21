import {
  EAuthSessionGuardType,
  EAuthTokenPlatformType,
  LoginSession,
} from "steam-session";
import SteamCommunity = require("steamcommunity");
import { debugLog } from "../../debug";
import type { SteamGuardPrompts } from "../../core/port/steam-auth-gateway";
import type { SteamMobileAuthGateway, SteamTwoFactorBootstrapResult } from "../../core/port/steam-mobile-auth-gateway";

type StartSessionResponse = {
  actionRequired: boolean;
  validActions?: Array<{ type: EAuthSessionGuardType }>;
};

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

async function waitForAuthentication(session: LoginSession): Promise<void> {
  if (session.refreshToken) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const onAuthenticated = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: unknown): void => {
      cleanup();
      reject(toError(error));
    };
    const onTimeout = (): void => {
      cleanup();
      reject(new Error("Steam mobile login timed out while waiting for confirmation."));
    };
    const cleanup = (): void => {
      session.off("authenticated", onAuthenticated);
      session.off("error", onError);
      session.off("timeout", onTimeout);
    };
    session.on("authenticated", onAuthenticated);
    session.on("error", onError);
    session.on("timeout", onTimeout);
  });
}

async function handleGuardActions(
  session: LoginSession,
  startResponse: StartSessionResponse,
  prompts: SteamGuardPrompts
): Promise<void> {
  if (!startResponse.actionRequired) {
    await waitForAuthentication(session);
    return;
  }

  const actions = startResponse.validActions ?? [];
  const needsDeviceCode = actions.some((action) => action.type === EAuthSessionGuardType.DeviceCode);
  const needsEmailCode = actions.some((action) => action.type === EAuthSessionGuardType.EmailCode);

  if (needsDeviceCode || needsEmailCode) {
    const label = needsDeviceCode ? "Steam mobile OTP code" : "Steam email guard code";
    const guardCode = await prompts.requestGuardCode(`Enter ${label}`);
    await session.submitSteamGuardCode(guardCode.trim());
    await waitForAuthentication(session);
    return;
  }

  const waitsForConfirmation = actions.some(
    (action) =>
      action.type === EAuthSessionGuardType.DeviceConfirmation ||
      action.type === EAuthSessionGuardType.EmailConfirmation
  );
  if (waitsForConfirmation) {
    await prompts.notifyPendingConfirmation(
      "Approve the mobile sign-in request in Steam app/email confirmation, then press Enter."
    );
    await waitForAuthentication(session);
    return;
  }

  throw new Error("Steam login requires an unsupported guard action.");
}

function enableTwoFactor(community: SteamCommunity): Promise<{
  sharedSecret: string;
  identitySecret: string;
  revocationCode: string;
  phoneNumberHint?: string;
}> {
  return new Promise((resolve, reject) => {
    community.enableTwoFactor((error, response) => {
      if (error) {
        reject(error);
        return;
      }
      if (!response?.shared_secret || !response.identity_secret || !response.revocation_code) {
        reject(new Error("Steam did not return required authenticator secrets."));
        return;
      }
      resolve({
        sharedSecret: response.shared_secret,
        identitySecret: response.identity_secret,
        revocationCode: response.revocation_code,
        ...(response.phone_number_hint ? { phoneNumberHint: response.phone_number_hint } : {}),
      });
    });
  });
}

function finalizeTwoFactor(community: SteamCommunity, sharedSecret: string, activationCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    community.finalizeTwoFactor(sharedSecret, activationCode, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export class SteamMobileTwoFactorGateway implements SteamMobileAuthGateway {
  async enableAndFinalizeTwoFactor(input: {
    accountName: string;
    password: string;
    prompts: SteamGuardPrompts;
    requestActivationCode: (message: string) => Promise<string>;
  }): Promise<SteamTwoFactorBootstrapResult> {
    debugLog("SteamMobileTwoFactorGateway", "enableAndFinalizeTwoFactor:start", {
      accountName: input.accountName,
    });

    const session = new LoginSession(EAuthTokenPlatformType.MobileApp);
    const startResponse = (await session.startWithCredentials({
      accountName: input.accountName,
      password: input.password,
    })) as StartSessionResponse;
    await handleGuardActions(session, startResponse, input.prompts);

    if (!session.steamID) {
      throw new Error("Steam mobile login succeeded but steamID is missing.");
    }
    if (!session.accessToken) {
      throw new Error("Steam mobile login succeeded but access token is missing.");
    }

    const community = new SteamCommunity();
    community.steamID = session.steamID;
    community.setMobileAppAccessToken(session.accessToken);

    const enabled = await enableTwoFactor(community);
    const activationPrompt = enabled.phoneNumberHint
      ? `Enter activation code sent to phone ending in ${enabled.phoneNumberHint}`
      : "Enter Steam authenticator activation code";
    const activationCode = (await input.requestActivationCode(activationPrompt)).trim();
    if (!activationCode) {
      throw new Error("Activation code must not be empty.");
    }

    await finalizeTwoFactor(community, enabled.sharedSecret, activationCode);

    debugLog("SteamMobileTwoFactorGateway", "enableAndFinalizeTwoFactor:done", {
      accountName: input.accountName,
    });

    return {
      sharedSecret: enabled.sharedSecret,
      identitySecret: enabled.identitySecret,
      revocationCode: enabled.revocationCode,
    };
  }
}
