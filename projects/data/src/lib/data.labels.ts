/**
 * The error messages `@styloviz/data`'s sources raise, in English — each one is
 * an `SvDataError.message`, which a table's error state shows the user.
 * Override any of them with `provideSvLabels({ data: { … } })` from `@styloviz/core`.
 */
export interface SvDataLabels {
  /** `withFailure()`'s default message. */
  readonly demoServerUnavailable: string;
  /** `withFlakiness()`'s message for a dropped request. */
  readonly connectionDropped: string;
  /** `createHttpDataSource()`'s message when `mapResponse` cannot read the body. */
  readonly unreadableResponse: string;
}

export const SV_DATA_LABELS: SvDataLabels = {
  demoServerUnavailable: 'The demo server is unavailable.',
  connectionDropped: 'The connection dropped.',
  unreadableResponse: 'Could not read the response.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    data: SvDataLabels;
  }
}
