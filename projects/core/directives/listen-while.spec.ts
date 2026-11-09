import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { svListenWhile, type SvListenWhileRef } from './listen-while';

/**
 * `svListenWhile` (1.0 audit, M2) — global move listeners only for the span of
 * a drag. The point is what is NOT attached: a document-level @HostListener ran
 * change detection on every mouse move on the page.
 */
@Component({ standalone: true, template: '' })
class Host {
  readonly dragging = signal(false);
  readonly moves: number[] = [];
  readonly ref: SvListenWhileRef = svListenWhile(() => this.dragging(), 'document', {
    pointermove: (e) => this.moves.push((e as MouseEvent).clientX),
  });
}

const move = (x: number) => document.dispatchEvent(new MouseEvent('pointermove', { clientX: x }));

describe('svListenWhile', () => {
  it('attaches nothing while inactive', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    expect(add.mock.calls.filter(([t]) => t === 'pointermove')).toHaveLength(0);
    move(1);
    expect(f.componentInstance.moves).toEqual([]);
    add.mockRestore();
  });

  it('sync() attaches at once, so the very first move is seen', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    f.componentInstance.dragging.set(true);
    f.componentInstance.ref.sync();
    move(5);
    expect(f.componentInstance.moves).toEqual([5]);
  });

  it('follows the signal on its own, and detaches when the drag ends', () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.dragging.set(true);
    f.detectChanges();
    TestBed.tick();
    move(7);
    f.componentInstance.dragging.set(false);
    TestBed.tick();
    move(8);
    expect(f.componentInstance.moves).toEqual([7]);
  });

  it('detaches on destroy mid-drag', () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.dragging.set(true);
    f.componentInstance.ref.sync();
    const moves = f.componentInstance.moves;
    f.destroy();
    move(9);
    expect(moves).toEqual([]);
  });

  it('is a no-op on the server', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const add = vi.spyOn(document, 'addEventListener');
    const f = TestBed.createComponent(Host);
    f.componentInstance.dragging.set(true);
    f.componentInstance.ref.sync();
    TestBed.tick();
    expect(add.mock.calls.filter(([t]) => t === 'pointermove')).toHaveLength(0);
    add.mockRestore();
  });
});
