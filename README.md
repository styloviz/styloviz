# Styloviz

Angular and Tailwind CSS 4 components for dashboards, admin panels and internal tools. This repository is the source of the **free tier**: 108 components in 54 packages, MIT-licensed, published to npm as `@styloviz/*`.

| | |
| --- | --- |
| Components in the kit | 189 (108 free here, the rest under a Pro license) |
| Free packages in this repo | 54 |
| Spec files in this repo | 737, run by CI on every push |
| App templates | 27 (3 free, in `templates/`) |
| Angular | >=21.0.0 <23.0.0 |
| Version | 2.0.0 |

```sh
npm i @styloviz/all
```

Then follow the setup at https://styloviz.dev/docs — Tailwind CSS 4 is a peer you install yourself.

## Working on this repo

```sh
npm ci
npm run build   # every package, in dependency order, into dist/
npm test        # the unit and component specs
```

Docs, a live gallery of every component and the Pro tier: https://styloviz.dev

This repository is generated from the main Styloviz repository on each release. Issues and pull requests are welcome; see CONTRIBUTING.md. Questions go to the [community Discussions](https://github.com/styloviz/community/discussions).
