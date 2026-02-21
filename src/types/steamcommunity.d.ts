declare module "steamcommunity" {
  type EnableTwoFactorResponse = {
    shared_secret?: string;
    identity_secret?: string;
    revocation_code?: string;
    phone_number_hint?: string;
    confirm_type?: number;
    status?: number;
  };

  class SteamCommunity {
    steamID?: { getSteamID64(): string };
    setMobileAppAccessToken(token: string): void;
    enableTwoFactor(callback: (error: Error | null, response?: EnableTwoFactorResponse) => void): void;
    finalizeTwoFactor(secret: string, activationCode: string, callback: (error: Error | null) => void): void;
  }

  export = SteamCommunity;
}
