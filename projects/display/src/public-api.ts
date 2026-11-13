/**
 * @styloviz/display — Public API
 *
 * Content-display components: the ways a dashboard shows a collection that is
 * neither a table nor a chart. The `DEMO_*` fixtures are exported the same way
 * the AI packages export theirs — they make a component demoable in one line
 * and tree-shake away when unused. `sv-status-page` composes `sv-timeline`
 * from `@styloviz/timeline` for each incident's updates; `sv-media-player`'s
 * `svDemoVideo` / `svDemoAudio` / `svDemoCaptions` are its demo media.
 * `sv-audio-device-select` composes `sv-select-dropdown` from
 * `@styloviz/select-dropdown` for its device lists.
 */

// ── Accessible names ─────────────────────────────────────────────────────────
export { SV_DISPLAY_LABELS } from '@styloviz/display/labels';
export type { SvDisplayLabels } from '@styloviz/display/labels';

// ── Media ────────────────────────────────────────────────────────────────────
export { SvCarouselComponent, DEMO_SLIDES } from '@styloviz/display/carousel';
export type {
  CarouselVariant,
  CarouselIndicator,
  CarouselSlide,
} from '@styloviz/display/carousel';
export { SvImageGalleryComponent, DEMO_IMAGES } from '@styloviz/display/image-gallery';
export type {
  GalleryLayout,
  GalleryColumns,
  GalleryViewerSize,
  GalleryViewerAspect,
  GalleryImage,
} from '@styloviz/display/image-gallery';
// ── Collections ──────────────────────────────────────────────────────────────
export { SvDndListComponent, DEMO_DND_ITEMS } from '@styloviz/display/dnd-list';
export type { DndListVariant, DndItem, DndReorderEvent } from '@styloviz/display/dnd-list';
export {
  SvDescriptionActionDirective,
  SvDescriptionsComponent,
} from '@styloviz/display/descriptions';
export type {
  DescriptionsLayout,
  DescriptionsVariant,
  DescriptionsSize,
  DescriptionsColumns,
  DescriptionsStackAt,
  DescriptionItem,
} from '@styloviz/display/descriptions';
export { SvItemsWithMoreComponent, svSplitOverflow } from '@styloviz/display/items-with-more';
export type {
  ItemsWithMoreItem,
  MoreVariant,
} from '@styloviz/display/items-with-more';
// ── Text ─────────────────────────────────────────────────────────────────────
export { SvLineClampComponent } from '@styloviz/display/line-clamp';

export { SvJsonViewerComponent } from '@styloviz/display/json-viewer';
export { secretKeyRedactor } from '@styloviz/display/json-viewer';
export type {
  JsonNodeKind,
  JsonViewerSize,
  JsonRow,
  JsonNodeClick,
  JsonCopyEvent,
  JsonRedactContext,
  JsonRedactor,
} from '@styloviz/display/json-viewer';

// ── Status ───────────────────────────────────────────────────────────────────
export { SvStatusPageComponent } from '@styloviz/display/status-page';
export type { SvStatusPageHeadingLevel, SvStatusPageLabels } from '@styloviz/display/status-page';
export {
  svFormatUptime,
  svOverallStatus,
  svStatusFromUptime,
  svUptimeSummary,
  svWorstStatus,
} from '@styloviz/display/status-page';
export type {
  SvIncidentImpact,
  SvIncidentStatus,
  SvIncidentUpdate,
  SvMaintenanceStatus,
  SvStatusComponent,
  SvStatusIncident,
  SvStatusInstant,
  SvStatusLevel,
  SvStatusMaintenance,
  SvStatusUptimeDay,
  SvUptimeCell,
  SvUptimeSummary,
} from '@styloviz/display/status-page';

// ── Media ────────────────────────────────────────────────────────────────────
export { SvMediaPlayerComponent } from '@styloviz/display/media-player';
export type {
  SvMediaLayout,
  SvMediaPlayerLabels,
  SvMediaPlaylistPosition,
  SvMediaPreload,
  SvMediaSinkError,
} from '@styloviz/display/media-player';
export { svFormatMediaTime, svIsSafeMediaUrl, svMediaSources, svMediaTracks } from '@styloviz/display/media-player';
export type {
  SvMediaChangeReason,
  SvMediaErrorCode,
  SvMediaErrorEvent,
  SvMediaItem,
  SvMediaKind,
  SvMediaSeekEvent,
  SvMediaSource,
  SvMediaTextTrack,
  SvMediaTimeEvent,
  SvMediaTrackChange,
} from '@styloviz/display/media-player';
/** Demo media made in the browser — tree-shakes away unless a demo calls it. */
export { svDemoAudio, svDemoCaptions, svDemoCaptionsDataUrl, svDemoVideo, svDemoVideoDataUrl } from '@styloviz/display/media-player';
export type { SvDemoAudioOptions, SvDemoCue, SvDemoMediaScene, SvDemoVideoOptions } from '@styloviz/display/media-player';

// ── Voice ────────────────────────────────────────────────────────────────────
export { SvTranscriptComponent } from '@styloviz/display/transcript';
export type { SvTranscriptLabels } from '@styloviz/display/transcript';
export {
  svActiveSegmentIndex,
  svTranscriptFilename,
  svTranscriptMatcher,
  svTranscriptParts,
  svTranscriptSpeakers,
  svTranscriptToText,
  svTranscriptToVtt,
  svVttTimestamp,
} from '@styloviz/display/transcript';
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
} from '@styloviz/display/transcript';
export { SvAudioDeviceSelectComponent } from '@styloviz/display/audio-device-select';
export type { SvAudioDeviceSelectLabels } from '@styloviz/display/audio-device-select';
export {
  SV_AUDIO_DEVICES,
  svAudioDevicesOf,
  svAudioLevel,
  svBrowserAudioDevices,
  svMicErrorCode,
} from '@styloviz/display/audio-device-select';
export type {
  SvAudioDevice,
  SvAudioDeviceBackend,
  SvAudioDeviceChange,
  SvAudioDeviceKind,
  SvAudioLevelSource,
  SvMicError,
  SvMicErrorCode,
  SvMicPermission,
} from '@styloviz/display/audio-device-select';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from '@styloviz/display/labels';

// Types a public input or output names, so a host can name them too (FL-G8, check:public-types).
export type { DndItemChangeEvent, DndRemoveEvent } from '@styloviz/display/dnd-list';
