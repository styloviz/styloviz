// The module this file augments. It has to be in this entry point's program:
// no other file of the entry imports it.
import type {} from '@styloviz/core/i18n';

/**
 * The accessible names and visible text `sv-carousel`, `sv-descriptions`, `sv-dnd-list`,
 * `sv-image-gallery`, `sv-items-with-more`, `sv-json-viewer`, `sv-line-clamp`, `sv-media-player`, `sv-status-page`, `sv-transcript` and `sv-audio-device-select`
 * render, in English. `{slots}` are
 * filled with data; `{count, plural, …}` follows the locale's plural rules.
 * Override any of them with `provideSvLabels({ display: { … } })` from `@styloviz/core`.
 */
export interface SvDisplayLabels {
  readonly previousSlide: string;
  readonly nextSlide: string;
  readonly chooseSlide: string;
  readonly moveUp: string;
  readonly moveDown: string;
  readonly viewFullSize: string;
  readonly productImages: string;
  readonly playSlideshow: string;
  readonly pauseSlideshow: string;
  readonly markIncomplete: string;
  readonly markComplete: string;
  readonly slidePosition: string;
  readonly goToSlide: string;
  readonly reorderItem: string;
  readonly dropItem: string;
  readonly removeItem: string;
  readonly moveItemLeft: string;
  readonly moveItemRight: string;
  readonly moveItemUp: string;
  readonly moveItemDown: string;
  readonly imageNotLoaded: string;
  readonly unnamedImageNotLoaded: string;
  readonly selectImage: string;
  readonly deselectImage: string;
  readonly viewImage: string;
  readonly viewImageFullSize: string;
  readonly openImage: string;
  readonly openUnnamedImage: string;
  readonly moreItems: string;
  readonly copyValueOf: string;
  readonly copyPath: string;
  /** `sv-carousel`: the region's name (`ariaLabel`), the empty state (`emptyMessage`), and the live announcement. `{index}`, `{total}`, `{title}`. */
  readonly carousel: string;
  readonly noSlides: string;
  readonly slideAnnouncement: string;
  readonly slideAnnouncementTitled: string;
  /** `sv-descriptions`: `emptyText`'s default. */
  readonly noDetails: string;
  /** `sv-dnd-list`: `emptyText`'s default, the checklist heading, the kanban move tooltips and empty column. */
  readonly nothingToOrder: string;
  readonly progress: string;
  readonly moveLeft: string;
  readonly moveRight: string;
  readonly noItems: string;
  /** `sv-dnd-list`'s live announcements. `{name}` is the item's label, `{position}` / `{total}` where it now sits. */
  readonly dndMovedTo: string;
  readonly dndAtPosition: string;
  readonly dndDroppedAt: string;
  readonly dndMovedUpTo: string;
  readonly dndMovedDownTo: string;
  readonly dndLifted: string;
  readonly dndMoveCancelled: string;
  /** A disabled item's grip was pressed: it cannot be moved. */
  readonly dndItemLocked: string;
  /** `{count}` drives the plural, `{n}` is the count as shown. */
  readonly dndRemoved: string;
  readonly dndMarkedComplete: string;
  readonly dndMarkedIncomplete: string;
  /** Stands in for an item with no label. */
  readonly dndUnnamedItem: string;
  /** `sv-dnd-list`'s kanban column headings. */
  readonly dndColumnTodo: string;
  readonly dndColumnInProgress: string;
  readonly dndColumnDone: string;
  /** `sv-image-gallery`: `emptyMessage`'s default, and its visible text. `{author}`. */
  readonly noImages: string;
  readonly clearSelection: string;
  readonly couldNotLoad: string;
  readonly byAuthor: string;
  readonly hoverToZoom: string;
  /** `sv-image-gallery`'s masonry reading-order disclosure. */
  readonly masonryOrderNote: string;
  /** `sv-image-gallery`'s lightbox: its name (`{title}` when the image has one) and controls. */
  readonly imageViewer: string;
  readonly imageViewerTitled: string;
  /** `sv-image-gallery`'s selection strip — `{n}` selected, `{off}` of them not on this page; both arrive as digits. */
  readonly gallerySelected: string;
  readonly gallerySelectedOffPage: string;
  readonly closeImageViewer: string;
  readonly previousImage: string;
  readonly nextImage: string;
  /** `sv-items-with-more`: `moreLabel`'s default; `{n}` is the hidden count. */
  readonly moreCount: string;
  /** `sv-items-with-more`: the overflow control's name, naming the hidden items. `{count}` drives the plural, `{n}` is shown; past five names `{others}` / `{othersN}` count the rest. */
  readonly moreNamed: string;
  readonly moreNamedCapped: string;
  /** Joins the hidden items' names in `moreNamed` / `moreNamedCapped`. */
  readonly moreNamesSeparator: string;
  /** `sv-items-with-more`'s live notice when every item fits again. */
  readonly moreAllFit: string;
  /** `sv-json-viewer`: the row's copy buttons. */
  readonly copyValueButton: string;
  readonly copiedButton: string;
  readonly copyPathButton: string;
  /** `sv-json-viewer`'s placeholders: an unread accessor, one that threw (`{error}`), and a capped list (`{n}` hidden). */
  readonly jsonGetterNotRead: string;
  readonly jsonGetterThrew: string;
  readonly jsonMoreChildren: string;
  /** `sv-json-viewer`'s notice when the tree hits `maxRows` — `{n}` arrives as digits. */
  readonly jsonRowCeiling: string;
  /** `sv-json-viewer`'s one-leaf summary of bytes (ArrayBuffer, typed array, Blob): `{type}`, `{n}` formatted, `{count}` drives the plural. */
  readonly jsonBinary: string;
  /** `sv-json-viewer`'s hidden-properties note. `{count}` drives the plural; `{n}`, `{nonEnumerable}`, `{symbolKeyed}` are shown. */
  readonly jsonOmittedNonEnumerable: string;
  readonly jsonOmittedSymbolKeyed: string;
  readonly jsonOmittedBoth: string;
  /** `sv-line-clamp`: `expandLabel` / `collapseLabel` defaults. */
  readonly showMore: string;
  readonly showLess: string;
  /** `sv-items-with-more` inline toggle, expanded. */
  readonly showLessShort: string;
  /** `sv-status-page`: each status level as text — a component's state, a day's tooltip, the legend. */
  readonly statusOperational: string;
  readonly statusDegraded: string;
  readonly statusPartialOutage: string;
  readonly statusMajorOutage: string;
  readonly statusMaintenance: string;
  /** `sv-status-page`: a day with no record in the uptime bar. */
  readonly statusNoData: string;
  /** `sv-status-page`: the overall banner's headline per level. */
  readonly statusBannerOperational: string;
  readonly statusBannerDegraded: string;
  readonly statusBannerPartialOutage: string;
  readonly statusBannerMajorOutage: string;
  readonly statusBannerMaintenance: string;
  /** `sv-status-page`: `{time}` arrives formatted in the page's locale and time zone. */
  readonly statusLastUpdated: string;
  /** `sv-status-page`: the section headings. */
  readonly statusComponentsHeading: string;
  readonly statusActiveHeading: string;
  readonly statusMaintenanceHeading: string;
  readonly statusHistoryHeading: string;
  /** `sv-status-page`: the uptime line — `{pct}` formatted, `{days}` drives the plural. */
  readonly statusUptimeSummary: string;
  /** `sv-status-page`: the uptime line when no day carries a percentage — `{good}` formatted, `{days}` drives the plural. */
  readonly statusUptimeGoodDays: string;
  /** `sv-status-page`: the uptime line with no records at all. */
  readonly statusUptimeNoData: string;
  /** `sv-status-page`: the uptime bar's accessible name — `{name}`, `{summary}`, `{start}` and `{end}` arrive finished. */
  readonly statusUptimeBarLabel: string;
  /** `sv-status-page`: a day cell's tooltip, without and with a measured `{pct}`. */
  readonly statusDayTitle: string;
  readonly statusDayTitleUptime: string;
  /** `sv-status-page`: screen-reader lead-in to the list of days that were not operational; `{count}` drives the plural. */
  readonly statusIssueDays: string;
  /** `sv-status-page`: the history when no incident has been resolved. */
  readonly statusNoPastIncidents: string;
  /** `sv-status-page`: an incident's status. */
  readonly statusInvestigating: string;
  readonly statusIdentified: string;
  readonly statusMonitoring: string;
  readonly statusResolved: string;
  /** `sv-status-page`: an incident's impact. */
  readonly statusImpactNone: string;
  readonly statusImpactMinor: string;
  readonly statusImpactMajor: string;
  readonly statusImpactCritical: string;
  /** `sv-status-page`: the components an incident or window touches — `{names}` arrives as a locale-joined list. */
  readonly statusAffects: string;
  /** `sv-status-page`: the accessible name of an incident's update timeline. */
  readonly statusUpdatesLabel: string;
  /** `sv-status-page`: a maintenance window's state and its span (`{start}` / `{end}` formatted). */
  readonly statusMaintenanceScheduled: string;
  readonly statusMaintenanceInProgress: string;
  readonly statusMaintenanceWindow: string;
  /** `sv-status-page`: the empty state when nothing at all has been published. */
  readonly statusEmptyTitle: string;
  readonly statusEmptyMessage: string;
  /** `sv-status-page`: the loading skeleton's accessible name. */
  readonly statusLoading: string;
  /** `sv-media-player`: the player region's name — alone, and with the item's `{title}`. */
  readonly mediaPlayer: string;
  readonly mediaPlayerTitled: string;
  /** `sv-media-player`: the control toolbar's name. */
  readonly mediaControls: string;
  /** `sv-media-player`: the play button — playing, paused, and after the end. */
  readonly mediaPlay: string;
  readonly mediaPause: string;
  readonly mediaReplay: string;
  /** `sv-media-player`: playlist steps. */
  readonly mediaPrevious: string;
  readonly mediaNext: string;
  /** `sv-media-player`: the seek slider's name and its spoken value — `{current}` / `{duration}` arrive as clocks. */
  readonly mediaSeek: string;
  readonly mediaTimeOf: string;
  /** `sv-media-player`: sound. `{pct}` is the volume, 0–100. */
  readonly mediaMute: string;
  readonly mediaUnmute: string;
  readonly mediaVolume: string;
  readonly mediaVolumeValue: string;
  readonly mediaMutedValue: string;
  /** `sv-media-player`: the speed button's name (`{rate}` is `mediaSpeedValue` filled) and the rate itself (`{rate}` a number). */
  readonly mediaSpeed: string;
  readonly mediaSpeedValue: string;
  /** `sv-media-player`: the captions button, and what is announced when it changes — `{label}` is the track's own label. */
  readonly mediaCaptions: string;
  readonly mediaCaptionsOn: string;
  readonly mediaCaptionsOff: string;
  /** `sv-media-player`: full screen and picture in picture, on and off. */
  readonly mediaFullscreen: string;
  readonly mediaExitFullscreen: string;
  readonly mediaPictureInPicture: string;
  readonly mediaExitPictureInPicture: string;
  /** `sv-media-player`: the playlist's name, and the marker on the entry playing. */
  readonly mediaPlaylist: string;
  readonly mediaNowPlaying: string;
  /** `sv-media-player`: loading the file, and waiting for more of it mid-play. */
  readonly mediaLoading: string;
  readonly mediaBuffering: string;
  /** `sv-media-player`: playback failed — a heading, then the reason. */
  readonly mediaErrorTitle: string;
  readonly mediaErrorNetwork: string;
  readonly mediaErrorDecode: string;
  readonly mediaErrorUnsupported: string;
  readonly mediaErrorAborted: string;
  readonly mediaErrorUnsafe: string;
  readonly mediaRetry: string;
  /** `sv-media-player`: an empty playlist, and the playlist's loading skeleton. */
  readonly mediaEmptyTitle: string;
  readonly mediaEmptyMessage: string;
  readonly mediaListLoading: string;
  /** `sv-media-player`: the keyboard help read with the video — `{seconds}` is `seekStep`. */
  readonly mediaShortcuts: string;
  /** `sv-media-player`: an item with no title. */
  readonly mediaUntitled: string;
  /** `sv-transcript`: the region's and the list's name. */
  readonly transcript: string;
  /** `sv-transcript`: the badge shown in `live` mode. */
  readonly transcriptLive: string;
  /** `sv-transcript`: the search box — its label, placeholder, match count (`{current}`, `{count}`), the match arrows and the clear button. */
  readonly transcriptSearch: string;
  readonly transcriptSearchPlaceholder: string;
  readonly transcriptMatchCount: string;
  readonly transcriptNoMatches: string;
  readonly transcriptPreviousMatch: string;
  readonly transcriptNextMatch: string;
  readonly transcriptClearSearch: string;
  /** `sv-transcript`: copy and download — the group's name, the buttons, and the result read to a screen reader. */
  readonly transcriptActions: string;
  readonly transcriptCopy: string;
  readonly transcriptCopied: string;
  readonly transcriptCopyFailed: string;
  readonly transcriptDownloadText: string;
  readonly transcriptDownloadVtt: string;
  /** `sv-transcript`: a timestamp button — plays a linked player from `{time}`, or (no player / `playOnSeek` off) only moves to it. */
  readonly transcriptPlayFrom: string;
  readonly transcriptJumpTo: string;
  /** `sv-transcript`: read after interim text, which may still change. */
  readonly transcriptInterim: string;
  /** `sv-transcript`: the live announcement of a new final line. */
  readonly transcriptSpeakerSaid: string;
  /** `sv-transcript`: read after the line under the playhead. */
  readonly transcriptNowPlaying: string;
  /** `sv-transcript`: the live-mode button shown after the reader scrolls up and new lines arrive. */
  readonly transcriptJumpToLatest: string;
  /** `sv-transcript`: the loading skeleton's name and the empty states — `{query}` is the search. */
  readonly transcriptLoading: string;
  readonly transcriptEmptyTitle: string;
  readonly transcriptEmptyMessage: string;
  readonly transcriptLiveEmptyMessage: string;
  readonly transcriptNoResultsTitle: string;
  readonly transcriptNoResultsMessage: string;
  readonly transcriptFilteredMessage: string;
  /** `sv-audio-device-select`: the group's name, the two lists, the system-default entry and the numbered names used while the browser hides device names (`{index}`). */
  readonly audioDevice: string;
  readonly audioDeviceInput: string;
  readonly audioDeviceOutput: string;
  readonly audioDeviceDefault: string;
  readonly audioDeviceUnnamedInput: string;
  readonly audioDeviceUnnamedOutput: string;
  /** `sv-audio-device-select`: the permission states — checking, not asked yet, allowed, blocked (with guidance), and the two places microphones are unavailable. */
  readonly audioDeviceChecking: string;
  readonly audioDeviceAllow: string;
  readonly audioDevicePromptHint: string;
  readonly audioDeviceGranted: string;
  readonly audioDeviceDeniedTitle: string;
  readonly audioDeviceDeniedHelp: string;
  readonly audioDeviceCheckAgain: string;
  readonly audioDeviceUnsupported: string;
  readonly audioDeviceInsecure: string;
  /** `sv-audio-device-select`: why the microphone could not be opened. */
  readonly audioDeviceNotFound: string;
  readonly audioDeviceInUse: string;
  readonly audioDeviceFailed: string;
  /** `sv-audio-device-select`: the level test — its toggle, the meter's name and value (`{pct}`), and the hint shown while it runs. */
  readonly audioDeviceTest: string;
  readonly audioDeviceStopTest: string;
  readonly audioDeviceLevel: string;
  readonly audioDeviceLevelValue: string;
  readonly audioDeviceListening: string;
  /** `sv-audio-device-select`: shown instead of the speaker list where the browser cannot route sound. */
  readonly audioDeviceOutputUnsupported: string;
  /** `sv-audio-device-select`: announced when the chosen device is unplugged. */
  readonly audioDeviceLost: string;
}

