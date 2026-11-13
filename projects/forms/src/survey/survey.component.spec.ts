import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvSurveyComponent, svNpsBand, type SvSurveyResponse } from './survey.component';
import { SV_FORMS_LABELS } from '../labels/forms.labels';

async function mount(inputs: Record<string, unknown> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const result = await render(SvSurveyComponent, {
    inputs: inputs as never,
    providers: providers as never[],
  });
  result.fixture.detectChanges();
  await result.fixture.whenStable();
  return result.fixture;
}

type Fixture = Awaited<ReturnType<typeof mount>>;

const el = (f: Fixture) => f.nativeElement as HTMLElement;
const radios = (f: Fixture) => [...el(f).querySelectorAll<HTMLInputElement>('input[type="radio"]')];
const legend = (f: Fixture) => el(f).querySelector('fieldset > legend')?.textContent?.trim();
const comment = (f: Fixture) => el(f).querySelector<HTMLTextAreaElement>('textarea[data-sv-survey-comment]');
const submitButton = (f: Fixture) => el(f).querySelector<HTMLButtonElement>('[data-sv-survey-submit]')!;

async function settle(f: Fixture): Promise<void> {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

async function choose(f: Fixture, index: number): Promise<void> {
  radios(f)[index].click();
  await settle(f);
}

async function type(f: Fixture, text: string): Promise<void> {
  const box = comment(f)!;
  box.value = text;
  box.dispatchEvent(new Event('input'));
  await settle(f);
}

async function send(f: Fixture): Promise<SvSurveyResponse[]> {
  const out: SvSurveyResponse[] = [];
  f.componentInstance.submitted.subscribe((r) => out.push(r));
  submitButton(f).click();
  await settle(f);
  return out;
}

describe('SvSurveyComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('NPS', () => {
    it('renders 0–10 as one native radio group inside a fieldset with the question as its legend', async () => {
      const f = await mount();
      expect(el(f).querySelector('fieldset')).not.toBeNull();
      expect(legend(f)).toBe(SV_FORMS_LABELS.surveyNpsQuestion);
      const all = radios(f);
      expect(all.map((r) => r.value)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
      // One shared name is what makes the browser move between them with the arrow keys.
      expect(new Set(all.map((r) => r.name)).size).toBe(1);
      // Each radio sits inside its own <label>, which names it and is its hit area.
      expect(all.every((r) => r.parentElement?.tagName === 'LABEL')).toBe(true);
    });

    it('describes the two ends with "Not likely" and "Very likely"', async () => {
      const f = await mount();
      const all = radios(f);
      const low = document.getElementById(all[0].getAttribute('aria-describedby')!);
      const high = document.getElementById(all[10].getAttribute('aria-describedby')!);
      expect(low?.textContent?.trim()).toBe(SV_FORMS_LABELS.surveyNpsLow);
      expect(high?.textContent?.trim()).toBe(SV_FORMS_LABELS.surveyNpsHigh);
      expect(all[5].hasAttribute('aria-describedby')).toBe(false);
    });

    it('selects natively and emits scoreChange', async () => {
      const f = await mount();
      const scores: (number | null)[] = [];
      f.componentInstance.score.subscribe((s) => scores.push(s));
      await choose(f, 8);
      expect(radios(f)[8].checked).toBe(true);
      expect(scores).toEqual([8]);
    });

    it('computes the band and picks the follow-up prompt for it', async () => {
      expect([0, 6, 7, 8, 9, 10].map(svNpsBand)).toEqual(['detractor', 'detractor', 'passive', 'passive', 'promoter', 'promoter']);

      const f = await mount({ followUpPrompts: { detractor: 'What went wrong?', promoter: 'What do you love?' } });
      expect(comment(f)).toBeNull();

      await choose(f, 3);
      expect(el(f).querySelector('[data-sv-survey]')?.getAttribute('data-band')).toBe('detractor');
      expect(el(f).querySelector(`label[for="${comment(f)!.id}"]`)?.textContent?.trim()).toBe('What went wrong?');

      await choose(f, 7);
      // No passive prompt given: the default label.
      expect(el(f).querySelector(`label[for="${comment(f)!.id}"]`)?.textContent?.trim()).toBe(SV_FORMS_LABELS.surveyFollowUp);

      await choose(f, 10);
      expect(el(f).querySelector(`label[for="${comment(f)!.id}"]`)?.textContent?.trim()).toBe('What do you love?');
    });

    it('submits { kind, score, band, comment } with the comment trimmed', async () => {
      const f = await mount();
      await choose(f, 9);
      await type(f, '  Fast support  ');
      const sent = await send(f);
      expect(sent).toEqual([{ kind: 'nps', score: 9, band: 'promoter', comment: 'Fast support' }]);
    });

    it('leaves the comment out when it is empty, and hides the follow-up when followUp is off', async () => {
      const f = await mount({ followUp: false });
      await choose(f, 2);
      expect(comment(f)).toBeNull();
      expect(await send(f)).toEqual([{ kind: 'nps', score: 2, band: 'detractor' }]);
    });

    it('ignores a host score that is not on the scale', async () => {
      const f = await mount({ score: 42 });
      expect(radios(f).some((r) => r.checked)).toBe(false);
      expect(await send(f)).toEqual([]);
    });
  });

  describe('CSAT', () => {
    it('renders five native radios in a fieldset, each named by its level', async () => {
      const f = await mount({ kind: 'csat' });
      expect(legend(f)).toBe(SV_FORMS_LABELS.surveyCsatQuestion);
      const all = radios(f);
      expect(all.map((r) => r.value)).toEqual(['1', '2', '3', '4', '5']);
      expect(all.map((r) => r.closest('label')?.textContent?.trim())).toEqual([
        SV_FORMS_LABELS.surveyCsat1,
        SV_FORMS_LABELS.surveyCsat2,
        SV_FORMS_LABELS.surveyCsat3,
        SV_FORMS_LABELS.surveyCsat4,
        SV_FORMS_LABELS.surveyCsat5,
      ]);
      expect(el(f).querySelector('[data-sv-survey] svg:not([aria-hidden="true"])')).toBeNull();
    });

    it('shows the chosen level in words and submits { kind, score }', async () => {
      const f = await mount({ kind: 'csat' });
      await choose(f, 3);
      expect(el(f).querySelector('[data-sv-survey-level]')?.textContent?.trim()).toBe(SV_FORMS_LABELS.surveyCsat4);
      expect(await send(f)).toEqual([{ kind: 'csat', score: 4 }]);
    });
  });

  describe('One question', () => {
    const OPTIONS = [
      { value: 'docs', label: 'The docs' },
      { value: 'support', label: 'Support' },
      { value: 'docs', label: 'Duplicate' },
      { value: '', label: 'Empty' },
    ];

    it('renders host options as a radio group, skipping empty and duplicate values', async () => {
      const f = await mount({ kind: 'question', question: 'What helped most?', options: OPTIONS });
      expect(legend(f)).toBe('What helped most?');
      expect(radios(f).map((r) => r.closest('label')?.textContent?.trim())).toEqual(['The docs', 'Support']);
    });

    it('submits { kind, choice, comment }', async () => {
      const f = await mount({ kind: 'question', options: OPTIONS });
      await choose(f, 1);
      expect(el(f).querySelector(`label[for="${comment(f)!.id}"]`)?.textContent?.trim()).toBe(SV_FORMS_LABELS.surveyFollowUpChoice);
      await type(f, 'Quick reply');
      expect(await send(f)).toEqual([{ kind: 'question', choice: 'support', comment: 'Quick reply' }]);
    });

    it('asks for free text when there are no options — the question labels the textarea', async () => {
      const f = await mount({ kind: 'question', question: 'What should we build next?' });
      expect(el(f).querySelector('fieldset')).toBeNull();
      const box = comment(f)!;
      expect(el(f).querySelector(`label[for="${box.id}"]`)?.textContent?.trim()).toBe('What should we build next?');
      await type(f, 'Dark mode for reports');
      expect(await send(f)).toEqual([{ kind: 'question', comment: 'Dark mode for reports' }]);
    });
  });

  describe('Submit and thank-you', () => {
    it('refuses to submit unanswered, says so, and moves focus to the first answer', async () => {
      const f = await mount();
      const sent = await send(f);
      expect(sent).toEqual([]);
      const message = el(f).querySelector('[aria-live="polite"]');
      expect(message?.textContent?.trim()).toBe(SV_FORMS_LABELS.surveyRequired);
      expect(el(f).querySelector('fieldset')?.getAttribute('aria-describedby')).toContain(message!.id);
      expect(document.activeElement).toBe(radios(f)[0]);
    });

    it('shows the thank-you after submit, focuses it, and offers the follow-up action', async () => {
      const f = await mount({ thanksActionLabel: 'Book a call', thanksActionHref: '/call' });
      await choose(f, 10);
      await send(f);
      expect(f.componentInstance.state()).toBe('thanks');
      expect(el(f).querySelector('form')).toBeNull();
      const title = el(f).querySelector<HTMLElement>('[data-sv-survey-thanks] [tabindex="-1"]');
      expect(title?.textContent?.trim()).toBe(SV_FORMS_LABELS.surveyThanksTitle);
      expect(document.activeElement).toBe(title);
      expect(el(f).querySelector('[data-sv-survey]')?.getAttribute('aria-labelledby')).toBe(title?.id);
      const action = el(f).querySelector<HTMLAnchorElement>('a[data-sv-survey-thanks-action]');
      expect(action?.getAttribute('href')).toBe('/call');
    });

    it('drops an unsafe thank-you link and renders a button that emits thanksAction', async () => {
      const f = await mount({ state: 'thanks', thanksActionLabel: 'Tell us more', thanksActionHref: 'javascript:alert(1)' });
      expect(el(f).querySelector('a[data-sv-survey-thanks-action]')).toBeNull();
      let clicks = 0;
      f.componentInstance.thanksAction.subscribe(() => clicks++);
      el(f).querySelector<HTMLButtonElement>('button[data-sv-survey-thanks-action]')!.click();
      expect(clicks).toBe(1);
    });

    it('reset() asks again with nothing chosen', async () => {
      const f = await mount();
      await choose(f, 4);
      await send(f);
      f.componentInstance.reset();
      await settle(f);
      expect(el(f).querySelector('form')).not.toBeNull();
      expect(radios(f).some((r) => r.checked)).toBe(false);
    });
  });

  describe('Dismiss, layout and labels', () => {
    it('has no close button unless dismissible; closing hides it and emits dismissed', async () => {
      const plain = await mount();
      expect(el(plain).querySelector('[data-sv-survey-dismiss]')).toBeNull();

      const f = await mount({ dismissible: true });
      let dismissed = 0;
      f.componentInstance.dismissed.subscribe(() => dismissed++);
      const close = el(f).querySelector<HTMLButtonElement>('[data-sv-survey-dismiss]')!;
      expect(close.getAttribute('aria-label')).toBe(SV_FORMS_LABELS.surveyDismiss);
      close.click();
      await settle(f);
      expect(dismissed).toBe(1);
      expect(f.componentInstance.open()).toBe(false);
      expect(el(f).querySelector('[data-sv-survey]')).toBeNull();
    });

    it('floats in a fixed bottom corner — a named region, not a dialog', async () => {
      const f = await mount({ layout: 'floating', corner: 'start' });
      const root = el(f).querySelector('[data-sv-survey]')!;
      expect(root.tagName).toBe('SECTION');
      expect(root.className).toContain('fixed');
      expect(root.className).toContain('start-4');
      expect(root.getAttribute('role')).toBeNull();
      expect(root.getAttribute('aria-modal')).toBeNull();
      expect(document.getElementById(root.getAttribute('aria-labelledby')!)?.textContent?.trim()).toBe(SV_FORMS_LABELS.surveyNpsQuestion);
    });

    it('takes a per-instance label over the registry', async () => {
      const f = await mount({ labels: { surveySubmit: 'Send', surveyNpsLow: 'Never' } });
      expect(submitButton(f).textContent?.trim()).toBe('Send');
      expect(el(f).textContent).toContain('Never');
    });

    it('reads a provided language pack', async () => {
      const f = await mount({ kind: 'csat' }, [provideSvLabels({ forms: { surveyCsatQuestion: 'Wie zufrieden sind Sie?' } })]);
      expect(legend(f)).toBe('Wie zufrieden sind Sie?');
    });
  });
});
