import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import type { BotDeclarationAccount, BotTradeSecretsDeclaration } from "../../core/usecase/bot-session-service";

const SECRET_BASE_DIR = path.resolve(process.cwd(), ".ryusen/secret");

function resolveSecretFilePath(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) {
    throw new Error("YAML file name must not be empty");
  }

  const resolved = path.resolve(SECRET_BASE_DIR, trimmed);
  const relative = path.relative(SECRET_BASE_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`YAML file must be inside ${SECRET_BASE_DIR}`);
  }
  return resolved;
}

function assertRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export async function loadBotAccountDeclarationFromYaml(path: string): Promise<BotDeclarationAccount[]> {
  const raw = await readFile(resolveSecretFilePath(path), "utf-8");
  const parsed = parse(raw) as unknown;
  const root = Array.isArray(parsed) ? { bots: parsed } : assertRecord(parsed, "Invalid YAML root");
  const botsRaw = root.bots;
  if (!Array.isArray(botsRaw)) {
    throw new Error("Account declaration must include a 'bots' array");
  }

  return botsRaw.map((entry, index) => {
    const row = assertRecord(entry, `bots[${index}] must be an object`);
    const steamId = asOptionalString(row.steamId);
    const account = asOptionalString(row.account);
    const password = asOptionalString(row.password);
    const alias = asOptionalString(row.alias);
    if (!steamId || !account || !password || !alias) {
      throw new Error(`bots[${index}] must include steamId, account, password, alias`);
    }
    return {
      steamId,
      account,
      password,
      alias,
    };
  });
}

export async function loadBotSecretsDeclarationFromYaml(
  path: string
): Promise<Record<string, BotTradeSecretsDeclaration>> {
  const raw = await readFile(resolveSecretFilePath(path), "utf-8");
  const parsed = parse(raw) as unknown;
  const root = assertRecord(parsed, "Invalid YAML root");
  const secretsRoot = root.secrets ? assertRecord(root.secrets, "secrets must be an object") : root;
  const result: Record<string, BotTradeSecretsDeclaration> = {};

  for (const [steamId, value] of Object.entries(secretsRoot)) {
    const secretRow = assertRecord(value, `secrets.${steamId} must be an object`);
    const sharedSecret = asOptionalString(secretRow.sharedSecret);
    const identitySecret = asOptionalString(secretRow.identitySecret);
    result[steamId.trim()] = {
      ...(sharedSecret ? { sharedSecret } : {}),
      ...(identitySecret ? { identitySecret } : {}),
    };
  }

  return result;
}
