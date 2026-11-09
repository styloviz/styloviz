import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { describe, expect, it, vi } from 'vitest';
import { SvAudioDeviceSelectComponent } from './audio-device-select.component';
import {
  SV_AUDIO_DEVICES,
  svAudioDevicesOf,
  svAudioLevel,
  svBrowserAudioDevices,
  svMicErrorCode,
  type SvAudioDevice,
  type SvAudioDeviceBackend,
  type SvAudioDeviceChange,
  type SvMicError,
  type SvMicPermission,
} from './audio-device-select.logic';

/**
 * `sv-audio-device-select` — jsdom has no microphone, so every test hands the
 * component a backend double through `SV_AUDIO_DEVICES`. What is pinned: it
 * never opens the microphone by itself, each permission state says itself in
 * words, a device that disappears falls back to the default, and closing (or
 * destroying) stops the stream.
 */

const MIC_A: SvAudioDevice = { deviceId: 'mic-a', kind: 'audioinput', label: 'Studio USB mic', groupId: 'g1' };
const MIC_B: SvAudioDevice = { deviceId: 'mic-b', kind: 'audioinput', label: 'Headset', groupId: 'g2' };
const SPK: SvAudioDevice = { deviceId: 'spk-1', kind: 'audiooutput', label: 'Desk speakers', groupId: 'g3' };

interface Fake extends SvAudioDeviceBackend {
  devices: SvAudioDevice[];
  state: 'prompt' | 'denied' | 'granted' | null;
  readonly openLevel: ReturnType<typeof vi.fn> & SvAudioDeviceBackend['openLevel'];
  readonly close: ReturnType<typeof vi.fn>;
  fireDeviceChange(): void;
}

function fake(overrides: Partial<Fake> = {}): Fake {
  let deviceListener: (() => void) | null = null;
  const close = vi.fn();
  const backend: Fake = {
    devices: [MIC_A, MIC_B, SPK],
    state: 'granted',
    supported: () => true,
    secure: () => true,
    enumerate: () => Promise.resolve(backend.devices),
    permission: () => Promise.resolve(backend.state),
    onPermissionChange: () => () => undefined,
    onDeviceChange: (listener) => {
      deviceListener = listener;
      return () => (deviceListener = null);
    },
    openLevel: vi.fn(() => Promise.resolve({ read: () => 0.5, close })) as Fake['openLevel'],
    sinkSupported: () => true,
    close,
    fireDeviceChange: () => deviceListener?.(),
    ...overrides,
  };
  return backend;
}

const settle = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  }
  await fixture.whenStable();
};

async function mount(backend: SvAudioDeviceBackend, inputs: Record<string, unknown> = {}, on: Record<string, (e: never) => void> = {}) {
  TestBed.resetTestingModule();
  const result = await render(SvAudioDeviceSelectComponent, {
    inputs: { locale: 'en-US', ...inputs },
    on,
    providers: [{ provide: SV_AUDIO_DEVICES, useValue: backend }],
  });
  await settle(result.fixture);
  return result;
}

// ─── Logic ────────────────────────────────────────────────────────────────────

describe('audio device logic', () => {
  it('maps the browser errors to codes a host can branch on', () => {
    expect(svMicErrorCode(new DOMException('x', 'NotAllowedError'))).toBe('denied');
    expect(svMicErrorCode(new DOMException('x', 'NotFoundError'))).toBe('not-found');
    expect(svMicErrorCode(new DOMException('x', 'NotReadableError'))).toBe('in-use');
    expect(svMicErrorCode(new TypeError('x'))).toBe('unsupported');
    expect(svMicErrorCode('weird')).toBe('unknown');
  });

  it('reads silence as 0, full scale as 1, and speech in between', () => {
    expect(svAudioLevel([])).toBe(0);
    expect(svAudioLevel(new Float32Array(256))).toBe(0);
    expect(svAudioLevel(new Float32Array(256).fill(1))).toBe(1);
    const speech = svAudioLevel(new Float32Array(256).fill(0.05));
    expect(speech).toBeGreaterThan(0.3);
    expect(speech).toBeLessThan(0.9);
  });

  it('keeps one entry per id and drops the hidden ones', () => {
    const hidden: SvAudioDevice = { deviceId: '', kind: 'audioinput', label: '', groupId: '' };
    expect(svAudioDevicesOf([MIC_A, MIC_A, hidden, SPK], 'audioinput')).toEqual([MIC_A]);
  });

  it('is safe with no document (the server)', async () => {
    const backend = svBrowserAudioDevices(null);
    expect(backend.supported()).toBe(false);
    expect(backend.sinkSupported()).toBe(false);
    expect(await backend.enumerate()).toEqual([]);
    expect(await backend.permission()).toBeNull();
    backend.onDeviceChange(() => undefined)();
  });
});

