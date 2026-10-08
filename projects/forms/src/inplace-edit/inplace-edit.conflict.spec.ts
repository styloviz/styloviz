import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  SvInplaceEditComponent,
  type InplaceEditConflict,
  type InplaceEditConflictChoice,
} from './inplace-edit.component';

/**
 * `FI-12-I1` / `FI-12-M2` re-verified 2026-09-26. The conflict choice existed
 * and rendered, but two paths through it lost data or focus:
 *
 * - a conflict pushed at a field nobody had opened showed "Yours" as EMPTY,
 *   and "Keep mine" wrote `''` over the value;
 * - the realistic path (Enter commits → focus returns to the trigger → 409 →
 *   the choice replaces the trigger) dropped focus to `<body>`, and resolving
 *   it dropped focus again when the host cleared `conflict`.
 */

@Component({
  standalone: true,
  imports: [SvInplaceEditComponent],
  template: `<sv-inplace-edit label="Project" [(value)]="value" [conflict]="conflict()"
                              (conflictResolved)="resolved($event)" />
             <input aria-label="Elsewhere" />`,
})
class Host {
  readonly value = signal('Ingestion');
  readonly conflict = signal<InplaceEditConflict | null>(null);
  readonly choices: InplaceEditConflictChoice[] = [];
  resolved(c: InplaceEditConflictChoice): void {
    this.choices.push(c);
    this.conflict.set(null);
  }
}

async function setup() {
  TestBed.resetTestingModule();
  const r = await render(Host);
  return { fixture: r.fixture, host: r.fixture.componentInstance };
}

const flush = () => new Promise<void>((r) => setTimeout(r));

describe('SvInplaceEditComponent — a conflict at a field nobody opened', () => {
  it('shows the current value as "Yours", not an empty draft', async () => {
    const { fixture, host } = await setup();
    host.conflict.set({ theirs: 'Ingestion v2' });
    fixture.detectChanges();
    const mine = fixture.nativeElement.querySelector('[data-sv-conflict="mine"]') as HTMLElement;
    expect(mine.textContent!.trim()).toBe('Ingestion');
  });

  it('"Keep mine" keeps the value instead of blanking it', async () => {
    const { fixture, host } = await setup();
    host.conflict.set({ theirs: 'Ingestion v2' });
    fixture.detectChanges();
    await userEvent.click(screen.getByRole('button', { name: /Keep mine/i }));
    fixture.detectChanges();
    expect(host.choices[0]).toEqual({ choice: 'mine', value: 'Ingestion' });
    expect(host.value()).toBe('Ingestion');
  });

  it('trims the typed side the same way a commit would', async () => {
    const { fixture, host } = await setup();
    await userEvent.click(screen.getByRole('button', { name: /Edit Project/i }));
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '  Mine  {Enter}');
    host.conflict.set({ theirs: 'Theirs' });
    fixture.detectChanges();
    await userEvent.click(screen.getByRole('button', { name: /Keep mine/i }));
    expect(host.choices[0].value).toBe('Mine');
  });
});

describe('SvInplaceEditComponent — focus through a conflict', () => {
  it('moves focus into the choice when it replaces the focused trigger', async () => {
    const { fixture, host } = await setup();
    await userEvent.click(screen.getByRole('button', { name: /Edit Project/i }));
    fixture.detectChanges();
    await userEvent.keyboard(' again{Enter}');
    fixture.detectChanges();
    await flush();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Edit Project');

    host.conflict.set({ theirs: 'Ingestion v2' });
    fixture.detectChanges();
    await flush();
    expect(document.activeElement?.textContent?.trim()).toBe('Keep mine');
  });

  it('returns focus to the trigger once the host clears the conflict', async () => {
    const { fixture, host } = await setup();
    host.conflict.set({ theirs: 'Ingestion v2' });
    fixture.detectChanges();
    await flush();
    await userEvent.click(screen.getByRole('button', { name: /Use theirs/i }));
    fixture.detectChanges();
    await flush();
    expect(host.value()).toBe('Ingestion v2');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Edit Project');
  });

  it('does not pull focus back from a field the user moved to', async () => {
    const { fixture, host } = await setup();
    const elsewhere = screen.getByRole('textbox', { name: 'Elsewhere' });
    elsewhere.focus();
    host.conflict.set({ theirs: 'Ingestion v2' });
    fixture.detectChanges();
    await flush();
    expect(document.activeElement).toBe(elsewhere);
  });
});
