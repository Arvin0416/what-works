import type { ArticleContent, SafetyReport } from "../content/types";

type RiskLevel = SafetyReport["riskLevel"];

interface RiskRule {
  flag: string;
  level: Exclude<RiskLevel, "low">;
  pattern: RegExp;
}

const RISK_RULES: readonly RiskRule[] = [
  {
    flag: "emergency-risk",
    level: "critical",
    pattern:
      /\b(?:immediate danger|life[- ]threatening|there is an emergency|i(?:'m| am) not safe|i feel unsafe)\b/i,
  },
  {
    flag: "imminent-danger",
    level: "critical",
    pattern:
      /\b(?:right now|tonight|today|immediately|this moment)\b[\s\S]{0,100}\b(?:kill myself|end my life|take my own life|hurt myself|hurt someone|self[- ]harm|suicide)\b|\b(?:kill myself|end my life|take my own life|hurt myself|hurt someone|self[- ]harm|suicide)\b[\s\S]{0,100}\b(?:right now|tonight|today|immediately|this moment)\b/i,
  },
  {
    flag: "self-harm-risk",
    level: "high",
    pattern:
      /\b(?:suicid(?:e|al)|self[- ]harm|kill myself|end my life|take my own life|hurt myself)\b/i,
  },
  {
    flag: "harm-to-others-risk",
    level: "high",
    pattern: /\b(?:hurt someone|kill someone|harm another person|assault someone)\b/i,
  },
  {
    flag: "abuse-risk",
    level: "high",
    pattern:
      /\b(?:ongoing abuse|domestic violence|sexual abuse|physical abuse|being abused|assaulted|abuse victim)\b/i,
  },
  {
    flag: "medical-risk",
    level: "high",
    pattern:
      /\b(?:medical emergency|chest pain|trouble breathing|can't breathe|cannot breathe|overdose|severe bleeding)\b/i,
  },
  {
    flag: "eating-disorder-risk",
    level: "high",
    pattern:
      /\b(?:eating disorder|purging|binge(?:ing| eating)|starving myself|anorexia|bulimia)\b/i,
  },
  {
    flag: "distress-context",
    level: "medium",
    pattern:
      /\b(?:panic attack|severe anxiety|depressed|depression|trauma response|acute grief|withdrawal)\b/i,
  },
] as const;

const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const ESCALATION_COPY =
  "Pause this draft for human review. If someone may be in immediate danger or may hurt themselves or someone else, contact local emergency services now, involve a trusted person, and seek qualified pastoral or professional care.";

/**
 * Evaluate article prose for signals that require a human safety review. The
 * safety note is deliberately excluded: it is expected to contain the site's
 * own emergency disclaimer and should not make an otherwise ordinary article
 * look like a crisis disclosure.
 */
export function evaluateSafety(input: ArticleContent): SafetyReport {
  const text = [
    input.title,
    input.dek,
    input.summary,
    ...input.sections.flatMap((section) => [section.heading, section.body]),
    input.prayer,
  ].join("\n");

  const matchedRules = RISK_RULES.filter((rule) => rule.pattern.test(text));
  const highestRisk = matchedRules.reduce(
    (level, rule) =>
      RISK_LEVEL_ORDER[rule.level] > RISK_LEVEL_ORDER[level]
        ? rule.level
        : level,
    "low" as RiskLevel,
  );
  const flags = matchedRules.map((rule) => rule.flag);

  if (
    (highestRisk === "high" || highestRisk === "critical") &&
    !flags.includes("emergency-risk")
  ) {
    flags.unshift("emergency-risk");
  }

  return {
    riskLevel: highestRisk,
    flags: [...new Set(flags)],
    blocked: highestRisk === "high" || highestRisk === "critical",
    ...(highestRisk === "high" || highestRisk === "critical"
      ? { escalationCopy: ESCALATION_COPY }
      : {}),
  };
}

export const SAFETY_ESCALATION_COPY = ESCALATION_COPY;
