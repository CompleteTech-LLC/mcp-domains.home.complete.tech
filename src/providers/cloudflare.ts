import { config } from '../config.js';
import type { PriceQuote, ProviderStatus, RegistrationResult } from '../types.js';
import type { RegistrarProvider } from './base.js';

interface CloudflareCheckPayload {
  success: boolean;
  result?: {
    domains?: Array<{
      name: string;
      registrable: boolean;
      tier?: string;
      pricing?: {
        currency?: string;
        registration_cost?: string;
        renewal_cost?: string;
      };
      reason?: string;
    }>;
  };
}

export class CloudflareProvider implements RegistrarProvider {
  readonly status: ProviderStatus = {
    id: 'cloudflare',
    name: 'Cloudflare Registrar',
    configured: Boolean(config.cloudflare.accountId && config.cloudflare.apiToken),
    supportsEstimatedPricing: false,
    supportsExactLookup: Boolean(config.cloudflare.accountId && config.cloudflare.apiToken),
    supportsLivePurchase: Boolean(config.cloudflare.accountId && config.cloudflare.apiToken),
    notes: ['Requires account billing, a default registrant contact, and Registrar write permissions.'],
  };

  constructor(private readonly purchaseMode: 'disabled' | 'manual' | 'live') {}

  async getExactQuote(domain: string): Promise<PriceQuote | null> {
    if (!this.status.configured) {
      return null;
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.cloudflare.accountId}/registrar/domain-check`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.cloudflare.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domains: [domain],
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as CloudflareCheckPayload;
    const result = payload.result?.domains?.[0];
    if (!result) {
      return null;
    }

    return {
      registrar: 'cloudflare',
      registrarName: 'Cloudflare Registrar',
      currency: result.pricing?.currency ?? 'USD',
      registrationCost: result.pricing?.registration_cost
        ? Number(result.pricing.registration_cost)
        : undefined,
      renewalCost: result.pricing?.renewal_cost ? Number(result.pricing.renewal_cost) : undefined,
      available: result.registrable,
      exact: true,
      note: result.reason
        ? `Cloudflare check reason: ${result.reason}`
        : `Exact Cloudflare registrar check (${result.tier ?? 'unknown'} tier).`,
      checkedAt: new Date().toISOString(),
    };
  }

  async registerDomain(domain: string): Promise<RegistrationResult> {
    const requestSummary = {
      domain,
      registrar: 'cloudflare',
      purchaseMode: this.purchaseMode,
    };

    if (this.purchaseMode !== 'live') {
      return {
        registrar: 'cloudflare',
        mode: this.purchaseMode,
        liveAttempted: false,
        success: true,
        requestSummary,
        response: {
          note: 'Purchase mode is not live, so no registration request was sent.',
        },
      };
    }

    if (!this.status.configured) {
      throw new Error('Cloudflare Registrar credentials are not configured.');
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.cloudflare.accountId}/registrar/registrations`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.cloudflare.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain_name: domain,
        }),
      }
    );

    const payload = await response.json();

    return {
      registrar: 'cloudflare',
      mode: this.purchaseMode,
      liveAttempted: true,
      success: response.ok && payload?.success === true,
      requestSummary,
      response: payload,
    };
  }
}
