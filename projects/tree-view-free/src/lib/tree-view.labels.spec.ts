import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvTreeViewComponent, type TreeNode } from './tree-view.component';

/** FL-B1c: a composed accessible name is one template whose slots a translation may reorder. */
const TREE: TreeNode[] = [{ id: 'src', label: 'src', children: [{ id: 'main', label: 'main.ts' }] }];

async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvTreeViewComponent, {
    inputs: { nodes: TREE },
    providers: providers as never[],
  });
}

describe('SvTreeViewComponent — accessible names', () => {
  it('names the toggle in English by default', async () => {
    const { container } = await setup();
    expect(container.querySelector('[aria-label="Expand src"], [aria-label="Collapse src"]')).toBeTruthy();
  });

  it('fills a composed name from a template whose slot moves', async () => {
    const { container } = await setup([
      provideSvLabels({ treeView: { expandNode: '{name} aufklappen', collapseNode: '{name} zuklappen' } }),
    ]);
    expect(container.querySelector('[aria-label="src aufklappen"], [aria-label="src zuklappen"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Expand src"], [aria-label="Collapse src"]')).toBeNull();
  });

  it('renders the visible text an app provides (FL-B1d)', async () => {
    TestBed.resetTestingModule();
    await render(SvTreeViewComponent, {
      inputs: { nodes: [] },
      providers: [provideSvLabels({ treeView: { emptyText: 'Keine Einträge vorhanden' } })],
    });
    expect(screen.getByText('Keine Einträge vorhanden')).toBeTruthy();
    expect(screen.queryByText('No items to display')).toBeNull();
  });
});
