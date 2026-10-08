import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
  type WritableSignal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import type { Address } from './address-card.component';
import {
  DEFAULT_ADDRESS_SCHEMAS,
  GENERIC_ADDRESS_SCHEMA,
  resolveAddressSchema,
  type AddressFieldName,
  type AddressFieldSchema,
  type AddressSaveEvent,
  type AddressSchema,
  type AddressVerification,
} from './address-schema';
import { svUniqueId } from '@styloviz/core';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvAddressFormComponent — Add / edit an address.
 *
 * A signal-driven form (via `linkedSignal`, so it repopulates when `value`
 * changes) whose FIELD LIST COMES FROM THE COUNTRY rather than from the
 * template. Emits the assembled `Address` on a valid `save`, or `cancel`.
 *
 * Features:
 * - Country-driven field list, labels, order and required-ness — see
 *   {@link AddressSchema}. A country with no postal code does not render one.
 * - Validation derived from the active schema, so the form is submittable for a
 *   UK address without inventing a county
 * - Advisory verification state that never blocks submit, `unavailable` included
 * - Edit mode by binding `value`; the form resets when it changes
 * - Instance-scoped ids, so a shipping and a billing form can share a page
 */
@Component({
  selector: 'sv-address-form',
  standalone: true,
  imports: [NgClass],
  templateUrl: './address-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvAddressFormComponent {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Initial value for edit mode; the form resets when it changes. @default null */
  value = input<Address | null>(null);

  /**
   * The countries offered, and the field list each one implies.
   *
   * Replaces the old `countries: string[]`, which could only ever change the
   * names in the dropdown — the fields behind it were fixed, so picking Germany
   * still demanded a state Germany has no field for.
   * @default DEFAULT_ADDRESS_SCHEMAS (12 countries)
   */
  schemas = input<readonly AddressSchema[]>(DEFAULT_ADDRESS_SCHEMAS);

  /** Label for the country selector. @default 'Country' */
  countryLabel = input<string>('Country');

  /** Optional form heading. @default '' */
  title = input<string>('');

  /** Submit button label. @default 'Save address' */
  submitLabel = input<string>('Save address');

  /** Cancel button label. @default 'Cancel' */
  cancelLabel = input<string>('Cancel');

  /** Show the cancel button. @default true */
  showCancel = input<boolean>(true);

  /** Show the label field (Home / Work). @default true */
  showLabelField = input<boolean>(true);

  /** Show the "Set as default" toggle. @default true */
  showDefaultToggle = input<boolean>(true);

  /** True while the host is persisting a submitted address. @default false */
  saving = input<boolean>(false);

  /**
   * What is known about this address, from the host's verifier.
   *
   * ★ Advisory only. **No status disables submit**, `unavailable` and `failed`
   *   included. A verifier is a third party that times out, rate-limits and
   *   500s, and a form that treats a missing answer as a failing one stops
   *   accepting good addresses the moment someone else has a bad afternoon.
   * @default null
   */
  verification = input<AddressVerification | null>(null);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * Emitted with the assembled address on a valid submit, alongside the
   * verification status at that moment — so the host can tell "checked and fine"
   * from "never managed to check".
   */
  save = output<AddressSaveEvent>();

  /**
   * Emitted when cancel is pressed. Named `cancelled` rather than `cancel`,
   * which is a native DOM event name, and to match `cancelLabel` /
   * `showCancel`.
   */
  cancelled = output<void>();

  /**
   * The country changed. The field list changed with it, so this is the moment
   * to run a fresh verification rather than re-showing a verdict about the old
   * shape of the address.
   */
  countryChange = output<string>();

  /** The verifier's suggestion was accepted and written into the fields. */
  suggestionApplied = output<Address>();

  // ── Fields (repopulate when `value` changes, stay writable) ─────────────────

  readonly label = linkedSignal(() => this.value()?.label ?? '');
  readonly firstName = linkedSignal(() => this.value()?.firstName ?? '');
  readonly lastName = linkedSignal(() => this.value()?.lastName ?? '');
  readonly line1 = linkedSignal(() => this.value()?.line1 ?? '');
  readonly line2 = linkedSignal(() => this.value()?.line2 ?? '');
  readonly city = linkedSignal(() => this.value()?.city ?? '');
  readonly state = linkedSignal(() => this.value()?.state ?? '');
  readonly postalCode = linkedSignal(() => this.value()?.postalCode ?? '');
  readonly country = linkedSignal(() => this.value()?.country ?? '');
  readonly phone = linkedSignal(() => this.value()?.phone ?? '');
  readonly isDefault = linkedSignal(() => this.value()?.isDefault ?? false);

  private readonly controls: Readonly<Record<AddressFieldName, WritableSignal<string>>> = {
    label: this.label,
    firstName: this.firstName,
    lastName: this.lastName,
    line1: this.line1,
    line2: this.line2,
    city: this.city,
    state: this.state,
    postalCode: this.postalCode,
    phone: this.phone,
  };

  private readonly submitted = signal(false);

  /**
   * Read a field by schema name, for the render loop.
   *
   * Not `valueOf`, which would shadow `Object.prototype.valueOf` with an
   * incompatible signature and make the component structurally incompatible with
   * a plain object — every `TestBed` input literal stops type-checking.
   */
  fieldValue(name: AddressFieldName): string {
    return this.controls[name]();
  }

  /** Write a field by schema name, from the render loop. */
  setFieldValue(name: AddressFieldName, next: string): void {
    this.controls[name].set(next);
  }

  // ── Schema ──────────────────────────────────────────────────────────────────

  /**
   * The country's schema, or the generic one until a country is chosen. Falls
   * back to generic for a country not in `schemas` — an unrecognised value must
   * not make the form unsubmittable.
   */
  readonly schema = computed<AddressSchema>(
    () => resolveAddressSchema(this.schemas(), this.country()) ?? GENERIC_ADDRESS_SCHEMA,
  );

  /** The fields to render, in the country's order, minus anything switched off. */
  readonly fields = computed<readonly AddressFieldSchema[]>(() => {
    const showLabel = this.showLabelField();
    return this.schema().fields.filter((f) => f.name !== 'label' || showLabel);
  });

  /** Country names for the selector, in the order `schemas` was given. */
  readonly countryOptions = computed<readonly string[]>(() =>
    this.schemas().map((s) => s.name),
  );

  // ── Ids ─────────────────────────────────────────────────────────────────────
  //
  // Every id here used to be a literal (`af-first`, `af-city`, …). A checkout
  // that shows a shipping form and a billing form together — the ordinary case —
  // rendered each id twice, and every `<label for>` in the second form pointed at
  // the first form's input.

  private readonly _uid = svUniqueId('sv-address-form');

  /** Id of a field control, unique to this instance. */
  fieldId(name: string): string { return `${this._uid}-${name}`; }

  /** Id of the message describing that field, for `aria-describedby`. */
  errorId(name: string): string { return `${this._uid}-${name}-error`; }

  // ── Validation ──────────────────────────────────────────────────────────────

  /**
   * Required-ness comes from the schema, so a UK address submits without a
   * county and a Hong Kong one without a postal code. Country is always
   * required: it is what selects the rest of the rules.
   */
  readonly errors = computed<Partial<Record<AddressFieldName | 'country', string>>>(() => {
    if (!this.submitted()) return {};
    const out: Partial<Record<AddressFieldName | 'country', string>> = {};
    for (const field of this.fields()) {
      if (field.required && !this.controls[field.name]().trim()) out[field.name] = 'Required';
    }
    if (!this.country().trim()) out.country = 'Required';
    return out;
  });

  private readonly isValid = computed(() => {
    if (!this.country().trim()) return false;
    return this.fields().every((f) => !f.required || this.controls[f.name]().trim().length > 0);
  });

  errorFor(name: AddressFieldName | 'country'): string {
    return this.errors()[name] ?? '';
  }

  errClass(name: AddressFieldName | 'country'): string {
    return this.errorFor(name)
      ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-500/25 dark:border-danger-500/60'
      : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500/25 dark:border-white/10';
  }

  // ── Verification ────────────────────────────────────────────────────────────

  readonly verificationStatus = computed(() => this.verification()?.status ?? 'unverified');

  /** Whether to show the advisory strip at all. */
  readonly showVerification = computed(() => this.verificationStatus() !== 'unverified');

  readonly suggestion = computed<Address | null>(() => {
    const v = this.verification();
    return v?.status === 'corrected' ? (v.suggestion ?? null) : null;
  });

  /**
   * Default wording per status, so a host that has only a status still gets a
   * sentence. `verification.message` overrides it.
   */
  readonly verificationMessage = computed<string>(() => {
    const v = this.verification();
    if (v?.message) return v.message;
    switch (v?.status) {
      case 'verifying': return 'Checking this address…';
      case 'verified': return 'Address confirmed.';
      case 'corrected': return 'We found a close match. Use it, or keep what you entered.';
      case 'unavailable':
        return 'We could not check this address right now. You can save it as entered.';
      case 'failed':
        return 'We could not match this address. Check it, or save it as entered.';
      default: return '';
    }
  });

  /** Tone of the advisory strip. `unavailable` is a notice, not an error. */
  readonly verificationClass = computed(() => {
    switch (this.verificationStatus()) {
      case 'verified':
        return 'bg-accent-50 text-accent-800 ring-accent-200 dark:bg-accent-950/40 dark:text-accent-200 dark:ring-accent-900';
      case 'failed':
        return 'bg-danger-50 text-danger-800 ring-danger-200 dark:bg-danger-950/40 dark:text-danger-200 dark:ring-danger-900';
      case 'corrected':
      case 'unavailable':
        return 'bg-warning-50 text-warning-800 ring-warning-200 dark:bg-warning-950/40 dark:text-warning-200 dark:ring-warning-900';
      default:
        return 'bg-gray-50 text-gray-700 ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10';
    }
  });

  /** One line of the suggested address, for the "use this instead" block. */
  readonly suggestionLines = computed<readonly string[]>(() => {
    const s = this.suggestion();
    if (s === null) return [];
    const cityLine = [[s.city, s.state].filter(Boolean).join(', '), s.postalCode]
      .filter(Boolean)
      .join(' ');
    return [s.line1, s.line2 ?? '', cityLine, s.country].filter((l) => l.trim().length > 0);
  });

  /** Write the verifier's version into the fields. */
  applySuggestion(): void {
    const s = this.suggestion();
    if (s === null) return;
    this.label.set(s.label ?? this.label());
    this.firstName.set(s.firstName);
    this.lastName.set(s.lastName);
    this.line1.set(s.line1);
    this.line2.set(s.line2 ?? '');
    this.city.set(s.city);
    this.state.set(s.state);
    this.postalCode.set(s.postalCode);
    this.country.set(s.country);
    this.phone.set(s.phone ?? this.phone());
    this.suggestionApplied.emit(s);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  onCountryChange(next: string): void {
    this.country.set(next);
    this.countryChange.emit(next);
  }

  /**
   * ★ Only the active schema's fields are sent.
   *
   * Type a county, then switch to Germany: the value is still in the signal, but
   * Germany's schema has no region field, so shipping it would store a state
   * against an address that has none — and the card would print it.
   */
  onSubmit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.isValid() || this.saving()) return;

    const present = new Set(this.fields().map((f) => f.name));
    const take = (name: AddressFieldName): string =>
      present.has(name) ? this.controls[name]().trim() : '';
    const optional = (name: AddressFieldName): string | undefined => take(name) || undefined;

    const address: Address = {
      id: this.value()?.id,
      label: optional('label'),
      firstName: take('firstName'),
      lastName: take('lastName'),
      line1: take('line1'),
      line2: optional('line2'),
      city: take('city'),
      state: take('state'),
      postalCode: take('postalCode'),
      country: this.country().trim(),
      phone: optional('phone'),
      isDefault: this.isDefault(),
      kind: this.value()?.kind,
    };
    this.save.emit({ address, verification: this.verificationStatus() });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
