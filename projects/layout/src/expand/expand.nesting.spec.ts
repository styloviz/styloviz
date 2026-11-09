import { Component, signal, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvExpandComponent } from './expand.component';

/**
 * FL-J3-LU-06 — nested expands, and content added after init (`X-13`).
 *
 * `expand.component.spec.ts` mounts one panel. Nested disclosures (an FAQ
 * section inside a settings group) raise questions one panel cannot: does
 * collapsing the OUTER panel strand focus that sits in the INNER one, does the
 * inner panel keep its own state across the outer collapse, and does a panel
 * rendered after init start in the right state?
 */

@Component({
  imports: [SvExpandComponent],
  template: `
    <button type="button" id="outer-trigger" aria-controls="outer">Outer</button>
    <sv-expand panelId="outer" [expanded]="outer()" [duration]="0" ariaLabelledby="outer-trigger" (expandedChange)="log.push('outer:' + $event)">
      <button type="button" id="inner-trigger" aria-controls="inner">Inner</button>
      <sv-expand panelId="inner" [expanded]="inner()" [duration]="0" [lazy]="false" ariaLabelledby="inner-trigger" (expandedChange)="log.push('inner:' + $event)">
        <button type="button" id="deep">Deep control</button>
        @if (late()) {
          <sv-expand panelId="late" [expanded]="lateOpen()" [duration]="0" [lazy]="false"><p>Late</p></sv-expand>
        }
      </sv-expand>
    </sv-expand>`,
})
class Nested {
  readonly outer = signal(true);
  readonly inner = signal(true);
  readonly late = signal(false);
  readonly lateOpen = signal(false);
  readonly log: string[] = [];
  readonly panels = viewChildren(SvExpandComponent);
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

async function setup() {
  TestBed.resetTestingModule();
  const r = await render(Nested);
  const root = r.fixture.nativeElement as HTMLElement;
  const panel = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  return { ...r, root, panel, host: r.fixture.componentInstance };
}

describe('SvExpandComponent — nested (X-13)', () => {
  it('★ collapsing the OUTER panel while focus is deep in the inner one sends focus to the OUTER trigger', async () => {
    const { fixture, root, host } = await setup();
    root.querySelector<HTMLButtonElement>('#deep')!.focus();
    host.outer.set(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(root.querySelector('#outer-trigger'));
    expect(document.activeElement).not.toBe(document.body);
  });

  it('collapsing the INNER panel only sends focus to the inner trigger — the outer stays open', async () => {
    const { fixture, root, host, panel } = await setup();
    root.querySelector<HTMLButtonElement>('#deep')!.focus();
    host.inner.set(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(root.querySelector('#inner-trigger'));
    expect(panel('outer').getAttribute('aria-hidden')).toBe('false');
  });

  it('★ each panel reports only its own transitions', async () => {
    const { fixture, host } = await setup();
    host.inner.set(false);
    fixture.detectChanges();
    await settle();
    expect(host.log).toEqual(['inner:false']);
    host.outer.set(false);
    fixture.detectChanges();
    await settle();
    expect(host.log).toEqual(['inner:false', 'outer:false']);
  });

  it('the inner panel keeps its own state across an outer collapse and re-open', async () => {
    const { fixture, host, panel } = await setup();
    host.inner.set(false);
    fixture.detectChanges();
    await settle();
    host.outer.set(false);
    fixture.detectChanges();
    await settle();
    host.outer.set(true);
    fixture.detectChanges();
    await settle();
    expect(panel('outer').getAttribute('aria-hidden')).toBe('false');
    expect(panel('inner').getAttribute('aria-hidden')).toBe('true');
    expect(panel('inner').style.display).toBe('none');
  });

  it('a collapsed outer panel makes everything inside it inert, however the inner is set', async () => {
    const { fixture, host, panel } = await setup();
    host.outer.set(false);
    fixture.detectChanges();
    expect(panel('outer').hasAttribute('inert')).toBe(true);
    // The inner one is still "expanded" itself — the outer's inert covers it.
    expect(panel('inner').hasAttribute('inert')).toBe(false);
    expect(panel('outer').contains(panel('inner'))).toBe(true);
  });

  it('ids stay unique and each trigger controls its own panel', async () => {
    const { root } = await setup();
    const ids = Array.from(root.querySelectorAll('[id]')).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('SvExpandComponent — added after init (X-13)', () => {
  it('★ a collapsed panel rendered later starts hidden, from its first render', async () => {
    const { fixture, host, panel } = await setup();
    host.late.set(true);
    fixture.detectChanges();
    expect(panel('late').style.display).toBe('none');
    expect(panel('late').getAttribute('aria-hidden')).toBe('true');
  });

  it('…and opens normally afterwards', async () => {
    const { fixture, host, panel } = await setup();
    host.late.set(true);
    fixture.detectChanges();
    host.lateOpen.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(panel('late').style.display).not.toBe('none');
    expect(panel('late').getAttribute('aria-hidden')).toBe('false');
  });
});
