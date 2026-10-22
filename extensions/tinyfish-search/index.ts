import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TinyFish, type SearchResult } from "@tiny-fish/sdk";
import { Type } from "typebox";

import {
  SEARCH_PARAMETER_DESCRIPTIONS,
  SEARCH_PROMPT_GUIDELINES,
  SEARCH_PROMPT_SNIPPET,
  SEARCH_TOOL_DESCRIPTION,
} from "./prompt.ts";

function readEnvValue(name: string) {
  if (process.env[name]) return process.env[name];

  const envPath = join(homedir(), ".pi", "agent", ".env");
  let envText = "";

  try {
    envText = readFileSync(envPath, "utf8");
  } catch {
    return undefined;
  }

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || match[1] !== name) continue;

    const value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    return value.replace(/\s+#.*$/, "");
  }

  return undefined;
}

function getClient(): TinyFish {
  const apiKey = readEnvValue("TINYFISH_API_KEY");
  if (!apiKey) {
    throw new Error(
      "TINYFISH_API_KEY is not set. Create a key at https://agent.tinyfish.ai/api-keys and export it.",
    );
  }
  return new TinyFish({
    apiKey,
  });
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new Error("Search aborted"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("Search aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function formatResult(r: SearchResult): string {
  const meta = [
    r.publisher ?? r.site_name,
    r.date,
    r.authors?.length ? r.authors.join(", ") : undefined,
    r.venue,
    r.year?.toString(),
    r.cited_by_count !== undefined ? `cited by ${r.cited_by_count}` : undefined,
  ].filter(Boolean);
  const lines = [`${r.position}. ${r.title}`, `   ${r.url}`];
  if (meta.length) lines.push(`   ${meta.join(" · ")}`);
  if (r.pdf_url) lines.push(`   PDF: ${r.pdf_url}`);
  if (r.snippet) lines.push(`   ${r.snippet.replace(/\s+/g, " ").trim()}`);
  return lines.join("\n");
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

    async execute(_toolCallId, params, signal) {
      const response = await abortable(getClient().search.query(params), signal);

      const header = `TinyFish search: "${response.query}" — ${response.results.length} results (page ${response.page})`;
      const body = response.results.length
        ? response.results.map(formatResult).join("\n\n")
        : "No results found.";

      return {
        content: [{ type: "text", text: `${header}\n\n${body}` }],
        structuredContent: {
          query: response.query,
          page: response.page,
          total_results: response.total_results,
          results: response.results,
        },
        details: { query: response.query, count: response.results.length, page: response.page },
      };
    },
  });
}
