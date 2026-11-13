import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { svUniqueId } from '@styloviz/core/a11y';
import { injectSvLabels, svFormatLabel, svLocale } from '@styloviz/core/i18n';
import { SvIconComponent } from '@styloviz/icons/core';
import { SvSelectDropdownComponent, type SelectOption, type SelectSize } from '@styloviz/select-dropdown';
import { SV_DISPLAY_LABELS, type SvDisplayLabels } from '@styloviz/display/labels';
import {
  SV_AUDIO_DEVICES,
  svAudioDevicesOf,
  svMicErrorCode,
  type SvAudioDevice,
  type SvAudioDeviceChange,
  type SvAudioDeviceKind,
  type SvAudioLevelSource,
  type SvMicError,
  type SvMicErrorCode,
  type SvMicPermission,
} from './audio-device-select.logic';

import { registerAudioDeviceSelectIcons } from './audio-device-select.component.icons';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The labels this component reads — the `audioDevice*` subset of the `display` namespace. */
export type SvAudioDeviceSelectLabels = Pick<
  SvDisplayLabels,
  | 'audioDevice'
  | 'audioDeviceInput'
  | 'audioDeviceOutput'
  | 'audioDeviceDefault'
  | 'audioDeviceUnnamedInput'
  | 'audioDeviceUnnamedOutput'
  | 'audioDeviceChecking'
  | 'audioDeviceAllow'
  | 'audioDevicePromptHint'
  | 'audioDeviceGranted'
  | 'audioDeviceDeniedTitle'
  | 'audioDeviceDeniedHelp'
  | 'audioDeviceCheckAgain'
  | 'audioDeviceUnsupported'
  | 'audioDeviceInsecure'
  | 'audioDeviceNotFound'
  | 'audioDeviceInUse'
  | 'audioDeviceFailed'
  | 'audioDeviceTest'
  | 'audioDeviceStopTest'
  | 'audioDeviceLevel'
  | 'audioDeviceLevelValue'
  | 'audioDeviceListening'
  | 'audioDeviceOutputUnsupported'
  | 'audioDeviceLost'
>;

/** How often the meter's spoken value (`aria-valuenow`) is refreshed — the bar itself moves every frame. */
const ARIA_LEVEL_MS = 200;

/** Each frame the bar falls back this far towards silence, so it reads as a level, not a flicker. */
const LEVEL_DECAY = 0.86;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * `sv-audio-device-select` — choose a microphone (and, optionally, a speaker),
 * with the permission states said in words and a live input-level meter.
 *
 * It never opens the microphone on its own: rendering only reads the
 * permission and the device list. The browser's prompt appears when the person
 * presses **Allow microphone access** or **Test microphone**. Blocked access
 * gets guidance and a **Check again**; an `http:` page or a browser without
 * `mediaDevices` is told so. Devices plugged in or removed are picked up live,
 * and a chosen device that disappears falls back to the system default.
 *
 * ```html
 * <sv-audio-device-select [(deviceId)]="mic" [(outputDeviceId)]="speaker" [showOutput]="true" />
 * <sv-media-player kind="audio" [items]="clips" [sinkId]="speaker()" />
 * ```
 */
