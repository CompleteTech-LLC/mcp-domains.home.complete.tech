export type RegistrarId = 'rdap' | 'porkbun' | 'namecheap' | 'cloudflare';

export type PurchaseMode = 'disabled' | 'manual' | 'live';

export interface ProviderStatus {
  id: RegistrarId;
  name: string;
  configured: boolean;
  supportsEstimatedPricing: boolean;
  supportsExactLookup: boolean;
  supportsLivePurchase: boolean;
  notes: string[];
}

export interface AvailabilitySignal {
  source: RegistrarId;
  available: boolean | null;
  checkedAt: string;
  note?: string;
}

export interface PriceQuote {
  registrar: RegistrarId;
  registrarName: string;
  currency: string;
  registrationCost?: number;
  renewalCost?: number;
  transferCost?: number;
  available?: boolean | null;
  exact: boolean;
  note?: string;
  checkedAt: string;
}

export interface DomainComparison {
  domain: string;
  sld: string;
  tld: string;
  consensusAvailable: boolean | null;
  availabilitySignals: AvailabilitySignal[];
  quotes: PriceQuote[];
  cheapestQuote: PriceQuote | null;
  livePurchasableVia: RegistrarId[];
}

export interface DiscoveryCandidate {
  domain: string;
  sld: string;
  tld: string;
  availability: boolean | null;
  estimatedRegistrationCost?: number;
  estimatedCostSource?: RegistrarId;
  score: number;
  reasons: string[];
}

export interface DomainAssessment {
  domain: string;
  score: number;
  availability: boolean | null;
  brandabilityScore: number;
  fitScore: number;
  tldScore: number;
  costScore: number;
  estimatedRegistrationCost?: number;
  reasons: string[];
}

export interface PurchasePlan {
  domain: string;
  recommendedRegistrar: RegistrarId | null;
  canPurchaseNow: boolean;
  purchaseMode: PurchaseMode;
  cheapestQuote: PriceQuote | null;
  guardPhrase: string | null;
  nextSteps: string[];
  warnings: string[];
}

export interface RegistrationRequest {
  domain: string;
  registrar: RegistrarId;
  guardPhrase: string;
}

export interface RegistrationResult {
  registrar: RegistrarId;
  mode: PurchaseMode;
  liveAttempted: boolean;
  success: boolean;
  requestSummary: Record<string, unknown>;
  response: unknown;
}
