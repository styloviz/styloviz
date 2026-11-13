import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { svUniqueId } from '@styloviz/core/a11y';
import { svPersistedStore, type SvPersistedStore } from '@styloviz/core/data';
import { injectSvLabels } from '@styloviz/core/i18n';
import { svIsSafeUrl } from '@styloviz/core/security';
import { SvIconComponent } from '@styloviz/icons/core';
import { SV_COOKIE_CONSENT_LABELS, type SvCookieConsentLabels } from './cookie-consent.labels';

import { registerCookieConsentIcons } from './cookie-consent.component.icons';
// ─── Types ────────────────────────────────────────────────────────────────────

/** One purpose the visitor can allow or refuse. */
export interface SvCookieCategory {
  /** Stable identity — the key in the consent state and the record. */
  readonly id: string;
  /** What the switch is called. */
  readonly label: string;
  /** One or two sentences on what the category does. */
  readonly description?: string;
  /**
   * Strictly necessary: always on, and its switch is shown checked and disabled.
   * Everything else starts off — ePrivacy consent is opt-in, never pre-ticked.
   */
  readonly required?: boolean;
}

/** Category id → allowed. JSON-safe, so a host can store it as-is. */
export type SvCookieConsentState = Readonly<Record<string, boolean>>;

/** Which control produced a consent record. */
export type SvCookieConsentMethod = 'accept-all' | 'reject-all' | 'save';

/**
 * What the visitor decided, when, and under which policy — the evidence GDPR
 * Art. 7(1) asks a controller to be able to produce. JSON-safe.
 */
export interface SvCookieConsentRecord {
  /** The policy `version` in force when the visitor chose. */
  readonly version: string;
  /** When the visitor chose, as an ISO 8601 string. */
  readonly timestamp: string;
  /** Accept all, reject all, or a saved custom selection. */
  readonly method: SvCookieConsentMethod;
  /** Every category's outcome; required categories are always `true`. */
  readonly categories: SvCookieConsentState;
}

/** `banner` (bottom bar), `corner` (compact card) or `modal` (a dialog up front). */
export type SvCookieConsentLayout = 'banner' | 'corner' | 'modal';

/** Which bottom corner the `corner` card sits in — logical, so it flips in RTL. */
export type SvCookieConsentCorner = 'start' | 'end';

/** A category as the template draws it. */
interface CategoryRow {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly required: boolean;
  readonly inputId: string;
  readonly descriptionId: string;
}

const METHODS: readonly SvCookieConsentMethod[] = ['accept-all', 'reject-all', 'save'];

/** The storage envelope's kind — namespaced by selector. */
const STORAGE_KIND = 'sv-cookie-consent/record';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read a consent record from anything — storage, a cookie, a server response —
 * and return it only when it really is one. Use it before handing a stored
 * value to `[record]`.
 */
export function svReadCookieConsentRecord(value: unknown): SvCookieConsentRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Readonly<Record<string, unknown>>;
  if (typeof v['version'] !== 'string' || typeof v['timestamp'] !== 'string') return null;
  if (Number.isNaN(Date.parse(v['timestamp']))) return null;
  const method = METHODS.find((m) => m === v['method']);
  if (!method) return null;
  const raw = v['categories'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const categories: Record<string, boolean> = {};
  for (const [key, allowed] of Object.entries(raw as Readonly<Record<string, unknown>>)) {
    if (typeof allowed !== 'boolean') return null;
    categories[key] = allowed;
  }
  return { version: v['version'], timestamp: v['timestamp'], method, categories };
}

