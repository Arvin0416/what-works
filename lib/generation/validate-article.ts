import {
  ArticleContentSchema,
  ResearchDossierSchema,
  SourceCitationSchema,
  type ArticleContent,
  type ResearchDossier,
  type SourceCitation,
  type ValidationReport,
} from "../content/types";
import { isAllowedResearchUrl } from "../research/source-policy";
import { evaluateSafety } from "../safety/content-safety";

export interface GeneratedArticleValidationContext {
  dossier?: ResearchDossier;
  sources?: SourceCitation[];
}

const FIELD_LENGTH_LIMITS = {
  title: 160,
  dek: 320,
  summary: 1_000,
  sectionHeading: 140,
  sectionBody: 2_400,
  prayer: 1_600,
  safetyNote: 1_000,
} as const;

const ABSOLUTE_CLAIM_PATTERNS = [
  /\b(?:always|never|guaranteed|guarantees|definitely|certainly)\b/i,
  /\b(?:everyone|no one)\s+(?:will|can|must|should|is|has)\b/i,
  /\b(?:cures?|proves?|completely heals?)\b/i,
];

const BIBLE_BOOK_CHAPTERS: Readonly<Record<string, number>> = {
  Genesis: 50,
  Exodus: 40,
  Leviticus: 27,
  Numbers: 36,
  Deuteronomy: 34,
  Joshua: 24,
  Judges: 21,
  Ruth: 4,
  "1 Samuel": 31,
  "2 Samuel": 24,
  "1 Kings": 22,
  "2 Kings": 25,
  "1 Chronicles": 29,
  "2 Chronicles": 36,
  Ezra: 10,
  Nehemiah: 13,
  Esther: 10,
  Job: 42,
  Psalms: 150,
  Proverbs: 31,
  Ecclesiastes: 12,
  "Song of Solomon": 8,
  Isaiah: 66,
  Jeremiah: 52,
  Lamentations: 5,
  Ezekiel: 48,
  Daniel: 12,
  Hosea: 14,
  Joel: 3,
  Amos: 9,
  Obadiah: 1,
  Jonah: 4,
  Micah: 7,
  Nahum: 3,
  Habakkuk: 3,
  Zephaniah: 3,
  Haggai: 2,
  Zechariah: 14,
  Malachi: 4,
  Matthew: 28,
  Mark: 16,
  Luke: 24,
  John: 21,
  Acts: 28,
  Romans: 16,
  "1 Corinthians": 16,
  "2 Corinthians": 13,
  Galatians: 6,
  Ephesians: 6,
  Philippians: 4,
  Colossians: 4,
  "1 Thessalonians": 5,
  "2 Thessalonians": 3,
  "1 Timothy": 6,
  "2 Timothy": 4,
  Titus: 3,
  Philemon: 1,
  Hebrews: 13,
  James: 5,
  "1 Peter": 5,
  "2 Peter": 3,
  "1 John": 5,
  "2 John": 1,
  "3 John": 1,
  Jude: 1,
  Revelation: 22,
};

const BIBLE_BOOKS = [...Object.keys(BIBLE_BOOK_CHAPTERS), "Psalm", "Song of Songs"]
  .sort((left, right) => right.length - left.length)
  .map(escapeRegExp)
  .join("|");

const BIBLE_REFERENCE_PATTERN = new RegExp(
  `^(?<book>${BIBLE_BOOKS})\\s+(?<chapter>[1-9]\\d{0,2}):(?<verse>[1-9]\\d{0,2})(?:\\s*[-–]\\s*(?<endVerse>[1-9]\\d{0,2}))?(?:\\s*\\((?<translation>[A-Za-z0-9 .-]{2,24})\\))?$`,
  "i",
);

/**
 * Validate the shape against the canonical Bible book list and chapter
 * bounds. This is intentionally a shape check, not a claim that a particular
 * translation says a particular thing.
 */
export function isBibleReferenceShape(value: string): boolean {
  const parts = splitScriptureReference(value);

  return parts.length > 0 && parts.every(isSingleBibleReferenceShape);
}

