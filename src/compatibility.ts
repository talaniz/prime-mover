import { ACCEPTED_PROTOCOL_VERSIONS } from "./config.js";
/** Pin both the executable and the connected server; CLI identity alone is insufficient. */
export function requireCompatibility(
  configured: string,
  cli: string,
  initialization?: unknown,
): void {
  if (
    !ACCEPTED_PROTOCOL_VERSIONS.some((v) => v === configured) ||
    cli.trim() !== `codex-cli ${configured}`
  )
    throw Error(
      "Unsupported app-server protocol version; repeat compatibility acceptance (configuration/CLI mismatch)",
    );
  if (arguments.length >= 3) {
    const agent = (initialization as { userAgent?: unknown })?.userAgent;
    const match =
      typeof agent === "string"
        ? /^(?:Codex Desktop|codex_cli_rs|codex)\/(\d+\.\d+\.\d+)(?:\s|$)/.exec(
            agent,
          )
        : null;
    if (match?.[1] !== configured)
      throw Error(
        "Unsupported connected app-server version; repeat compatibility acceptance",
      );
  }
}
