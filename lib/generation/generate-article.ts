import {
  ArticleContentSchema,
  type ArticleContent,
  type ResearchDossier,
  type Topic,
  type ValidationReport,
} from "../content/types";
import {
  ARTICLE_CONTENT_JSON_SCHEMA,
  ARTICLE_SYSTEM_PROMPT,
  buildArticlePrompt,
  PROMPT_VERSION,
} from "./prompts";
import { validateGeneratedArticle } from "./validate-article";
import {
  createDefaultOpenAIClient,
  extractResponseText,
  getOpenAIModel,
  type OpenAIResponsesClient,
} from "../research/openai-research";

export interface GenerateArticleInput {
  topic: Topic;
  dossier: ResearchDossier;
}

export interface ArticleGenerationOptions {
  client?: OpenAIResponsesClient;
}

export interface ArticleResponsesRequest {
  model: string;
  instructions: string;
  input: string;
  text: {
    format: {
      type: "json_schema";
      name: string;
      strict: true;
      schema: typeof ARTICLE_CONTENT_JSON_SCHEMA;
    };
  };
}

export class ArticleGenerationError extends Error {
  readonly code: "missing_output" | "invalid_response" | "validation_failed";
  readonly validation?: ValidationReport;

  constructor(
    code: ArticleGenerationError["code"],
    message: string,
    validation?: ValidationReport,
  ) {
    super(message);
    this.name = "ArticleGenerationError";
    this.code = code;
    this.validation = validation;
  }
}

export function buildArticleRequest(
  input: GenerateArticleInput,
): ArticleResponsesRequest {
  return {
    model: getOpenAIModel(),
    instructions: `${ARTICLE_SYSTEM_PROMPT}\n\nPrompt version: ${PROMPT_VERSION}`,
    input: buildArticlePrompt(input.topic, input.dossier),
    text: {
      format: {
        type: "json_schema",
        name: "article_content",
        strict: true,
        schema: ARTICLE_CONTENT_JSON_SCHEMA,
      },
    },
  };
}

export async function generateArticle(
  input: GenerateArticleInput,
  optionsOrClient: ArticleGenerationOptions | OpenAIResponsesClient = {},
): Promise<ArticleContent> {
  const options = isResponsesClient(optionsOrClient)
    ? { client: optionsOrClient }
    : optionsOrClient;
  const client = options.client ?? createDefaultOpenAIClient();
  const response = await client.responses.create(buildArticleRequest(input));
  const candidate = parseArticleResponse(response);
  const validation = validateGeneratedArticle(
    {
      content: candidate,
      sources: input.dossier.sources,
      citationUrls: input.dossier.sources.map((source) => source.url),
    },
    input.dossier,
  );

  if (!validation.passed) {
    throw new ArticleGenerationError(
      "validation_failed",
      `Generated article did not pass validation: ${validation.blockedReasons.join(
        "; ",
      )}`,
      validation,
    );
  }

  return candidate;
}

function parseArticleResponse(response: unknown): ArticleContent {
  const parsedOutput =
    isRecord(response) && isRecord(response.output_parsed)
      ? response.output_parsed
      : parseJsonOutput(extractResponseText(response));

  if (!parsedOutput) {
    throw new ArticleGenerationError(
      "missing_output",
      "OpenAI article generation returned no structured output.",
    );
  }

  const parsedArticle = ArticleContentSchema.safeParse(parsedOutput);

  if (!parsedArticle.success) {
    throw new ArticleGenerationError(
      "invalid_response",
      `OpenAI article generation returned invalid ArticleContent: ${parsedArticle.error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return parsedArticle.data;
}

function parseJsonOutput(value: string): Record<string, unknown> | null {
  const trimmed = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    throw new ArticleGenerationError(
      "invalid_response",
      "OpenAI article generation returned invalid JSON.",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isResponsesClient(
  value: ArticleGenerationOptions | OpenAIResponsesClient,
): value is OpenAIResponsesClient {
  return (
    isRecord(value) &&
    isRecord(value.responses) &&
    typeof value.responses.create === "function"
  );
}
