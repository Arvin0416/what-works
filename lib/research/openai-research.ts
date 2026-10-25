import OpenAI from "openai";

import {
  ResearchDossierSchema,
  type ResearchDossier,
  type SourceCitation,
  type Topic,
} from "../content/types";
import {
  buildResearchPrompt,
  RESEARCH_DOSSIER_JSON_SCHEMA,
  RESEARCH_SYSTEM_PROMPT,
  PROMPT_VERSION,
} from "../generation/prompts";
import {
  getAllowedResearchDomains,
  getSourcePolicyEntry,
  isAllowedResearchUrl,
} from "./source-policy";

export interface WebSearchRequest {
  type: "web_search";
  filters: {
    allowed_domains: string[];
  };
}

export interface ResponsesRequest {
  model: string;
  instructions: string;
  input: string;
  tools: WebSearchRequest[];
  tool_choice: "required";
  include: string[];
  text: {
    format: {
      type: "json_schema";
      name: string;
      strict: true;
      schema: typeof RESEARCH_DOSSIER_JSON_SCHEMA;
    };
  };
}

export interface OpenAIResponsesClient {
  responses: {
    create(request: unknown): Promise<unknown>;
  };
}

export interface ResearchTopicOptions {
  client?: OpenAIResponsesClient;
  createClient?: () => OpenAIResponsesClient;
  now?: () => Date;
}

export class ResearchAdapterError extends Error {
  readonly code:
    | "missing_api_key"
    | "invalid_response"
    | "missing_sources"
    | "disallowed_source"
    | "server_only";

  constructor(
    code: ResearchAdapterError["code"],
    message: string,
  ) {
    super(message);
    this.name = "ResearchAdapterError";
    this.code = code;
  }
}

/**
 * Build the exact request separately from the network call so tests can prove
 * that search is required and the allowlist cannot be model-supplied.
 */
export function buildResearchRequest(topic: Topic): ResponsesRequest {
  return {
    model: getOpenAIModel(),
    instructions: `${RESEARCH_SYSTEM_PROMPT}\n\nPrompt version: ${PROMPT_VERSION}`,
    input: buildResearchPrompt(topic),
    tools: [
      {
        type: "web_search",
        filters: {
          allowed_domains: getAllowedResearchDomains(),
        },
      },
    ],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    text: {
      format: {
        type: "json_schema",
        name: "research_dossier",
        strict: true,
        schema: RESEARCH_DOSSIER_JSON_SCHEMA,
      },
    },
  };
}

/**
 * Research is intentionally server-only. The test exception keeps the
 * adapter callable in Vitest's jsdom environment while still preventing an
 * accidental browser invocation in a deployed build.
 */
export function assertResearchServerRuntime(): void {
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
    throw new ResearchAdapterError(
      "server_only",
      "OpenAI web research can only run on the server.",
    );
  }
}

export function createDefaultOpenAIClient(): OpenAIResponsesClient {
  assertResearchServerRuntime();

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new ResearchAdapterError(
      "missing_api_key",
      "OPENAI_API_KEY is required for OpenAI research.",
    );
  }

  return new OpenAI({ apiKey }) as unknown as OpenAIResponsesClient;
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-6.1-sol";
}

