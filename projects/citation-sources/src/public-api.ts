/**
 * @styloviz/citation-sources — Public API
 */
export * from './lib';

// Sample data the showcase binds explicitly.
export {
  DEMO_ANSWER,
  DEMO_CITATIONS,
  DEMO_SOURCES,
  DEMO_SOURCES_RESTRICTED,
} from './lib/citation-sources.component';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/citation-sources.labels.packs';
