type SteamDescriptionEntry = {
  value?: string;
};

type SteamTag = {
  category?: string;
  internal_name?: string;
  localized_tag_name?: string;
  name?: string;
};

type SteamDescriptionLike = {
  name?: string;
  app_data?: {
    def_index?: string;
  };
  tags?: SteamTag[];
  descriptions?: SteamDescriptionEntry[];
};

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findQuality(description: SteamDescriptionLike): string {
  for (const tag of description.tags ?? []) {
    if ((tag.category ?? "").toLowerCase() !== "quality") {
      continue;
    }

    const raw = tag.internal_name ?? tag.localized_tag_name ?? tag.name;
    if (raw) {
      return raw.toLowerCase();
    }
  }

  return "unique";
}

function findWear(description: SteamDescriptionLike): string | null {
  for (const tag of description.tags ?? []) {
    if ((tag.category ?? "").toLowerCase() !== "exterior") {
      continue;
    }

    const raw = tag.internal_name ?? tag.localized_tag_name ?? tag.name;
    if (raw) {
      return slug(raw);
    }
  }

  return null;
}

function hasDescriptionText(description: SteamDescriptionLike, keyword: string): boolean {
  const lowerKeyword = keyword.toLowerCase();
  return (description.descriptions ?? []).some((entry) =>
    (entry.value ?? "").toLowerCase().includes(lowerKeyword)
  );
}

function findUnusualEffect(description: SteamDescriptionLike): string | null {
  for (const entry of description.descriptions ?? []) {
    const text = entry.value ?? "";
    const marker = "Unusual Effect:";
    const index = text.indexOf(marker);
    if (index < 0) {
      continue;
    }

    const effect = text.slice(index + marker.length).trim();
    if (effect.length > 0) {
      return slug(effect);
    }
  }

  return null;
}

function killstreakTier(name: string): number {
  if (name.startsWith("Professional Killstreak ")) {
    return 3;
  }
  if (name.startsWith("Specialized Killstreak ")) {
    return 2;
  }
  if (name.startsWith("Killstreak ")) {
    return 1;
  }
  return 0;
}

export function toTf2Sku(description: SteamDescriptionLike | null, fallbackKey: string): string {
  if (!description) {
    return `raw-${fallbackKey}`;
  }

  const defIndexRaw = description.app_data?.def_index;
  if (!defIndexRaw || !/^\d+$/.test(defIndexRaw)) {
    return `raw-${fallbackKey}`;
  }

  const tokens: string[] = [];
  const name = description.name ?? "";
  const quality = findQuality(description);

  if (quality === "strange") {
    tokens.push("st");
  } else if (quality !== "unique") {
    tokens.push(`q-${slug(quality)}`);
  }

  const tier = killstreakTier(name);
  if (tier > 0) {
    tokens.push(`ks-${tier}`);
  }

  const effect = findUnusualEffect(description);
  if (effect) {
    tokens.push(`u-${effect}`);
  }

  const wear = findWear(description);
  if (wear) {
    tokens.push(`wear-${wear}`);
  }

  if (name.includes("Australium")) {
    tokens.push("australium");
  }

  if (name.includes("Festivized") || hasDescriptionText(description, "Festivized")) {
    tokens.push("festive");
  }

  if (hasDescriptionText(description, "Not Usable in Crafting")) {
    tokens.push("uncraft");
  }

  if (hasDescriptionText(description, "Not Tradable")) {
    tokens.push("untradable");
  }

  return tokens.length === 0 ? defIndexRaw : `${defIndexRaw};${tokens.join(";")}`;
}
