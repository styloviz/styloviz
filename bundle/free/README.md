# @styloviz/all

The entire **free** Styloviz UI Kit in one install — every free component plus `@styloviz/core`.

> Public npm, no license required. This bundle contains no code of its own; it just depends on every free package so you don't have to list them one by one.

## Install

```bash
npm install @styloviz/all
```

That single command installs `@styloviz/core` and every free `@styloviz/*` component. Import each component from its own package as usual:

```ts
import { SvButtonComponent } from '@styloviz/button';
import { SvDataTableComponent } from '@styloviz/data-table';
```

Prefer to install only what you use? Every component is also available individually, e.g. `npm install @styloviz/button`. Each package lists its own peer dependencies — most are self-contained; some (e.g. `@styloviz/charts`, `@styloviz/toast`, `@styloviz/layout`) also need `@styloviz/core`.

## Reproducible installs

The bundle pins each dependency to an **exact** version, so `@styloviz/all@1.0.2` always resolves to the same component versions — a fixed kit snapshot. For fully reproducible builds, pin the bundle version and commit your lockfile:

```bash
npm install @styloviz/all@1.0.2
```

## Upgrading to Pro

Pro is a superset. `@styloviz-pro/all` already depends on the whole free tier, so if you buy Pro you don't need `@styloviz/all` as well — a single `npm install @styloviz-pro/all` brings both tiers. See the [installation guide](https://styloviz.dev/docs) for the `.npmrc` token setup.
