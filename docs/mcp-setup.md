# Connect an AI assistant (MCP)

Point Claude Desktop, Claude Code, Cursor, or another MCP client at Open Money so it can import statements and search transactions. For the import workflow itself, see `docs/specs/import.md`.

| Mode | Auth |
| --- | --- |
| Local, desktop, or self-hosted | None — loopback only |
| Cloud | MCP access token (see `docs/adr/0011-mcp-cloud-auth-static-bearer-token.md`) |

## 1. Get the server URL

Open **Settings → Connect AI Assistant** (`/settings/mcp`). The page shows this instance’s MCP URL (for example `http://localhost:3000/api/mcp` or `https://your-domain/api/mcp`) and a ready-to-paste `mcp.json` block.

**Local / desktop / self-hosted:** the endpoint accepts same-machine connections only. No token. Continue to step 2.

**Cloud:** use **Generate token**, then copy the value shown. It appears once; only a hash is stored. Generating again invalidates the previous token.

## 2. Configure the client

**Claude Desktop** — Settings → Connectors → Add custom connector → paste the URL from step 1.

- Local: Desktop may start an OAuth flow; leave it empty and continue.
- Cloud: add header `Authorization: Bearer <token>`. If the UI has no custom-header field, use Claude Code or Cursor’s JSON config instead.

See [Anthropic’s custom connectors docs](https://support.claude.com/en/articles/10949351) if the UI asks for unexpected fields.

**Claude Code / Cursor** — add an MCP server entry (Cursor: Settings → Features → MCP, or edit `mcp.json`; Claude Code: `.mcp.json`):

```json
{
  "mcpServers": {
    "open-money": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Use the URL from step 1. Local mode: omit `headers`. Cloud mode: replace `YOUR_TOKEN_HERE` with your token. Cursor accepts a bare `url` without `type`; Claude Code needs `"type": "http"` (or `"streamable-http"`).

**Other clients** — connect as Streamable HTTP at the URL from step 1. In cloud mode, send `Authorization: Bearer <token>`. Stdio-only clients are not supported.

## 3. Check the connection

Ask something like “list my Open Money accounts” or “show my latest five debit transactions.” The assistant should call `list_accounts` or `search_transactions`.

## Troubleshooting

- **403 (local)** — `Host` was not treated as loopback. Reverse proxies that rewrite `Host` are not supported for this endpoint.
- **401 (cloud)** — missing or wrong `Authorization: Bearer <token>`, or the token was regenerated or revoked.
- **Cannot reach the URL** — confirm the app is running and the URL matches what Settings shows for this launch.
- **Import looks wrong** — the assistant parses the statement; Open Money never sees the file. Check what was uploaded to the assistant.

## Not covered

Clients that cannot send a static bearer header (for example ChatGPT’s connector, which expects OAuth 2.1) need a separate endpoint. That design is proposed in `docs/adr/0008-mcp-endpoint-adds-scoped-oauth-for-remote-clients.md` and is not built yet.
