<!-- Copied from docs/pci-scope.md by scripts/generate-readmes.mjs — edit that file, not this copy. -->

# Card numbers, PCI scope, and session replay

**Applies to:** `sv-input-mask` with `preset="credit-card"`, `sv-credit-card`
(display-only — feed it a token's `last4` + `brand`, never a PAN; collect card
data with your PSP's hosted fields), and any masked field carrying something
regulated.

---

## 1. A masked field is not a compliant field

`sv-input-mask` formats a card number as it is typed. That is a usability
feature and nothing more. It does not encrypt, tokenise, or shield anything:
the digits are in a DOM node on your page, readable by every script you have
loaded.

**What that costs you is a change of questionnaire.**

- **SAQ-A** applies when the merchant's page never touches the PAN — the number
  is entered into an iframe or a hosted field served by the payment processor,
  and the merchant's own JavaScript cannot read it.
- **SAQ-A-EP** applies when a script on the merchant's page can affect or read
  the payment form. That is a longer questionnaire, and its scope pulls in every
  other script on that page: your analytics, your tag manager, your chat widget,
  your A/B testing tool.

`<sv-input-mask preset="credit-card">` is a script on your page that reads the
digits. Using it is a legitimate choice — plenty of merchants have reasons — but
it is a choice with a consequence, and the consequence should not be discovered
from an assessor.

**If you do not need to hold the PAN, do not.** Every major processor ships
hosted fields precisely so you can stay in SAQ-A, and no amount of care in this
component gets you back there.

---

## 2. Session replay is the leak nobody plans for

★★★ **This is the part that catches people who have thought about everything
else.**

FullStory, Hotjar, Datadog RUM, Microsoft Clarity, Smartlook and LogRocket work
by recording the DOM and shipping it to a third party. They read input values
like any other attribute. A field that is "masked" is masked **to the eye** — the
recorder sees `4242424242424242` exactly as it sees anything else.

So the sequence is:

1. You add a card field to your checkout.
2. Your growth team has had a replay tool on the site for a year.
3. Every PAN typed into your checkout is now in a third-party vendor's storage,
   in clear text, for whatever their retention period is.

Nobody made a decision here. Nobody is in a position to notice.

### What this component does about it

For a sensitive preset (`credit-card`, `ssn`) or `sensitivity="sensitive"`, the
input carries every opt-out the major recorders honour:

| Attribute / class | Tool |
| --- | --- |
| `data-private` | LogRocket |
| `data-dd-privacy="mask"` | Datadog RUM |
| `data-hj-suppress` | Hotjar |
| `data-clarity-mask="true"` | Microsoft Clarity |
| `data-sl="mask"` | Smartlook |
| `class="fs-mask fs-exclude"` | FullStory |
| `data-recording-sensitive` | generic |

One per vendor, because there is no standard and each tool reads only its own.
They are inert when the tool is absent.

⚠️ **This is a best effort, not a guarantee.** It covers recorders that honour an
opt-out. It says nothing about a script you chose to load that does not, and it
is not a substitute for keeping the PAN off the page.

### `autocomplete="off"` is a request, not a control

Browsers largely ignore `autocomplete="off"` on card fields — the password
manager and the browser's own card store are trying to help the user, and they
are mostly right to. The component still sets it on sensitive presets, because
it is the correct instruction, and it is precisely *because* it is unreliable
that the attributes above are not optional.

On ordinary presets the component now sets a **useful** token (`tel`,
`postal-code`) rather than a blanket `off`, which denied a real convenience and
was being ignored anyway.

---

## 3. Who holds the unmasked value

A policy document answers this badly. Making the redacted form the easier thing
to reach for answers it well.

- **`maskedValue()`** — `•••• •••• •••• 4242`. Separators kept, so the shape
  still reads as what it is.
- **`last4()`** — `'4242'`.

A confirmation screen, a log line, an analytics event, a support ticket and a
receipt all want "the card ending 4242". Every one of them is somewhere a full
PAN ends up when the only value on offer is the full PAN.

⚠️ Both redact **everything** when the value has fewer than five digits. Four
digits of a four-digit value is not a redaction, and "show the last four"
applied blindly to a short value publishes it whole.

### Rules for the value you do hold

- **Never log it.** Not to `console`, not to an error reporter, not into a
  breadcrumb. Error reporters serialise form state more often than people
  expect.
- **Never put it in a URL**, a query string, or a `fetch` you can't see the
  destination of. URLs end up in server logs, referrer headers and browser
  history.
- **Never persist it** in `localStorage`, `sessionStorage`, IndexedDB or a
  cookie — including as part of an auto-saved draft of the form.
- **Send it once, to your processor, over TLS**, and keep nothing.
- **Do not put it in the form value you pass to a generic "save draft"
  mechanism.** This is the most common accidental persistence, because the draft
  code was written for a different form.

---

## 4. Checklist

- [ ] You have decided, on purpose, that SAQ-A-EP is acceptable — or you are
      using the processor's hosted fields instead.
- [ ] Every session-replay, analytics and error-reporting script on the checkout
      page is accounted for.
- [ ] Nothing logs, persists, or transmits the value except the one call to the
      processor.
- [ ] Confirmation screens, receipts and support tooling use `maskedValue()` or
      `last4()`.
- [ ] Your form's draft/autosave mechanism, if any, skips this field.
