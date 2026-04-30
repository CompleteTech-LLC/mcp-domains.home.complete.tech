import type { DomainAssessment, DomainComparison } from './types.js';
import { splitDomain, tokenizeQuery } from './domain-utils.js';

const TLD_SCORES: Record<string, number> = {
  com: 100,
  ai: 90,
  dev: 84,
  io: 82,
  app: 78,
  co: 76,
  org: 72,
  net: 68,
  xyz: 48,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function calculateBrandabilityScore(sld: string): number {
  let score = 80;

  if (sld.length < 4) {
    score -= 15;
  }

  if (sld.length > 12) {
    score -= Math.min(25, (sld.length - 12) * 3);
  }

  if (sld.includes('-')) {
    score -= 18;
  }

  if (/\d/.test(sld)) {
    score -= 15;
  }

  if (/(.)\1\1/.test(sld)) {
    score -= 10;
  }

  return clamp(score);
}

function calculateFitScore(domain: string, query: string): { score: number; reasons: string[] } {
  const { sld } = splitDomain(domain);
  const queryTokens = tokenizeQuery(query);
  const reasons: string[] = [];

  if (queryTokens.length === 0) {
    return { score: 50, reasons };
  }

  let hits = 0;
  for (const token of queryTokens) {
    if (sld.includes(token)) {
      hits += 1;
    }
  }

  if (hits === queryTokens.length) {
    reasons.push('The second-level domain covers every key query token.');
  } else if (hits > 0) {
    reasons.push('The second-level domain preserves some of the project keywords.');
  } else {
    reasons.push('The second-level domain does not directly reflect the project keywords.');
  }

  return {
    score: clamp((hits / queryTokens.length) * 100),
    reasons,
  };
}

function calculateCostScore(registrationCost: number | undefined, budgetLimit: number | undefined): number {
  if (registrationCost === undefined) {
    return 60;
  }

  if (budgetLimit === undefined || budgetLimit <= 0) {
    return registrationCost <= 15 ? 90 : registrationCost <= 30 ? 70 : 45;
  }

  if (registrationCost <= budgetLimit) {
    return clamp(100 - (registrationCost / budgetLimit) * 40);
  }

  return clamp(40 - ((registrationCost - budgetLimit) / budgetLimit) * 50);
}

export function assessDomain(
  comparison: DomainComparison,
  query: string,
  budgetLimit?: number
): DomainAssessment {
  const { sld, tld } = splitDomain(comparison.domain);
  const brandabilityScore = calculateBrandabilityScore(sld);
  const fit = calculateFitScore(comparison.domain, query);
  const tldScore = TLD_SCORES[tld] ?? 60;
  const costScore = calculateCostScore(comparison.cheapestQuote?.registrationCost, budgetLimit);
  const availabilityMultiplier = comparison.consensusAvailable === false ? 0.25 : 1;
  const availabilityReason =
    comparison.consensusAvailable === false
      ? 'The domain looks unavailable, so it is heavily penalized for acquisition.'
      : comparison.consensusAvailable === true
        ? 'The domain appears registrable based on the current lookup signals.'
        : 'Availability is uncertain, so this score is less reliable than usual.';

  const rawScore =
    brandabilityScore * 0.3 +
    fit.score * 0.3 +
    tldScore * 0.2 +
    costScore * 0.2;

  const reasons = [availabilityReason, ...fit.reasons];

  if (comparison.cheapestQuote?.registrationCost !== undefined) {
    reasons.push(
      `Current lowest first-year price is about $${comparison.cheapestQuote.registrationCost.toFixed(2)}.`
    );
  } else {
    reasons.push('No registrar returned a price quote, so affordability is estimated conservatively.');
  }

  if (sld.includes('-')) {
    reasons.push('Hyphens usually make brand recall and verbal sharing worse.');
  }

  if (/\d/.test(sld)) {
    reasons.push('Digits reduce trust and are easy to mishear in conversation.');
  }

  return {
    domain: comparison.domain,
    score: Math.round(rawScore * availabilityMultiplier),
    availability: comparison.consensusAvailable,
    brandabilityScore: Math.round(brandabilityScore),
    fitScore: Math.round(fit.score),
    tldScore: Math.round(tldScore),
    costScore: Math.round(costScore),
    estimatedRegistrationCost: comparison.cheapestQuote?.registrationCost,
    reasons,
  };
}
