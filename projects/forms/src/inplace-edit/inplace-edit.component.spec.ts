import { TestBed } from '@angular/core/testing';
import { render, screen, within, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvInplaceEditComponent } from './inplace-edit.component';

/**
 * `sv-inplace-edit` — click a value, it becomes an input, it goes back.
 *
 * The rendering is the easy half and is barely tested here. What these cover is
 * the part that is invisible in a demo and wrong in most hand-rolled versions:
 *
 *   • pressing **Cancel** must not save (the blur-before-click trap)
 *   • a **failed save** must not lose what the user typed
 *   • **Enter in a textarea** must insert a newline, not commit
 *   • an **unchanged** value must emit nothing at all
 *   • focus must **go somewhere** on the way out
 *
 * Every one of those is a bug that ships green, because each looks fine on
 * screen and only misbehaves at the moment it matters.
 */

async function setup(inputs: ComponentInput<SvInplaceEditComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvInplaceEditComponent, { inputs: { label: 'Display name', ...inputs } });
}

const trigger = () => screen.getByRole('button', { name: /^Edit/ }) as HTMLButtonElement;
const editor = () => screen.getByLabelText('Display name') as HTMLInputElement;
const saveBtn = () => screen.getByRole('button', { name: 'Save' });
const cancelBtn = () => screen.getByRole('button', { name: 'Cancel' });

/** Open the editor the way a user does, and hand back a clean typing session. */
async function open(inputs: ComponentInput<SvInplaceEditComponent> = {}) {
  const user = userEvent.setup();
  const view = await setup(inputs);
  await user.click(trigger());
  return { ...view, user };
}

// ── The read view ────────────────────────────────────────────────────────────

describe('SvInplaceEditComponent — the read view', () => {
  /**
   * ★★ A BUTTON, NOT A DIV WITH A CLICK HANDLER. The read view is the only door
   * into edit mode; a `<div (click)>` has no role, no tab stop and no keyboard
   * activation, so the field is simply not editable without a mouse.
   */
  it('offers the value as a real button', async () => {
    await setup({ value: 'Ada Lovelace' });
    const btn = trigger();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.textContent?.trim()).toBe('Ada Lovelace');
  });

  /**
   * ★★ The button's own text is the VALUE, so on its own a screen reader says
   * "Ada Lovelace, button" and never says what pressing it edits.
   */
  it('names itself after the field, not after the value', async () => {
    await setup({ value: 'Ada Lovelace', label: 'Display name' });
    expect(trigger().getAttribute('aria-label')).toBe('Edit Display name');
  });

  /**
   * ★★★ AN EMPTY VALUE STILL NEEDS A TARGET. Rendering the value alone gives an
   * empty button — zero width, invisible and unclickable — so the field becomes
   * uneditable at exactly the moment it most needs editing.
   */
  it('falls back to placeholder text when there is nothing to show', async () => {
    await setup({ value: '' });
    const btn = trigger();
    expect(btn.textContent?.trim()).toBe('Empty');
    expect(btn.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('lets the host word the empty state', async () => {
    await setup({ value: '', emptyText: 'Add a bio' });
    expect(trigger().textContent?.trim()).toBe('Add a bio');
  });

  /** A disabled field is text. A button that refuses to do anything is worse. */
  it('renders static text with no button when disabled', async () => {
    const { container } = await setup({ value: 'Ada Lovelace', disabled: true });
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('Ada Lovelace');
  });

  it('puts the affordance beside the text in button-trigger mode', async () => {
    const { container } = await setup({ value: 'Ada Lovelace', trigger: 'button' });
    expect(trigger().textContent?.trim()).toBe('');
    expect(container.textContent).toContain('Ada Lovelace');
  });
});

// ── Entering and committing ──────────────────────────────────────────────────

describe('SvInplaceEditComponent — committing', () => {
  it('swaps the value for a focused editor, with the text selected', async () => {
    await open({ value: 'Ada' });
    const input = editor();
    expect(input.value).toBe('Ada');
    expect(document.activeElement).toBe(input);
    // Selected, so typing replaces — the overwhelmingly common intent.
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 3]);
  });

  it('commits on Enter and returns to the read view', async () => {
    const { user, fixture } = await open({ value: 'Ada' });
    const saved: string[] = [];
    fixture.componentInstance.save.subscribe((v) => saved.push(v));

    await user.clear(editor());
    await user.type(editor(), 'Grace{Enter}');

    expect(saved).toEqual(['Grace']);
    expect(fixture.componentInstance.value()).toBe('Grace');
    expect(trigger().textContent?.trim()).toBe('Grace');
  });

  it('commits from the Save button', async () => {
    const { user, fixture } = await open({ value: 'Ada' });
    const saved: string[] = [];
    fixture.componentInstance.save.subscribe((v) => saved.push(v));

    await user.clear(editor());
    await user.type(editor(), 'Grace');
    await user.click(saveBtn());

    expect(saved).toEqual(['Grace']);
  });

  /**
   * ★★★ A SAVE THAT SAVES NOTHING IS NOT FREE. It costs a request, a toast, an
   * audit-log row and — on a field several people watch — a spurious "changed
   * by" entry. Opening a field to look at it is not an edit.
   */
  it('emits nothing when the value did not change', async () => {
    const { user, fixture } = await open({ value: 'Ada' });
    const saved: string[] = [];
    fixture.componentInstance.save.subscribe((v) => saved.push(v));

    await user.keyboard('{Enter}');

    expect(saved).toEqual([]);
    expect(fixture.componentInstance.editing()).toBe(false);
  });

  it('trims a single-line value but leaves a textarea alone', async () => {
    const one = await open({ value: '' });
    const savedOne: string[] = [];
    one.fixture.componentInstance.save.subscribe((v) => savedOne.push(v));
    await one.user.type(editor(), '  Grace  {Enter}');
    expect(savedOne).toEqual(['Grace']);

    const many = await open({ value: '', mode: 'textarea' });
    const savedMany: string[] = [];
    many.fixture.componentInstance.save.subscribe((v) => savedMany.push(v));
    await many.user.type(editor(), '  Grace  ');
    await many.user.keyboard('{Control>}{Enter}{/Control}');
    expect(savedMany).toEqual(['  Grace  ']);
  });
});

