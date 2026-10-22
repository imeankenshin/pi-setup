export const SEARCH_TOOL_DESCRIPTION =
  "Search the web with TinyFish and get ranked results (title, URL, snippet). Supports web, news, and research_paper searches, domain filters, and date/recency filters.";

export const SEARCH_PROMPT_SNIPPET = "Search the web with TinyFish for current information.";
export const SEARCH_PROMPT_GUIDELINES = [
  "Use tinyfish_search when you need current information from the web; pass `purpose` to describe the goal.",
  "Prefer include_domains/exclude_domains over site: operators in the query.",
];

export const SEARCH_PARAMETER_DESCRIPTIONS = {
  query: "Search query",
  domain_type: "Kind of search: web (default), news, or research_paper",
  page: "Results page, starting at 0",
};
