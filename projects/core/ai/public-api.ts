/*
 * @styloviz/core/ai — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
/** `X-2` — one privacy and redaction contract for the AI pack. */
export {
  SV_AI_COMMON_PATTERNS,
  SV_AI_PRIVACY,
  SV_AI_PRIVACY_DEFAULT,
  provideSvAiPrivacy,
  svAiMask,
  svAiPrivacy,
} from './privacy';
export type { SvAiMaskPattern, SvAiMasked, SvAiPrivacyPolicy } from './privacy';
/** `FL-E2` — expose a widget to a browser agent as WebMCP tools (`navigator.modelContext`). */
export { SvWebMcpDirective } from './webmcp';
export { svCheckWebMcpArgs, svRegisterWebMcpTools, svRunWebMcpTool } from './webmcp.register';
export type { SvWebMcpRegisterOptions } from './webmcp.register';
export { SV_WEBMCP_SOURCE, svIsWebMcpName, svModelContext, svWebMcpResult } from './webmcp.source';
export type {
  SvWebMcpAnnotations,
  SvWebMcpClient,
  SvModelContextLike,
  SvWebMcpSchema,
  SvWebMcpTool,
  SvWebMcpToolSource,
} from './webmcp.source';
