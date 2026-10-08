import { Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SvTagInputComponent, type TagOption } from './tag-input.component';

/**
 * `sv-tag-input` binds to Angular forms — `[formControl]`, `formControlName` and
 * `[(ngModel)]` (1.0 release). The docs and the gallery always showed these
 * bindings; the free twin never implemented ControlValueAccessor, so the
 * documented binding threw NG01203 and aborted the gallery page's render.
 */
const OPTIONS: TagOption[] = [
  { value: 'ng', label: 'Angular' },
  { value: 'ts', label: 'TypeScript' },
  { value: 'rx', label: 'RxJS' },
];

@Component({
  standalone: true,
  imports: [SvTagInputComponent, ReactiveFormsModule],
  template: `<sv-tag-input label="Skills" [formControl]="ctrl" [options]="options" />`,
})
class ReactiveHost {
  readonly ctrl = new FormControl<string[]>(['ng']);
  readonly options = OPTIONS;
}

@Component({
  standalone: true,
  imports: [SvTagInputComponent, FormsModule],
  template: `<sv-tag-input label="Skills" [(ngModel)]="tags" [options]="options" />`,
})
class NgModelHost {
  tags: string[] = ['ts'];
  readonly options = OPTIONS;
}

function tagInput(fixture: ComponentFixture<unknown>): SvTagInputComponent {
  return fixture.debugElement.query((d) => d.componentInstance instanceof SvTagInputComponent).componentInstance as SvTagInputComponent;
}

describe('SvTagInputComponent — Angular forms', () => {
  it('[formControl]: renders the control value, and writes the user’s change back', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const c = tagInput(fixture);
    expect(c.values()).toEqual(['ng']);

    c.selectOption(OPTIONS[1]);
    expect(fixture.componentInstance.ctrl.value).toEqual(['ng', 'ts']);
    expect(fixture.componentInstance.ctrl.dirty).toBe(true);

    fixture.componentInstance.ctrl.setValue(['rx']);
    expect(c.values()).toEqual(['rx']);
  });

  it('[formControl]: a disabled control disables the field, and enabling it gives it back', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const c = tagInput(fixture);
    const input = (): HTMLInputElement => (fixture.nativeElement as HTMLElement).querySelector('input')!;

    fixture.componentInstance.ctrl.disable();
    fixture.detectChanges();
    expect(c.resolvedDisabled()).toBe(true);
    expect(input().disabled).toBe(true);
    c.selectOption(OPTIONS[2]);
    expect(fixture.componentInstance.ctrl.value).toEqual(['ng']);

    fixture.componentInstance.ctrl.enable();
    fixture.detectChanges();
    expect(input().disabled).toBe(false);
  });

  it('[formControl]: is touched when focus leaves the field, even with no change', async () => {
    vi.useFakeTimers();
    try {
      TestBed.resetTestingModule();
      const fixture = TestBed.createComponent(ReactiveHost);
      fixture.detectChanges();
      const c = tagInput(fixture);
      expect(fixture.componentInstance.ctrl.touched).toBe(false);
      c.onInputBlur();
      vi.advanceTimersByTime(200);
      expect(fixture.componentInstance.ctrl.touched).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('[(ngModel)]: renders the model and writes the change back', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const c = tagInput(fixture);
    expect(c.values()).toEqual(['ts']);

    c.selectOption(OPTIONS[2]);
    expect(fixture.componentInstance.tags).toEqual(['ts', 'rx']);
  });
});
