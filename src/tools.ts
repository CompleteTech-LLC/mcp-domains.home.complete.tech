import { z } from 'zod';
import { config } from './config.js';
import { expandDomains, generateBaseNames } from './domain-utils.js';
import { ProviderManager } from './provider-manager.js';
import { assessDomain } from './scoring.js';
import type { RegistrarId } from './types.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
}

const manager = new ProviderManager();

function normalizeRequestedTlds(tlds: string[] | undefined): string[] {
  return (tlds?.length ? tlds : config.defaultTlds)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export const tools: ToolDefinition[] = [
  {
    name: 'discover_domain_options',
    description:
      'Generate domain candidates from a project or business description, check registrability with RDAP, estimate first-year prices, and rank options with domain-fit heuristics.',
    inputSchema: {
      query: z.string().min(3).describe('Project name, business description, or naming brief.'),
      tlds: z.array(z.string()).optional().describe('Preferred TLDs, such as ["com","ai","dev"].'),
      maxBaseNames: z.number().int().min(3).max(30).optional().describe('Maximum generated base names.'),
      maxResults: z.number().int().min(5).max(50).optional().describe('Maximum ranked domains to return.'),
      includeUnavailable: z.boolean().optional().describe('Include names that appear unavailable.'),
    },
  },
  {
    name: 'compare_domain_prices',
    description:
      'Compare a specific domain across configured registrars, combining RDAP availability with exact or estimated pricing where supported.',
    inputSchema: {
      domain: z.string().describe('Exact domain name to compare, such as example.com.'),
    },
  },
  {
    name: 'assess_domain_candidates',
    description:
      'Rank a user-supplied list of domain names for a given project, combining availability, price, TLD quality, and brandability.',
    inputSchema: {
      query: z.string().min(3).describe('Project summary or naming brief used for fit scoring.'),
      domains: z.array(z.string()).min(1).max(20).describe('Candidate domains to assess.'),
      budgetLimit: z.number().positive().optional().describe('Optional first-year budget cap in USD.'),
    },
  },
  {
    name: 'plan_domain_purchase',
    description:
      'Prepare a safe purchase plan for one domain, recommending the best registrar, exposing risks, and generating the guard phrase required by register_domain.',
    inputSchema: {
      domain: z.string().describe('Exact domain name to prepare for purchase.'),
    },
  },
  {
    name: 'register_domain',
    description:
      'Guarded registration entry point for Porkbun or Cloudflare. This is billable. Only call after explicit user approval and only with the exact guard phrase returned by plan_domain_purchase.',
    inputSchema: {
      domain: z.string().describe('Exact domain to register.'),
      registrar: z.enum(['porkbun', 'cloudflare']).describe('Registrar to use for the registration call.'),
      guardPhrase: z.string().describe('Exact guard phrase from a fresh plan_domain_purchase result.'),
    },
  },
];

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'discover_domain_options': {
      const query = String(args.query);
      const maxBaseNames = typeof args.maxBaseNames === 'number' ? args.maxBaseNames : 12;
      const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 20;
      const includeUnavailable = Boolean(args.includeUnavailable);
      const tlds = normalizeRequestedTlds(args.tlds as string[] | undefined);
      const baseNames = generateBaseNames(query, maxBaseNames);
      const candidateDomains = expandDomains(baseNames, tlds);
      const comparisons = await Promise.all(candidateDomains.map((domain) => manager.compareDomain(domain)));
      const estimatedQuotesByTld = new Map(
        await Promise.all(
          Array.from(new Set(tlds)).map(async (tld) => [tld, await manager.getEstimatedTldQuotes(tld)] as const)
        )
      );
      const ranked = comparisons
        .map((comparison) => {
          const fallbackQuotes = estimatedQuotesByTld.get(comparison.tld) ?? [];
          const candidateQuotes = comparison.quotes.length > 0 ? comparison.quotes : fallbackQuotes;
          const cheapestQuote =
            candidateQuotes
              .filter((quote) => quote.registrationCost !== undefined)
              .sort(
                (left, right) =>
                  (left.registrationCost ?? Number.POSITIVE_INFINITY) -
                  (right.registrationCost ?? Number.POSITIVE_INFINITY)
              )[0] ?? null;

          const mergedComparison = {
            ...comparison,
            quotes: candidateQuotes,
            cheapestQuote,
          };
          const assessment = assessDomain(mergedComparison, query);
          return {
            domain: comparison.domain,
            sld: comparison.sld,
            tld: comparison.tld,
            availability: comparison.consensusAvailable,
            estimatedRegistrationCost: cheapestQuote?.registrationCost,
            estimatedCostSource: cheapestQuote?.registrar,
            score: assessment.score,
            reasons: assessment.reasons,
            quotes: mergedComparison.quotes,
          };
        })
        .filter((candidate) => includeUnavailable || candidate.availability !== false)
        .sort((left, right) => {
          const availabilityRankLeft = left.availability === true ? 0 : left.availability === null ? 1 : 2;
          const availabilityRankRight = right.availability === true ? 0 : right.availability === null ? 1 : 2;
          if (availabilityRankLeft !== availabilityRankRight) {
            return availabilityRankLeft - availabilityRankRight;
          }

          return right.score - left.score;
        })
        .slice(0, maxResults);

      return {
        query,
        baseNames,
        providerStatuses: manager.getProviderStatuses(),
        results: ranked,
      };
    }

    case 'compare_domain_prices': {
      const domain = String(args.domain).trim().toLowerCase();
      return {
        comparison: await manager.compareDomain(domain),
        providerStatuses: manager.getProviderStatuses(),
      };
    }

    case 'assess_domain_candidates': {
      const query = String(args.query);
      const budgetLimit = typeof args.budgetLimit === 'number' ? args.budgetLimit : undefined;
      const domains = (args.domains as string[]).map((item) => item.trim().toLowerCase());
      const comparisons = await Promise.all(domains.map((domain) => manager.compareDomain(domain)));
      const assessments = comparisons
        .map((comparison) => ({
          comparison,
          assessment: assessDomain(comparison, query, budgetLimit),
        }))
        .sort((left, right) => right.assessment.score - left.assessment.score);

      return {
        query,
        budgetLimit,
        ranking: assessments.map(({ comparison, assessment }) => ({
          ...assessment,
          cheapestQuote: comparison.cheapestQuote,
          livePurchasableVia: comparison.livePurchasableVia,
        })),
      };
    }

    case 'plan_domain_purchase': {
      const domain = String(args.domain).trim().toLowerCase();
      const comparison = await manager.compareDomain(domain);
      return {
        comparison,
        plan: manager.createPurchasePlan(comparison),
      };
    }

    case 'register_domain': {
      const domain = String(args.domain).trim().toLowerCase();
      const registrar = args.registrar as RegistrarId;
      const guardPhrase = String(args.guardPhrase);

      return manager.registerDomain(domain, registrar, guardPhrase);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
