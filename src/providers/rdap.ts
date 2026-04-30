import type { AvailabilitySignal, ProviderStatus } from '../types.js';

export class RdapProvider {
  readonly status: ProviderStatus = {
    id: 'rdap',
    name: 'RDAP',
    configured: true,
    supportsEstimatedPricing: false,
    supportsExactLookup: true,
    supportsLivePurchase: false,
    notes: ['Public zero-config availability source.'],
  };

  constructor(private readonly userAgent: string) {}

  async checkAvailability(domains: string[]): Promise<AvailabilitySignal[]> {
    return Promise.all(
      domains.map(async (domain) => {
        const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
        });

        if (response.status === 404) {
          return {
            source: 'rdap' as const,
            available: true,
            checkedAt: new Date().toISOString(),
            note: 'RDAP returned 404 (domain not found).',
          };
        }

        if (response.ok) {
          return {
            source: 'rdap' as const,
            available: false,
            checkedAt: new Date().toISOString(),
            note: 'RDAP returned an existing registration object.',
          };
        }

        return {
          source: 'rdap' as const,
          available: null,
          checkedAt: new Date().toISOString(),
          note: `RDAP returned HTTP ${response.status}.`,
        };
      })
    );
  }
}
