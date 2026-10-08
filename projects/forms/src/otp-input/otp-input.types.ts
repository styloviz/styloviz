export type OtpInputVariant = 'default' | 'filled' | 'underline' | 'ghost';
export type OtpInputSize    = 'sm' | 'md' | 'lg';
export type OtpInputStatus  = 'idle' | 'success' | 'error' | 'loading';

/**
 * How the code is taken from the user.
 *
 * ★★★ `'cells'` IS SIX FORM FIELDS AND EVERYTHING THAT READS FORMS BELIEVES IT
 *     — screen readers, password managers, and the OS autofill that looks for
 *     one `autocomplete="one-time-code"` input and skips a row of them.
 *     `'single'` is one real field with one real label, drawn over boxes that
 *     are decoration.
 */
export type OtpInputMode = 'cells' | 'single';
