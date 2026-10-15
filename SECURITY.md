# Security policy

## Reporting a vulnerability

Email **support@styloviz.dev** with the subject "Security report". Please do not open a public issue or discussion for a vulnerability that is not yet fixed.

Include the package and its version, your Angular version, what an attacker can do, and the smallest code that shows it. Security reports are read ahead of the support queue. A confirmed issue is fixed in a patch release, credited to you if you wish, and recorded in CHANGELOG.md.

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x (latest: 1.0.2) | Yes — fixes ship as patch releases |
| Earlier | No — upgrade to the latest 1.x |

Angular >=21.0.0 <23.0.0 is supported.

## What the packages do and do not do

- No package declares a third-party runtime dependency.
- Only `@styloviz/data` can make a network request, and only to the URL or HttpClient your app gives it. No analytics, no telemetry, no update checks.
- No package loads a remote asset (fonts, images, scripts).
- No package bypasses Angular's HTML sanitizer.

The full statement, generated from the published packages, is at https://styloviz.dev/security.
