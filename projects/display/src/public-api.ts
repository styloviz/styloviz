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
export { SV_DISPLAY_LABELS } from './display.labels';
export type { SvDisplayLabels } from './display.labels';

// ── Media ────────────────────────────────────────────────────────────────────
export { SvCarouselComponent, DEMO_SLIDES } from './carousel/carousel.component';
export type {
  CarouselVariant,
  CarouselIndicator,
  CarouselSlide,
} from './carousel/carousel.component';
export { SvImageGalleryComponent, DEMO_IMAGES } from './image-gallery/image-gallery.component';
export type {
  GalleryLayout,
  GalleryColumns,
  GalleryViewerSize,
  GalleryViewerAspect,
  GalleryImage,
} from './image-gallery/image-gallery.component';
// ── Collections ──────────────────────────────────────────────────────────────
export { SvDndListComponent, DEMO_DND_ITEMS } from './dnd-list/dnd-list.component';
export type { DndListVariant, DndItem, DndReorderEvent } from './dnd-list/dnd-list.component';
export {
  SvDescriptionActionDirective,
  SvDescriptionsComponent,
} from './descriptions/descriptions.component';
export type {
  DescriptionsLayout,
  DescriptionsVariant,
  DescriptionsSize,
  DescriptionsColumns,
  DescriptionsStackAt,
  DescriptionItem,
} from './descriptions/descriptions.component';
export { SvItemsWithMoreComponent, svSplitOverflow } from './items-with-more/items-with-more.component';
export type {
  ItemsWithMoreItem,
  MoreVariant,
} from './items-with-more/items-with-more.component';
// ── Text ─────────────────────────────────────────────────────────────────────
export { SvLineClampComponent } from './line-clamp/line-clamp.component';

export { SvJsonViewerComponent } from './json-viewer/json-viewer.component';
export { secretKeyRedactor } from './json-viewer/json-viewer.types';
export type {
  JsonNodeKind,
  JsonViewerSize,
  JsonRow,
  JsonNodeClick,
  JsonCopyEvent,
  JsonRedactContext,
  JsonRedactor,
} from './json-viewer/json-viewer.types';

// ── Status ───────────────────────────────────────────────────────────────────
export { SvStatusPageComponent } from './status-page/status-page.component';
export type { SvStatusPageHeadingLevel, SvStatusPageLabels } from './status-page/status-page.component';
export {
  svFormatUptime,
  svOverallStatus,
  svStatusFromUptime,
  svUptimeSummary,
  svWorstStatus,
} from './status-page/status-page.logic';
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
} from './status-page/status-page.logic';

// ── Media ────────────────────────────────────────────────────────────────────
export { SvMediaPlayerComponent } from './media-player/media-player.component';
export type {
  SvMediaLayout,
  SvMediaPlayerLabels,
  SvMediaPlaylistPosition,
  SvMediaPreload,
  SvMediaSinkError,
} from './media-player/media-player.component';
export { svFormatMediaTime, svIsSafeMediaUrl, svMediaSources, svMediaTracks } from './media-player/media-player.logic';
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
} from './media-player/media-player.logic';
/** Demo media made in the browser — tree-shakes away unless a demo calls it. */
export { svDemoAudio, svDemoCaptions, svDemoCaptionsDataUrl, svDemoVideo, svDemoVideoDataUrl } from './media-player/media-player.demo';
export type { SvDemoAudioOptions, SvDemoCue, SvDemoMediaScene, SvDemoVideoOptions } from './media-player/media-player.demo';

// ── Voice ────────────────────────────────────────────────────────────────────
export { SvTranscriptComponent } from './transcript/transcript.component';
export type { SvTranscriptLabels } from './transcript/transcript.component';
export {
  svActiveSegmentIndex,
  svTranscriptFilename,
  svTranscriptMatcher,
  svTranscriptParts,
  svTranscriptSpeakers,
  svTranscriptToText,
  svTranscriptToVtt,
  svVttTimestamp,
} from './transcript/transcript.logic';
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
} from './transcript/transcript.logic';
export { SvAudioDeviceSelectComponent } from './audio-device-select/audio-device-select.component';
export type { SvAudioDeviceSelectLabels } from './audio-device-select/audio-device-select.component';
export {
  SV_AUDIO_DEVICES,
  svAudioDevicesOf,
  svAudioLevel,
  svBrowserAudioDevices,
  svMicErrorCode,
} from './audio-device-select/audio-device-select.logic';
export type {
  SvAudioDevice,
  SvAudioDeviceBackend,
  SvAudioDeviceChange,
  SvAudioDeviceKind,
  SvAudioLevelSource,
  SvMicError,
  SvMicErrorCode,
  SvMicPermission,
} from './audio-device-select/audio-device-select.logic';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './display.labels.packs';

// Types a public input or output names, so a host can name them too (FL-G8, check:public-types).
export type { DndItemChangeEvent, DndRemoveEvent } from './dnd-list/dnd-list.component';
