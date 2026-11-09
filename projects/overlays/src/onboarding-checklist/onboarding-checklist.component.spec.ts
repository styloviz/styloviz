import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { describeAsyncContract } from '@testing/async-contract';
import {
  SvOnboardingChecklistComponent,
  type SvOnboardingStep,
  type SvOnboardingStepToggle,
} from './onboarding-checklist.component';
import { SV_OVERLAYS_LABELS } from '../overlays.labels';

const STEPS: readonly SvOnboardingStep[] = [
  { id: 'account', title: 'Create your account', done: true },
  { id: 'invite', title: 'Invite your team', description: 'Teammates get an email.', href: '/team', actionLabel: 'Invite' },
  { id: 'data', title: 'Connect a data source', actionLabel: 'Connect' },
  { id: 'theme', title: 'Pick a theme', optional: true },
];

async function mount(inputs: Record<string, unknown> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const result = await render(SvOnboardingChecklistComponent, {
    inputs: { steps: STEPS, ...inputs } as never,
    providers: providers as never[],
  });
  result.fixture.detectChanges();
  await result.fixture.whenStable();
  return result.fixture;
}

type Fixture = Awaited<ReturnType<typeof mount>>;

const el = (f: Fixture) => f.nativeElement as HTMLElement;
const boxes = (f: Fixture) => [...el(f).querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
const progress = (f: Fixture) => el(f).querySelector('[data-sv-onboarding-progress]')?.textContent?.trim();

async function update(f: Fixture, name: string, value: unknown): Promise<void> {
  f.componentRef.setInput(name, value);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

describe('SvOnboardingChecklistComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders every step with a native checkbox labelled by its title', async () => {
    const f = await mount();
    const items = el(f).querySelectorAll('[data-sv-onboarding-step]');
    expect(items.length).toBe(4);
    const first = boxes(f)[0];
    expect(first.checked).toBe(true);
    expect(el(f).querySelector(`label[for="${first.id}"]`)?.textContent).toContain('Create your account');
    expect(el(f).querySelector('[role="heading"]')?.textContent?.trim()).toBe(SV_OVERLAYS_LABELS.onboardingTitle);
  });

  it('counts required steps only, and says optional ones do not count', async () => {
    const f = await mount();
    expect(progress(f)).toBe('1 of 3 done');
    expect(el(f).textContent).toContain(SV_OVERLAYS_LABELS.onboardingOptionalNote);
    expect(el(f).querySelector('[data-sv-onboarding-step="theme"]')?.textContent).toContain(SV_OVERLAYS_LABELS.onboardingOptional);
    const ring = el(f).querySelector('[role="progressbar"]');
    expect(ring?.getAttribute('aria-valuenow')).toBe('33');
    expect(ring?.getAttribute('aria-valuetext')).toBe('1 of 3 done');
  });

  it('emits stepToggle and leaves the box as the host has it until the host updates done', async () => {
    const f = await mount();
    const toggles: SvOnboardingStepToggle[] = [];
    f.componentInstance.stepToggle.subscribe((t) => toggles.push(t));

    const invite = boxes(f)[1];
    invite.click();
    f.detectChanges();
    expect(toggles).toHaveLength(1);
    expect(toggles[0].step.id).toBe('invite');
    expect(toggles[0].done).toBe(true);
    expect(invite.checked).toBe(false);

    await update(f, 'steps', STEPS.map((s) => (s.id === 'invite' ? { ...s, done: true } : s)));
    expect(boxes(f)[1].checked).toBe(true);
    expect(progress(f)).toBe('2 of 3 done');
  });

  it('fires completed once, on the change to every required step done', async () => {
    const f = await mount();
    let fired = 0;
    f.componentInstance.completed.subscribe(() => (fired += 1));

    // The optional step stays undone — it does not hold completion back.
    const allRequired = STEPS.map((s) => (s.optional ? s : { ...s, done: true }));
    await update(f, 'steps', allRequired);
    expect(fired).toBe(1);
    expect(el(f).querySelector('[data-sv-onboarding-complete]')?.textContent).toContain(SV_OVERLAYS_LABELS.onboardingComplete);

    await update(f, 'steps', allRequired.map((s) => ({ ...s })));
    expect(fired).toBe(1);
  });

  it('does not fire completed for a checklist that arrives already complete', async () => {
    const f = await mount({ steps: STEPS.map((s) => ({ ...s, done: true })) });
    let fired = 0;
    f.componentInstance.completed.subscribe(() => (fired += 1));
    f.detectChanges();
    await f.whenStable();
    expect(fired).toBe(0);
    expect(el(f).querySelector('[data-sv-onboarding-checklist]')?.getAttribute('data-complete')).toBe('true');
  });

  it('emits stepAction from a link and from a button, and hides the action once done', async () => {
    const f = await mount();
    const actions: string[] = [];
    f.componentInstance.stepAction.subscribe((s) => actions.push(s.id));

    const link = el(f).querySelector<HTMLAnchorElement>('[data-sv-onboarding-step="invite"] a[data-sv-onboarding-action]');
    expect(link?.getAttribute('href')).toBe('/team');
    link?.addEventListener('click', (e) => e.preventDefault());
    link?.click();

    const button = el(f).querySelector<HTMLButtonElement>('[data-sv-onboarding-step="data"] button[data-sv-onboarding-action]');
    expect(button?.textContent?.trim()).toBe('Connect');
    button?.click();

    expect(actions).toEqual(['invite', 'data']);
    expect(el(f).querySelector('[data-sv-onboarding-step="account"] [data-sv-onboarding-action]')).toBeNull();
  });

  it('drops an unsafe href and falls back to a button when the step names an action', async () => {
    const f = await mount({
      steps: [
        { id: 'a', title: 'Bad link', href: 'javascript:alert(1)', actionLabel: 'Go' },
        { id: 'b', title: 'Bad link, no label', href: ' data:text/html,hi' },
      ],
    });
    expect(el(f).querySelector('a')).toBeNull();
    expect(el(f).querySelector('[data-sv-onboarding-step="a"] button[data-sv-onboarding-action]')?.textContent?.trim()).toBe('Go');
    expect(el(f).querySelector('[data-sv-onboarding-step="b"] [data-sv-onboarding-action]')).toBeNull();
  });

  it('dismisses: closes, emits dismissed and reports open=false', async () => {
    const f = await mount({ dismissible: true });
    let dismissed = 0;
    const open: boolean[] = [];
    f.componentInstance.dismissed.subscribe(() => (dismissed += 1));
    f.componentInstance.open.subscribe((v) => open.push(v));

    el(f).querySelector<HTMLButtonElement>('[data-sv-onboarding-dismiss]')?.click();
    f.detectChanges();
    expect(dismissed).toBe(1);
    expect(open).toEqual([false]);
    expect(el(f).querySelector('[data-sv-onboarding-checklist]')).toBeNull();
  });

  it('collapses the steps but keeps the heading and progress', async () => {
    const f = await mount({ collapsible: true });
    const toggle = el(f).querySelector<HTMLButtonElement>('[data-sv-onboarding-collapse]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    f.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const body = el(f).querySelector<HTMLElement>(`#${toggle.getAttribute('aria-controls')}`);
    expect(body?.hidden).toBe(true);
    expect(progress(f)).toBe('1 of 3 done');
  });

  it('shows read-only state when not checkable', async () => {
    const f = await mount({ checkable: false });
    expect(boxes(f)).toHaveLength(0);
    expect(el(f).querySelector('[data-sv-onboarding-step="account"]')?.textContent).toContain(SV_OVERLAYS_LABELS.onboardingStepDone);
  });

  it('skips steps with an empty or duplicate id', async () => {
    const f = await mount({ steps: [{ id: 'a', title: 'A' }, { id: 'a', title: 'Again' }, { id: ' ', title: 'Blank' }] });
    expect(el(f).querySelectorAll('[data-sv-onboarding-step]')).toHaveLength(1);
  });

  it('takes text from the registry and from the labels input', async () => {
    const f = await mount({}, [provideSvLabels({ overlays: { onboardingTitle: 'Einrichtung' } })]);
    expect(el(f).querySelector('[role="heading"]')?.textContent?.trim()).toBe('Einrichtung');

    const g = await mount({ labels: { onboardingProgress: '{done}/{total}' }, title: 'Workspace setup' });
    expect(el(g).querySelector('[role="heading"]')?.textContent?.trim()).toBe('Workspace setup');
    expect(progress(g)).toBe('1/3');
  });

  it('withholds the ring and the count while loading', async () => {
    const f = await mount({ loading: true });
    expect(el(f).querySelector('[role="progressbar"]')).toBeNull();
    expect(progress(f)).toBeUndefined();
    expect(el(f).querySelector('[data-sv-state="loading"]')).toBeTruthy();
  });
});

describeAsyncContract({
  component: SvOnboardingChecklistComponent,
  collection: 'steps',
  rows: STEPS,
  loadedSelector: 'input[type="checkbox"]',
  skip: { twoEmpties: 'a checklist has no filter of its own, so every empty is no-data' },
});
