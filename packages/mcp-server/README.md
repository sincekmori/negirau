# negirau-mcp

[![npm version](https://badge.fury.io/js/negirau-mcp.svg)](https://badge.fury.io/js/negirau-mcp)
[![Node Versions](https://img.shields.io/node/v/negirau-mcp.svg)](https://www.npmjs.com/package/negirau-mcp)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/sincekmori/negirau/actions/workflows/ci.yml/badge.svg)](https://github.com/sincekmori/negirau/actions/workflows/ci.yml)

MCP (Model Context Protocol) server for the [Negirau](https://negirau.com) public API.

Self-updating by construction: at startup it fetches `https://api.negirau.com/v1/openapi.json` and registers one tool per operation from the spec's `x-mcp-tool-name` / `x-agent-description` annotations.
New API operations appear as tools without a new release of this package.

## Install

The server is a standard stdio MCP server, published to npm as `negirau-mcp` and listed in the vendor-neutral [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.sincekmori/negirau`.

The portable definition — every MCP client understands this shape in its own config file:

```json
{
  "mcpServers": {
    "negirau": {
      "command": "npx",
      "args": ["-y", "negirau-mcp"]
    }
  }
}
```

To install into all detected agents at once with the cross-agent installer:

```
npx add-mcp negirau-mcp
```

Per-client one-liners, if you prefer a specific CLI:

```
codex mcp add negirau -- npx -y negirau-mcp
claude mcp add negirau -- npx -y negirau-mcp
```

(Gemini CLI and others: add the `mcpServers` block above to the client's settings file. `bunx` works in place of `npx -y`.)

Environment:

- `NEGIRAU_BASE_URL` — override the API base (default `https://api.negirau.com/v1`).

## Notes

- All tools are read-only `GET`s; the API is anonymous and CORS-open, so the full surface is safe to expose.
- Counts are display values — exact up to 100, "100+" beyond — never rankings, by design.

## License

Apache-2.0.
This package lives in the [negirau monorepo](https://github.com/sincekmori/negirau), whose server code is separately licensed under AGPL-3.0-only.
