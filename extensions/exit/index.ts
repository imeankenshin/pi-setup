import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Effect } from "effect";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("exit", {
    description: "Exit Pi (alias for /quit)",
    handler: (_args, ctx) => Effect.runPromise(Effect.sync(() => ctx.shutdown())),
  });
}