@Component({
  selector: 'sv-audio-device-select',
  standalone: true,
  imports: [SvIconComponent, SvSelectDropdownComponent],
  templateUrl: './audio-device-select.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class SvAudioDeviceSelectComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerAudioDeviceSelectIcons();

  private readonly registryText = injectSvLabels('display', SV_DISPLAY_LABELS);
  private readonly backend = inject(SV_AUDIO_DEVICES);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  // ── Selection ─────────────────────────────────────────────────────────────

  /** The chosen microphone's `deviceId` (two-way). `''` is the system default. @default '' */
  readonly deviceId = model<string>('');

  /** The chosen speaker's `deviceId` (two-way) — bind it to `sv-media-player`'s `sinkId`. `''` is the system default. @default '' */
  readonly outputDeviceId = model<string>('');

  /** Also offer a speaker list, where the browser can route sound (`setSinkId`). @default false */
  readonly showOutput = input<boolean>(false);

  /** Offer **Test microphone** and the input-level meter. @default true */
  readonly meter = input<boolean>(true);

  /** Disable both lists and every button. @default false */
  readonly disabled = input<boolean>(false);

  /** Size of the lists. @default 'md' */
  readonly size = input<SelectSize>('md');

  /** The group's accessible name. @default the `audioDevice` label */
  readonly ariaLabel = input<string | null>(null);

  /** BCP-47 locale for the numbered fallback names and the meter value. @default the kit's locale (`SV_LOCALE`) */
  readonly locale = input<string>(svLocale());

  /** Per-instance text, merged over the registry's `display` labels. @default {} */
  readonly labels = input<Partial<SvAudioDeviceSelectLabels>>({});

  // ── Events ────────────────────────────────────────────────────────────────

  /** A microphone was chosen — from the list, or as the fallback when the chosen one was unplugged. */
  readonly inputChange = output<SvAudioDeviceChange>();

  /** A speaker was chosen — from the list, or as the fallback when the chosen one was unplugged. */
  readonly outputChange = output<SvAudioDeviceChange>();

  /** Microphone access changed state (`prompt`, `denied`, `granted`, …) — including when it was first read. */
  readonly permissionChange = output<SvMicPermission>();

  /** The device list was read or changed (a device was plugged in or removed). */
  readonly devicesChange = output<readonly SvAudioDevice[]>();

  /** Opening the microphone failed — blocked, missing, or busy in another app. */
  readonly accessError = output<SvMicError>();

  /** The level test started (the microphone is open) or stopped (it is closed again). */
  readonly testChange = output<boolean>();

  // ── State ─────────────────────────────────────────────────────────────────

  /** @internal The labels in effect. */
  protected readonly text = computed<SvAudioDeviceSelectLabels>(() => ({ ...this.registryText, ...this.labels() }));

  protected readonly uid = svUniqueId('sv-audio-device-select');

  protected readonly permission = signal<SvMicPermission>('checking');
  protected readonly devices = signal<readonly SvAudioDevice[]>([]);
  protected readonly testing = signal(false);
  protected readonly opening = signal(false);
  protected readonly errorCode = signal<SvMicErrorCode | null>(null);
  /** @internal The meter's spoken value, 0–100, refreshed a few times a second. */
  protected readonly levelPct = signal(0);
  /** @internal Polite announcement: access granted, a device unplugged. */
  protected readonly announcement = signal('');

  protected readonly sinkSupported = this.isBrowser && this.backend.supported() && this.backend.sinkSupported();

  private readonly barRef = viewChild<ElementRef<HTMLElement>>('bar');

  private source: SvAudioLevelSource | null = null;
  private frame = 0;
  private level = 0;
  private lastAria = 0;
  /** Bumped on every open / close, so a slow `getUserMedia` that resolves late is closed, not kept. */
  private generation = 0;
  private destroyed = false;

  // ── Derived ───────────────────────────────────────────────────────────────

  protected readonly regionLabel = computed(() => this.ariaLabel() ?? this.text().audioDevice);

  protected readonly inputOptions = computed(() => this.optionsFor('audioinput'));
  protected readonly outputOptions = computed(() => this.optionsFor('audiooutput'));

  /** @internal The browser can list devices at all. */
  protected readonly available = computed(() => {
    const p = this.permission();
    return p !== 'unsupported' && p !== 'insecure';
  });

  protected readonly canOpen = computed(
    () => !this.disabled() && !this.opening() && (this.permission() === 'prompt' || this.permission() === 'granted'),
  );

  protected readonly errorMessage = computed(() => {
    const t = this.text();
    switch (this.errorCode()) {
      case 'not-found':
        return t.audioDeviceNotFound;
      case 'in-use':
        return t.audioDeviceInUse;
      case 'unsupported':
        return t.audioDeviceUnsupported;
      case 'unknown':
        return t.audioDeviceFailed;
      default:
        return '';
    }
  });

  protected readonly levelText = computed(() =>
    svFormatLabel(this.text().audioDeviceLevelValue, { pct: this.levelPct() }, this.locale()),
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.closeSource();
    });
    if (!this.isBrowser) return;
    // ★ Reading the permission and the list never prompts. The microphone is
    //   opened only from a button the person pressed.
    afterNextRender(() => void this.start());
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Ask for microphone access — this shows the browser's prompt. With `meter` on, the level test starts. */
  async requestAccess(): Promise<void> {
    await this.open(this.meter());
  }

  /** Open the chosen microphone and show its level. */
  async startTest(): Promise<void> {
    await this.open(true);
  }

  /** Close the microphone and stop the meter. */
  stopTest(): void {
    const was = this.testing() || this.source !== null;
    this.closeSource();
    if (was) this.testChange.emit(false);
  }

  /** Read the permission and the device list again (what **Check again** does). */
  async refresh(): Promise<void> {
    if (!this.isBrowser || !this.backend.supported()) return;
    await this.readPermission();
    await this.readDevices();
  }

  // ── Template handlers ─────────────────────────────────────────────────────

  protected onInputSelect(value: string | string[]): void {
    if (typeof value !== 'string' || value === this.deviceId()) return;
    this.deviceId.set(value);
    this.inputChange.emit({ kind: 'audioinput', deviceId: value, label: this.labelOf('audioinput', value), reason: 'user' });
    this.errorCode.set(null);
    if (this.testing()) void this.open(true);
  }

  protected onOutputSelect(value: string | string[]): void {
    if (typeof value !== 'string' || value === this.outputDeviceId()) return;
    this.outputDeviceId.set(value);
    this.outputChange.emit({ kind: 'audiooutput', deviceId: value, label: this.labelOf('audiooutput', value), reason: 'user' });
  }

  protected toggleTest(): void {
    if (this.testing()) this.stopTest();
    else void this.startTest();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private async start(): Promise<void> {
    if (!this.backend.supported()) {
      this.setPermission(this.backend.secure() ? 'unsupported' : 'insecure');
      return;
    }
    if (this.destroyed) return;
    const stopDevices = this.backend.onDeviceChange(() => void this.readDevices());
    const stopPermission = this.backend.onPermissionChange(() => void this.refresh());
    this.destroyRef.onDestroy(() => {
      stopDevices();
      stopPermission();
    });
    await this.refresh();
  }

  private async readPermission(): Promise<void> {
    const state = await this.backend.permission();
    if (this.destroyed) return;
    if (state !== null) {
      this.setPermission(state);
      if (state === 'denied') this.closeSource();
    }
  }

  private async readDevices(): Promise<void> {
    let list: readonly SvAudioDevice[];
    try {
      list = await this.backend.enumerate();
    } catch {
      list = [];
    }
    if (this.destroyed) return;
    this.devices.set(list);
    this.devicesChange.emit(list);
    // No Permissions API: names are hidden until access is granted, so their
    // presence is the answer.
    if (this.permission() === 'checking' || (this.permission() === 'prompt' && list.some((d) => d.label))) {
      const named = svAudioDevicesOf(list, 'audioinput').some((d) => d.label !== '');
      if (this.permission() === 'checking') this.setPermission(named ? 'granted' : 'prompt');
      else if (named) this.setPermission('granted');
    }
    this.fallBackIfGone('audioinput');
    if (this.showOutput()) this.fallBackIfGone('audiooutput');
  }

  /** The chosen device was unplugged: the system default takes over, and the person is told. */
  private fallBackIfGone(kind: SvAudioDeviceKind): void {
    const chosen = kind === 'audioinput' ? this.deviceId() : this.outputDeviceId();
    if (chosen === '') return;
    const present = svAudioDevicesOf(this.devices(), kind).some((d) => d.deviceId === chosen);
    // Before permission the ids are hidden, so absence proves nothing.
    if (present || this.permission() !== 'granted') return;
    const target = kind === 'audioinput' ? this.deviceId : this.outputDeviceId;
    target.set('');
    const fallback = this.text().audioDeviceDefault;
    const change: SvAudioDeviceChange = { kind, deviceId: '', label: fallback, reason: 'fallback' };
    if (kind === 'audioinput') {
      this.inputChange.emit(change);
      if (this.testing()) void this.open(true);
    } else {
      this.outputChange.emit(change);
    }
    this.announce(svFormatLabel(this.text().audioDeviceLost, { fallback }, this.locale()));
  }

  private async open(withMeter: boolean): Promise<void> {
    if (!this.isBrowser || this.disabled() || !this.backend.supported()) return;
    this.closeSource();
    const run = ++this.generation;
    this.opening.set(true);
    this.errorCode.set(null);
    try {
      const source = await this.backend.openLevel(this.deviceId() || null);
      if (run !== this.generation || this.destroyed) {
        source.close();
        return;
      }
      const wasGranted = this.permission() === 'granted';
      this.setPermission('granted');
      if (!wasGranted) this.announce(this.text().audioDeviceGranted);
      if (withMeter) {
        this.source = source;
        this.testing.set(true);
        this.testChange.emit(true);
        this.loop();
      } else {
        source.close();
      }
      // Names (and real ids) appear only now.
      await this.readDevices();
    } catch (err) {
      if (run !== this.generation || this.destroyed) return;
      const code = svMicErrorCode(err);
      this.errorCode.set(code === 'denied' ? null : code);
      if (code === 'denied') this.setPermission('denied');
      this.accessError.emit({ code, detail: err instanceof Error ? err.message : '' });
    } finally {
      if (run === this.generation) this.opening.set(false);
    }
  }

  /**
   * ★ The bar is written straight to the DOM as a `transform` — one compositor
   *   update a frame and no change detection. Only the spoken value goes
   *   through a signal, a few times a second.
   */
  private loop(): void {
    const view = this.document.defaultView;
    if (!view || typeof view.requestAnimationFrame !== 'function') return;
    const tick = (now: number): void => {
      const source = this.source;
      if (!source) return;
      this.level = Math.max(source.read(), this.level * LEVEL_DECAY);
      const bar = this.barRef()?.nativeElement;
      if (bar) bar.style.transform = `scaleX(${this.level.toFixed(3)})`;
      if (now - this.lastAria >= ARIA_LEVEL_MS) {
        this.lastAria = now;
        this.levelPct.set(Math.round(this.level * 100));
      }
      this.frame = view.requestAnimationFrame(tick);
    };
    this.frame = view.requestAnimationFrame(tick);
  }

  /** Stop the stream, close the audio context, cancel the frame. Safe to call twice. */
  private closeSource(): void {
    this.generation++;
    if (this.frame) this.document.defaultView?.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.source?.close();
    this.source = null;
    this.level = 0;
    if (!this.destroyed) {
      this.testing.set(false);
      this.opening.set(false);
      this.levelPct.set(0);
      const bar = this.barRef()?.nativeElement;
      if (bar) bar.style.transform = 'scaleX(0)';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private setPermission(state: SvMicPermission): void {
    if (this.permission() === state) return;
    this.permission.set(state);
    this.permissionChange.emit(state);
  }

  private optionsFor(kind: SvAudioDeviceKind): SelectOption[] {
    const t = this.text();
    const unnamed = kind === 'audioinput' ? t.audioDeviceUnnamedInput : t.audioDeviceUnnamedOutput;
    // `default` is Chrome's alias for the system default — the '' entry says the same thing.
    const list = svAudioDevicesOf(this.devices(), kind).filter((d) => d.deviceId !== 'default');
    return [
      { value: '', label: t.audioDeviceDefault },
      ...list.map((d, i) => ({
        value: d.deviceId,
        label: d.label.trim() || svFormatLabel(unnamed, { index: i + 1 }, this.locale()),
      })),
    ];
  }

  private labelOf(kind: SvAudioDeviceKind, id: string): string {
    const options = kind === 'audioinput' ? this.inputOptions() : this.outputOptions();
    return options.find((o) => o.value === id)?.label ?? this.text().audioDeviceDefault;
  }

  private announce(message: string): void {
    this.announcement.set('');
    queueMicrotask(() => {
      if (!this.destroyed) this.announcement.set(message);
    });
  }
}