// ── Backing out ──────────────────────────────────────────────────────────────

describe('SvInplaceEditComponent — backing out', () => {
  it('restores the original value on Escape and saves nothing', async () => {
    const { user, fixture } = await open({ value: 'Ada' });
    const saved: string[] = [];
    let cancelled = 0;
    fixture.componentInstance.save.subscribe((v) => saved.push(v));
    fixture.componentInstance.cancel.subscribe(() => (cancelled += 1));

    await user.clear(editor());
    await user.type(editor(), 'Grace{Escape}');

    expect(saved).toEqual([]);
    expect(cancelled).toBe(1);
    expect(fixture.componentInstance.value()).toBe('Ada');
    expect(trigger().textContent?.trim()).toBe('Ada');
  });

  /**
   * ★★★ THE BUG THIS CONTROL IS MOST OFTEN SHIPPED WITH.
   *
   * The action buttons sit outside the input, so pressing one blurs the editor —
   * and with commit-on-blur the blur handler runs BEFORE the click. The user
   * presses Cancel and their edit is saved. Preventing the default on mousedown
   * keeps focus in the field so no blur ever fires; this asserts that guard is
   * really on the button, because jsdom will not reproduce the focus loss that
   * would otherwise expose it.
   */
  it('prevents mousedown on both actions, so pressing Cancel cannot save', async () => {
    await open({ value: 'Ada' });

    for (const btn of [saveBtn(), cancelBtn()]) {
      const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      btn.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
    }
  });

  it('cancels from the Cancel button without saving', async () => {
    const { user, fixture } = await open({ value: 'Ada' });
    const saved: string[] = [];
    fixture.componentInstance.save.subscribe((v) => saved.push(v));

    await user.clear(editor());
    await user.type(editor(), 'Grace');
    await user.click(cancelBtn());

    expect(saved).toEqual([]);
    expect(fixture.componentInstance.value()).toBe('Ada');
  });

  /**
   * ★★ FOCUS HAS TO LAND SOMEWHERE. When the editor is removed with focus still
   * inside it, focus falls to `<body>` — and the next Tab starts from the top of
   * the document, which for a keyboard user is being thrown out of the row they
   * were working in.
   */
  it('returns focus to the trigger when the editor closes', async () => {
    const { user } = await open({ value: 'Ada' });
    await user.keyboard('{Escape}');
    await new Promise((r) => queueMicrotask(() => r(null)));
    expect(document.activeElement).toBe(trigger());
  });

  /**
   * ★★★ THE OTHER HALF OF THE FOCUS RULE, AND THE EASIER ONE TO GET WRONG.
   *
   * "Always focus the trigger on close" fixes the Escape case and breaks the
   * commonest one: the ordinary way to leave a field is to click the NEXT field,
   * and pulling focus back then throws the user out of the input they just
   * chose — twice in a row if they try again. Focus is only ours to take back
   * when the editor still had it.
   */
  it('leaves focus alone when the user clicked something else', async () => {
    const elsewhere = document.createElement('input');
    document.body.appendChild(elsewhere);
    try {
      const { user } = await open({ value: 'Ada' });
      await user.clear(editor());
      await user.type(editor(), 'Grace');

      elsewhere.focus();
      editor().blur();
      await new Promise((r) => setTimeout(r, 0));

      expect(document.activeElement).toBe(elsewhere);
    } finally {
      elsewhere.remove();
    }
  });

  it('commits on blur by default, and discards when told to', async () => {
    const commits = await open({ value: 'Ada' });
    const savedA: string[] = [];
    commits.fixture.componentInstance.save.subscribe((v) => savedA.push(v));
    await commits.user.clear(editor());
    await commits.user.type(editor(), 'Grace');
    editor().blur();
    expect(savedA).toEqual(['Grace']);

    const discards = await open({ value: 'Ada', commitOnBlur: false });
    const savedB: string[] = [];
    discards.fixture.componentInstance.save.subscribe((v) => savedB.push(v));
    await discards.user.clear(editor());
    await discards.user.type(editor(), 'Grace');
    editor().blur();
    expect(savedB).toEqual([]);
    expect(discards.fixture.componentInstance.value()).toBe('Ada');
  });
});

