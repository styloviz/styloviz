// The @styloviz/display/image-gallery entry point. The package barrel (src/public-api.ts) re-exports it.
export { SvImageGalleryComponent, DEMO_IMAGES } from './image-gallery.component';
export type {
  GalleryLayout,
  GalleryColumns,
  GalleryViewerSize,
  GalleryViewerAspect,
  GalleryImage,
} from './image-gallery.component';
