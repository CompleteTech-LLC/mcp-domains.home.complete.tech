---
name: domain-buyer
description: Use when selecting, scoring, comparing, and safely purchasing domain names through the project-specific domain MCP server. Applies to naming research, registrar comparison, budget-aware recommendations, and guarded registration flows.
---

# Domain Buyer

Use this skill when the user wants help finding domain names, comparing registrars, or deciding whether to buy a domain.

## Workflow

1. Start with `discover_domain_options` when the user has a business idea, project brief, or a few keywords.
2. Use `assess_domain_candidates` when the user already has a shortlist and wants a ranking.
3. Use `compare_domain_prices` on finalists before making a recommendation.
4. Use `plan_domain_purchase` immediately before any purchase discussion.
5. Only use `register_domain` after the user clearly approves the exact domain and registrar.

## Recommendation Rules

- Prefer names that are easy to say, easy to spell, and short enough to remember.
- Penalize hyphens, digits, awkward abbreviations, and cheap-looking TLD choices unless the user explicitly wants them.
- Treat `.com` as the default trust anchor when price and fit are reasonable.
- Treat `.ai`, `.dev`, `.io`, and `.app` as situationally strong, not universally better.
- Mention renewal cost when it is materially higher than the first-year registration price.
- If availability is uncertain, say so plainly and avoid overstating confidence.

## Purchase Guardrails

- Never recommend a purchase without re-running `compare_domain_prices`.
- Never call `register_domain` without first calling `plan_domain_purchase`.
- The guard phrase from `plan_domain_purchase` is required but is not itself user consent.
- Ask for explicit approval in natural language before registration.
- If purchase mode is `disabled` or `manual`, explain that the server is intentionally not making a live order.

## Output Style

- Give a small shortlist, not an overwhelming dump.
- Separate factual data from judgment:
  - Facts: availability, first-year price, renewal price, supported live registrars.
  - Judgment: memorability, brand fit, resale risk, trust.
- When recommending one domain over another, name the tradeoff directly.
