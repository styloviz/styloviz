/*
 * @styloviz/core/directives — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
// Directives
export { SvChartAnimDirective } from './chart-animate.directive';
export { SvAutofocusDirective } from './autofocus.directive';
export { SvAutosizeDirective } from './autosize.directive';
export { SvStopPropagationDirective } from './stop-propagation.directive';
export { SvRevealDirective } from './reveal.directive';
export { SvPauseOffscreenDirective } from './pause-offscreen.directive';
// Global move listeners for the span of a drag only — see the file header (1.0 audit, M2).
export { svListenWhile, type SvListenTarget, type SvListenWhileRef } from './listen-while';
