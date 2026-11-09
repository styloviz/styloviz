import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { describe, expect, it, vi } from 'vitest';
import { SvMediaPlayerComponent, type SvMediaSinkError } from './media-player.component';
import type { SvMediaItem } from './media-player.logic';

/**
 * FL-E7 — the voice-note shape of `sv-media-player`: `layout="compact"` draws
 * an audio clip as one row (play, seek, time, speed), and `sinkId` routes the
 * sound to an output device where `setSinkId` exists.
 */

const NOTE: readonly SvMediaItem[] = [{ id: 'vm1', title: 'Voice note from Jordan', src: '/media/note.webm', duration: 42 }];

async function mount(inputs: Record<string, unknown>, on: Record<string, (e: never) => void> = {}) {
  TestBed.resetTestingModule();
  return render(SvMediaPlayerComponent, { inputs: { items: NOTE, kind: 'audio', locale: 'en-US', ...inputs }, on });
}

describe('sv-media-player — compact audio (voice note)', () => {
  it('draws one row: play, seek, the clip length, speed — no toolbar, volume, artwork or playlist', async () => {
    const { container } = await mount({ layout: 'compact', items: [...NOTE, { id: 'vm2', title: 'Second', src: '/media/2.webm' }] });
    expect(container.querySelector('[data-sv-media-compact="play"]')).not.toBeNull();
    expect(container.querySelector('[data-sv-media-compact="speed"]')?.textContent?.trim()).toBe('1×');
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(1);
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
    expect(container.querySelector('ol')).toBeNull();
    expect(container.textContent).toContain('Voice note from Jordan');
  });

  it('plays from the row button and toggles its name', async () => {
    const { container, fixture } = await mount({ layout: 'compact' });
    const audio = container.querySelector('audio') as HTMLAudioElement;
    audio.play = () => {
      audio.dispatchEvent(new Event('play'));
      return Promise.resolve();
    };
    const play = container.querySelector('[data-sv-media-compact="play"]') as HTMLButtonElement;
    expect(play.getAttribute('aria-label')).toBe('Play');
    play.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(play.getAttribute('aria-label')).toBe('Pause');
  });

  it('keeps the full player for video, whatever the layout', async () => {
    const { container } = await mount({ layout: 'compact', kind: 'video' });
    expect(container.querySelector('[role="toolbar"]')).not.toBeNull();
    expect(container.querySelector('[data-sv-media-compact]')).toBeNull();
  });

  it('routes sound to sinkId where setSinkId exists, and reports a refusal', async () => {
    const setSinkId = vi.fn().mockRejectedValue(new Error('NotFoundError'));
    const proto = HTMLMediaElement.prototype as unknown as { setSinkId?: unknown };
    proto.setSinkId = setSinkId;
    try {
      const sinkError = vi.fn<(e: SvMediaSinkError) => void>();
      const { fixture } = await mount({ sinkId: 'spk-1' }, { sinkError });
      await fixture.whenStable();
      expect(setSinkId).toHaveBeenCalledWith('spk-1');
      expect(sinkError).toHaveBeenCalledWith({ sinkId: 'spk-1', detail: 'NotFoundError' });
    } finally {
      delete proto.setSinkId;
    }
  });

  it('leaves the device alone where setSinkId does not exist', async () => {
    const { fixture } = await mount({ sinkId: 'spk-1' });
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