export function validateGeneratedArticle(
  input: unknown,
  context?: GeneratedArticleValidationContext | ResearchDossier,
): ValidationReport {
  const blockedReasons: string[] = [];
  const warnings: string[] = [];
  const envelope = getEnvelope(input);
  const dossier = getDossier(context ?? envelope.dossier);
  const citationInputs =
    envelope.sources ?? getContextSources(context, dossier);

  const parsedContent = ArticleContentSchema.safeParse(envelope.content);

  if (!parsedContent.success) {
    blockedReasons.push(
      ...parsedContent.error.issues.map(
        (issue) =>
          `Article schema validation failed at ${formatIssuePath(issue.path)}: ${issue.message}`,
      ),
    );
  }

  const parsedSources = parseSources(citationInputs, blockedReasons);

  if (parsedSources.length === 0) {
    blockedReasons.push(
      "Article must include at least one source citation from the research dossier.",
    );
  }

  validateCitationsAgainstDossier(
    [
      ...parsedSources.map((source) => source.url),
      ...(envelope.citationUrls ?? []),
    ],
    dossier,
    blockedReasons,
  );

  if (parsedContent.success) {
    const content = parsedContent.data;
    validateFieldLengths(content, blockedReasons);

    for (const scriptureRef of content.scriptureRefs) {
      if (!isBibleReferenceShape(scriptureRef)) {
        blockedReasons.push(
          `Scripture reference has an invalid or invented-looking shape: ${scriptureRef}`,
        );
      }
    }

    if (containsUnsupportedAbsoluteClaim(content)) {
      blockedReasons.push(
        "Article contains an unsupported absolute or guaranteed claim.",
      );
    }

    const safety = evaluateSafety(content);

    if (safety.blocked) {
      blockedReasons.push(
        `Safety review required before approval: ${safety.flags.join(", ")}.`,
      );
    } else if (safety.riskLevel !== "low") {
      warnings.push(
        `Safety review recommended: ${safety.flags.join(", ")}.`,
      );
    }
  }

  return {
    passed: blockedReasons.length === 0,
    warnings: uniqueNonEmpty(warnings),
    blockedReasons: uniqueNonEmpty(blockedReasons),
  };
}

export function getArticleFromValidationInput(input: unknown): ArticleContent | null {
  const parsed = ArticleContentSchema.safeParse(getEnvelope(input).content);
  return parsed.success ? parsed.data : null;
}

function getEnvelope(input: unknown): {
  content: unknown;
  sources?: unknown[];
  citationUrls?: string[];
  dossier?: unknown;
} {
  if (!isRecord(input)) {
    return { content: input };
  }

  const content =
    "content" in input ? input.content : "article" in input ? input.article : input;
  const sourceValue = input.sources ?? input.citations;
  const sources = Array.isArray(sourceValue) ? sourceValue : undefined;
  const citationValue = input.citationUrls ?? input.sourceUrls;
  const citationUrls = Array.isArray(citationValue)
    ? citationValue.filter((value): value is string => typeof value === "string")
    : undefined;
  const dossier = input.dossier ?? input.researchDossier;

  return { content, sources, citationUrls, dossier };
}

