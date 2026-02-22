import type { EAuthSessionGuardType } from "steam-session";

export type StartSessionResponse = {
  actionRequired: boolean;
  validActions?: Array<{ type: EAuthSessionGuardType }>;
};
