import { describe, expect, it } from "vitest";

import { seedArticle } from "../../lib/content/seed";
import { evaluateSafety } from "../../lib/safety/content-safety";

describe("content safety", () => {
  it("keeps ordinary seed content low risk and does not scan the disclaimer as a crisis disclosure", () => {
    const report = evaluateSafety(seedArticle.content);

    expect(report).toEqual({
      riskLevel: "low",
      flags: [],
      blocked: false,
    });
  });

  it("blocks imminent self-harm language and provides escalation copy", () => {
    const report = evaluateSafety({
      ...seedArticle.content,
      sections: [
        {
          ...seedArticle.content.sections[0],
          body: "I want to kill myself tonight and do not feel safe.",
        },
        ...seedArticle.content.sections.slice(1),
      ],
    });

    expect(report.riskLevel).toBe("critical");
    expect(report.blocked).toBe(true);
    expect(report.flags).toEqual(
      expect.arrayContaining(["imminent-danger", "self-harm-risk"]),
    );
    expect(report.escalationCopy).toMatch(/emergency services/i);
  });

  it("flags medical emergency language for human review", () => {
    const report = evaluateSafety({
      ...seedArticle.content,
      sections: [
        {
          ...seedArticle.content.sections[0],
          body: "If you have chest pain or trouble breathing, seek immediate care.",
        },
        ...seedArticle.content.sections.slice(1),
      ],
    });

    expect(report.riskLevel).toBe("high");
    expect(report.blocked).toBe(true);
    expect(report.flags).toContain("medical-risk");
  });

  it("returns a review warning for non-emergency distress context", () => {
    const report = evaluateSafety({
      ...seedArticle.content,
      sections: [
        {
          ...seedArticle.content.sections[0],
          body: "A panic attack can make an ordinary moment feel overwhelming.",
        },
        ...seedArticle.content.sections.slice(1),
      ],
    });

    expect(report.riskLevel).toBe("medium");
    expect(report.blocked).toBe(false);
    expect(report.flags).toContain("distress-context");
  });
});
