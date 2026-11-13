// The @styloviz/display/transcript entry point. The package barrel (src/public-api.ts) re-exports it.
export { SvTranscriptComponent } from './transcript.component';
export type { SvTranscriptLabels } from './transcript.component';
export {
  svActiveSegmentIndex,
  svTranscriptFilename,
  svTranscriptMatcher,
  svTranscriptParts,
  svTranscriptSpeakers,
  svTranscriptToText,
  svTranscriptToVtt,
  svVttTimestamp,
} from './transcript.logic';
export type {
  SvResolvedSpeaker,
  SvTranscriptExportEvent,
  SvTranscriptExportFormat,
  SvTranscriptPart,
  SvTranscriptPlayer,
  SvTranscriptSeekEvent,
  SvTranscriptSegment,
  SvTranscriptSpeaker,
  SvTranscriptTone,
} from './transcript.logic';
