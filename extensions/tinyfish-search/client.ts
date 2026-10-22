import { type SearchQueryParams, type SearchQueryResponse, TinyFish } from "@tiny-fish/sdk";
import { Context, Effect, Layer, Redacted, Schema } from "effect";

import { TinyFishConfig } from "./config.ts";

export class TinyFishSearchError extends Schema.TaggedError<
  TinyFishSearchError,
  { readonly brand: unique symbol }
>()("TinyFishSearchError", { message: Schema.String, cause: Schema.Defect() }) {}

export class TinyFishSearch extends Context.Service<
  TinyFishSearch,
  {
    readonly query: (
      params: SearchQueryParams,
    ) => Effect.Effect<SearchQueryResponse, TinyFishSearchError>;
  }
>()("tinyfish-search/TinyFishSearch") {
  /** Live implementation backed by the TinyFish SDK. Requires {@link TinyFishConfig}. */
  static readonly layerNoDeps = Layer.effect(TinyFishSearch)(
    Effect.gen(function* () {
      const { apiKey } = yield* TinyFishConfig;
      const client = new TinyFish({ apiKey: Redacted.value(apiKey) });

      const query = Effect.fn("TinyFishSearch.query")(function* (params: SearchQueryParams) {
        return yield* Effect.tryPromise({
          try: () => client.search.query(params),
          catch: (cause) =>
            new TinyFishSearchError({
              message: `TinyFish search failed: ${cause instanceof Error ? cause.message : String(cause)}`,
              cause,
            }),
        });
      });

      return TinyFishSearch.of({ query });
    }),
  );

  static readonly layer = TinyFishSearch.layerNoDeps.pipe(Layer.provide(TinyFishConfig.layer));
}
