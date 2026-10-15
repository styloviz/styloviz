import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import {
  createOptimisticEdit,
  svRequestKey,
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  warnOnDuplicateItemKeys,
  type SvDataError,
} from '@styloviz/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';

export type DndListVariant = 'default' | 'kanban' | 'checklist' | 'compact';

export interface DndItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: string;
  color?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  disabled?: boolean;
  badge?: string | number;
  completed?: boolean;
  assignee?: string; // initials e.g. "AK"
  assigneeColor?: string;
  dueDate?: string;  // ISO string
  tags?: string[];
  column?: 'todo' | 'in-progress' | 'done'; // for kanban
}

/**
 * Sample rows for the showcase and the docs — NOT a component default.
 *
 * ★ `assigneeColor` is drawn behind `text-white`, so every value here is a
 *   step-700 hue rather than the 500 these used to be. At 500 the initials
 *   failed AA on four of the five — emerald 2.46:1, amber 2.15:1, blue 3.76:1,
 *   violet 4.40:1. Demo data is what a buyer copies, so shipping it unreadable
 *   teaches the wrong pattern even though the component itself is fine.
 */
export const DEMO_DND_ITEMS: DndItem[] = [
  { id: '1', label: 'Design system audit',      sublabel: 'Review all components for consistency', priority: 'high',     badge: '2h',   assignee: 'AP', assigneeColor: '#1447e6', dueDate: '2026-06-25', tags: ['design'],   column: 'in-progress' },
  { id: '2', label: 'Write unit tests',          sublabel: 'Coverage above 80%',                   priority: 'medium',   badge: '4h',   assignee: 'MK', assigneeColor: '#007a55', dueDate: '2026-06-28', tags: ['dev'],      column: 'todo' },
  { id: '3', label: 'Update documentation',      sublabel: 'All new APIs documented',              priority: 'low',                     assignee: 'LN', assigneeColor: '#7008e7', dueDate: '2026-07-01', tags: ['docs'],     column: 'todo' },
  { id: '4', label: 'Performance profiling',     sublabel: 'Identify render bottlenecks',          priority: 'high',                    assignee: 'OR', assigneeColor: '#bb4d00', dueDate: '2026-06-22', tags: ['perf'],     column: 'in-progress' },
  { id: '5', label: 'Accessibility pass',        sublabel: 'WCAG 2.1 AA compliance',              priority: 'medium',                   assignee: 'YT', assigneeColor: '#c10007',                        tags: ['a11y'],     column: 'done', completed: true },
  { id: '6', label: 'Release v2.0',              sublabel: 'Tag & publish to npm',                 priority: 'critical', badge: '🚀',  assignee: 'AP', assigneeColor: '#1447e6', dueDate: '2026-06-30', tags: ['release'],  column: 'todo' },
];

/** A reorder, with a way to undo it if the save fails. */
export interface DndReorderEvent {
  /** The list in its new order — persist this. */
  readonly items: readonly DndItem[];
  /**
   * Client-generated key for this write, stable across retries of it. Send it
   * and ignore a key already applied, so a retried save cannot land twice.
   */
  readonly requestKey: string;
  /**
   * Restore the previous order. Refused, with a dev-mode warning, once a later
   * reorder has happened.
   */
  readonly rollback: () => void;
}

/**
 * A row deleted from the list.
 *
 * Separate from `reordered` because deleting and rearranging are different
 * writes — a `DELETE` against one id versus a `PUT` of the whole order — and
 * this used to be reported as a reorder. A host that did the obvious thing
 * persisted the shorter list as an ordering and never called its delete
 * endpoint, so the row came back on the next load.
 */
export interface DndRemoveEvent {
  /** The row that was taken out. */
  readonly item: DndItem;
  /** The list without it. */
  readonly items: readonly DndItem[];
  /** Idempotency key for the delete. See {@link DndReorderEvent.requestKey}. */
  readonly requestKey: string;
  /** Put the row back where it was. Refused once a later change has landed. */
  readonly rollback: () => void;
}