function getDossier(
  context: unknown,
): ResearchDossier | undefined {
  if (!isRecord(context)) {
    return undefined;
  }

  const candidate =
    "dossier" in context && context.dossier !== undefined
      ? context.dossier
      : context;
  const parsed = ResearchDossierSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

function getContextSources(
  context: GeneratedArticleValidationContext | ResearchDossier | undefined,
  dossier: ResearchDossier | undefined,
): unknown[] | undefined {
  if (context && "sources" in context && Array.isArray(context.sources)) {
    return context.sources;
  }

  return dossier?.sources;
}

function parseSources(
  inputs: unknown[] | undefined,
  blockedReasons: string[],
): SourceCitation[] {
  if (!inputs) {
    return [];
  }

  const parsed: SourceCitation[] = [];

  for (const [index, input] of inputs.entries()) {
    const result = SourceCitationSchema.safeParse(input);

    if (!result.success) {
      blockedReasons.push(`Source citation ${index + 1} is malformed.`);
      continue;
    }

    if (!isAllowedResearchUrl(result.data.url)) {
      blockedReasons.push(
        `Source citation ${index + 1} uses a domain outside the research allowlist.`,
      );
      continue;
    }

    parsed.push(result.data);
  }

  return parsed;
}

function validateCitationsAgainstDossier(
  citationUrls: string[],
  dossier: ResearchDossier | undefined,
  blockedReasons: string[],
): void {
  if (citationUrls.length === 0 || !dossier) {
    return;
  }

  const dossierUrls = new Set(dossier.sources.map((source) => source.url));

  for (const url of citationUrls) {
    if (!dossierUrls.has(url)) {
      blockedReasons.push(
        `Cited URL is not present in the supplied research dossier: ${url}`,
      );
    }
  }
}

function validateFieldLengths(
  content: ArticleContent,
  blockedReasons: string[],
): void {
  addLengthFailure(
    blockedReasons,
    "title",
    content.title,
    FIELD_LENGTH_LIMITS.title,
  );
  addLengthFailure(blockedReasons, "dek", content.dek, FIELD_LENGTH_LIMITS.dek);
  addLengthFailure(
    blockedReasons,
    "summary",
    content.summary,
    FIELD_LENGTH_LIMITS.summary,
  );
  addLengthFailure(
    blockedReasons,
    "prayer",
    content.prayer,
    FIELD_LENGTH_LIMITS.prayer,
  );
  addLengthFailure(
    blockedReasons,
    "safety note",
    content.safetyNote,
    FIELD_LENGTH_LIMITS.safetyNote,
  );

  content.sections.forEach((section, index) => {
    addLengthFailure(
      blockedReasons,
      `section ${index + 1} heading`,
      section.heading,
      FIELD_LENGTH_LIMITS.sectionHeading,
    );
    addLengthFailure(
      blockedReasons,
      `section ${index + 1} body`,
      section.body,
      FIELD_LENGTH_LIMITS.sectionBody,
    );
  });
}

function addLengthFailure(
  blockedReasons: string[],
  field: string,
  value: string,
  maxLength: number,
): void {
  if (value.length > maxLength) {
    blockedReasons.push(
      `${field} exceeds the maximum allowed length of ${maxLength} characters.`,
    );
  }
}

function containsUnsupportedAbsoluteClaim(content: ArticleContent): boolean {
  const prose = [
    content.title,
    content.dek,
    content.summary,
    ...content.sections.flatMap((section) => [section.heading, section.body]),
    content.prayer,
  ].join("\n");

  return ABSOLUTE_CLAIM_PATTERNS.some((pattern) => pattern.test(prose));
}

function splitScriptureReference(value: string): string[] {
  return value
    .replace(/[–—]/g, "-")
    .split(/\s*(?:;|,)\s*|\s+\band\b\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isSingleBibleReferenceShape(value: string): boolean {
  const match = BIBLE_REFERENCE_PATTERN.exec(value.trim());

  if (!match?.groups) {
    return false;
  }

  const book = canonicalBibleBook(match.groups.book);
  const chapter = Number(match.groups.chapter);
  const verse = Number(match.groups.verse);
  const endVerse = match.groups.endVerse
    ? Number(match.groups.endVerse)
    : undefined;
  const maxChapter = BIBLE_BOOK_CHAPTERS[book];

  return (
    maxChapter !== undefined &&
    chapter <= maxChapter &&
    verse <= 176 &&
    (endVerse === undefined || (endVerse <= 176 && endVerse >= verse))
  );
}

function canonicalBibleBook(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.toLowerCase() === "psalm") {
    return "Psalms";
  }

  if (normalized.toLowerCase() === "song of songs") {
    return "Song of Solomon";
  }

  return Object.keys(BIBLE_BOOK_CHAPTERS).find(
    (book) => book.toLowerCase() === normalized.toLowerCase(),
  ) ?? normalized;
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.length === 0 ? "root" : path.map(String).join(".");
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
