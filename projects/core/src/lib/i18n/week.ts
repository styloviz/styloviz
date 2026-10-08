/**
 * Which day the week starts on, and what the columns are called.
 *
 * ── The defect this exists for (`FI-09-M2`) ─────────────────────────────────
 *
 * ★★★ THE CALENDAR STARTED ON MONDAY, FOR EVERYONE, AND SAID `'Mo'`. Both
 *     halves were constants: `WEEKDAYS = ['Mo', …, 'Su']` and a
 *     `mondayOffset` in the grid builder. So an American opening a date picker
 *     found the columns shifted by one from every other calendar on their
 *     machine, and an Arabic or Hebrew reader found them shifted by two and
 *     labelled in a language they were not using.
 *
 * ★★ A WEEK-START BUG IS NOT A COSMETIC ONE, WHICH IS WHY IT IS WORTH A FILE.
 *    A calendar is read by column position before it is read by number — that
 *    is what the grid is for — so a Sunday-first reader looking at a
 *    Monday-first grid picks the wrong date, confidently, and the component
 *    reports exactly what they clicked. Nothing is inconsistent; the user is
 *    just wrong about which day they chose.
 *
 * ★★ MEASURED FIRST DAYS: `en-US` Sunday, `en-GB` Monday, `de-DE` Monday,
 *    `ja-JP` Sunday, `he-IL` Sunday, `ar-EG` **Saturday**. Three different
 *    answers in six locales, so there is no majority to default to and no
 *    excuse for a constant.
 *
 * ⚠️ Nothing here is a table. `Intl.Locale.prototype.getWeekInfo()` is CLDR's
 *    own answer, and the labels come from `Intl.DateTimeFormat`.
 */

/**
 * The locale's first weekday as a JS `Date#getDay()` index — `0` is Sunday.
 *
 * @param locale BCP-47 tag. `''` returns `1` (Monday).
 *
 * ⚠️ `''` MEANS "KEEP MONDAY", NOT "ASK THE BROWSER". The calendars in this kit
 *    shipped Monday-first; defaulting to the runtime's locale would move every
 *    existing caller's columns on upgrade, which is a change a host should make
 *    on purpose rather than discover.
 *
 * ★ `getWeekInfo()` reports ISO numbering (Monday `1` … Sunday `7`) and this
 *   returns JS numbering (Sunday `0` … Saturday `6`). The conversion is `% 7`,
 *   and it is the single most likely place for this to be quietly wrong —
 *   Sunday is `7` in one scheme and `0` in the other, so an implementation that
 *   forgets it is correct for six days a week.
 */
export function svFirstDayOfWeek(locale: string): number {
  if (!locale) return 1;
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    // `getWeekInfo()` is the standardised form; `weekInfo` was the earlier
    // property and is still what some engines expose.
    const first = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    if (typeof first !== 'number' || first < 1 || first > 7) return 1;
    return first % 7;
  } catch {
    // An invalid tag is a developer mistake, not a user-facing failure.
    return 1;
  }
}

/**
 * The seven column headings, starting at `firstDay`, as the locale writes them.
 *
 * @param locale `''` keeps the kit's original two-letter English headings.
 * @param firstDay JS index, `0` = Sunday.
 *
 * ★★ THE REFERENCE WEEK IS BUILT IN UTC AND FORMATTED IN UTC — the same zone on
 *    both sides. Naming a weekday means picking a real date and asking what day
 *    it was, so mixing the two rotates the headings by one. There are two ways
 *    to mix them and they break in OPPOSITE hemispheres:
 *
 *      build LOCAL, format UTC → wrong EAST of Greenwich (local midnight
 *        2023-01-01 in Tokyo is 2022-12-31T15:00Z).
 *      build UTC, format LOCAL → wrong WEST of Greenwich (UTC midnight
 *        2023-01-01 in Marquesas is 2022-12-31 14:30 local).
 *
 * ⚠️ SO THE SUITE'S PINNED Pacific/Marquesas (−09:30) CATCHES ONLY THE SECOND.
 *    An implementation making the first mistake would be green there and broken
 *    for every user east of Greenwich. `week.spec.ts` therefore branches on the
 *    sign of the offset and asserts both mixes, rather than trusting the pin.
 */
export function svWeekdayLabels(
  locale: string,
  firstDay: number,
  width: 'narrow' | 'short' = 'short',
): string[] {
  const start = ((firstDay % 7) + 7) % 7;
  if (!locale) {
    const EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return Array.from({ length: 7 }, (_, i) => EN[(start + i) % 7]);
  }
  try {
    const format = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' });
    // 2023-01-01 was a Sunday, in UTC, which makes the offset arithmetic below
    // read as the weekday index it is.
    return Array.from({ length: 7 }, (_, i) =>
      format.format(new Date(Date.UTC(2023, 0, 1 + ((start + i) % 7)))),
    );
  } catch {
    const EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return Array.from({ length: 7 }, (_, i) => EN[(start + i) % 7]);
  }
}