/**
 * One row's own fields changed — ticked complete, or moved between columns in
 * the kanban variant.
 *
 * Both of those used to mutate the list and emit nothing, so a checklist tick
 * looked saved and was not: the host never heard about it, and a reload put the
 * box back. One event covers both because the write is the same shape — a patch
 * against one row — and `item` carries the new `completed` / `column`.
 */
export interface DndItemChangeEvent {
  /** The row after the change. */
  readonly item: DndItem;
  /** The whole list with the change applied. */
  readonly items: readonly DndItem[];
  /** Idempotency key for the patch. See {@link DndReorderEvent.requestKey}. */
  readonly requestKey: string;
  /** Undo the change. Refused once a later change has landed. */
  readonly rollback: () => void;
}

@Component({
  host: { tabindex: '-1', class: 'outline-none' },
  selector: 'sv-dnd-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NgTemplateOutlet,
    SvEmptyShellComponent,
    SvErrorShellComponent,
    SvSkeletonShellComponent, SvIconComponent],
  templateUrl: './dnd-list.component.html',
})
export class SvDndListComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /**
   * The items to render and reorder. Two-way — this is a `model()`.
   *
   * The items to order. Defaults to empty — this used to default to a demo
   * fixture, so an unbound list rendered convincing fake rows.
   */
  items    = model<DndItem[]>([]);
  /** Visual variant. @default 'default' */
  variant  = input<DndListVariant>('default');
  /** Accessible label for the list. */
  label    = input<string>('');
  /** Enable drag-and-drop reordering. @default true */
  sortable = input<boolean>(true);

  // ── Persisting the order ────────────────────────────────────────────────────

  /**
   * True while the new order is being saved. Dragging is blocked, so a second
   * reorder cannot race the first and leave `rollback()` ambiguous.
   * @default false
   */
  saving   = input<boolean>(false);

  /**
   * Failure saving the order. Rendered above the list; the rows stay put so the
   * user can see what state things are in.
   * @default null
   */
  error    = input<SvDataError | string | null>(null);

  /** Copy for the empty state. @default 'Nothing to order yet' */
  emptyText = input<string>('Nothing to order yet');

  // ── Loading the definition ──────────────────────────────────────────────────

  /**
   * True while the list is being fetched. A list whose order you persist is a list you fetched first.
   * @default false
   */
  loading = input<boolean>(false);

  /**
   * The host should re-run whatever failed — the initial load, or the save
   * behind the last reorder. One output covers both because from the user's
   * side there is one button, and which request it re-runs is the host's
   * business, not theirs.
   */
  retry   = output<void>();
  /**
   * Restrict drag initiation to the grip handle only (rows can't be dragged by
   * their body). The handle "arms" the row on pointer-down. @default false
   */
  useHandle = input<boolean>(false);

  /**
   * The order changed.
   *
   * The move is applied immediately — a row that snaps back while a request is
   * in flight feels broken — so the payload carries `rollback()` for when the
   * save fails. It refuses, with a dev-mode warning, once a later reorder has
   * happened; bind `saving` so that cannot arise.
   */
  reordered = output<DndReorderEvent>();

  /**
   * A row was deleted. Applied immediately; `rollback()` puts it back.
   *
   * Bind this or the delete never happens — the list on screen is the
   * component's, and it has no way to reach your API.
   */
  itemRemoved = output<DndRemoveEvent>();

  /**
   * A row was ticked complete or moved to another column. Applied immediately;
   * `rollback()` undoes it.
   */
  itemChanged = output<DndItemChangeEvent>();

  /**
   * Render each item's label as a button that emits `itemClick` — for a list
   * whose items open something (a detail panel, a task). @default false
   *
   * ★ DA-04 — `itemClick` used to be declared and documented with nothing that
   *   emitted it. It is opt-in rather than always-on because a label button
   *   that nobody listens to is a focusable control that does nothing: four
   *   extra dead tab stops per row for every list that only reorders.
   */
  clickable = input<boolean>(false);

  /** Emitted with the item whose label was activated (click, Enter or Space). Needs `clickable`. */
  itemClick = output<DndItem>();

  readonly dragIndex  = signal<number>(-1);
  readonly overIndex  = signal<number>(-1);
  readonly isDragging = signal(false);
  /** When `useHandle` is on, true only while the grip has armed the row for drag. */
  readonly handleArmed = signal(false);

  /** Whether the given row is currently draggable, honoring handle-only mode. */
  canDrag(item: DndItem): boolean {
    return this.sortable() && !item.disabled && (!this.useHandle() || this.handleArmed());
  }

  /** Called on grip pointer-down to arm the row for a handle-only drag. */
  armHandle(): void {
    if (this.useHandle()) this.handleArmed.set(true);
  }

  /** Disarm after a click that didn't turn into a drag (drag paths reset separately). */
  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    if (!this.isDragging() && this.handleArmed()) this.handleArmed.set(false);
  }
  /** Polite screen-reader announcement for reorder / remove / complete. */
  readonly liveMessage = signal('');

  /** Re-announce by clearing first so identical consecutive messages are read. */
  private _announce(message: string): void {
    this.liveMessage.set('');
    queueMicrotask(() => this.liveMessage.set(message));
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────

  /**
   * Monotonic change counter guarding stale `rollback()` handles.
   *
   * Shared by every action, deliberately: a removal supersedes an earlier
   * reorder's handle just as another reorder would, because the snapshot that
   * handle is holding predates both.
   */
  private _editSeq = 0;

  private readonly _edit = createOptimisticEdit({
    revision: () => this._editSeq,
    selector: 'sv-dnd-list',
    superseded:
      'the order has changed since. Restoring it would undo that newer move too. ' +
      'Bind [saving] so the list cannot be reordered again while the save is in flight.',
  });

  /** Whether the list has nothing to show. */
  readonly isEmpty = computed(() => this.items().length === 0);

  /** Emit a reorder with a handle that restores the previous arrangement. */
  private _emitReorder(before: DndItem[], after: DndItem[]): void {
    this._editSeq++;
    this.reordered.emit({
      items: after,
      requestKey: svRequestKey('order'),
      rollback: this._edit.begin(() => this.items.set(before)),
    });
  }

  onDragStart(i: number): void {
    if (this.saving()) return;
    this.dragIndex.set(i);
    this.isDragging.set(true);
  }

  onDragOver(e: DragEvent, i: number): void {
    e.preventDefault();
    this.overIndex.set(i);
  }

  onDrop(e: DragEvent, i: number): void {
    e.preventDefault();
    const from = this.dragIndex();
    if (from === -1 || from === i) { this._resetDrag(); return; }
    const before = this.items();
    const list = [...before];
    const [moved] = list.splice(from, 1);
    if (moved) list.splice(i, 0, moved);
    this.items.set(list);
    this._emitReorder(before, list);
    if (moved) this._announce(`${moved.label} moved to position ${i + 1} of ${list.length}.`);
    this._resetDrag();
  }

  onDragEnd(): void { this._resetDrag(); }

  private _resetDrag(): void {
    this.dragIndex.set(-1);
    this.overIndex.set(-1);
    this.isDragging.set(false);
    this.handleArmed.set(false);
  }

  // ── Keyboard grab/drop ────────────────────────────────────────────────────

  /**
   * The index currently lifted with the keyboard, or `-1`.
   *
   * ★★★ NATIVE HTML DRAG LARGELY DOES NOT WORK ON TOUCH, which means the
   *     keyboard path is the PRIMARY path rather than the fallback — and the
   *     Move up / Move down buttons, while a valid alternative, are a different
   *     model: they commit each step immediately, so a five-position move is
   *     five separate writes the host has to save and possibly roll back.
   *     Grab/drop lifts once, previews the moves, and commits on drop.
   */
  readonly grabbedIndex = signal(-1);

  /** The order before the lift, so Escape can restore it exactly. */
  private _beforeGrab: readonly DndItem[] | null = null;

  /** True while this row is lifted. */
  isGrabbed(i: number): boolean {
    return this.grabbedIndex() === i;
  }

  /**
   * Space or Enter lifts and drops; arrows move; Escape cancels.
   *
   * ★ Escape restores the ORDER, not just the flag. A cancel that left the item
   *   where the arrows had pushed it would be the opposite of a cancel, and it
   *   is the mistake most grab/drop implementations make.
   */
  onHandleKeydown(event: KeyboardEvent, i: number): void {
    if (this.saving()) return;
    const key = event.key;

    if (key === ' ' || key === 'Enter') {
      event.preventDefault();
      if (this.isGrabbed(i)) {
        this._dropAt(i);
      } else {
        this._beforeGrab = this.items();
        this.grabbedIndex.set(i);
        this._announce(
          `${this.items()[i]?.label ?? 'Item'} lifted. Use the arrow keys to move it, ` +
          'space to drop, escape to cancel.',
        );
      }
      return;
    }

    if (key === 'Escape' && this.isGrabbed(i)) {
      event.preventDefault();
      const restore = this._beforeGrab;
      if (restore) this.items.set([...restore]);
      this.grabbedIndex.set(-1);
      this._beforeGrab = null;
      this._announce('Move cancelled. The order is unchanged.');
      return;
    }

    if (!this.isGrabbed(i)) return;

    if (key === 'ArrowUp' && i > 0) {
      event.preventDefault();
      this._shift(i, i - 1);
    } else if (key === 'ArrowDown' && i < this.items().length - 1) {
      event.preventDefault();
      this._shift(i, i + 1);
    }
  }

  /** Move the lifted row one place without committing. */
  private _shift(from: number, to: number): void {
    const list = [...this.items()];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved!);
    this.items.set(list);
    this.grabbedIndex.set(to);
    this._announce(`${moved!.label} at position ${to + 1} of ${list.length}.`);
    // Focus follows the row, or the next arrow press lands on whatever moved
    // into the old position instead.
    queueMicrotask(() => {
      const handles = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-dnd-handle]');
      handles[to]?.focus({ preventScroll: true });
    });
  }

  /** Commit the lift, emitting one reorder for the whole move. */
  private _dropAt(i: number): void {
    const before = this._beforeGrab;
    const after = this.items();
    this.grabbedIndex.set(-1);
    this._beforeGrab = null;
    // ★ One write for the whole move, not one per arrow press — which is the
    //   reason this mode exists alongside the move buttons.
    if (before && before.some((it, n) => it.id !== after[n]?.id)) {
      this._emitReorder([...before], [...after]);
    }
    this._announce(`${after[i]?.label ?? 'Item'} dropped at position ${i + 1} of ${after.length}.`);
  }

  // ── Item actions ──────────────────────────────────────────────────────────

  moveUp(i: number): void {
    if (i === 0 || this.saving()) return;
    const before = this.items();
    const list = [...before];
    const label = list[i]!.label;
    [list[i - 1], list[i]] = [list[i]!, list[i - 1]!];
    this.items.set(list);
    this._emitReorder(before, list);
    this._announce(`${label} moved up to position ${i} of ${list.length}.`);
  }

  moveDown(i: number): void {
    const list = this.items();
    if (i === list.length - 1 || this.saving()) return;
    const arr = [...list];
    const label = arr[i]!.label;
    [arr[i], arr[i + 1]] = [arr[i + 1]!, arr[i]!];
    this.items.set(arr);
    this._emitReorder(list, arr);
    this._announce(`${label} moved down to position ${i + 2} of ${arr.length}.`);
  }

  remove(id: string): void {
    if (this.saving()) return;
    const before = this.items();
    const removed = before.find(it => it.id === id);
    if (!removed) return;

    // ★★★ FOCUS AFTER A REMOVAL IS THE HALF EVERY LIST FORGETS. The button that
    //     had focus is about to leave the DOM, and the browser's answer is to
    //     drop focus on `<body>` — so the next Tab restarts at the top of the
    //     page and a keyboard user deleting three items has to travel back down
    //     the list three times. The index is captured BEFORE the removal,
    //     because afterwards there is nothing to compute it from.
    const removedAt = before.findIndex(it => it.id === id);
    const list = before.filter(it => it.id !== id);
    this._focusAfterRemoval(removedAt, list.length);
    this.items.set(list);
    this._editSeq++;
    this.itemRemoved.emit({
      item: removed,
      items: list,
      requestKey: svRequestKey('del'),
      rollback: this._edit.begin(() => this.items.set(before)),
    });
    this._announce(`${removed.label} removed. ${list.length} item${list.length === 1 ? '' : 's'} remaining.`);
  }

  /**
   * Where focus goes when the row holding it is deleted.
   *
   * ★ The row that TOOK its place, so a run of deletions keeps the pointer
   *   still and the next Delete is one keystroke away. Falling back to the
   *   previous row when the last item went, because there is no successor — and
   *   to the list itself when nothing is left, since focusing a removed row's
   *   neighbour is impossible and `<body>` is the outcome being avoided.
   */
  private _focusAfterRemoval(removedAt: number, remaining: number): void {
    if (typeof document === 'undefined') return;
    const target = remaining === 0 ? -1 : Math.min(removedAt, remaining - 1);
    // After the signal write and the render that follows it.
    queueMicrotask(() => {
      const root = this.host.nativeElement;
      if (target < 0) {
        // ★ When the last row goes there is no successor AND no list left to
        //   fall back to — the empty state replaces it. The host itself is the
        //   only element guaranteed to still be there, so it carries
        //   `tabindex="-1"` to be a target without becoming a tab stop.
        const list = root.querySelector<HTMLElement>('[data-dnd-list]');
        (list ?? root).focus({ preventScroll: true });
        return;
      }
      const rows = root.querySelectorAll<HTMLElement>('[data-dnd-remove]');
      rows[target]?.focus({ preventScroll: true });
    });
  }

  toggleComplete(id: string): void {
    if (this.saving()) return;
    const before = this.items();
    const found = before.find(it => it.id === id);
    if (!found) return;

    const item: DndItem = { ...found, completed: !found.completed };
    this._patch(before, item);
    this._announce(`${item.label} marked ${item.completed ? 'complete' : 'incomplete'}.`);
  }

  // ── Kanban helpers ────────────────────────────────────────────────────────

  readonly kanbanCols = ['todo', 'in-progress', 'done'] as const;

  /**
   * `items()` on its way to the template, with a dev-mode duplicate-key check.
   *
   * `DndItem.id` is required by the type but cannot be required to be UNIQUE, and
   * a reorder list is the worst place for a collision: `track item.id` meets the
   * repeat with NG0955 and empties the list, and the drop handlers address rows by
   * id, so a duplicate would move the wrong one. In production this is a
   * passthrough.
   */
  readonly renderItems = computed<DndItem[]>(() => {
    const items = this.items();
    warnOnDuplicateItemKeys(items, 'id', 'sv-dnd-list [items]');
    return items;
  });

  kanbanItems(col: string): DndItem[] {
    return this.renderItems().filter(it => it.column === col);
  }

  readonly colLabels: Record<string, string> = {
    'todo':        'To Do',
    'in-progress': 'In Progress',
    'done':        'Done',
  };

  readonly colColors: Record<string, string> = {
    'todo':        'bg-gray-400',
    'in-progress': 'bg-warning-400',
    'done':        'bg-accent-400',
  };

  moveToCol(id: string, col: DndItem['column']): void {
    if (this.saving()) return;
    const before = this.items();
    const found = before.find(it => it.id === id);
    if (!found) return;

    this._patch(before, { ...found, column: col, completed: col === 'done' });
  }

  /** Apply one row's new fields, report the change, and hand back the way out. */
  private _patch(before: DndItem[], item: DndItem): void {
    const list = before.map(it => (it.id === item.id ? item : it));
    this.items.set(list);
    this._editSeq++;
    this.itemChanged.emit({
      item,
      items: list,
      requestKey: svRequestKey('patch'),
      rollback: this._edit.begin(() => this.items.set(before)),
    });
  }

  // ── Styling helpers ───────────────────────────────────────────────────────

  readonly priorityDot: Record<string, string> = {
    critical: 'bg-danger-600',
    high:     'bg-orange-400',
    medium:   'bg-warning-400',
    low:      'bg-accent-400',
  };

  readonly priorityBadge: Record<string, string> = {
    critical: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
    high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    medium:   'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
    low:      'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
  };

  /**
   * The surface of a card, and how a COMPLETED one recedes.
   *
   * ★★ NOT `opacity-60`, WHICH IS WHAT THIS USED TO BE. Fading a card composites
   *    its text and its fill toward the page together, so every colour inside
   *    collapses at once: on a completed row axe measured the priority chip at
   *    2.35:1, the tag chip at 2.70:1 and the assignee initials at 3.42:1 — all
   *    three of which pass at full opacity (4.52, 6.87, 6.42). No opacity value
   *    rescues them either, because the chip is a 4.52 hairline pass to begin
   *    with. Done has to recede by SURFACE, not by transparency.
   *
   * ★  Both arms are spelled out instead of layering a second `bg-*` over the
   *    base one. Two utilities setting the same property are resolved by
   *    stylesheet order, not by the order they appear in the attribute — which
   *    is exactly how `[class.text-gray-400]` on the completed label came to be
   *    dead code: `text-gray-800` sits later in Tailwind's output and won every
   *    time, so the label never dimmed and `opacity-60` was doing all the work.
   *    See `labelTone`.
   */
  cardSurface(item: DndItem): string {
    return item.completed
      ? 'bg-gray-50 dark:bg-gray-800/60'
      : 'bg-white dark:bg-gray-800';
  }

  /** The label colour, strike included — see `cardSurface` for why it is a pair. */
  labelTone(item: DndItem): string {
    return item.completed
      ? 'line-through text-gray-500 dark:text-gray-400'
      : 'text-gray-800 dark:text-gray-200';
  }

  /**
   * Whether the due date has passed.
   *
   * ★ A date-only `dueDate` ('2026-06-25') means "by the end of that calendar
   * day, where the reader is". `new Date('2026-06-25')` is UTC midnight per
   * spec, so west of UTC it lands on the 24th — and the template renders the
   * same string through Angular's `DatePipe`, which DOES parse a date-only ISO
   * string as a local calendar date. Flag and label therefore disagreed: at
   * UTC−09:30 the row turned red at 14:30 on the 24th while still showing
   * "Jun 25", and stayed red for the whole of the day it was actually due.
   *
   * A value that carries a time is left alone — that one really is an instant.
   */
  isDue(dueDate?: string): boolean {
    if (!dueDate) return false;
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate.trim());
    const due = dateOnly
      ? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3], 23, 59, 59, 999)
      : new Date(dueDate);
    return due < new Date();
  }

  readonly completedCount = computed(() => this.items().filter(i => i.completed).length);
  readonly totalCount     = computed(() => this.items().length);
  readonly progressPct    = computed(() => this.totalCount() > 0
    ? Math.round((this.completedCount() / this.totalCount()) * 100)
    : 0
  );
}
