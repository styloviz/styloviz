import { SV_FORMS_LABELS, type SvFormsLabels } from '@styloviz/forms/labels';

export type ColorPickerFormat = 'hex' | 'rgb' | 'hsl';
export type ColorPickerSize   = 'sm' | 'md' | 'lg';

export interface ColorSwatch {
  readonly label: string;
  readonly value: string;
}

/** The swatch names `defaultSwatches` reads. */
export type ColorSwatchLabels = Pick<SvFormsLabels, 'swatchRed' | 'swatchOrange' | 'swatchAmber' | 'swatchYellow' | 'swatchGreen' | 'swatchTeal' | 'swatchCyan' | 'swatchBlue' | 'swatchIndigo' | 'swatchPurple' | 'swatchPink' | 'swatchGray' | 'swatchBlack' | 'swatchWhite'>;

/** The preset palette the picker shows when the host binds no `swatches`, named in `labels`. */
export function defaultSwatches(labels: ColorSwatchLabels): readonly ColorSwatch[] {
  return [
    { label: labels.swatchRed, value: '#ef4444' },
    { label: labels.swatchOrange, value: '#f97316' },
    { label: labels.swatchAmber, value: '#f59e0b' },
    { label: labels.swatchYellow, value: '#eab308' },
    { label: labels.swatchGreen, value: '#22c55e' },
    { label: labels.swatchTeal, value: '#14b8a6' },
    { label: labels.swatchCyan, value: '#06b6d4' },
    { label: labels.swatchBlue, value: '#3b82f6' },
    { label: labels.swatchIndigo, value: '#6366f1' },
    { label: labels.swatchPurple, value: '#a855f7' },
    { label: labels.swatchPink, value: '#ec4899' },
    { label: labels.swatchGray, value: '#6b7280' },
    { label: labels.swatchBlack, value: '#111827' },
    { label: labels.swatchWhite, value: '#ffffff' },
  ];
}

/** The default palette, in English. */
export const DEFAULT_SWATCHES: readonly ColorSwatch[] = defaultSwatches(SV_FORMS_LABELS);
