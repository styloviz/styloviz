/**
 * Demo media for `sv-media-player`, made in the browser — no file, no network.
 *
 * ★★★ WHY GENERATED, NOT A FILE IN `public/`. A kit that promises "no external
 *     calls" cannot point its demo at a CDN clip, and a committed clip has one
 *     length. The LMS template's lessons run 6 to 90 minutes and its coverage
 *     arithmetic divides by the lesson's length, so the clip has to be exactly
 *     that long. These helpers write a real WebM (VP9) of any length from one
 *     embedded 480×270 keyframe — a still "slide" — held on screen by one-byte
 *     `show_existing_frame` frames, plus a keyframe every thirty seconds so a seek
 *     lands near where it was asked for. A 90-minute clip is about 300 kB in
 *     memory; nothing is fetched.
 *
 * ★★ Demo-only, like `DEMO_IMAGES`: nothing in the player imports this file,
 *    so it tree-shakes away unless a demo calls it. Create object URLs in the
 *    browser only (`afterNextRender` or `isPlatformBrowser`), and revoke them.
 *
 * ★ VP9 in WebM plays in Chromium and Firefox, and in Safari 17+. Where it does
 *   not, the player shows its own "could not be played" state — which is what a
 *   real unsupported file would do.
 */

// ─── Scenes ───────────────────────────────────────────────────────────────────

/** The stills a demo clip can show. */
export type SvDemoMediaScene = 'indigo' | 'teal' | 'amber';

