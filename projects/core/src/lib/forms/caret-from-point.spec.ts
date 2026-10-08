import { svCaretRangeFromPoint } from './caret-from-point';

type Doc = Omit<Document, 'caretPositionFromPoint' | 'caretRangeFromPoint'> & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

describe('svCaretRangeFromPoint', () => {
  const doc = document as unknown as Doc;
  afterEach(() => {
    Reflect.deleteProperty(doc, 'caretPositionFromPoint');
    Reflect.deleteProperty(doc, 'caretRangeFromPoint');
  });

  it('is null when the engine has neither API', () => {
    expect(svCaretRangeFromPoint(1, 1)).toBeNull();
  });

  it('prefers the standard caretPositionFromPoint, as a collapsed range', () => {
    const node = document.createTextNode('hello');
    document.body.appendChild(node);
    doc.caretPositionFromPoint = () => ({ offsetNode: node, offset: 2 });
    doc.caretRangeFromPoint = () => { throw new Error('should not be called'); };

    const r = svCaretRangeFromPoint(5, 5)!;
    expect(r.startContainer).toBe(node);
    expect(r.startOffset).toBe(2);
    expect(r.collapsed).toBe(true);
    node.remove();
  });

  it('is null when the standard API hits nothing', () => {
    doc.caretPositionFromPoint = () => null;
    expect(svCaretRangeFromPoint(5, 5)).toBeNull();
  });

  it('falls back to WebKit’s caretRangeFromPoint', () => {
    const r = document.createRange();
    doc.caretRangeFromPoint = () => r;
    expect(svCaretRangeFromPoint(5, 5)).toBe(r);
  });
});
