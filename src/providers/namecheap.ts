import { XMLParser } from 'fast-xml-parser';
import { config } from '../config.js';
import type { PriceQuote, ProviderStatus } from '../types.js';
import type { RegistrarProvider } from './base.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export class NamecheapProvider implements RegistrarProvider {
  readonly status: ProviderStatus = {
    id: 'namecheap',
    name: 'Namecheap',
    configured: Boolean(
      config.namecheap.apiUser && config.namecheap.apiKey && config.namecheap.clientIp
    ),
    supportsEstimatedPricing: Boolean(
      config.namecheap.apiUser && config.namecheap.apiKey && config.namecheap.clientIp
    ),
    supportsExactLookup: Boolean(
      config.namecheap.apiUser && config.namecheap.apiKey && config.namecheap.clientIp
    ),
    supportsLivePurchase: false,
    notes: ['Requires Namecheap API access and a whitelisted IPv4 address.'],
  };

  private buildBaseParams(command: string): URLSearchParams {
    return new URLSearchParams({
      ApiUser: config.namecheap.apiUser,
      ApiKey: config.namecheap.apiKey,
      UserName: config.namecheap.apiUser,
      ClientIp: config.namecheap.clientIp,
      Command: command,
    });
  }

  async getEstimatedPricing(tld: string): Promise<PriceQuote | null> {
    if (!this.status.configured) {
      return null;
    }

    const params = this.buildBaseParams('namecheap.users.getPricing');
    params.set('ProductType', 'DOMAIN');
    params.set('ProductCategory', 'DOMAINS');
    params.set('ActionName', 'REGISTER');
    params.set('ProductName', tld.toUpperCase());

    const response = await fetch(`https://api.namecheap.com/xml.response?${params.toString()}`);
    if (!response.ok) {
      return null;
    }

    const xml = await response.text();
    const parsed = parser.parse(xml) as any;
    const products = asArray(
      parsed?.ApiResponse?.CommandResponse?.UserGetPricingResult?.ProductType?.ProductCategory?.Product
    );
    const product = products.find((item: any) => String(item?.Name).toLowerCase() === tld.toLowerCase());
    const firstPrice = asArray(product?.Price)[0];

    if (!firstPrice?.Price) {
      return null;
    }

    return {
      registrar: 'namecheap',
      registrarName: 'Namecheap',
      currency: firstPrice.Currency ?? 'USD',
      registrationCost: Number(firstPrice.Price),
      renewalCost: Number(firstPrice.Price),
      exact: false,
      note: 'Namecheap TLD pricing estimate.',
      checkedAt: new Date().toISOString(),
    };
  }

  async getExactQuote(domain: string): Promise<PriceQuote | null> {
    if (!this.status.configured) {
      return null;
    }

    const params = this.buildBaseParams('namecheap.domains.check');
    params.set('DomainList', domain);

    const response = await fetch(`https://api.namecheap.com/xml.response?${params.toString()}`);
    if (!response.ok) {
      return null;
    }

    const xml = await response.text();
    const parsed = parser.parse(xml) as any;
    const result = parsed?.ApiResponse?.CommandResponse?.DomainCheckResult;
    if (!result) {
      return null;
    }

    const available = String(result.Available) === 'true';
    const isPremium = String(result.IsPremiumName) === 'true';
    const premiumPrice = Number(result.PremiumRegistrationPrice ?? 0);

    return {
      registrar: 'namecheap',
      registrarName: 'Namecheap',
      currency: 'USD',
      registrationCost: isPremium && premiumPrice > 0 ? premiumPrice : undefined,
      renewalCost:
        result.PremiumRenewalPrice && Number(result.PremiumRenewalPrice) > 0
          ? Number(result.PremiumRenewalPrice)
          : undefined,
      available,
      exact: true,
      note: isPremium
        ? 'Exact domain check from Namecheap with premium pricing.'
        : 'Exact domain check from Namecheap. Standard pricing may require a separate pricing lookup.',
      checkedAt: new Date().toISOString(),
    };
  }
}
