import { config } from '../config.js';
import { TtlCache } from '../cache.js';
import type { PriceQuote, ProviderStatus, RegistrationResult } from '../types.js';
import type { RegistrarProvider } from './base.js';

interface PorkbunPricingResponse {
  status: string;
  pricing?: Record<
    string,
    {
      registration?: string;
      renewal?: string;
      transfer?: string;
    }
  >;
}

interface PorkbunCheckResponse {
  status: string;
  avail?: string;
  price?: string;
  renewalPrice?: string;
  transferPrice?: string;
  message?: string;
}

export class PorkbunProvider implements RegistrarProvider {
  private readonly pricingCache = new TtlCache<PriceQuote | null>(60 * 60 * 1000);

  readonly status: ProviderStatus = {
    id: 'porkbun',
    name: 'Porkbun',
    configured: Boolean(config.porkbun.apiKey && config.porkbun.secretApiKey),
    supportsEstimatedPricing: true,
    supportsExactLookup: Boolean(config.porkbun.apiKey && config.porkbun.secretApiKey),
    supportsLivePurchase: Boolean(config.porkbun.apiKey && config.porkbun.secretApiKey),
    notes: ['Public TLD pricing works without keys.', 'Exact lookup and purchase require API credentials.'],
  };

  constructor(private readonly userAgent: string, private readonly purchaseMode: 'disabled' | 'manual' | 'live') {}

  async getEstimatedPricing(tld: string): Promise<PriceQuote | null> {
    const cacheKey = `porkbun:${tld}`;
    const cached = this.pricingCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const response = await fetch('https://api.porkbun.com/api/json/v3/pricing/get', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
      },
      body: JSON.stringify({ tlds: [tld] }),
    });

    if (!response.ok) {
      this.pricingCache.set(cacheKey, null);
      return null;
    }

    const payload = (await response.json()) as PorkbunPricingResponse;
    const pricing = payload.pricing?.[tld];
    if (!pricing?.registration) {
      this.pricingCache.set(cacheKey, null);
      return null;
    }

    const quote: PriceQuote = {
      registrar: 'porkbun',
      registrarName: 'Porkbun',
      currency: 'USD',
      registrationCost: Number(pricing.registration),
      renewalCost: pricing.renewal ? Number(pricing.renewal) : undefined,
      transferCost: pricing.transfer ? Number(pricing.transfer) : undefined,
      exact: false,
      note: 'Public TLD pricing estimate.',
      checkedAt: new Date().toISOString(),
    };

    this.pricingCache.set(cacheKey, quote);
    return quote;
  }

  async getExactQuote(domain: string): Promise<PriceQuote | null> {
    if (!this.status.configured) {
      return null;
    }

    const response = await fetch(
      `https://api.porkbun.com/api/json/v3/domain/checkDomain/${encodeURIComponent(domain)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent,
        },
        body: JSON.stringify({
          apikey: config.porkbun.apiKey,
          secretapikey: config.porkbun.secretApiKey,
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as PorkbunCheckResponse;
    if (payload.status !== 'SUCCESS') {
      return null;
    }

    return {
      registrar: 'porkbun',
      registrarName: 'Porkbun',
      currency: 'USD',
      registrationCost: payload.price ? Number(payload.price) : undefined,
      renewalCost: payload.renewalPrice ? Number(payload.renewalPrice) : undefined,
      transferCost: payload.transferPrice ? Number(payload.transferPrice) : undefined,
      available: payload.avail === 'yes',
      exact: true,
      note: 'Exact domain check from Porkbun.',
      checkedAt: new Date().toISOString(),
    };
  }

  async registerDomain(domain: string): Promise<RegistrationResult> {
    const requestSummary: Record<string, unknown> = {
      domain,
      registrar: 'porkbun',
      purchaseMode: this.purchaseMode,
    };

    if (this.purchaseMode !== 'live') {
      return {
        registrar: 'porkbun',
        mode: this.purchaseMode,
        liveAttempted: false,
        success: true,
        requestSummary,
        response: {
          note: 'Purchase mode is not live, so no order was sent.',
        },
      };
    }

    if (!this.status.configured) {
      throw new Error('Porkbun credentials are not configured.');
    }

    const quote = await this.getExactQuote(domain);
    if (!quote?.registrationCost) {
      throw new Error('Porkbun did not return a live registration price.');
    }

    const cost = Math.round(quote.registrationCost * 100);
    requestSummary.costInCents = cost;

    const response = await fetch(
      `https://api.porkbun.com/api/json/v3/domain/create/${encodeURIComponent(domain)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent,
        },
        body: JSON.stringify({
          apikey: config.porkbun.apiKey,
          secretapikey: config.porkbun.secretApiKey,
          cost,
          agreeToTerms: 'yes',
        }),
      }
    );

    const payload = await response.json();

    return {
      registrar: 'porkbun',
      mode: this.purchaseMode,
      liveAttempted: true,
      success: response.ok && payload?.status === 'SUCCESS',
      requestSummary,
      response: payload,
    };
  }
}
