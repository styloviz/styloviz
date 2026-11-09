#!/usr/bin/env node
/**
 * styloviz-mcp — the Styloviz MCP server (stdio), or a one-shot CLI.
 *
 *   npx @styloviz/mcp                         # serve MCP on stdio (what an editor runs)
 *   npx @styloviz/mcp search "data table grouping"
 *   npx @styloviz/mcp component data-table
 *   npx @styloviz/mcp icons arrow
 *   npx @styloviz/mcp tokens primary
 */
import { callTool, serve } from '../lib/server.mjs';
import { loadIndex } from '../lib/search.mjs';

const [command, ...rest] = process.argv.slice(2);
const arg = rest.join(' ');

const ONE_SHOT = {
  search: () => ['search', { query: arg }],
  component: () => ['get_component', { name: arg }],
  list: () => ['list_components', { category: arg || undefined }],
  variants: () => ['find_variants', { name: rest[0], query: rest.slice(1).join(' ') }],
  icons: () => ['find_icons', { query: arg }],
  tokens: () => ['get_tokens', { query: arg }],
  templates: () => ['list_templates', {}],
};

if (!command || command === 'serve') {
  serve();
} else if (command === '--help' || command === '-h' || !ONE_SHOT[command]) {
  process.stderr.write(
    'Usage: styloviz-mcp [serve]                 MCP server on stdio\n' +
      '       styloviz-mcp search <query>          components and templates\n' +
      '       styloviz-mcp component <name>        full API and snippet\n' +
      '       styloviz-mcp list [category]         the catalogue\n' +
      '       styloviz-mcp variants <name> [query] demos and examples\n' +
      '       styloviz-mcp icons <query>           glyph names and imports\n' +
      '       styloviz-mcp tokens [query]          theme tokens\n' +
      '       styloviz-mcp templates               application templates\n',
  );
  process.exitCode = command === '--help' || command === '-h' ? 0 : 2;
} else {
  try {
    const [tool, args] = ONE_SHOT[command]();
    process.stdout.write(`${JSON.stringify(callTool(loadIndex(), tool, args), null, 2)}\n`);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = 1;
  }
}