/** One intra-coded VP9 frame per scene (480×270), produced offline by libvpx. */
const SCENE_KEYFRAMES: Readonly<Record<SvDemoMediaScene, string>> = {
  indigo: 'gkmDQgAd8BDWHDgkHBjiEAGwfp3ZvR/TfL8Liq7YXSAuq7xTtdUOH7JQvvjFyo9L2zWPVrhn7yP14Q5Oi5h918VxzEAXQYAAAAABmRhfuaoCnelM//9c860TlXwNN6LqVOkWUO7tZN5HkCoWlKjwCzCD9hD3+qBux5arbvBQnAoSlcisXYR9tSfB0Yqx9iZtEg8kY/pdFijHR/dZl1deCwZjaXVsfrVfff6dJMbkaw2bSqEYmRzAsFk55AHmurMH2LJAm4Hh3s8CI1XoBznPZZcNpzaCW+0IxsqLCM5qDDm2UnKFQT6ANgR6J8qaCOC0TatKIsGQgTb9sQOr3TuWfxyyuwy7sBJiATgZBqBKUHbuk91hqoad/biPVz+3YEM1/9FRyRAjoiyUuJHFDcd0Ow7NZ92ARDKUSAdQjK1kop5kmFPOSHnynV199Xmo8oBYqrqg9+mkYVnJnWGpAxCA8Hxku7AyiSYBSuYb5PjfVdFJOAqeFRbUKpNUSjfQmeKqdlgxCyZUDw/GanRLXbiCED7aw4CpGwfQ/2x4+nNS1tl4XNI2x7tSFUE0KcfykonDfJcgBMsyxOvuAKPzb6kKqmz/64ET+G+GMViI0Rda+NZoTMgsU5p4PnZgNZg8Wo0N74TmRKB47//+gyv//04fhpGS4NGO/a7sx53Ztf5g+i4eE+DCKEnc11IxOue4CCbETUu2aGsmVOWAWReAnY9Z7tZwrQ5i1vme38Y4DPiYy2Rtkl/Pp8W5SXxG8/RSYcnz0VpVeGuc9JIvzLJonrGl6+00egYzUENxYq/7mAK6JUPsCwNOTRkXVfj6TGXz0SlfWzDa+cgSrVUiIrQdqpeQ4Sbl0mMyCkblww66TrlKVIyF+1owKDKtlcbhuH51PibKiX7kXM3ONgGTC7tud1odfGtxeYdg3OiitqyC5z0IL5Svkq4PJklRik5NvowWP6R78R7psjPu2TFTtz+lJt6MJaiYH2j5AsTwtxdE+GXwVEMllB1drWf0gZcYhuj4WEH/Xa/GTut0Y/3X7SDX7rfhj5kPp8CrPHnFvn3XwsH84beJCSATEFyFxM0jVKnZIBQcfWMJ3qEL6nhPjBLL8oWGBDSXnOA6sVkPPIYLu2gVP8dDqQp92CntIuKqK/eauhU2ryqEBWBj9gkiRaz7UB7tLHtMu/ecBQj+qfpAAYJM2v5/rsApttEImeGFiyk+Yh4nGe1m3L2ru4weWXDsHUfBvFtVMlQdMiPVSy1Jz9Nb3bJzOiU31PGuUKKN+ySsip88ykaZGZrSoT4Toyooklea0JVhXLGPCy+CSS7e0R4F4O3TIXhb2PqoHsJ9If+CkWUoBZHQA2yGN3xx42hSDLHuAw7v3ET9b0aCMFjTkFQ2I5E7bGpfY/zgXjhzhqnt6k+GKX0yBszz+eYleWlsd3NjcjvufXHmFDF4IPGLHfSW8mpKoN+Bwm5fEx/JHguozHA3kB154MzgGSgeFNV3vA6FnkQTr623OrZ8thz7u2F9wRGva/5HQi/7i0a2V6oFfK9viHxaIQjb9qnObj92FC3V9TuwaaD+Ys6V9USks3+2/MpGvjzmUYV4hygsEGCLxgA=',
  teal: 'gkmDQgAd8BDWHjgkHBjiEAHofpnZvbfz+k+PBJ9kVn/BhSXXini6oZZCqfwm+kXKv1fb9aOKjxD7Pbv1dQg/heB3P8/1/LfX3bS2X/4AAAAAAbAYFlVDxyDPtff85n/OJiCZVHXVaL2ej8kDje+xqZ/7gskiaT496pIcZyYe0xlIWje4vMrrWROkiLpNzHKSkVJYGCuVTymTmbwK52Xc23nyTpUPVcO//SmSyZ7g8PMoATtFKQAAGZ4yh1DiDrWNWIe99bf4RSTTbWnYF7lqK0N1A7+RlriOkSuxqJaloIOIFeCTthSDYUMKAVIKDn3AePA0VshborZZuHQ3RGiyFB6W8FFQaD0MbTsMmfxTVHzoUTJVQzaNualLLdBQfXPAe7z6H2HmHFZqWSD20x837pNkpTtJg9YCpEagxeF9E5Aq/9JQBf4iwj9Ps9THbT1WqiQ1uw0HYF7hTgYj9gQFlsUyRShPi2FTiInroRbRRs0odBPgHBFgffpM8Hy6t/c0N8qjjfubFRGV4YxKlPWYGWQkqfMccz95LWL05Lu8E76Ny/DVEE1jjQ3tG9aDglAjqHg7BII+RSbSbOeeJzt5qcAK5stesxPaL2c9FP630O7663u9cz3zqWPLRqbqq43hcP7KwYKC8A5NUaUvVUp6xf9sfAXmmr+jsXycSdpKB0OXiwB8ixkKEU5w/vmrGP7frNt9u4D6jSVx+ru2seRa/ikFHxKPF+pjR+yn2aeSdXj0L2p19mfYzv/rIUSIGH1BYyGKvFEmseJ8RAqVNwNwNWExougHjJlSuNt2ddvosBrHjVNnq+WndI+t7pVLdKlqvsyIR32LWP76XDzqSL5q7p5XYeHyyDc08Y1Ij6zvhjBi25WgU8crd1Uy6UxXlAHcNgtLMFKbW3JMeZ1rlEr62HpoiJBYvlaxQDVXJM+zVv72aVwImDkz7yvkHHECt/dw50FATkmnyUncL1zGu6MtnARjAeXq1GLTN4a3CJYN2aiiBS3sL5C0PO4nIIzhNKDj9jj4zShapT01QReDZVyySL77STUxExootwwpG9YkbRbc4bUamPwfCJ/hNHCLc+qAqKCMHjXFZzAUbQuUEvwZwTLPXcTza21nnT+MU/LtKook5bg8KtAA3YJOAIjrOHbzF3aLs/6/3Yzf4joExKnGxdPUBSRSb+WdJNmtEly5QDt7touMxgQGv5n15dZxC2D7brKDvbM0yXrXJhI2uUAkBklSpICbJpddQTJJBi2oLAMiXyjCYr3TU6UL7I/laN+rGCOqMhTBhLks5XhTQixl0HfpWulCN71BW45cL1T1tNYGm/MI3PrB9+L9H7xv2KeNVWcC37FCjdjJk6da1oqsFXpyt3JFXw75ZBJbqR0oUDkZ07jRyyAjpvMPPByXgeAWjLux+ozKUhdF3/4HqdJqCRjgKZy2sY7jOBPIhtALCEmY1u05hEAtljnlrMBIuTW9RGEJywWSEZtGJst2u2I4e4SHByzpYevNgqKDkeeFxBnMO2VEV3TNLL8ZA5VAlKjcWgV+7X2xAI/tJmg7z9BfpvyBAtgNG7QcgUTz+z2rcic1W+4zbM0aoVNe91OoztSbqYlFq20c1c2rA59pmekVn5/MxLESD5KN2bIexOB2/IUBLqPUicVaZlKrUqtP+B9Xn2Cyr9fdcVV+Xp8mldzj35xDIUqVErsy2Ie9jke0z7QSXLIkIe18md9BrMCWBtEPKmjdKMWcY0kwhpByW0XgCpvye997jB4JV66g/Vg32Q1dYiA=',
  amber: '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',
};

