/**
 * The declaration a chart makes when it owns its own data.
 *
 * ★★ THIS EXISTS SO THAT "NO LOADING STATE" CAN BE A STATEMENT RATHER THAN A
 *    SILENCE. Every chart in the kit renders inside `sv-chart-frame`, which is
 *    what gives it `loading` / `error` / empty / filtered-empty. Two do not:
 *    `sv-click-add-point-chart` builds its series from the user's own clicks and
 *    `sv-live-sort-chart` generates its own, so there is no fetch to be in
 *    flight and no request that can fail. Wiring a spinner to either would be
 *    inventing a state that cannot occur.
 *
 *    That reading is defensible. Undocumented and untyped, it was
 *    indistinguishable from having forgotten — a buyer auditing the kit for
 *    async coverage found sixty-three charts that handle a failed load and two
 *    that appear not to, with nothing to say which kind of two. So the exemption
 *    is now declared on the class, and `scripts/check-chart-states.mjs` asserts
 *    that every chart component either frames its states or declares this. A
 *    chart that quietly drops `sv-chart-frame` fails the gate instead of
 *    joining an unmarked minority.
 *
 * Not an Angular input: a host cannot change where a chart's data comes from,
 * and the field is `readonly` for the same reason.
 */
export interface SvLocalStateChart {
  /**
   * Always `'local'`. The literal type is the point — a chart cannot satisfy
   * this interface by declaring the field mutable or widening it to `string`,
   * so the marker cannot be half-applied.
   */
  readonly chartDataOrigin: 'local';
}
