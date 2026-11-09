# @styloviz/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for the
[Styloviz](https://styloviz.dev) Angular + Tailwind CSS 4 component kit. Your
coding assistant asks it about the kit and gets the kit's own docs back: which
component fits, its exact inputs and outputs, a snippet to paste, its demos, the
templates, icon names and theme tokens.

It runs offline. Everything it answers comes from a generated index built from
the same docs that render styloviz.dev, shipped inside the package, at the same
version as the components. It has no dependencies and makes no network calls.

## Add it to your editor

**Claude Code**

```sh
claude mcp add styloviz -- npx -y @styloviz/mcp
```

**Cursor** — `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "styloviz": { "command": "npx", "args": ["-y", "@styloviz/mcp"] }
  }
}
```

**VS Code** — `.vscode/mcp.json`

```json
{
  "servers": {
    "styloviz": { "type": "stdio", "command": "npx", "args": ["-y", "@styloviz/mcp"] }
  }
}
```

Any other MCP client: run `npx -y @styloviz/mcp` as a stdio server.

## Tools

| Tool | What it answers |
| --- | --- |
| `search` | Free-text search over every component, template and page block — returns the docs URL, package, tier, a usage snippet, the worked example about what you asked, and the demos and notes that matched |
| `get_component` | One component's full record: description, when to use it, the free and Pro API (inputs, outputs, types, defaults), usage, examples, demo titles, customization and accessibility notes |
| `list_components` | The catalogue, narrowed by category words or tier |
| `find_variants` | A component's live demos and worked examples, filtered by words |
| `find_icons` | Icon names in the free and Pro sets, with the per-glyph import line and how to register it |
| `get_tokens` | The theme tokens (CSS custom properties) from the kit stylesheet |
| `list_blocks` | The copy-paste page blocks (hero, pricing, FAQ, footer, sign-in, settings…), by category words or tier |
| `get_block` | One block: a free block's complete component file to save and render; for a Pro block, the page where a licence unlocks it |
| `list_templates` | The application templates, with tier and live preview URL |

## From the terminal

The same questions work without an editor:

```sh
npx @styloviz/mcp search "data table grouping"
npx @styloviz/mcp component date-picker
npx @styloviz/mcp variants kanban swimlane
npx @styloviz/mcp icons arrow
npx @styloviz/mcp tokens primary
```

## Skills

The kit also ships agent instructions — a Claude Code skill and a Cursor rule —
in [`skills/styloviz`](https://github.com/styloviz/styloviz/tree/main/skills/styloviz)
of the public repository. They tell an assistant how Styloviz components are
imported, themed, translated and registered, and to ask this server before
writing code against an API it has not looked up.

## License

MIT
