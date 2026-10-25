import { describe, expect, it, vi } from "vitest";

import { seedArticle } from "../../lib/content/seed";
import type { ResearchDossier, Topic } from "../../lib/content/types";
import {
  buildArticleRequest,
  generateArticle,
} from "../../lib/generation/generate-article";
import type { OpenAIResponsesClient } from "../../lib/research/openai-research";
import {
  ARTICLE_SYSTEM_PROMPT,
  CHRISTIAN_DOCTRINE_PROFILE,
} from "../../lib/generation/prompts";
import {
  isBibleReferenceShape,
  validateGeneratedArticle,
} from "../../lib/generation/validate-article";

const topic: Topic = {
  id: "spiritual-growth",
  label: "Feeling far from God",
  prompt: "Give a reader one honest next step toward Jesus.",
  categoryId: "spiritual-growth",
};

const dossier: ResearchDossier = {
  topicId: topic.id,
  claims: ["A small, repeatable practice can help a person re-engage attention."],
  scriptureRefs: seedArticle.content.scriptureRefs,
  uncertaintyNotes: ["The guidance is not pastoral or medical diagnosis."],
  sources: seedArticle.sources,
};

describe("generated article validation", () => {
  it("requires source citations", () => {
    const report = validateGeneratedArticle({
      content: seedArticle.content,
      sources: [],
    });

    expect(report.passed).toBe(false);
    expect(report.blockedReasons.join(" ")).toMatch(/source citation/i);
  });

  it("accepts valid content when citations come from the dossier", () => {
    const report = validateGeneratedArticle(
      {
        content: seedArticle.content,
        sources: dossier.sources,
        citationUrls: dossier.sources.map((source) => source.url),
      },
      dossier,
    );

    expect(report).toEqual({
      passed: true,
      warnings: [],
      blockedReasons: [],
    });
  });

  it("rejects an invented-looking Bible reference", () => {
    expect(isBibleReferenceShape("Psalm 13:1-2")).toBe(true);
    expect(isBibleReferenceShape("Made Up 99:99")).toBe(false);

    const report = validateGeneratedArticle(
      {
        content: {
          ...seedArticle.content,
          scriptureRefs: ["Made Up 99:99"],
        },
        sources: dossier.sources,
      },
      dossier,
    );

    expect(report.passed).toBe(false);
    expect(report.blockedReasons.join(" ")).toMatch(/scripture reference/i);
  });

  it("rejects a cited URL that is absent from the dossier", () => {
    const report = validateGeneratedArticle(
      {
        content: seedArticle.content,
        sources: dossier.sources,
        citationUrls: ["https://www.bible.com/other-source"],
      },
      dossier,
    );

    expect(report.passed).toBe(false);
    expect(report.blockedReasons.join(" ")).toMatch(/not present/i);
  });

  it("detects unsupported absolute claims", () => {
    const report = validateGeneratedArticle(
      {
        content: {
          ...seedArticle.content,
          summary: "Prayer always guarantees an immediate answer.",
        },
        sources: dossier.sources,
      },
      dossier,
    );

    expect(report.passed).toBe(false);
    expect(report.blockedReasons.join(" ")).toMatch(/absolute/i);
  });

  it("uses an original Jesus-centered doctrine prompt", () => {
    expect(CHRISTIAN_DOCTRINE_PROFILE).toMatch(/Jesus Christ/i);
    expect(CHRISTIAN_DOCTRINE_PROFILE).toMatch(/original prose/i);
    expect(CHRISTIAN_DOCTRINE_PROFILE).toMatch(/Victory and Every Nation/i);
    expect(CHRISTIAN_DOCTRINE_PROFILE).toMatch(/affiliation/i);
    expect(ARTICLE_SYSTEM_PROMPT).toMatch(/safety[\s-]+note/i);
  });

  it("turns a valid mocked Responses result into ArticleContent without an API key", async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify(seedArticle.content),
    }));
    const client: OpenAIResponsesClient = { responses: { create } };

    const result = await generateArticle(
      { topic, dossier },
      { client },
    );

    expect(result).toEqual(seedArticle.content);
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.objectContaining({
          format: expect.objectContaining({
            type: "json_schema",
            name: "article_content",
          }),
        }),
      }),
    );
  });

  it("rejects an unsafe mocked response before review", async () => {
    const unsafeContent = {
      ...seedArticle.content,
      sections: [
        {
          ...seedArticle.content.sections[0],
          body: "I want to kill myself tonight.",
        },
        ...seedArticle.content.sections.slice(1),
      ],
    };
    const client: OpenAIResponsesClient = {
      responses: {
        create: vi.fn(async () => ({
          output_text: JSON.stringify(unsafeContent),
        })),
      },
    };

    await expect(generateArticle({ topic, dossier }, { client })).rejects.toMatchObject({
      code: "validation_failed",
      validation: expect.objectContaining({
        passed: false,
        blockedReasons: expect.arrayContaining([
          expect.stringMatching(/safety review/i),
        ]),
      }),
    });
  });

  it("exposes a stable structured-output request", () => {
    expect(buildArticleRequest({ topic, dossier })).toMatchObject({
      model: expect.any(String),
      input: expect.stringContaining("untrusted reference data"),
      instructions: expect.stringContaining("Jesus-centered"),
    });
  });
});
