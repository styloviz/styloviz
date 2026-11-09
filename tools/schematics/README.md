# @styloviz/schematics

Angular schematics for the [Styloviz](https://styloviz.dev) Angular + Tailwind CSS 4
component kit.

## `ng add @styloviz/core`

Sets up an Angular app (21 or 22) to render Styloviz, in one command:

```sh
ng add @styloviz/core
```

- adds `@styloviz/core`, `@styloviz/icons`, `@styloviz/button` and Tailwind 4
  (`tailwindcss`, `@tailwindcss/postcss`, `postcss`), keeping any version you
  already have;
- creates `.postcssrc.json` for the Tailwind 4 PostCSS plugin, unless you have a
  PostCSS config;
- prepends `@import "tailwindcss"`, the kit stylesheet and an `@source` for the
  kit's templates to your global stylesheet;
- adds `provideStyloviz()` to `app.config.ts`;
- adds a demo page at `/styloviz` (pass `--demo=false` to skip it).

Running it again changes nothing. The same schematic is `ng add @styloviz/schematics`.

## `ng g @styloviz/schematics:migrate-primeng`

Moves a PrimeNG 21 app onto Styloviz, applying the selector map that
[styloviz.dev/primeng-alternative](https://styloviz.dev/primeng-alternative)
shows:

```sh
npm i -D @styloviz/schematics
ng g @styloviz/schematics:migrate-primeng            # the whole workspace
ng g @styloviz/schematics:migrate-primeng --path src/app/admin
```

- renames every mapped PrimeNG element (`<p-table>` → `<sv-data-table>`) in
  `.html` files and inline templates;
- in each component that now uses Styloviz, imports the Styloviz classes and
  removes the PrimeNG modules it no longer needs;
- adds the Styloviz packages now in use to `package.json`.

It does not translate inputs — PrimeNG's `[value]` on a table is Styloviz's
`[rows]` — so it lists every migrated selector with its docs page, and reports
everything it left alone: attribute directives such as `pTooltip`, and the
PrimeNG components Styloviz has no equivalent for, with the reason.

## `ng update`

Every Styloviz package names the whole kit as its `packageGroup`, so
`ng update @styloviz/core` moves every installed Styloviz package together and
runs the kit's migrations once:

- **2.0.0** — icons are registered per glyph. An upgraded app is opted into the
  full glyph set (`provideSvIcons(svAllIcons)`, plus `svAllProIcons` with the Pro
  icons), so every icon keeps rendering. Trim it to the glyphs you use
  afterwards.
- **2.0.0** — one pie family. `sv-default-pie-chart(-pro)` becomes
  `sv-pie-chart(-pro)` and `sv-donut-chart` becomes
  `sv-pie-chart-pro variant="donut"` (keeping its 1.x size), with the classes and
  the option and slice types renamed.
- **2.0.0** — the data table's phone layout is one input: `[cardOnMobile]="true"`
  becomes `responsive="cards"`. Each file that uses `sv-record-grid` is listed for
  you to fold into the table's `responsive="records"` by hand.

## License

MIT
