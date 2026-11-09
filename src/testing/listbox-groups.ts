/**
 * The grouped-listbox contract (`FI-01-I5`, `FL-J3-FI-07`): every labelled
 * section is a `role="group"` inside the listbox, named by its heading through
 * `aria-labelledby`, holding its options — what sv-select-dropdown does.
 */
export interface ListboxGroupReport {
  readonly name: string;
  readonly options: readonly string[];
}

/** Read the groups of a listbox, failing loudly on a malformed one. */
export function readListboxGroups(listbox: Element): ListboxGroupReport[] {
  return [...listbox.querySelectorAll('[role="group"]')].map((g) => {
    const ids = (g.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
    if (!ids.length) throw new Error('role="group" with no aria-labelledby');
    const name = ids
      .map((id) => listbox.ownerDocument.getElementById(id)?.textContent?.trim() ?? '')
      .join(' ')
      .trim();
    return {
      name,
      options: [...g.querySelectorAll('[role="option"]')].map((o) => (o.textContent ?? '').replace(/\s+/g, ' ').trim()),
    };
  });
}
