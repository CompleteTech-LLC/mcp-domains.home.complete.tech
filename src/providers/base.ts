import type { PriceQuote, ProviderStatus, RegistrationResult } from '../types.js';

export interface RegistrarProvider {
  readonly status: ProviderStatus;
  getEstimatedPricing?(tld: string): Promise<PriceQuote | null>;
  getExactQuote?(domain: string): Promise<PriceQuote | null>;
  registerDomain?(domain: string): Promise<RegistrationResult>;
}