const WIDTH = 480;
const HEIGHT = 270;

/**
 * VP9 `show_existing_frame`: frame marker `10`, profile 0, then the flag and
 * reference slot 0. One byte that says "show the last keyframe again".
 */
const SHOW_EXISTING_FRAME = 0x88;

// ─── EBML / WebM writer ───────────────────────────────────────────────────────

type Bytes = Uint8Array<ArrayBuffer>;

function concat(parts: readonly Bytes[]): Bytes {
  let length = 0;
  for (const p of parts) length += p.length;
  const out = new Uint8Array(length);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** An element ID's own bytes (IDs carry their length marker already). */
function idBytes(id: number): Bytes {
  const out: number[] = [];
  for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v % 256);
  return Uint8Array.from(out);
}

/** An EBML size as the shortest variable-length integer that holds it. */
function sizeBytes(size: number): Bytes {
  for (let length = 1; length <= 8; length++) {
    if (size < 2 ** (7 * length) - 1) {
      const out = new Uint8Array(length);
      let v = size;
      for (let i = length - 1; i >= 0; i--) {
        out[i] = v % 256;
        v = Math.floor(v / 256);
      }
      out[0] |= 1 << (8 - length);
      return out;
    }
  }
  throw new RangeError('EBML element too large');
}

function uintBytes(value: number, width = 0): Bytes {
  const out: number[] = [];
  for (let v = value; v > 0; v = Math.floor(v / 256)) out.unshift(v % 256);
  while (out.length < Math.max(1, width)) out.unshift(0);
  return Uint8Array.from(out);
}

function element(id: number, payload: Bytes): Bytes {
  return concat([idBytes(id), sizeBytes(payload.length), payload]);
}

const uint = (id: number, value: number, width = 0): Bytes => element(id, uintBytes(value, width));
const text = (id: number, value: string): Bytes => element(id, new TextEncoder().encode(value));
const master = (id: number, children: readonly Bytes[]): Bytes => element(id, concat(children));

