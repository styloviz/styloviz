import { svFragmentHref } from './fragment-href';

describe('svFragmentHref', () => {
  const docAt = (pathname: string, search = '') => ({ location: { pathname, search } }) as unknown as Document;

  it('puts the page path in front of the fragment, so a <base href="/"> cannot send it to the root', () => {
    expect(svFragmentHref(docAt('/docs/anchor'), 'usage')).toBe('/docs/anchor#usage');
  });

  it('keeps the query string — the same document, not a sibling URL', () => {
    expect(svFragmentHref(docAt('/docs/tabs', '?tab=api'), 'usage')).toBe('/docs/tabs?tab=api#usage');
  });

  it('resolves to the same document under a base that points elsewhere', () => {
    const href = svFragmentHref(docAt('/docs/anchor'), 'usage');
    expect(new URL(href, 'https://example.com/').href).toBe('https://example.com/docs/anchor#usage');
  });

  it('falls back to the bare fragment with no document or location', () => {
    expect(svFragmentHref(null, 'x')).toBe('#x');
    expect(svFragmentHref({} as Document, 'x')).toBe('#x');
  });
});