/** Whether a stored record was made under the current policy `version`. */
export function svCookieConsentIsCurrent(
  record: SvCookieConsentRecord | null | undefined,
  version: string,
): boolean {
  return !!record && record.version === version;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * `sv-cookie-consent` — a GDPR / ePrivacy cookie banner with per-category
 * preferences and a consent record.
 *
 * Features:
 * - Three layouts: a bottom `banner`, a compact `corner` card, or a `modal` dialog up front
 * - "Reject all" is exactly as prominent as "Accept all"; optional categories start off
 * - Per-category native switches (`<input type="checkbox" role="switch">`) in a native `<dialog>`
 * - Emits a record with the choices, an ISO timestamp and the policy `version`
 * - `[(consent)]` and `[record]` restore a returning visitor; a newer `version` re-asks
 * - No storage of its own unless `storageKey` opts in; SSR-safe, no timers
 *
 * ```html
 * <sv-cookie-consent version="2026-10" privacyHref="/privacy"
 *                    [record]="saved()" (recorded)="store($event)" />
 * ```
 */
@Component({
  selector: 'sv-cookie-consent',
  standalone: true,
  imports: [SvIconComponent],
  templateUrl: './cookie-consent.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvCookieConsentComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerCookieConsentIcons();

  private readonly registryText = injectSvLabels('cookieConsent', SV_COOKIE_CONSENT_LABELS);
  /** @internal Prefix for the ids the labels and descriptions point at. */
  protected readonly baseId = svUniqueId('sv-cookie-consent');

  // ── Data ──────────────────────────────────────────────────────────────────

  /**
   * The purposes the visitor chooses between. Empty uses four built-in ones —
   * strictly necessary (required), functional, analytics and marketing — worded
   * from the labels, so they translate with the rest. Rows with an empty or
   * duplicate `id` are skipped. @default []
   */
  readonly categories = input<readonly SvCookieCategory[]>([]);

  /**
   * The visitor's choices, category id → allowed. Two-way: bind `[(consent)]`
   * to restore and keep them. Updated only when the visitor decides — toggling a
   * switch changes nothing until "Save choices". Unknown ids are ignored and a
   * missing optional id counts as refused. @default {}
   */
  readonly consent = model<SvCookieConsentState>({});

  /**
   * The visitor's stored record, if any. With the current `version` the banner
   * starts closed and `consent` is restored from it; with an older one the banner
   * re-asks, says the policy changed and starts from the old choices. @default null
   */
  readonly record = input<SvCookieConsentRecord | null>(null);

  /**
   * Your cookie policy's version, stamped into every record. Change it when the
   * policy changes and returning visitors are asked again. @default '1'
   */
  readonly version = input<string>('1');

  // ── Visibility ────────────────────────────────────────────────────────────

  /**
   * Whether the banner (or, for `layout="modal"`, the dialog) is showing. The
   * component closes it when the visitor decides. Two-way: `[(open)]`. @default true
   */
  readonly open = model<boolean>(true);

  /**
   * Whether the per-category preferences dialog is open. Set it `true` from a
   * "Cookie settings" link so visitors can change their mind later — withdrawing
   * consent must be as easy as giving it. Two-way: `[(preferencesOpen)]`. @default false
   */
  readonly preferencesOpen = model<boolean>(false);

  // ── Appearance ────────────────────────────────────────────────────────────

  /** `banner` (full-width bottom bar), `corner` (compact card) or `modal` (dialog up front). @default 'banner' */
  readonly layout = input<SvCookieConsentLayout>('banner');

  /** Which bottom corner the `corner` card sits in. @default 'end' */
  readonly corner = input<SvCookieConsentCorner>('end');

  /**
   * Render the banner or card in normal flow instead of fixed to the viewport —
   * for previews, docs and settings pages. The preferences dialog stays modal. @default false
   */
  readonly inline = input<boolean>(false);

  /**
   * Your privacy or cookie policy URL. Relative paths, `http(s):` and `mailto:`
   * are kept; anything else (`javascript:`, `data:`) drops the link. @default null
   */
  readonly privacyHref = input<string | null>(null);

  /** Per-instance text, merged over the registry's `cookieConsent` labels. @default {} */
  readonly labels = input<Partial<SvCookieConsentLabels>>({});

  // ── Persistence (opt-in) ──────────────────────────────────────────────────

  /**
   * Opt in to keeping the record in `localStorage` under this key, in a
   * versioned envelope. Read once after the first render (never on the server);
   * written on every decision. `null` keeps nothing — persistence is yours
   * through `(recorded)` and `[record]`. @default null
   */
  readonly storageKey = input<string | null>(null);

  // ── Events ────────────────────────────────────────────────────────────────

  /** The visitor accepted, rejected or saved: their choices, an ISO timestamp and the policy version. */
  readonly recorded = output<SvCookieConsentRecord>();

  /** A record was read back from `storageKey` — load the scripts it allows. */
  readonly restored = output<SvCookieConsentRecord>();

  // ── Derived state ─────────────────────────────────────────────────────────

  /** @internal The labels in effect. */
  protected readonly text = computed<SvCookieConsentLabels>(() => ({ ...this.registryText, ...this.labels() }));

  /** @internal Validated categories, built-ins when none are given. */
  protected readonly rows = computed<readonly CategoryRow[]>(() => {
    const given = this.categories();
    const t = this.text();
    const list: readonly SvCookieCategory[] = given.length
      ? given
      : [
          { id: 'necessary', label: t.necessary, description: t.necessaryDescription, required: true },
          { id: 'functional', label: t.functional, description: t.functionalDescription },
          { id: 'analytics', label: t.analytics, description: t.analyticsDescription },
          { id: 'marketing', label: t.marketing, description: t.marketingDescription },
        ];
    const seen = new Set<string>();
    const out: CategoryRow[] = [];
    for (const category of list) {
      const id = typeof category?.id === 'string' ? category.id.trim() : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const n = out.length;
      out.push({
        id,
        label: typeof category.label === 'string' && category.label.trim() ? category.label : id,
        description: typeof category.description === 'string' ? category.description : '',
        required: category.required === true,
        inputId: `${this.baseId}-switch-${n}`,
        descriptionId: `${this.baseId}-desc-${n}`,
      });
    }
    return out;
  });

  /** @internal Every category's effective state: required on, the rest as consented. */
  protected readonly effective = computed<SvCookieConsentState>(() => {
    const consent = this.consent() ?? {};
    const out: Record<string, boolean> = {};
    for (const row of this.rows()) out[row.id] = row.required || consent[row.id] === true;
    return out;
  });

  /** @internal Unsaved switch positions; resets to `effective` whenever that changes. */
  protected readonly draft = linkedSignal<SvCookieConsentState>(() => this.effective());

  /** A record read back from `storageKey`. */
  private readonly loaded = signal<SvCookieConsentRecord | null>(null);
  /** The version the visitor last decided under in this session. */
  private readonly decidedVersion = signal<string | null>(null);
  /** `layout="modal"` only: the visitor closed the dialog without deciding. */
  private readonly modalDismissed = signal(false);

  /** @internal The policy changed since the stored choice. */
  protected readonly policyChanged = computed(() => {
    const prior = this.loaded() ?? this.record();
    const version = this.version();
    return !!prior && prior.version !== version && this.decidedVersion() !== version;
  });

  /** @internal Whether the native dialog is showing. */
  protected readonly dialogShown = computed(
    () => this.preferencesOpen() || (this.open() && this.layout() === 'modal' && !this.modalDismissed()),
  );

  /**
   * @internal Whether the banner/card is rendered. A dismissed `modal` layout
   * falls back to the banner, so a choice is always one press away.
   */
  protected readonly barShown = computed(
    () => this.open() && (this.layout() !== 'modal' || this.modalDismissed()),
  );

  /** @internal The bar is the compact card. */
  protected readonly isCorner = computed(() => this.layout() === 'corner');

  /** @internal The policy link, or null when absent or unsafe. */
  protected readonly policyHref = computed<string | null>(() => {
    const raw = this.privacyHref();
    if (typeof raw !== 'string') return null;
    const href = raw.trim();
    return href && svIsSafeUrl(href, false) ? href : null;
  });

  /** @internal Classes for the bar's outer element. */
  protected readonly barClass = computed(() => {
    const inline = this.inline();
    if (this.isCorner()) {
      const side = this.corner() === 'start' ? 'start-4' : 'end-4';
      return inline
        ? 'relative w-full max-w-sm'
        : `fixed bottom-4 ${side} z-[60] w-[calc(100%-2rem)] max-w-sm`;
    }
    return inline ? 'relative w-full' : 'fixed inset-x-0 bottom-0 z-[60]';
  });

  /** @internal Polite announcement once a choice is recorded. */
  protected readonly announcement = signal('');

  // ── Shared classes ────────────────────────────────────────────────────────

  /**
   * Accept and Reject share ONE class string on purpose: rejecting must be as
   * easy and as visible as accepting (EDPB Guidelines 03/2022, CNIL 2020).
   */
  protected readonly decisionClass =
    'inline-flex min-h-10 items-center justify-center rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white ' +
    'transition-colors hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ' +
    'focus-visible:ring-offset-2 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus-visible:ring-offset-gray-900';

  protected readonly secondaryClass =
    'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm ' +
    'font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 ' +
    'dark:hover:bg-gray-800 dark:focus-visible:ring-offset-gray-900';

  // ── Internals ─────────────────────────────────────────────────────────────

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  /** Where focus was before the dialog opened — restored when it closes. */
  private returnFocus: HTMLElement | null = null;
  private store: SvPersistedStore<SvCookieConsentRecord> | null = null;
  private storeKey = '';

  constructor() {
    // A host-supplied record restores the choices and decides whether to ask.
    effect(() => {
      const record = this.record();
      const version = this.version();
      untracked(() => this.adopt(record, version));
    });

    // The native dialog follows `dialogShown`. Never on the server.
    afterRenderEffect(() => {
      const shown = this.dialogShown();
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;
      untracked(() => (shown ? this.showDialog(dialog) : this.hideDialog(dialog)));
    });

    // Opt-in storage is read once, in the browser, after the first render.
    afterNextRender(() => this.loadStored());
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Allow every category and record it. */
  acceptAll(): void {
    const all: Record<string, boolean> = {};
    for (const row of this.rows()) all[row.id] = true;
    this.decide(all, 'accept-all');
  }

  /** Refuse every optional category and record it. */
  rejectAll(): void {
    this.decide({}, 'reject-all');
  }

  /** Record the switch positions in the preferences dialog. */
  save(): void {
    this.decide(this.draft(), 'save');
  }

  /** Open the per-category preferences — wire a "Cookie settings" link to this. */
  openPreferences(): void {
    this.announcement.set('');
    this.preferencesOpen.set(true);
  }

  /** Close the preferences without recording anything. */
  closePreferences(): void {
    this.preferencesOpen.set(false);
    if (this.layout() === 'modal' && this.open()) this.modalDismissed.set(true);
    this.draft.set(this.effective());
  }

  // ── Template handlers ─────────────────────────────────────────────────────

  /** @internal A switch moved — kept as a draft until "Save choices". */
  protected toggle(row: CategoryRow, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (row.required) {
      target.checked = true;
      return;
    }
    this.draft.update((d) => ({ ...d, [row.id]: target.checked }));
  }

  /** @internal The dialog closed natively — Escape, or a form `method="dialog"`. */
  protected onDialogClose(): void {
    if (this.dialogShown()) this.closePreferences();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private decide(choices: SvCookieConsentState, method: SvCookieConsentMethod): void {
    const categories: Record<string, boolean> = {};
    for (const row of this.rows()) categories[row.id] = row.required || choices[row.id] === true;
    const record: SvCookieConsentRecord = {
      version: this.version(),
      timestamp: new Date().toISOString(),
      method,
      categories,
    };
    this.consent.set(categories);
    this.decidedVersion.set(record.version);
    this.modalDismissed.set(false);
    this.preferencesOpen.set(false);
    this.open.set(false);
    this.announcement.set(this.text().saved);
    this.storeFor(this.storageKey())?.save(record);
    this.recorded.emit(record);
  }

  /** Restore from a stored record and decide whether to ask again. */
  private adopt(record: SvCookieConsentRecord | null, version: string): void {
    if (!record) return;
    this.consent.set(record.categories);
    this.open.set(!svCookieConsentIsCurrent(record, version));
  }

  private loadStored(): void {
    const store = this.storeFor(this.storageKey());
    if (!store) return;
    const { state } = store.load();
    if (!state) {
      // Nothing usable stored (or a refused blob): the visitor is asked, which
      // is the safe default — never assume consent from what could not be read.
      return;
    }
    this.loaded.set(state);
    this.adopt(state, this.version());
    this.restored.emit(state);
  }

  private storeFor(key: string | null): SvPersistedStore<SvCookieConsentRecord> | null {
    const k = typeof key === 'string' ? key.trim() : '';
    if (!k) return null;
    if (!this.store || this.storeKey !== k) {
      this.storeKey = k;
      this.store = svPersistedStore<SvCookieConsentRecord>({
        key: k,
        spec: { kind: STORAGE_KIND, version: 1, read: svReadCookieConsentRecord },
      });
    }
    return this.store;
  }

  private showDialog(dialog: HTMLDialogElement): void {
    if (dialog.open || dialog.hasAttribute('open')) return;
    const active = dialog.ownerDocument.activeElement;
    this.returnFocus = active instanceof HTMLElement && active !== dialog.ownerDocument.body ? active : null;
    if (typeof dialog.showModal === 'function') {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    } else {
      dialog.setAttribute('open', '');
    }
    // The heading, not the first control: a screen reader hears what the
    // dialog is before landing on a switch, and nothing is toggled by accident.
    dialog.querySelector<HTMLElement>('[data-sv-cookie-dialog-title]')?.focus();
  }

  private hideDialog(dialog: HTMLDialogElement): void {
    if (dialog.open || dialog.hasAttribute('open')) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
    const target = this.returnFocus;
    this.returnFocus = null;
    if (target?.isConnected) target.focus();
  }
}
