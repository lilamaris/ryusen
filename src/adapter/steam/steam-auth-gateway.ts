import {
  EAuthSessionGuardType,
  EAuthTokenPlatformType,
  LoginSession,
} from "steam-session";
import type { SteamAuthGateway, SteamAuthResult, SteamGuardPrompts } from "../../core/port/steam-auth-gateway";

type StartSessionResponse = {
  actionRequired: boolean;
  validActions?: Array<{ type: EAuthSessionGuardType }>;
};

function findCookieValue(cookies: string[], cookieName: string): string | null {
  for (const cookie of cookies) {
    const [firstPart] = cookie.split(";");
    if (!firstPart) {
      continue;
    }

    const [name, value] = firstPart.split("=");
    if (name?.trim() === cookieName && value) {
      return value;
    }
  }
  return null;
}

function findCookieExpiresAt(cookies: string[]): Date | null {
  for (const cookie of cookies) {
    const parts = cookie.split(";").map((part) => part.trim());
    const expiresPart = parts.find((part) => part.toLowerCase().startsWith("expires="));
    if (!expiresPart) {
      continue;
    }

    const expiresRaw = expiresPart.slice("expires=".length);
    const expiresDate = new Date(expiresRaw);
    if (!Number.isNaN(expiresDate.getTime())) {
      return expiresDate;
    }
  }

  return null;
}

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
      reject(new Error("Steam login timed out while waiting for confirmation."));
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
      "Approve the sign-in request in Steam mobile app/email confirmation, then press Enter."
    );
    await waitForAuthentication(session);
    return;
  }

  throw new Error("Steam login requires an unsupported guard action.");
}

export class SteamSessionAuthGateway implements SteamAuthGateway {
  async authenticateWithCredentials(input: {
    accountName: string;
    password: string;
    prompts: SteamGuardPrompts;
  }): Promise<SteamAuthResult> {
    const session = new LoginSession(EAuthTokenPlatformType.WebBrowser);

    const startResponse = (await session.startWithCredentials({
      accountName: input.accountName,
      password: input.password,
    })) as StartSessionResponse;

    await handleGuardActions(session, startResponse, input.prompts);

    const cookies = await session.getWebCookies();
    const sessionId = findCookieValue(cookies, "sessionid");
    if (!sessionId) {
      throw new Error("Steam login succeeded but no sessionid cookie was returned.");
    }

    const expiresAt = findCookieExpiresAt(cookies) ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

    return {
      sessionToken: sessionId,
      expiresAt,
    };
  }
}
