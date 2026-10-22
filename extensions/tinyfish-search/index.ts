import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SearchQueryParams } from "@tiny-fish/sdk";
import { Cause, Effect, Exit } from "effect";
import { Type } from "typebox";

import { TinyFishSearch } from "./client.ts";
import { formatResponse } from "./format.ts";
import {
  SEARCH_PARAMETER_DESCRIPTIONS,
  SEARCH_PROMPT_GUIDELINES,
  SEARCH_PROMPT_SNIPPET,
  SEARCH_TOOL_DESCRIPTION,
} from "./prompt.ts";

const search = Effect.fn("tinyfish-search.search")(function* (params: SearchQueryParams) {
  const tinyfish = yield* TinyFishSearch;
  const response = yield* tinyfish.query(params);

  return {
    content: [{ type: "text" as const, text: formatResponse(response) }],
    structuredContent: {
      query: response.query,
      page: response.page,
      total_results: response.total_results,
      results: response.results,
    },
    details: { query: response.query, count: response.results.length, page: response.page },
  };
});

/**
 * Runs the effect at the pi boundary. Aborting `signal` interrupts the fiber;
 * typed failures are rethrown so pi reports them as failed tool results.
 */
async function runTool<A, E>(effect: Effect.Effect<A, E>, signal: AbortSignal | undefined) {
  const exit = await Effect.runPromiseExit(effect, { signal });
  if (Exit.isSuccess(exit)) return exit.value;
  if (Cause.hasInterruptsOnly(exit.cause)) throw new Error("Search aborted");
  throw Cause.squash(exit.cause);
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "search",
    label: "Search Web",
    description: SEARCH_TOOL_DESCRIPTION,
    promptSnippet: SEARCH_PROMPT_SNIPPET,
    promptGuidelines: SEARCH_PROMPT_GUIDELINES,
    parameters: Type.Object({
      query: Type.String({ description: SEARCH_PARAMETER_DESCRIPTIONS.query }),
      domain_type: Type.Optional(
        Type.Union([Type.Literal("web"), Type.Literal("news"), Type.Literal("research_paper")], {
          description: SEARCH_PARAMETER_DESCRIPTIONS.domain_type,
        }),
      ),
      page: Type.Optional(
        Type.Integer({ minimum: 0, maximum: 10, description: SEARCH_PARAMETER_DESCRIPTIONS.page }),
      ),
    }),
    outputSchema: Type.Object({
      query: Type.String(),
      page: Type.Number(),
      total_results: Type.Number(),
      results: Type.Array(
        Type.Object({
          position: Type.Number(),
          title: Type.String(),
          url: Type.String(),
          site_name: Type.String(),
          snippet: Type.String(),
          date: Type.Optional(Type.String()),
          publisher: Type.Optional(Type.String()),
          authors: Type.Optional(Type.Array(Type.String())),
          venue: Type.Optional(Type.String()),
          year: Type.Optional(Type.Number()),
          cited_by_count: Type.Optional(Type.Number()),
          pdf_url: Type.Optional(Type.String()),
        }),
      ),
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },

    execute(_toolCallId, params, signal) {
      // Entry point: the layer is built per call so API key changes are picked up without a reload.
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      return runTool(search(params).pipe(Effect.provide(TinyFishSearch.layer)), signal);
    },
  });
}