function float64(id: number, value: number): Bytes {
  const payload = new Uint8Array(8);
  new DataView(payload.buffer).setFloat64(0, value);
  return element(id, payload);
}

function base64Bytes(value: string): Bytes {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function simpleBlock(relativeMs: number, keyframe: boolean, frame: Bytes): Bytes {
  const head = new Uint8Array(4);
  head[0] = 0x81; // track 1
  new DataView(head.buffer).setInt16(1, relativeMs);
  head[3] = keyframe ? 0x80 : 0x00;
  return element(0xa3, concat([head, frame]));
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Options for {@link svDemoVideo}. */
export interface SvDemoVideoOptions {
  /** Length in seconds — whole seconds, clamped to 1 … 21,600 (six hours). */
  readonly seconds: number;
  /** Which still to show. @default 'indigo' */
  readonly scene?: SvDemoMediaScene;
}

/**
 * A silent WebM (VP9) clip of exactly `seconds`, showing one still.
 *
 * ```ts
 * const url = URL.createObjectURL(svDemoVideo({ seconds: 754, scene: 'teal' }));
 * // … <sv-media-player [items]="[{ id: 'l1', title: 'Lesson 1', src: url }]" />
 * URL.revokeObjectURL(url); // when done
 * ```
 */
export function svDemoVideo(options: SvDemoVideoOptions): Blob {
  return new Blob([...demoVideoParts(options)], { type: 'video/webm' });
}

/**
 * The same clip as a `data:video/webm;base64,…` URI — for a short clip that has
 * to exist without a browser (a static fixture, a playground, SSR). Nothing to
 * revoke. Keep it short: the URI is a third larger than the clip.
 */
export function svDemoVideoDataUrl(options: SvDemoVideoOptions): string {
  return `data:video/webm;base64,${base64Of(demoVideoParts(options))}`;
}

function base64Of(parts: readonly Bytes[]): string {
  let binary = '';
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 0x8000) {
      binary += String.fromCharCode(...part.subarray(i, i + 0x8000));
    }
  }
  return btoa(binary);
}

function demoVideoParts(options: SvDemoVideoOptions): readonly Bytes[] {
  const seconds = Math.min(21_600, Math.max(1, Math.round(options.seconds || 0)));
  const keyframe = base64Bytes(SCENE_KEYFRAMES[options.scene ?? 'indigo']);
  const repeat = Uint8Array.of(SHOW_EXISTING_FRAME);
  const clusterSeconds = 30;

  const info = master(0x1549a966, [
    uint(0x2ad7b1, 1_000_000), // TimecodeScale: milliseconds
    float64(0x4489, seconds * 1000), // Duration
    text(0x4d80, 'styloviz'),
    text(0x5741, 'styloviz'),
  ]);
  const tracks = master(0x1654ae6b, [
    master(0xae, [
      uint(0xd7, 1), // TrackNumber
      uint(0x73c5, 1), // TrackUID
      uint(0x83, 1), // TrackType: video
      uint(0x23e383, 1_000_000_000), // DefaultDuration: one frame a second
      text(0x86, 'V_VP9'),
      master(0xe0, [uint(0xb0, WIDTH), uint(0xba, HEIGHT)]),
    ]),
  ]);

  const clusters: Bytes[] = [];
  const clusterTimes: number[] = [];
  for (let start = 0; start < seconds; start += clusterSeconds) {
    const blocks: Bytes[] = [uint(0xe7, start * 1000)];
    for (let s = start; s < Math.min(seconds, start + clusterSeconds); s++) {
      const first = s === start;
      blocks.push(simpleBlock((s - start) * 1000, first, first ? keyframe : repeat));
    }
    clusters.push(master(0x1f43b675, blocks));
    clusterTimes.push(start * 1000);
  }

  // Positions are offsets from the start of the Segment's payload. They are
  // written 8 bytes wide so the SeekHead's own size never depends on them.
  const seekEntry = (id: number, position: number): Bytes =>
    master(0x4dbb, [element(0x53ab, idBytes(id)), uint(0x53ac, position, 8)]);
  const seekHeadLength = master(0x114d9b74, [
    seekEntry(0x1549a966, 0),
    seekEntry(0x1654ae6b, 0),
    seekEntry(0x1c53bb6b, 0),
  ]).length;

  const infoAt = seekHeadLength;
  const tracksAt = infoAt + info.length;
  let clusterAt = tracksAt + tracks.length;
  const cuePoints: Bytes[] = [];
  clusters.forEach((cluster, i) => {
    cuePoints.push(
      master(0xbb, [uint(0xb3, clusterTimes[i]), master(0xb7, [uint(0xf7, 1), uint(0xf1, clusterAt, 8)])]),
    );
    clusterAt += cluster.length;
  });
  const cues = master(0x1c53bb6b, cuePoints);
  const seekHead = master(0x114d9b74, [
    seekEntry(0x1549a966, infoAt),
    seekEntry(0x1654ae6b, tracksAt),
    seekEntry(0x1c53bb6b, clusterAt),
  ]);

  const ebml = master(0x1a45dfa3, [
    uint(0x4286, 1),
    uint(0x42f7, 1),
    uint(0x42f2, 4),
    uint(0x42f3, 8),
    text(0x4282, 'webm'),
    uint(0x4287, 4),
    uint(0x4285, 2),
  ]);
  return [ebml, master(0x18538067, [seekHead, info, tracks, ...clusters, cues])];
}

