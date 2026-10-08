export type ColorPickerFormat = 'hex' | 'rgb' | 'hsl';
export type ColorPickerSize   = 'sm' | 'md' | 'lg';

export interface ColorSwatch {
  readonly label: string;
  readonly value: string;
}

export const DEFAULT_SWATCHES: readonly ColorSwatch[] = [
  { label: 'Red',     value: '#ef4444' },
  { label: 'Orange',  value: '#f97316' },
  { label: 'Amber',   value: '#f59e0b' },
  { label: 'Yellow',  value: '#eab308' },
  { label: 'Green',   value: '#22c55e' },
  { label: 'Teal',    value: '#14b8a6' },
  { label: 'Cyan',    value: '#06b6d4' },
  { label: 'Blue',    value: '#3b82f6' },
  { label: 'Indigo',  value: '#6366f1' },
  { label: 'Purple',  value: '#a855f7' },
  { label: 'Pink',    value: '#ec4899' },
  { label: 'Gray',    value: '#6b7280' },
  { label: 'Black',   value: '#111827' },
  { label: 'White',   value: '#ffffff' },
];
