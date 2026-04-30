import type { PurchaseMode } from './types.js';

const FALLBACK_TLDS = ['com', 'ai', 'dev', 'io', 'app', 'co'];

function parsePurchaseMode(value: string | undefined): PurchaseMode {
  if (value === 'manual' || value === 'live') {
    return value;
  }

  return 'disabled';
}

export const config = {
  defaultTlds:
    process.env.DEFAULT_TLDS?.split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean) ?? FALLBACK_TLDS,
  purchaseMode: parsePurchaseMode(process.env.DOMAIN_PURCHASE_MODE),
  userAgent: process.env.DOMAIN_USER_AGENT?.trim() || 'complete-tech-domain-suite/0.1.0',
  porkbun: {
    apiKey: process.env.PORKBUN_API_KEY?.trim() || '',
    secretApiKey: process.env.PORKBUN_SECRET_API_KEY?.trim() || '',
  },
  namecheap: {
    apiUser: process.env.NAMECHEAP_API_USER?.trim() || '',
    apiKey: process.env.NAMECHEAP_API_KEY?.trim() || '',
    clientIp: process.env.NAMECHEAP_CLIENT_IP?.trim() || '',
  },
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '',
    apiToken: process.env.CLOUDFLARE_API_TOKEN?.trim() || '',
  },
};
