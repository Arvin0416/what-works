import {
  GenerationRunInputSchema,
  type GenerationRunInput,
} from "../../content/types";
import type { Database } from "../client";
import { generationRuns } from "../schema";

export async function saveGenerationRun(
  db: Database,
  input: GenerationRunInput,
): Promise<string> {
  const parsedInput = GenerationRunInputSchema.parse(input);
  const now = new Date();
  const [run] = await db
    .insert(generationRuns)
    .values({
      topicId: parsedInput.topicId,
      trigger: parsedInput.trigger,
      status: parsedInput.status,
      errorCode: parsedInput.errorCode,
      startedAt:
        parsedInput.status === "researching" || parsedInput.status === "drafted"
          ? now
          : null,
      finishedAt:
        parsedInput.status === "drafted" || parsedInput.status === "failed"
          ? now
          : null,
    })
    .returning({ id: generationRuns.id });

  if (!run) {
    throw new Error("The generation run could not be created.");
  }

  return run.id;
}
