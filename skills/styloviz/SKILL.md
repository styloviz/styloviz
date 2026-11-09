---
name: styloviz
description: Build Angular UIs with the Styloviz component kit (Angular 21/22 + Tailwind CSS 4) — pick the right component, import it from the right package, wire icons, labels, theming and forms the way the kit expects. Use when the project depends on @styloviz/* or @styloviz-pro/*, or when asked to build a dashboard, table, form, chart or admin screen with Styloviz.
---

# Styloviz

Styloviz is a kit of standalone Angular components styled with Tailwind CSS 4.
Free packages are `@styloviz/<name>` (MIT, public npm); Pro packages are
`@styloviz-pro/<name>` (licensed). Docs: https://styloviz.dev/docs

## Look it up before you write it

If the `styloviz` MCP server is connected, **ask it first** — its answers come
from the kit's own docs at the installed version:

1. `search` with what you need ("data table grouping", "date range picker").
2. `get_component` for the exact inputs, outputs, types and defaults of what you
   picked. Do not guess an input name; the API is in the answer.
3. `find_variants` for a worked demo close to the task; `find_icons` and
   `get_tokens` for glyph names and theme tokens.

Without it: `npx -y @styloviz/mcp search "<question>"` gives the same answers in
a terminal. To connect it in Claude Code: `claude mcp add styloviz -- npx -y @styloviz/mcp`.

## Setup a project needs once

- Install the packages you use; `@styloviz/core` comes with them on npm (add it
  yourself on pnpm or yarn).
- Tailwind 4 must see the kit's classes and tokens. In the global stylesheet:

  ```css
  @import "tailwindcss";
  @import "@styloviz/core/styles/styloviz.css";
  @source "../node_modules/@styloviz";
  @source "../node_modules/@styloviz-pro";   /* Pro only */
  ```

- In `app.config.ts`: `provideStyloviz({ colorScheme: 'system' })`. Dark mode is
  the `dark` class on `<html>` (`ThemeService` toggles it).

## How components are used

- **Standalone only.** Import the component class into the `imports` of the
  component that uses it — there are no NgModules.
- **Icons are registered per glyph.** A component registers the glyphs it draws
  itself. A glyph name YOU pass in (a button's `icon`, a nav item's icon, a
  step's icon) you register: `providers: [provideSvIcons([bellIcon])]` with
  `import { bellIcon } from '@styloviz/icons/glyph/bell'` (Pro glyphs:
  `@styloviz-pro/icons/glyph/<name>`, `<name>ProIcon`). An unregistered name
  renders nothing and warns in development.
- **Forms.** Every form control is a ControlValueAccessor: use it with
  `formControlName`, `[(ngModel)]` or Signal Forms' `[formField]`.
- **Text is translatable.** Visible and accessible strings come from label
  packs: `provideSvLabels(SV_DATA_TABLE_LABELS_DE, …)` and
  `provideSvLocale('de-DE')`, 12 languages per package. Don't hard-code strings
  the component already labels.
- **Data components take async states** (`loading`, `error`, empty) and a stable
  row key (`rowKey`); pass them rather than hiding the component while loading.
- **Theme with tokens, not hex.** Use the kit's Tailwind tokens
  (`bg-primary-600`, `text-gray-700 dark:text-gray-300`); `get_tokens` lists them.

## Accessibility the kit expects you to keep

- Controls you draw under 24×24 px get the `sv-target` class (a 24 px hit area);
  wrap a small checkbox in `<label class="sv-target inline-flex">`.
- A sticky page header gets `data-sv-sticky="page-top"`; a scroller with sticky
  bands gets `svRevealFocus` (from `@styloviz/core`) and its bands
  `data-sv-sticky="top|bottom|start|end"`.
- Anything you make draggable needs a tap alternative (a button or menu) —
  keyboard alone does not meet WCAG 2.5.7.
