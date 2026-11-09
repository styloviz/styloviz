import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject } from '@angular/core';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Which way sound goes through a device. */
export type SvAudioDeviceKind = 'audioinput' | 'audiooutput';

/** An audio device, as `enumerateDevices()` reports it. */
export interface SvAudioDevice {
  readonly deviceId: string;
  readonly kind: SvAudioDeviceKind;
  /** Empty until the page has been allowed to use a microphone — the browser hides names before that. */
  readonly label: string;
  readonly groupId: string;
}

/**
 * Where microphone access stands.
 * `checking` — not known yet · `unsupported` — no `mediaDevices` · `insecure` —
 * not a secure context (http) · `prompt` — the browser will ask · `denied` —
 * the person or a policy said no · `granted` — allowed.
 */
export type SvMicPermission = 'checking' | 'unsupported' | 'insecure' | 'prompt' | 'denied' | 'granted';

/** Why opening the microphone failed, in words a host can branch on. */
export type SvMicErrorCode = 'denied' | 'not-found' | 'in-use' | 'unsupported' | 'unknown';

/** Opening the microphone failed. */
export interface SvMicError {
  readonly code: SvMicErrorCode;
  /** The browser's message, when it gave one. */
  readonly detail: string;
}

/** A device was chosen — by the person, or because the chosen one went away. */
export interface SvAudioDeviceChange {
  readonly kind: SvAudioDeviceKind;
  readonly deviceId: string;
  /** The device's name, or the fallback name when the browser hides it. */
  readonly label: string;
  /** `user` — picked from the list · `fallback` — the chosen device was unplugged, so the default took over. */
  readonly reason: 'user' | 'fallback';
}

/** A live input level — `read()` is 0 (silence) to 1 (full scale). `close()` stops the stream and the audio context. */
export interface SvAudioLevelSource {
  read(): number;
  close(): void;
}

/**
 * Everything the selector needs from the browser, behind one seam — so the
 * component is SSR-safe by construction, and a test or a demo can stand in
 * for a microphone. `svBrowserAudioDevices()` is the real one.
 */
export interface SvAudioDeviceBackend {
  /** `navigator.mediaDevices` exists (and the page is not on the server). */
  supported(): boolean;
  /** The page is a secure context — the only place browsers expose microphones. */
  secure(): boolean;
  /** The audio devices, in the browser's order. Names are empty before permission. */
  enumerate(): Promise<readonly SvAudioDevice[]>;
  /**
   * The microphone permission WITHOUT asking — Permissions API where there is
   * one, null where there is not (the selector then infers it from names).
   */
  permission(): Promise<'prompt' | 'denied' | 'granted' | null>;
  /** Call `listener` when the permission changes; returns the unsubscribe. */
  onPermissionChange(listener: () => void): () => void;
  /** Call `listener` when a device is plugged in or removed; returns the unsubscribe. */
  onDeviceChange(listener: () => void): () => void;
  /**
   * Open the microphone (this is the call that shows the browser's prompt)
   * and measure it. Rejects with the browser's `DOMException`.
   */
  openLevel(deviceId: string | null): Promise<SvAudioLevelSource>;
  /** `HTMLMediaElement.setSinkId` exists, so an output device can be chosen. */
  sinkSupported(): boolean;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** The browser's `DOMException` name, as a code. */
export function svMicErrorCode(error: unknown): SvMicErrorCode {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
    case 'DevicesNotFoundError':
      return 'not-found';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'in-use';
    case 'TypeError':
    case 'NotSupportedError':
      return 'unsupported';
    default:
      return 'unknown';
  }
}

/**
 * Root-mean-square of a time-domain buffer (−1…1 samples), mapped onto 0…1 so
 * ordinary speech moves the meter: −60 dBFS reads 0, 0 dBFS reads 1.
 */
export function svAudioLevel(samples: Iterable<number> & { readonly length: number }): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  const rms = Math.sqrt(sum / samples.length);
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db + 60) / 60));
}

