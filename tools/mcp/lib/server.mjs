/**
 * A Model Context Protocol server over stdio, with no dependencies.
 *
 * ★ Why not the SDK: the kit ships no runtime dependencies (CLAUDE.md, and
 *   `check:package-refs`), and the part of MCP a read-only knowledge server
 *   needs is small — JSON-RPC 2.0, one message per line on stdin/stdout,
 *   `initialize`, `tools/list`, `tools/call`, `ping`. Nothing is written to
 *   stdout but protocol messages; diagnostics go to stderr.
 */
import { createInterface } from 'node:readline';
import { findIcons, findTokens, findVariants, getBlock, getComponent, listBlocks, listComponents, loadIndex, search } from './search.mjs';

/** Protocol revisions this server speaks, newest first. */
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const str = (description) => ({ type: 'string', description });

/** The tools, as `tools/list` describes them. */
export const TOOLS = [
  {
    name: 'search',
    title: 'Search Styloviz components',
    description: 'Free-text search across every Styloviz component, template and page block: docs, API inputs, demo titles and notes. Returns the best matches with their docs URL, package and a usage snippet to paste.',
    inputSchema: { type: 'object', properties: { query: str('What you are looking for, e.g. "data table grouping"'), limit: { type: 'number', description: 'Maximum components to return (default 5)' } }, required: ['query'] },
  },
  {
    name: 'get_component',
    title: 'Get a component',
    description: 'The full documented record of one component by name, docs id or selector: description, when to use it, the free and Pro API (inputs, outputs, types, defaults), usage snippet, worked examples, demo titles, customization and accessibility notes.',
    inputSchema: { type: 'object', properties: { name: str('e.g. "data-table", "Data Table" or "sv-data-table"') }, required: ['name'] },
  },
  {
    name: 'list_components',
    title: 'List components',
    description: 'The component catalogue, optionally narrowed by category words (e.g. "forms", "charts", "ai") and tier.',
    inputSchema: { type: 'object', properties: { category: str('Words from a category name'), tier: { type: 'string', enum: ['free', 'pro'] } } },
  },
  {
    name: 'find_variants',
    title: 'Find demo variants',
    description: 'The live demos and worked examples of one component, optionally only those matching a query — with the demo URL and example code.',
    inputSchema: { type: 'object', properties: { name: str('Component name, id or selector'), query: str('Optional words to filter by') }, required: ['name'] },
  },
  {
    name: 'find_icons',
    title: 'Find icons',
    description: 'Icon names containing the query words, in the free and Pro sets, with the per-glyph import line and how to register it.',
    inputSchema: { type: 'object', properties: { query: str('e.g. "arrow", "chart bar"') }, required: ['query'] },
  },
  {
    name: 'get_tokens',
    title: 'Get theme tokens',
    description: 'Styloviz theme tokens (CSS custom properties from the kit stylesheet) whose name contains the query words — e.g. "primary", "radius", "font".',
    inputSchema: { type: 'object', properties: { query: str('Words in the token name; empty for all') } },
  },
  {
    name: 'list_blocks',
    title: 'List page blocks',
    description: 'Copy-paste page sections (hero, pricing, testimonials, FAQ, CTA, footer, sign-in cards, settings panels, empty states…), each one standalone Angular component. Optionally narrowed by category words and tier.',
    inputSchema: { type: 'object', properties: { category: str('Words from a category, e.g. "pricing", "auth", "settings"'), tier: { type: 'string', enum: ['free', 'pro'] } } },
  },
  {
    name: 'get_block',
    title: 'Get a page block',
    description: 'One page block by id or title: a free block with its complete component file to save and render; a Pro block with the page where a licence unlocks it.',
    inputSchema: { type: 'object', properties: { id: str('e.g. "hero-centered-signup" or "Centred, with email sign-up"') }, required: ['id'] },
  },
  {
    name: 'list_templates',
    title: 'List templates',
    description: 'The full application templates (admin, CRM, store, docs site…) with their tier and live preview URL.',
    inputSchema: { type: 'object', properties: {} },
  },
];

/** Run one tool; returns the payload, or throws a user-facing Error. */
export function callTool(index, name, args = {}) {
  switch (name) {
    case 'search':
      if (!args.query) throw new Error('`query` is required');
      return search(index, args.query, Number(args.limit) || 5);
    case 'get_component': {
      const c = getComponent(index, args.name);
      if (!c) throw new Error(`No Styloviz component matches "${args.name}". Try the \`search\` tool.`);
      return c;
    }
    case 'list_components':
      return listComponents(index, args);
    case 'find_variants': {
      const v = findVariants(index, args.name, args.query);
      if (!v) throw new Error(`No Styloviz component matches "${args.name}".`);
      return v;
    }
    case 'find_icons':
      return findIcons(index, args.query ?? '');
    case 'get_tokens':
      return findTokens(index, args.query ?? '');
    case 'list_blocks':
      return listBlocks(index, args);
    case 'get_block': {
      const b = getBlock(index, args.id);
      if (!b) throw new Error(`No Styloviz block matches "${args.id}". Try \`list_blocks\`.`);
      return b;
    }
    case 'list_templates':
      return index.templates;
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  }
}

/** Handle one JSON-RPC message; returns the response object, or null for a notification. */
export function handle(index, message) {
  const { id, method, params } = message ?? {};
  const isRequest = id !== undefined && id !== null;
  const ok = (result) => (isRequest ? { jsonrpc: '2.0', id, result } : null);
  const fail = (code, msg) => (isRequest ? { jsonrpc: '2.0', id, error: { code, message: msg } } : null);

  if (!message || message.jsonrpc !== '2.0' || typeof method !== 'string') return fail(-32600, 'Invalid Request');
  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion;
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'styloviz', title: 'Styloviz UI kit', version: index.version },
        instructions:
          'Answers questions about the Styloviz Angular + Tailwind CSS 4 component kit from its own docs. ' +
          'Use `search` first, then `get_component` for the exact API before writing code; for a whole page section, `list_blocks` then `get_block`. Components are standalone; ' +
          'import each from the package `search` returns. Free packages are `@styloviz/*`, Pro are `@styloviz-pro/*`.',
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: TOOLS });
    case 'tools/call': {
      try {
        const data = callTool(index, params?.name, params?.arguments ?? {});
        return ok({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: Array.isArray(data) ? { items: data } : data });
      } catch (e) {
        if (e.code === -32602) return fail(-32602, e.message);
        return ok({ content: [{ type: 'text', text: e.message }], isError: true });
      }
    }
    default:
      if (method.startsWith('notifications/')) return null;
      return fail(-32601, `Method not found: ${method}`);
  }
}

/** Serve on stdio until stdin closes. */
export function serve({ input = process.stdin, output = process.stdout, index = loadIndex() } = {}) {
  const rl = createInterface({ input, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      output.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`);
      return;
    }
    const batch = Array.isArray(message) ? message : [message];
    const replies = batch.map((m) => handle(index, m)).filter(Boolean);
    if (replies.length) output.write(`${JSON.stringify(Array.isArray(message) ? replies : replies[0])}\n`);
  });
  return rl;
}
