import type { SearchQueryResponse, SearchResult } from "@tiny-fish/sdk";

export function formatResult(r: SearchResult): string {
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

export function formatResponse(response: SearchQueryResponse): string {
  const header = `TinyFish search: "${response.query}" — ${response.results.length} results (page ${response.page})`;
  const body = response.results.length
    ? response.results.map(formatResult).join("\n\n")
    : "No results found.";
  return `${header}\n\n${body}`;
}
