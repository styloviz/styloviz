/**
 * @styloviz/display — Public API
 *
 * Content-display components: the ways a dashboard shows a collection that is
 * neither a table nor a chart. The `DEMO_*` fixtures are exported the same way
 * the AI packages export theirs — they make a component demoable in one line
 * and tree-shake away when unused.
 */

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