export const SV_DISPLAY_LABELS: SvDisplayLabels = {
  previousSlide: 'Previous slide',
  nextSlide: 'Next slide',
  chooseSlide: 'Choose slide',
  moveUp: 'Move up',
  moveDown: 'Move down',
  viewFullSize: 'View full size',
  productImages: 'Product images',
  playSlideshow: 'Play automatic slideshow',
  pauseSlideshow: 'Pause automatic slideshow',
  markIncomplete: 'Mark incomplete',
  markComplete: 'Mark complete',
  slidePosition: '{index} of {total}',
  goToSlide: 'Go to slide {index}',
  reorderItem: 'Reorder {name}',
  dropItem: 'Drop {name}',
  removeItem: 'Remove {name}',
  moveItemLeft: 'Move {name} left',
  moveItemRight: 'Move {name} right',
  moveItemUp: 'Move {name} up',
  moveItemDown: 'Move {name} down',
  imageNotLoaded: '{name} — could not be loaded',
  unnamedImageNotLoaded: 'Image — could not be loaded',
  selectImage: 'Select {name}',
  deselectImage: 'Deselect {name}',
  viewImage: 'View {name}',
  viewImageFullSize: 'View {name} full size',
  openImage: 'Open {name}',
  openUnnamedImage: 'Open image',
  moreItems: '{count, plural, one {# more item} other {# more items}}',
  copyValueOf: 'Copy value of {path}',
  copyPath: 'Copy path {path}',
  carousel: 'Carousel',
  noSlides: 'No slides to show',
  slideAnnouncement: 'Slide {index} of {total}',
  slideAnnouncementTitled: 'Slide {index} of {total}: {title}',
  noDetails: 'No details to show',
  nothingToOrder: 'Nothing to order yet',
  progress: 'Progress',
  moveLeft: 'Move left',
  moveRight: 'Move right',
  noItems: 'No items',
  dndMovedTo: '{name} moved to position {position} of {total}.',
  dndAtPosition: '{name} at position {position} of {total}.',
  dndDroppedAt: '{name} dropped at position {position} of {total}.',
  dndMovedUpTo: '{name} moved up to position {position} of {total}.',
  dndMovedDownTo: '{name} moved down to position {position} of {total}.',
  dndLifted: '{name} lifted. Use the arrow keys to move it, space to drop, escape to cancel.',
  dndMoveCancelled: 'Move cancelled. The order is unchanged.',
  dndItemLocked: '{name} cannot be moved.',
  dndRemoved: '{name} removed. {count, plural, one {{n} item} other {{n} items}} remaining.',
  dndMarkedComplete: '{name} marked complete.',
  dndMarkedIncomplete: '{name} marked incomplete.',
  dndUnnamedItem: 'Item',
  dndColumnTodo: 'To Do',
  dndColumnInProgress: 'In Progress',
  dndColumnDone: 'Done',
  noImages: 'No images yet',
  clearSelection: 'Clear selection',
  couldNotLoad: 'Could not load',
  byAuthor: 'by {author}',
  hoverToZoom: 'Hover to zoom',
  masonryOrderNote:
    'Masonry columns fill top to bottom, so the left-to-right reading order does not match the order these images are in. Use the grid layout where that order matters.',
  imageViewer: 'Image viewer',
  imageViewerTitled: '{title} — image viewer',
  gallerySelected: '{n} selected',
  gallerySelectedOffPage: '{n} selected — {off} not on this page',
  closeImageViewer: 'Close image viewer',
  previousImage: 'Previous image',
  nextImage: 'Next image',
  moreCount: '+{n} more',
  moreNamed: '{count, plural, one {Show {n} more item: {names}} other {Show {n} more items: {names}}}',
  moreNamedCapped: 'Show {n} more items: {names}, and {others, plural, one {{othersN} other} other {{othersN} others}}',
  moreNamesSeparator: ', ',
  moreAllFit: '{count, plural, one {All {n} item now fits.} other {All {n} items now fit.}} The more button has gone.',
  copyValueButton: 'value',
  copiedButton: 'copied',
  copyPathButton: 'path',
  jsonGetterNotRead: '(getter — not read)',
  jsonGetterThrew: '(getter threw: {error})',
  jsonMoreChildren: '… {n} more (raise maxChildren to show)',
  jsonRowCeiling: '… stopped at {n} rows (raise maxRows to show more)',
  jsonBinary: '{type} · {n} {count, plural, one {byte} other {bytes}}',
  jsonOmittedNonEnumerable: '+ {n} non-enumerable own {count, plural, one {property} other {properties}} not shown',
  jsonOmittedSymbolKeyed: '+ {n} symbol-keyed own {count, plural, one {property} other {properties}} not shown',
  jsonOmittedBoth:
    '+ {nonEnumerable} non-enumerable, {symbolKeyed} symbol-keyed own {count, plural, one {property} other {properties}} not shown',
  showMore: 'Show more',
  showLess: 'Show less',
  showLessShort: 'Less',
  statusOperational: 'Operational',
  statusDegraded: 'Degraded performance',
  statusPartialOutage: 'Partial outage',
  statusMajorOutage: 'Major outage',
  statusMaintenance: 'Under maintenance',
  statusNoData: 'No data',
  statusBannerOperational: 'All systems operational',
  statusBannerDegraded: 'Some systems are degraded',
  statusBannerPartialOutage: 'Partial system outage',
  statusBannerMajorOutage: 'Major system outage',
  statusBannerMaintenance: 'Maintenance in progress',
  statusLastUpdated: 'Last updated {time}',
  statusComponentsHeading: 'Components',
  statusActiveHeading: 'Active incidents',
  statusMaintenanceHeading: 'Scheduled maintenance',
  statusHistoryHeading: 'Past incidents',
  statusUptimeSummary: '{pct}% uptime over {days, plural, one {# day} other {# days}}',
  statusUptimeGoodDays: '{good} of {days, plural, one {# day} other {# days}} without an outage',
  statusUptimeNoData: 'No uptime data yet',
  statusUptimeBarLabel: '{name}: {summary}, {start} to {end}',
  statusDayTitle: '{date}: {status}',
  statusDayTitleUptime: '{date}: {status}, {pct}% uptime',
  statusIssueDays: '{count, plural, one {Not operational on # day:} other {Not operational on # days:}}',
  statusNoPastIncidents: 'No incidents reported.',
  statusInvestigating: 'Investigating',
  statusIdentified: 'Identified',
  statusMonitoring: 'Monitoring',
  statusResolved: 'Resolved',
  statusImpactNone: 'No impact',
  statusImpactMinor: 'Minor impact',
  statusImpactMajor: 'Major impact',
  statusImpactCritical: 'Critical impact',
  statusAffects: 'Affects {names}',
  statusUpdatesLabel: 'Updates on {title}',
  statusMaintenanceScheduled: 'Scheduled',
  statusMaintenanceInProgress: 'In progress',
  statusMaintenanceWindow: '{start} to {end}',
  statusEmptyTitle: 'Nothing published yet',
  statusEmptyMessage: 'No components, incidents or maintenance windows have been published.',
  statusLoading: 'Loading system status',
  mediaPlayer: 'Media player',
  mediaPlayerTitled: '{title} — media player',
  mediaControls: 'Player controls',
  mediaPlay: 'Play',
  mediaPause: 'Pause',
  mediaReplay: 'Replay',
  mediaPrevious: 'Previous',
  mediaNext: 'Next',
  mediaSeek: 'Seek',
  mediaTimeOf: '{current} of {duration}',
  mediaMute: 'Mute',
  mediaUnmute: 'Unmute',
  mediaVolume: 'Volume',
  mediaVolumeValue: '{pct}%',
  mediaMutedValue: 'Muted',
  mediaSpeed: 'Playback speed: {rate}',
  mediaSpeedValue: '{rate}×',
  mediaCaptions: 'Captions',
  mediaCaptionsOn: 'Captions: {label}',
  mediaCaptionsOff: 'Captions off',
  mediaFullscreen: 'Full screen',
  mediaExitFullscreen: 'Exit full screen',
  mediaPictureInPicture: 'Picture in picture',
  mediaExitPictureInPicture: 'Exit picture in picture',
  mediaPlaylist: 'Playlist',
  mediaNowPlaying: 'Now playing',
  mediaLoading: 'Loading media',
  mediaBuffering: 'Buffering',
  mediaErrorTitle: 'This media could not be played',
  mediaErrorNetwork: 'The connection dropped while it was downloading.',
  mediaErrorDecode: 'The file is damaged, or in a format this browser cannot decode.',
  mediaErrorUnsupported: 'This browser cannot play this file, or the file could not be found.',
  mediaErrorAborted: 'Loading stopped before it finished.',
  mediaErrorUnsafe: 'The address of this media is not allowed.',
  mediaRetry: 'Try again',
  mediaEmptyTitle: 'Nothing to play',
  mediaEmptyMessage: 'No media has been added to this player yet.',
  mediaListLoading: 'Loading the playlist',
  mediaShortcuts:
    'Shortcuts: Space or K plays and pauses, the Left and Right arrows skip {seconds} seconds, M mutes, F switches full screen, C switches captions, and Shift with comma or period changes the speed.',
  mediaUntitled: 'Untitled',
  transcript: 'Transcript',
  transcriptLive: 'Live',
  transcriptSearch: 'Search the transcript',
  transcriptSearchPlaceholder: 'Search transcript',
  transcriptMatchCount: '{current} of {count}',
  transcriptNoMatches: 'No matches',
  transcriptPreviousMatch: 'Previous match',
  transcriptNextMatch: 'Next match',
  transcriptClearSearch: 'Clear search',
  transcriptActions: 'Transcript actions',
  transcriptCopy: 'Copy transcript',
  transcriptCopied: 'Transcript copied',
  transcriptCopyFailed: 'Could not copy — select the text and copy it instead',
  transcriptDownloadText: 'Download as text',
  transcriptDownloadVtt: 'Download as WebVTT captions',
  transcriptPlayFrom: 'Play from {time}',
  transcriptJumpTo: 'Go to {time}',
  transcriptInterim: '(still transcribing)',
  transcriptSpeakerSaid: '{speaker}: {text}',
  transcriptNowPlaying: 'now playing',
  transcriptJumpToLatest: 'Jump to latest',
  transcriptLoading: 'Loading the transcript',
  transcriptEmptyTitle: 'No transcript yet',
  transcriptEmptyMessage: 'Nothing has been transcribed for this recording.',
  transcriptLiveEmptyMessage: 'Listening — words appear here as they are recognised.',
  transcriptNoResultsTitle: 'No matching lines',
  transcriptNoResultsMessage: 'Nothing in the transcript matches “{query}”.',
  transcriptFilteredMessage: 'Nothing in the transcript matches the current filter.',
  audioDevice: 'Audio devices',
  audioDeviceInput: 'Microphone',
  audioDeviceOutput: 'Speaker',
  audioDeviceDefault: 'System default',
  audioDeviceUnnamedInput: 'Microphone {index}',
  audioDeviceUnnamedOutput: 'Speaker {index}',
  audioDeviceChecking: 'Checking microphone access…',
  audioDeviceAllow: 'Allow microphone access',
  audioDevicePromptHint: 'Your browser will ask before this page can use a microphone. Nothing is recorded until you allow it.',
  audioDeviceGranted: 'Microphone access allowed',
  audioDeviceDeniedTitle: 'Microphone access is blocked',
  audioDeviceDeniedHelp: 'Open this site’s settings in your browser (the icon beside the address), allow the microphone, then check again.',
  audioDeviceCheckAgain: 'Check again',
  audioDeviceUnsupported: 'This browser cannot list or open audio devices.',
  audioDeviceInsecure: 'Microphones are only available on a secure (https) page.',
  audioDeviceNotFound: 'No microphone was found. Connect one and try again.',
  audioDeviceInUse: 'The microphone is busy in another app, or could not be started.',
  audioDeviceFailed: 'The microphone could not be opened.',
  audioDeviceTest: 'Test microphone',
  audioDeviceStopTest: 'Stop test',
  audioDeviceLevel: 'Input level',
  audioDeviceLevelValue: '{pct}%',
  audioDeviceListening: 'Listening — speak and the level moves. Nothing is recorded.',
  audioDeviceOutputUnsupported: 'This browser plays sound through the system’s default speaker.',
  audioDeviceLost: 'The chosen device was disconnected — switched to {fallback}.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    display: SvDisplayLabels;
  }
}
