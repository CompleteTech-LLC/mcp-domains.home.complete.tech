const COMPOUND_TLDS = new Set([
  'co.uk',
  'org.uk',
  'me.uk',
  'com.au',
  'net.au',
  'co.nz',
  'com.br',
]);

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export function splitDomain(domain: string): { sld: string; tld: string } {
  const normalized = normalizeDomain(domain);
  const labels = normalized.split('.').filter(Boolean);

  if (labels.length < 2) {
    throw new Error(`Invalid domain: ${domain}`);
  }

  const lastTwo = labels.slice(-2).join('.');
  if (labels.length >= 3 && COMPOUND_TLDS.has(lastTwo)) {
    return {
      sld: labels.slice(0, -2).join('.'),
      tld: lastTwo,
    };
  }

  return {
    sld: labels.slice(0, -1).join('.'),
    tld: labels.at(-1) ?? '',
  };
}

export function tokenizeQuery(input: string): string[] {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 1 && !STOP_WORDS.has(part))
    )
  );
}

function abbreviate(parts: string[]): string {
  return parts.map((part) => part[0]).join('');
}

export function generateBaseNames(query: string, maxBaseNames = 12): string[] {
  const words = tokenizeQuery(query);
  if (words.length === 0) {
    throw new Error('The query did not contain any usable words for domain generation.');
  }

  const results = new Set<string>();
  const joined = words.join('');
  const dashed = words.join('-');

  results.add(joined);
  if (words.length > 1) {
    results.add(dashed);
    results.add(words.slice(0, 2).join(''));
    results.add(abbreviate(words));
    results.add(`${words[0]}${words.at(-1) ?? ''}`);
  }

  const prefixes = ['get', 'go', 'join', 'try', 'use'];
  const suffixes = ['app', 'base', 'co', 'hq', 'hub', 'lab', 'now'];

  for (const prefix of prefixes) {
    results.add(`${prefix}${joined}`);
  }

  for (const suffix of suffixes) {
    results.add(`${joined}${suffix}`);
  }

  if (words.length >= 2) {
    results.add(`${words[0]}${suffixes[0]}`);
    results.add(`${words[0]}${words[1][0]}`);
  }

  return Array.from(results)
    .map((item) => item.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    .filter((item) => item.length >= 3 && item.length <= 63)
    .slice(0, maxBaseNames);
}

export function expandDomains(baseNames: string[], tlds: string[]): string[] {
  const results = new Set<string>();

  for (const baseName of baseNames) {
    for (const tld of tlds) {
      results.add(`${baseName}.${tld.toLowerCase()}`);
    }
  }

  return Array.from(results);
}
