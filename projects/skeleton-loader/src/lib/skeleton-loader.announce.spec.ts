import { ApplicationRef, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLiveAnnouncer } from '@styloviz/core';
import { SvSkeletonLoaderComponent } from './skeleton-loader.component';

/**
 * `sv-skeleton-loader` — the loading label is SPOKEN once, through the shared
 * announcer (`OF-17-I1`). A `role="status"` born with its `aria-label` and no
 * content is usually silent, so the claim is proved by `history()`.
 */

async function setup(inputs: Record<string, unknown> = {}, server = false) {
  TestBed.resetTestingModule();
  const view = await render(SvSkeletonLoaderComponent, {
    inputs,
    providers: server ? [{ provide: PLATFORM_ID, useValue: 'server' }] : [],
  });
  TestBed.inject(ApplicationRef).tick();
  return view;
}

const said = () => TestBed.inject(SvLiveAnnouncer).history();

describe('sv-skeleton-loader — announcing the wait', () => {
  it('★★ says its label once, politely, when it appears', async () => {
    const { fixture } = await setup({ ariaLabel: 'Loading invoices…', preset: 'table' });
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    expect(said()).toHaveLength(1);
    expect(said()[0]).toMatchObject({ message: 'Loading invoices…', priority: 'polite' });
  });

  it('keeps role="status" and its name, with no text of its own to repeat it', async () => {
    const { fixture } = await setup({ ariaLabel: 'Loading invoices…' });
    const region = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')!;
    expect(region.getAttribute('aria-label')).toBe('Loading invoices…');
    expect(region.textContent?.trim()).toBe('');
  });

  it('★ says nothing when the host owns the announcement', async () => {
    await setup({ announce: false, ariaLabel: 'Loading invoices…' });
    expect(said()).toEqual([]);
  });

  it('★ says nothing on the server', async () => {
    await setup({ ariaLabel: 'Loading invoices…' }, true);
    expect(said()).toEqual([]);
  });

  it('says nothing when destroyed before it renders', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(SvSkeletonLoaderComponent);
    fixture.destroy();
    TestBed.inject(ApplicationRef).tick();
    expect(said()).toEqual([]);
  });
});
