import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { SvIconComponent } from '@styloviz/icons';
import {
  svAriaValue,
  svClampPosition,
  svFrames,
  svClipInset,
  svPositionForKey,
  svPositionFromPointer,
  svPositionLabel,
} from './image-compare.geometry';
import { svUniqueId } from '@styloviz/core';

export type ImageCompareVariant =
  /** The wipe with a draggable handle. */
  | 'slider'
  /** The wipe with no handle drawn — keyboard and drag still work. */
  | 'bare'
  /** The wipe plus the measured ratios and what they mean. */
  | 'inspect';

/**
 * A fixed reference drawn over both images at once.
 *
 * ★★★ THE COMPONENT CANNOT CHECK THE FRAMING, ONLY THE DIMENSIONS. Two files of
 * identical size can still be different crops of the same scene — a tighter
 * lens, a nudged horizon — and no measurement a browser can take will tell.
 * These give the reader the thing the component cannot compute: a fixed line
 * that does not move with the wipe, so a feature that sits on it in one image
 * and beside it in the other proves the frames do not match.
 */
export type ImageCompareLandmarks = 'none' | 'crosshair' | 'thirds' | 'grid';

/**
 * `<sv-image-compare>` — a before/after wipe that admits when it is not one.
 *
 * ★★★ TWO IMAGES OF DIFFERENT ASPECT RATIOS CANNOT BE COMPARED BY WIPING. One of
 * them is scaled or cropped to fit, so part of what the reader is shown as "the
 * change" is the reframing — and the widget looks exactly right while it happens.
 * The component measures both naturals and says so.
 *
 * ★★★ IT IS A REAL SLIDER. Arrows nudge, Page keys jump, Home and End go to the
 * extremes. Almost no implementation of this control is operable without a mouse,
 * which excludes people from a comparison they can otherwise fully perceive.
 */
@Component({
  selector: 'sv-image-compare',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvIconComponent],
  templateUrl: './image-compare.component.html',
})
export class SvImageCompareComponent {
  private readonly uid = svUniqueId('sv-ic');

  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Presentation: `'slider'` (draggable handle), `'bare'` (no handle; keyboard and drag still work) or `'inspect'` (adds the measured ratios). @default 'slider' */
  readonly variant = input<ImageCompareVariant>('slider');

  /** The image revealed on the left of the wipe. */
  readonly beforeSrc = input<string>('');
  /** The image revealed on the right of the wipe. */
  readonly afterSrc = input<string>('');

  /**
   * Alt text, used in the slider's spoken value as well as on the images.
   *
   * ★★ "Before" and "after" are what the CONTROL does, not what the images are.
   * A screen reader user hearing "50% after" learns nothing; "50% retouched" is
   * the sentence a sighted reader gets from looking.
   * @default 'the before image' / 'the after image'
   */
  readonly beforeAlt = input<string>('the before image');
  /** Alt text for the after image, also used as its name in the slider's spoken value. @default 'the after image' */
  readonly afterAlt = input<string>('the after image');

  /** Corner captions. Empty hides them. @default '' */
  readonly beforeLabel = input<string>('');
  /** Corner caption on the after image; empty hides it. @default '' */
  readonly afterLabel = input<string>('');

  /** Accessible name for the slider itself. @default 'Comparison position' */
  readonly ariaLabel = input<string>('Comparison position');

  /**
   * Suppress the aspect-ratio warning.
   *
   * ★★ Provided because a caller who has deliberately letterboxed both images to
   * a common frame is telling the truth and the warning would be noise. It is NOT
   * a way to silence a real mismatch, and the docs say so.
   * @default false
   */
  readonly allowMismatch = input<boolean>(false);

  /**
   * Draw a fixed alignment reference over both images. @default 'none'
   *
   * ★★ It is drawn ONCE, over the whole box, above both layers — never inside
   * the clipped one. A landmark that travelled with the wipe would sit at the
   * same place on whatever is under it and prove nothing; the entire value is
   * that it stays put while the images change beneath it.
   */
  readonly landmarks = input<ImageCompareLandmarks>('none');

  /** Wipe position, 0–1. Two-way. @default 0.5 */
  readonly position = model<number>(0.5);

  /** Emitted once when the two images turn out not to be comparable. */
  readonly mismatch = output<number>();

  // ── Measured state ────────────────────────────────────────────────────────

  readonly beforeWidth = signal(0);
  readonly beforeHeight = signal(0);
  readonly afterWidth = signal(0);
  readonly afterHeight = signal(0);
  /** True while the pointer is dragging the handle. */
  readonly dragging = signal(false);