export async function researchTopic(
  topic: Topic,
  optionsOrClient: ResearchTopicOptions | OpenAIResponsesClient = {},
): Promise<ResearchDossier> {
  assertResearchServerRuntime();

  const options = isResponsesClient(optionsOrClient)
    ? { client: optionsOrClient }
    : optionsOrClient;
  const client =
    options.client ?? options.createClient?.() ?? createDefaultOpenAIClient();
  const response = await client.responses.create(buildResearchRequest(topic));
  const payload = extractStructuredPayload(response);
  const returnedCitations = extractReturnedCitations(response, options.now);
  const rawSources = mergeSourceMetadata(payload.sources, returnedCitations);

  if (rawSources.length === 0) {
    throw new ResearchAdapterError(
      "missing_sources",
      "OpenAI research returned no source URLs; the dossier cannot be accepted.",
    );
  }

  for (const source of rawSources) {
    if (!isRecord(source) || typeof source.url !== "string") {
      throw new ResearchAdapterError(
        "invalid_response",
        "OpenAI research returned a source without a URL.",
      );
    }

    if (!isAllowedResearchUrl(source.url)) {
      throw new ResearchAdapterError(
        "disallowed_source",
        `Research returned a source outside the configured allowlist: ${source.url}`,
      );
    }
  }

  const dossier = ResearchDossierSchema.safeParse({
    ...payload,
    topicId: topic.id,
    sources: rawSources,
  });

  if (!dossier.success) {
    throw new ResearchAdapterError(
      "invalid_response",
      `OpenAI research returned an invalid dossier: ${dossier.error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return dossier.data;
}

/**
 * Extract text from the SDK response without trusting a fixed output index.
 * This also makes small fake Responses clients easy to use in unit tests.
 */
export function extractResponseText(response: unknown): string {
  if (typeof response === "string") {
    return response;
  }

  if (!isRecord(response)) {
    return "";
  }

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  if (!Array.isArray(response.output)) {
    return "";
  }

  return response.output
    .flatMap((item) => {
      if (!isRecord(item)) {
        return [];
      }

      if (typeof item.output_text === "string") {
        return [item.output_text];
      }

      if (!Array.isArray(item.content)) {
        return [];
      }

      return item.content.flatMap((part) =>
        isRecord(part) && typeof part.text === "string" ? [part.text] : [],
      );
    })
    .join("\n");
}

function extractStructuredPayload(response: unknown): Record<string, unknown> {
  if (isRecord(response) && isRecord(response.output_parsed)) {
    return response.output_parsed;
  }

  const text = extractResponseText(response).trim();

  if (!text) {
    throw new ResearchAdapterError(
      "invalid_response",
      "OpenAI research returned no structured output.",
    );
  }

  try {
    const parsed: unknown = JSON.parse(stripJsonCodeFence(text));

    if (!isRecord(parsed)) {
      throw new Error("Expected a JSON object.");
    }

    return parsed;
  } catch (error) {
    throw new ResearchAdapterError(
      "invalid_response",
      `OpenAI research returned invalid JSON: ${
        error instanceof Error ? error.message : "unknown parse error"
      }`,
    );
  }
}

function extractReturnedCitations(
  response: unknown,
  now: (() => Date) | undefined,
): SourceCitation[] {
  if (!isRecord(response)) {
    return [];
  }

  const retrievedAt = (now ?? (() => new Date))().toISOString();
  const citations: SourceCitation[] = [];

  const addCitation = (value: unknown): void => {
    if (!isRecord(value) || typeof value.url !== "string") {
      return;
    }

    const url = value.url;
    let hostname = "web source";

    try {
      hostname = new URL(url).hostname;
    } catch {
      return;
    }

    const policyEntry = getSourcePolicyEntry(hostname);
    citations.push({
      url,
      title:
        typeof value.title === "string" && value.title.trim()
          ? value.title
          : "Web search citation",
      publisher: policyEntry?.publisher ?? hostname,
      retrievedAt,
      claimUse: "Returned citation metadata from the web-search tool; verify before publication.",
    });
  };

  if (Array.isArray(response.citations)) {
    response.citations.forEach(addCitation);
  }

  if (!Array.isArray(response.output)) {
    return deduplicateSources(citations);
  }

  for (const item of response.output) {
    if (!isRecord(item)) {
      continue;
    }

    if (Array.isArray(item.content)) {
      for (const part of item.content) {
        if (!isRecord(part) || !Array.isArray(part.annotations)) {
          continue;
        }

        part.annotations.forEach((annotation) => {
          if (
            isRecord(annotation) &&
            (annotation.type === "url_citation" || typeof annotation.url === "string")
          ) {
            addCitation(annotation);
          }
        });
      }
    }

    if (!isRecord(item.action) || !Array.isArray(item.action.sources)) {
      continue;
    }

    item.action.sources.forEach(addCitation);
  }

  return deduplicateSources(citations);
}

function mergeSourceMetadata(
  sources: unknown,
  returnedCitations: SourceCitation[],
): unknown[] {
  const modelSources = Array.isArray(sources) ? sources : [];
  const seen = new Set(
    modelSources.flatMap((source) =>
      isRecord(source) && typeof source.url === "string" ? [source.url] : [],
    ),
  );

  return [
    ...modelSources,
    ...returnedCitations.filter((citation) => {
      if (seen.has(citation.url)) {
        return false;
      }

      seen.add(citation.url);
      return true;
    }),
  ];
}

function deduplicateSources(sources: SourceCitation[]): SourceCitation[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) {
      return false;
    }

    seen.add(source.url);
    return true;
  });
}

function stripJsonCodeFence(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isResponsesClient(
  value: ResearchTopicOptions | OpenAIResponsesClient,
): value is OpenAIResponsesClient {
  return (
    isRecord(value) &&
    isRecord(value.responses) &&
    typeof value.responses.create === "function"
  );
}
