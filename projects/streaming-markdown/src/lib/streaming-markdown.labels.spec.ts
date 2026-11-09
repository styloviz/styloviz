import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvStreamingMarkdownComponent } from './streaming-markdown.component';
import { SV_STREAMING_MARKDOWN_LABELS } from './streaming-markdown.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStreamingMarkdownComponent, { inputs: { content: '- [x] shipped\n- [ ] tested' } as never, providers: providers as never[] });
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label'));
}

describe('SvStreamingMarkdownComponent — accessible names', () => {
  it('names the task-list states in English by default', async () => {
    const names = await setup();
    expect(names).toContain(SV_STREAMING_MARKDOWN_LABELS.done);
    expect(names).toContain(SV_STREAMING_MARKDOWN_LABELS.notDone);
  });

  it('renders the names an app provides', async () => {
    const names = await setup([provideSvLabels({ streamingMarkdown: { done: 'Erledigt', notDone: 'Offen' } })]);
    expect(names).toContain('Erledigt');
    expect(names).toContain('Offen');
    expect(names).not.toContain('Done');
  });
});

describe('SvStreamingMarkdownComponent — visible text (FL-B1d)', () => {
  it('announces the completion message an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture, rerender } = await render(SvStreamingMarkdownComponent, {
      inputs: { content: '# Hallo', streaming: true } as never,
      providers: [provideSvLabels({ streamingMarkdown: { responseComplete: 'Antwort vollständig' } })],
    });
    await rerender({ inputs: { content: '# Hallo', streaming: false } as never });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="status"]')?.textContent?.trim()).toBe('Antwort vollständig');
  });
});