// ─── Component ───────────────────────────────────────────────────────────────

describe('SvAudioDeviceSelectComponent', () => {
  it('never opens the microphone on render — not even with access already granted', async () => {
    const backend = fake();
    const { container } = await mount(backend);
    expect(backend.openLevel).not.toHaveBeenCalled();
    expect(container.querySelector('[data-permission="granted"]')).not.toBeNull();
    expect(container.querySelector('[data-sv-audio-device="test"]')?.textContent).toContain('Test microphone');
  });

  it('asks only when Allow is pressed, then lists the named devices', async () => {
    const backend = fake({ state: 'prompt' });
    backend.devices = [{ deviceId: '', kind: 'audioinput', label: '', groupId: '' }];
    const permissionChange = vi.fn<(p: SvMicPermission) => void>();
    const { container, fixture } = await mount(backend, {}, { permissionChange });
    expect(container.textContent).toContain('Allow microphone access');
    expect(backend.openLevel).not.toHaveBeenCalled();

    backend.devices = [MIC_A, MIC_B];
    (container.querySelector('[data-sv-audio-device="allow"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(backend.openLevel).toHaveBeenCalledWith(null);
    expect(permissionChange).toHaveBeenLastCalledWith('granted');
    expect(container.querySelector('[role="meter"]')).not.toBeNull();
    expect(container.querySelector('[data-sv-audio-device="test"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('infers the permission from device names where there is no Permissions API', async () => {
    const { container } = await mount(fake({ state: null }));
    expect(container.querySelector('[data-permission="granted"]')).not.toBeNull();
  });

  it('explains a blocked microphone and offers Check again', async () => {
    const backend = fake({ state: 'denied' });
    const { container, fixture } = await mount(backend);
    expect(container.textContent).toContain('Microphone access is blocked');
    backend.state = 'granted';
    (container.querySelector('[data-sv-audio-device="check-again"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(container.querySelector('[data-permission="granted"]')).not.toBeNull();
  });

  it('turns a NotAllowedError into the denied state, and NotFound into words', async () => {
    const accessError = vi.fn<(e: SvMicError) => void>();
    const backend = fake({ state: 'prompt' });
    // Named devices would prove access was granted — before it, the labels are hidden.
    backend.devices = [{ deviceId: '', kind: 'audioinput', label: '', groupId: '' }];
    backend.openLevel.mockRejectedValueOnce(new DOMException('no', 'NotFoundError'));
    const { container, fixture } = await mount(backend, {}, { accessError });
    (container.querySelector('[data-sv-audio-device="allow"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('No microphone was found');
    expect(accessError).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'not-found' }));

    backend.openLevel.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    (container.querySelector('[data-sv-audio-device="allow"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(container.querySelector('[data-permission="denied"]')).not.toBeNull();
  });

  it('says so on an insecure page, and where devices cannot be listed', async () => {
    const insecure = await mount(fake({ supported: () => false, secure: () => false }));
    expect(insecure.container.textContent).toContain('secure (https)');
    const unsupported = await mount(fake({ supported: () => false }));
    expect(unsupported.container.textContent).toContain('cannot list or open audio devices');
  });

  it('falls back to the default when the chosen microphone is unplugged', async () => {
    const backend = fake();
    const inputChange = vi.fn<(e: SvAudioDeviceChange) => void>();
    const { fixture } = await mount(backend, { deviceId: 'mic-b' }, { inputChange });
    backend.devices = [MIC_A, SPK];
    backend.fireDeviceChange();
    await settle(fixture);
    expect(fixture.componentInstance.deviceId()).toBe('');
    expect(inputChange).toHaveBeenLastCalledWith(expect.objectContaining({ deviceId: '', reason: 'fallback' }));
  });

  it('stops the stream when the test stops and when it is destroyed', async () => {
    const backend = fake();
    const { fixture } = await mount(backend);
    await fixture.componentInstance.startTest();
    await settle(fixture);
    fixture.componentInstance.stopTest();
    expect(backend.close).toHaveBeenCalledTimes(1);
    await fixture.componentInstance.startTest();
    fixture.destroy();
    expect(backend.close).toHaveBeenCalledTimes(2);
  });

  it('offers a speaker list only where the browser can route sound', async () => {
    const routed = await mount(fake(), { showOutput: true });
    expect(routed.container.textContent).toContain('Speaker');
    const fixed = await mount(fake({ sinkSupported: () => false }), { showOutput: true });
    expect(fixed.container.textContent).toContain("system’s default speaker");
  });
});