/** Audio devices of one kind, one entry per id (some browsers repeat `default`). */
export function svAudioDevicesOf(devices: readonly SvAudioDevice[], kind: SvAudioDeviceKind): SvAudioDevice[] {
  const seen = new Set<string>();
  return devices.filter((d) => {
    if (d.kind !== kind || d.deviceId === '' || seen.has(d.deviceId)) return false;
    seen.add(d.deviceId);
    return true;
  });
}

// ─── The browser backend ──────────────────────────────────────────────────────

interface AnalyserLike {
  fftSize: number;
  getFloatTimeDomainData(array: Float32Array): void;
}

/** The real backend: `navigator.mediaDevices`, the Permissions API and Web Audio. Safe to create on the server. */
export function svBrowserAudioDevices(doc: Document | null): SvAudioDeviceBackend {
  const view = doc?.defaultView ?? null;
  const nav = view?.navigator ?? null;
  const media = (): MediaDevices | null => nav?.mediaDevices ?? null;

  return {
    supported: () => !!media() && typeof media()?.enumerateDevices === 'function',
    secure: () => view?.isSecureContext !== false,

    enumerate: async () => {
      const list = (await media()?.enumerateDevices()) ?? [];
      return list
        .filter((d) => d.kind === 'audioinput' || d.kind === 'audiooutput')
        .map((d) => ({ deviceId: d.deviceId, kind: d.kind as SvAudioDeviceKind, label: d.label, groupId: d.groupId }));
    },

    permission: async () => {
      try {
        const status = await nav?.permissions?.query({ name: 'microphone' as PermissionName });
        return status ? status.state : null;
      } catch {
        return null; // Firefox before 131 throws on 'microphone'.
      }
    },

    onPermissionChange: (listener) => {
      let status: PermissionStatus | null = null;
      let gone = false;
      void nav?.permissions
        ?.query({ name: 'microphone' as PermissionName })
        .then((s) => {
          if (gone) return;
          status = s;
          s.addEventListener('change', listener);
        })
        .catch(() => undefined);
      return () => {
        gone = true;
        status?.removeEventListener('change', listener);
      };
    },

    onDeviceChange: (listener) => {
      const devices = media();
      if (!devices || typeof devices.addEventListener !== 'function') return () => undefined;
      devices.addEventListener('devicechange', listener);
      return () => devices.removeEventListener('devicechange', listener);
    },

    openLevel: async (deviceId) => {
      const devices = media();
      // sv-i18n-ignore: a DOMException message for developers — the component shows its own label
      if (!devices?.getUserMedia) throw new DOMException('getUserMedia is unavailable', 'NotSupportedError');
      const stream = await devices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      const stop = (): void => stream.getTracks().forEach((t) => t.stop());
      const Ctor = view?.AudioContext ?? null;
      if (!Ctor) {
        // Permission is what was asked for; without Web Audio there is just no meter.
        return { read: () => 0, close: stop };
      }
      let context: AudioContext | null = null;
      try {
        context = new Ctor();
        const analyser = context.createAnalyser() as AnalyserNode & AnalyserLike;
        analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);
        const ctx = context;
        return {
          read: () => {
            analyser.getFloatTimeDomainData(buffer);
            return svAudioLevel(buffer);
          },
          close: () => {
            stop();
            void ctx.close().catch(() => undefined);
          },
        };
      } catch (err) {
        stop();
        void context?.close().catch(() => undefined);
        throw err;
      }
    },

    sinkSupported: () => !!view && 'HTMLMediaElement' in view && 'setSinkId' in view.HTMLMediaElement.prototype,
  };
}

/**
 * The backend `sv-audio-device-select` uses. Provide your own to stand in for
 * the browser — a test double, a demo, or a native shell's device API.
 */
export const SV_AUDIO_DEVICES = new InjectionToken<SvAudioDeviceBackend>('SV_AUDIO_DEVICES', {
  providedIn: 'root',
  factory: () => svBrowserAudioDevices(inject(DOCUMENT, { optional: true })),
});
