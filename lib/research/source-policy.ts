/**
 * Research domains are configuration, not model output. Keep this list small
 * and reviewable because it is also the boundary used by the web-search tool.
 * A domain entry permits the domain and its subdomains, but not lookalike
 * hosts such as `everynation.org.attacker.example`.
 */

export type ResearchSourceRole = "theological" | "general";

export interface ResearchSourcePolicyEntry {
  domain: string;
  role: ResearchSourceRole;
  publisher: string;
  description: string;
}

export const THEOLOGICAL_RESEARCH_DOMAINS = [
  "everynation.org",
  "victory.org.ph",
  "church.victory.org.ph",
  "biblegateway.com",
  "bible.com",
] as const;

/**
 * General sources are limited to established public-health and psychology
 * references. They provide context for practical care, not doctrine.
 */
export const GENERAL_RESEARCH_DOMAINS = [
  "nih.gov",
  "cdc.gov",
  "who.int",
  "apa.org",
] as const;

export const RESEARCH_SOURCE_POLICY: readonly ResearchSourcePolicyEntry[] = [
  {
    domain: "everynation.org",
    role: "theological",
    publisher: "Every Nation",
    description: "Public Christian doctrine and ministry reference material.",
  },
  {
    domain: "victory.org.ph",
    role: "theological",
    publisher: "Victory",
    description: "Public Christian doctrine and ministry reference material.",
  },
  {
    domain: "church.victory.org.ph",
    role: "theological",
    publisher: "Victory",
    description: "Public Christian doctrine and ministry reference material.",
  },
  {
    domain: "biblegateway.com",
    role: "theological",
    publisher: "Bible Gateway",
    description: "Scripture reference lookup; not a source for invented quotations.",
  },
  {
    domain: "bible.com",
    role: "theological",
    publisher: "YouVersion Bible",
    description: "Scripture reference lookup; not a source for invented quotations.",
  },
  {
    domain: "nih.gov",
    role: "general",
    publisher: "National Institutes of Health",
    description: "General health and wellbeing context.",
  },
  {
    domain: "cdc.gov",
    role: "general",
    publisher: "Centers for Disease Control and Prevention",
    description: "General public-health context.",
  },
  {
    domain: "who.int",
    role: "general",
    publisher: "World Health Organization",
    description: "General public-health context.",
  },
  {
    domain: "apa.org",
    role: "general",
    publisher: "American Psychological Association",
    description: "General psychology and wellbeing context.",
  },
] as const;

const POLICY_BY_DOMAIN = new Map(
  RESEARCH_SOURCE_POLICY.map((entry) => [entry.domain, entry]),
);

/**
 * Return a fresh copy so callers cannot mutate the policy used by later
 * requests. The optional role filter is useful when a caller needs to explain
 * why a source is theological versus general context.
 */
export function getAllowedResearchDomains(
  role?: ResearchSourceRole,
): string[] {
  return RESEARCH_SOURCE_POLICY.filter(
    (entry) => role === undefined || entry.role === role,
  ).map((entry) => entry.domain);
}

export function getSourcePolicyEntry(
  domain: string,
): ResearchSourcePolicyEntry | undefined {
  const hostname = normalizeHostname(domain);
  return (
    POLICY_BY_DOMAIN.get(hostname) ??
    RESEARCH_SOURCE_POLICY.find((entry) =>
      isHostnameWithinPolicy(hostname, entry.domain),
    )
  );
}

/**
 * Check a URL against the allowlist. HTTPS is required for citations and the
 * host comparison is exact-or-subdomain, never a substring comparison.
 */
export function isAllowedResearchUrl(
  value: string,
  role?: ResearchSourceRole,
): boolean {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  const hostname = normalizeHostname(parsed.hostname);
  return RESEARCH_SOURCE_POLICY.some(
    (entry) =>
      (role === undefined || entry.role === role) &&
      isHostnameWithinPolicy(hostname, entry.domain),
  );
}

export function isAllowedResearchDomain(
  domain: string,
  role?: ResearchSourceRole,
): boolean {
  const hostname = normalizeHostname(domain);

  return RESEARCH_SOURCE_POLICY.some(
    (entry) =>
      (role === undefined || entry.role === role) &&
      (hostname === entry.domain || hostname.endsWith(`.${entry.domain}`)),
  );
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function isHostnameWithinPolicy(hostname: string, policyDomain: string): boolean {
  return hostname === policyDomain || hostname.endsWith(`.${policyDomain}`);
}
