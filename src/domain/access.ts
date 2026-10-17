export interface Identity {
  readonly id: string;
  readonly name: string;
}

export interface Account {
  readonly id: string;
  readonly identityId: string;
  readonly loginStatus: 'enabled' | 'blocked';
  readonly credentialVersion: number;
  /** Abstrakcja zarejestrowanego drugiego składnika; bez prawdziwych sekretów. */
  readonly mfaPolicy: 'not-required' | 'required';
  readonly secondFactorVersion?: number;
}

export interface VpnSession {
  readonly id: string;
  readonly accountId: string;
  readonly gatewayAssetId: string;
  readonly status: 'active' | 'terminated' | 'expired';
  readonly startedAtMinute: number;
  readonly expiresAtMinute: number;
}

export interface NetworkRule {
  readonly id: string;
  readonly sourceAssetId: string;
  readonly targetAssetId: string;
  readonly protocol: string;
  readonly priority: number;
  readonly action: 'allow' | 'deny';
  /** Brak pola zachowuje stare reguły dla wszystkich podmiotów. */
  readonly accountIds?: readonly string[];
}

export interface ResourcePermission {
  readonly accountId: string;
  readonly targetAssetId: string;
  readonly protocol: string;
}

export interface AccessState {
  readonly vpnAssetId: string;
  readonly identityAssetId: string;
  readonly sessionLifetimeMinutes: number;
  readonly identities: readonly Identity[];
  readonly accounts: readonly Account[];
  readonly sessions: readonly VpnSession[];
  readonly rules: readonly NetworkRule[];
  readonly permissions: readonly ResourcePermission[];
}