// ── Multi-line ───────────────────────────────────────────────────────────────

describe('SvInplaceEditComponent — textarea mode', () => {
  /**
   * ★★★ PLAIN ENTER MUST INSERT A NEWLINE. Committing on Enter here makes a
   * multi-line field unable to hold more than one line, which is the entire
   * reason a host picked this mode.
   */
  it('takes a newline on Enter and commits only with the modifier', async () => {
    const { user, fixture } = await open({ value: '', mode: 'textarea' });
    const saved: string[] = [];
    fixture.componentInstance.save.subscribe((v) => saved.push(v));

    await user.type(editor(), 'one{Enter}two');
    expect(saved).toEqual([]);
    expect(editor().value).toBe('one\ntwo');

    await user.keyboard('{Meta>}{Enter}{/Meta}');
    expect(saved).toEqual(['one\ntwo']);
  });

  it('renders a textarea with the requested rows', async () => {
    await open({ value: '', mode: 'textarea', rows: 6 });
    const el = editor() as unknown as HTMLTextAreaElement;
    expect(el.tagName).toBe('TEXTAREA');
    expect(el.rows).toBe(6);
  });
});

// ── Select ───────────────────────────────────────────────────────────────────

describe('SvInplaceEditComponent — select mode', () => {
  const OPTIONS = [
    { value: 'open', label: 'Open' },
    { value: 'done', label: 'Done' },
  ];

  /**
   * ★ The read view must show the LABEL. A status column that reads "in_review"
   * is a database column leaking into the interface.
   */
  it('reads out the option label, never the raw value', async () => {
    await setup({ value: 'done', mode: 'select', options: OPTIONS });
    expect(trigger().textContent?.trim()).toBe('Done');
  });

  it('commits the moment a choice is made, with no action buttons', async () => {
    const { user, fixture } = await open({ value: 'open', mode: 'select', options: OPTIONS });
    const saved: string[] = [];
    fixture.componentInstance.save.subscribe((v) => saved.push(v));

    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    await user.selectOptions(editor() as unknown as HTMLSelectElement, 'done');

    expect(saved).toEqual(['done']);
    expect(trigger().textContent?.trim()).toBe('Done');
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe('SvInplaceEditComponent — required', () => {
  it('refuses an empty commit, says why, and stays open', async () => {
    const { user, fixture } = await open({ value: 'Ada', required: true });
    const saved: string[] = [];
    fixture.componentInstance.save.subscribe((v) => saved.push(v));

    await user.clear(editor());
    await user.keyboard('{Enter}');

    expect(saved).toEqual([]);
    expect(fixture.componentInstance.editing()).toBe(true);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('cannot be empty');
    // The message is only useful if the editor points at it.
    expect(editor().getAttribute('aria-describedby')).toBe(alert.id);
    expect(editor().getAttribute('aria-invalid')).toBe('true');
  });

  it('clears the complaint as soon as the user types', async () => {
    const { user } = await open({ value: 'Ada', required: true });
    await user.clear(editor());
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('alert')).not.toBeNull();

    await user.type(editor(), 'G');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// ── The save lifecycle ───────────────────────────────────────────────────────

describe('SvInplaceEditComponent — while the host is saving', () => {
  it('keeps the editor open, disabled, with a labelled spinner', async () => {
    const { fixture } = await open({ value: 'Ada' });
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    expect(editor().disabled).toBe(true);
    expect(screen.getByRole('img', { name: 'Saving' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  /**
   * ★★★ THE WORST FAILURE THIS CONTROL CAN HAVE.
   *
   * The user types a paragraph, the save 500s, and the field is back to reading
   * out the old value with a red message under it — their text is gone and no
   * retry can bring it back. The draft outlives the close for exactly this: a
   * failure costs a click, not the work.
   */
  it('re-opens with the draft intact when the save fails', async () => {
    const { user, fixture } = await open({ value: 'Ada' });
    await user.clear(editor());
    await user.type(editor(), 'Grace{Enter}');
    expect(fixture.componentInstance.editing()).toBe(false);

    fixture.componentRef.setInput('error', 'Could not save. Try again.');
    fixture.detectChanges();

    expect(editor().value).toBe('Grace');
    expect(screen.getByRole('alert').textContent).toContain('Could not save');
  });

  /**
   * ★★ A SECOND FAILURE MUST RE-OPEN TOO. Dismissing the first one cannot be
   * allowed to swallow the next, which is what a plain `dismissed` flag does
   * until someone remembers to reset it in all three call sites.
   */
  it('re-opens again on a new failure after the first was dismissed', async () => {
    const { user, fixture } = await open({ value: 'Ada' });
    await user.type(editor(), 'x{Enter}');

    fixture.componentRef.setInput('error', 'Network error');
    fixture.detectChanges();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alert')).toBeNull();

    fixture.componentRef.setInput('error', 'Conflict: edited elsewhere');
    fixture.detectChanges();
    expect(screen.getByRole('alert').textContent).toContain('Conflict');
  });
});

// ── Host control ─────────────────────────────────────────────────────────────

describe('SvInplaceEditComponent — host control', () => {
  /** A table row's own Edit button opens the cell; there is no click of ours. */
  it('opens when the host sets editing, and focuses the editor', async () => {
    const { fixture } = await setup({ value: 'Ada' });
    fixture.componentRef.setInput('editing', true);
    fixture.detectChanges();

    expect(editor()).toBeTruthy();
    expect(document.activeElement).toBe(editor());
  });

  it('gives two instances different message ids', async () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    const a = await open({ value: '', required: true });
    await a.user.keyboard('{Enter}');
    const idA = within(a.fixture.nativeElement as HTMLElement).getByRole('alert').id;

    const b = TestBed.createComponent(SvInplaceEditComponent);
    b.componentRef.setInput('label', 'Display name');
    b.componentRef.setInput('value', '');
    b.componentRef.setInput('required', true);
    b.autoDetectChanges();
    await b.whenStable();
    const inB = within(b.nativeElement as HTMLElement);
    await a.user.click(inB.getByRole('button', { name: /^Edit/ }));
    await a.user.keyboard('{Enter}');
    const idB = inB.getByRole('alert').id;

    expect(idA).not.toBe('');
    expect(idA).not.toBe(idB);
  });
});