  private announced = false;

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly at = computed(() => svClampPosition(this.position()));

  readonly frames = computed(() =>
    svFrames(this.beforeWidth(), this.beforeHeight(), this.afterWidth(), this.afterHeight()),
  );

  readonly aspect = computed(() => this.frames().aspect);

  /** True only once both images have reported a size AND they disagree. */
  readonly mismatched = computed(() => !this.allowMismatch() && this.aspect().mismatched);

  /**
   * The warning, naming WHICH mismatch it is.
   *
   * ★ "Different shapes" is a symptom. A reciprocal pair is an EXIF orientation
   * tag on one file and not the other, and telling that reader to re-crop sends
   * them to fix the one thing that is not wrong.
   */
  readonly aspectLabel = computed(() => (this.mismatched() ? this.frames().warning : ''));

  /** Something true and worth saying that is not a warning. */
  readonly frameNote = computed(() => (this.allowMismatch() ? '' : this.frames().note));

  /** Lines to draw, as fractions of the box, for the chosen landmark set. */
  readonly landmarkLines = computed<{ x: readonly number[]; y: readonly number[] }>(() => {
    switch (this.landmarks()) {
      case 'crosshair': return { x: [0.5], y: [0.5] };
      case 'thirds':    return { x: [1 / 3, 2 / 3], y: [1 / 3, 2 / 3] };
      case 'grid':      return { x: [0.25, 0.5, 0.75], y: [0.25, 0.5, 0.75] };
      default:          return { x: [], y: [] };
    }
  });

  readonly showLandmarks = computed(() => this.landmarks() !== 'none');

  readonly clip = computed(() => svClipInset(this.at()));

  readonly ariaValue = computed(() => svAriaValue(this.at()));

  readonly positionLabel = computed(() =>
    svPositionLabel(this.at(), this.beforeAlt(), this.afterAlt()),
  );

  readonly showHandle = computed(() => this.variant() !== 'bare');

  // ── Interactions ──────────────────────────────────────────────────────────

  /**
   * Record an image's intrinsic size.
   *
   * ★★★ THE NATURAL SIZE, NOT THE LAID-OUT SIZE. Both images are stretched to the
   * same box by the layout, so their rendered rects always agree — measuring
   * those would make the mismatch check report "identical" in exactly the case it
   * exists to catch.
   */
  onImageLoad(which: 'before' | 'after', event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (which === 'before') {
      this.beforeWidth.set(img.naturalWidth);
      this.beforeHeight.set(img.naturalHeight);
    } else {
      this.afterWidth.set(img.naturalWidth);
      this.afterHeight.set(img.naturalHeight);
    }
    if (!this.announced && this.aspect().mismatched) {
      this.announced = true;
      this.mismatch.emit(this.aspect().difference);
    }
  }

  /**
   * ★★★ `preventDefault()` ONLY FOR THE KEYS THE SLIDER OWNS. `svPositionForKey`
   * returns null for everything else, and Tab has to keep leaving — a handler
   * that claims every key it receives traps focus on the slider, which is worse
   * than the control being unreachable in the first place.
   *
   * ★★★ AND THE RETURN TYPE IS `void` FOR A REASON THAT IS NOT OBVIOUS. The first
   * version returned a boolean saying whether it had handled the key, which reads
   * as better API — but Angular calls `preventDefault()` ITSELF whenever a
   * template event expression evaluates to exactly `false`. So `(keydown)=
   * "onKeydown($event)"` swallowed Tab, Escape and every printable character:
   * the one method whose whole purpose is not to trap focus did nothing but. The
   * spec caught it; nothing else would have.
   */
  onKeydown(event: KeyboardEvent): void {
    const next = svPositionForKey(event.key, this.at());
    if (next === null) return;
    this.position.set(next);
    event.preventDefault();
  }

  onPointerDown(event: PointerEvent): void {
    this.dragging.set(true);
    const target = event.target as Element & { setPointerCapture?(id: number): void };
    // ★ POINTER CAPTURE, so a drag that leaves the box keeps working. Without it
    //   the wipe sticks the moment the pointer crosses the edge, which is where
    //   people drag it to when they want to see one image whole.
    target.setPointerCapture?.(event.pointerId);
    this.moveTo(event.clientX);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging()) return;
    this.moveTo(event.clientX);
  }

  onPointerUp(): void {
    this.dragging.set(false);
  }

  /** Move the wipe to a viewport x. */
  moveTo(clientX: number): void {
    const el = this.box()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.position.set(svPositionFromPointer(clientX, rect.left, rect.width));
  }

  icId(suffix: string): string {
    return `${this.uid}-${suffix}`;
  }
}