/** Options for {@link svDemoAudio}. */
export interface SvDemoAudioOptions {
  /** Length in seconds, clamped to 1 … 300. */
  readonly seconds: number;
  /** Base pitch of the chime, in hertz. @default 440 */
  readonly pitch?: number;
}

/**
 * A quiet WAV chime (8 kHz, 8-bit mono — about 8 kB a second): one soft note
 * every two seconds over a four-note figure. Plays only when the user presses
 * play; the player never autoplays sound.
 */
export function svDemoAudio(options: SvDemoAudioOptions): Blob {
  const seconds = Math.min(300, Math.max(1, Math.round(options.seconds || 0)));
  const rate = 8000;
  const samples = seconds * rate;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, 'data');
  view.setUint32(40, samples, true);

  const base = options.pitch ?? 440;
  const figure = [1, 5 / 4, 3 / 2, 2];
  const pcm = new Uint8Array(buffer, 44);
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const note = Math.floor(t / 2);
    const local = t - note * 2;
    const envelope = Math.exp(-3 * local) * Math.min(1, local * 200);
    const value = Math.sin(2 * Math.PI * base * figure[note % figure.length] * t) * envelope * 0.25;
    pcm[i] = Math.round(128 + value * 127);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** One caption cue for {@link svDemoCaptions}. Times in seconds. */
export interface SvDemoCue {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function vttTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/**
 * A WebVTT file from plain cues. Cue text is escaped (`&`, `<`, `>` — which
 * also defuses a `-->` inside it), so text from anywhere cannot change the
 * file's structure or smuggle markup into a cue.
 */
export function svDemoCaptions(cues: readonly SvDemoCue[]): Blob {
  return new Blob([vttOf(cues)], { type: 'text/vtt' });
}

/** The same WebVTT file as a `data:text/vtt;base64,…` URI. */
export function svDemoCaptionsDataUrl(cues: readonly SvDemoCue[]): string {
  return `data:text/vtt;base64,${base64Of([new TextEncoder().encode(vttOf(cues))])}`;
}

function vttOf(cues: readonly SvDemoCue[]): string {
  const body = cues
    .filter((cue) => cue.end > cue.start)
    .map((cue) => {
      const clean = cue.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r?\n\s*\r?\n/g, '\n');
      return `${vttTime(cue.start)} --> ${vttTime(cue.end)}\n${clean}`;
    })
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}
