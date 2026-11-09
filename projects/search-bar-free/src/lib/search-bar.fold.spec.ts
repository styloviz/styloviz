import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvSearchBarComponent } from './search-bar.component';

/** `FL-J3-FI-08` — the suggestion highlight folds accents and case. */
describe('sv-search-bar — folded highlight', () => {
  it('marks José for the query “jose”, keeping the accent', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSearchBarComponent, { inputs: { value: 'jose' } });
    expect(fixture.componentInstance.highlightMatch('Ask José')).toEqual({ pre: 'Ask ', match: 'José', post: '' });
  });
});
