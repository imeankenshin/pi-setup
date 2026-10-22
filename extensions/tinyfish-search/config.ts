import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { Config, ConfigProvider, Context, Effect, Layer, type Redacted, Schema } from "effect";

export const PI_AGENT_ENV_PATH = join(homedir(), ".pi", "agent", ".env");

export class MissingApiKeyError extends Schema.TaggedError<
  MissingApiKeyError,
  { readonly brand: unique symbol }
>()("MissingApiKeyError", { message: Schema.String }) {}

const piConfigProvider = Effect.tryPromise(() => readFile(PI_AGENT_ENV_PATH, "utf8")).pipe(
  Effect.map((contents) => ConfigProvider.fromDotEnvContents(contents)),
  Effect.orElseSucceed(() => ConfigProvider.fromUnknown({})),
  Effect.map((dotEnv) => ConfigProvider.orElse(ConfigProvider.fromEnv(), dotEnv)),
);

export class TinyFishConfig extends Context.Service<
  TinyFishConfig,
  { readonly apiKey: Redacted.Redacted }
>()("tinyfish-search/TinyFishConfig") {
  static readonly layer = Layer.effect(TinyFishConfig)(
    Effect.gen(function* () {
      const provider = yield* piConfigProvider;
      const apiKey = yield* Config.Redacted("TINYFISH_API_KEY")
        .parse(provider)
        .pipe(
          Effect.mapError(
            () =>
              new MissingApiKeyError({
                message:
                  "TINYFISH_API_KEY is not set. Create a key at https://agent.tinyfish.ai/api-keys and export it.",
              }),
          ),
        );
      return TinyFishConfig.of({ apiKey });
    }),
  );
}
