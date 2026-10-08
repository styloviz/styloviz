/**
 * Country address schemas.
 *
 * ★ THE FORM USED TO ASSUME EVERY ADDRESS HAS A STATE AND A POSTAL CODE, AND
 *   THAT BOTH ARE REQUIRED. That is true in the United States and wrong in most
 *   of the world:
 *
 *   - The United Kingdom and Ireland have a county, and it is OPTIONAL.
 *   - Germany and France have no state field in a postal address AT ALL, and
 *     the postal code comes BEFORE the city ("10115 Berlin").
 *   - Hong Kong and the United Arab Emirates have NO POSTAL CODE.
 *   - Bangladesh and Ireland have one, and it is optional.
 *   - Japan puts the postal code first, then the prefecture.
 *
 *   A required field a country does not have is not a cosmetic problem: it makes
 *   the form unsubmittable for a real address, and the only way past it is to
 *   invent data. So the field list, its labels, its order and its required-ness
 *   are all data, and the form renders whatever it is given.
 */

import type { Address } from './address-card.component';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The `Address` keys a schema can place. `country` and `isDefault` are not here:
 * the country selector is what chooses the schema, and the default toggle is not
 * part of the address.
 */
export type AddressFieldName =
  | 'label'
  | 'firstName'
  | 'lastName'
  | 'line1'
  | 'line2'
  | 'city'
  | 'state'
  | 'postalCode'
  | 'phone';

export interface AddressFieldSchema {
  readonly name: AddressFieldName;
  /** Visible label. "State", "Province", "County", "Prefecture", "Emirate"… */
  readonly label: string;
  readonly required: boolean;
  /** The WHATWG autofill token, so a browser fills the right box. */
  readonly autocomplete: string;
  readonly placeholder?: string;
  /** `numeric` for an all-digit postal code, so a phone shows a number pad. */
  readonly inputMode?: 'text' | 'numeric';
  /**
   * A closed subdivision list. Where the set is short and fixed, free text
   * produces "NSW", "N.S.W." and "New South Wales " for the same place.
   */
  readonly options?: readonly string[];
  /** Half-width fields pair up on a two-column grid. @default 'full' */
  readonly width?: 'full' | 'half';
}

export interface AddressSchema {
  /** ISO 3166-1 alpha-2. */
  readonly code: string;
  /** Display name, and the value stored in `Address.country`. */
  readonly name: string;
  /** Ordered. A German form is postal-then-city; an American one is not. */
  readonly fields: readonly AddressFieldSchema[];
}

// ─── Shared field definitions ─────────────────────────────────────────────────

const LABEL: AddressFieldSchema = {
  name: 'label', label: 'Label', required: false,
  autocomplete: 'off', placeholder: 'Home, Work…',
};
const FIRST_NAME: AddressFieldSchema = {
  name: 'firstName', label: 'First name', required: true,
  autocomplete: 'given-name', width: 'half',
};
const LAST_NAME: AddressFieldSchema = {
  name: 'lastName', label: 'Last name', required: true,
  autocomplete: 'family-name', width: 'half',
};
const LINE1: AddressFieldSchema = {
  name: 'line1', label: 'Address', required: true,
  autocomplete: 'address-line1', placeholder: 'Street address',
};
const LINE2: AddressFieldSchema = {
  name: 'line2', label: 'Apartment, suite, etc.', required: false,
  autocomplete: 'address-line2',
};
const PHONE: AddressFieldSchema = {
  name: 'phone', label: 'Phone', required: false, autocomplete: 'tel',
};

const city = (label: string, required = true): AddressFieldSchema => ({
  name: 'city', label, required, autocomplete: 'address-level2', width: 'half',
});

const region = (
  label: string,
  required: boolean,
  options?: readonly string[],
): AddressFieldSchema => ({
  name: 'state', label, required, autocomplete: 'address-level1',
  width: 'half', options,
});

const postal = (
  label: string,
  required: boolean,
  inputMode: 'text' | 'numeric' = 'text',
): AddressFieldSchema => ({
  name: 'postalCode', label, required,
  autocomplete: 'postal-code', width: 'half', inputMode,
});

const AU_STATES = [
  'Australian Capital Territory', 'New South Wales', 'Northern Territory',
  'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia',
] as const;

const CA_PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
  'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia',
  'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan',
  'Yukon',
] as const;

const head = [LABEL, FIRST_NAME, LAST_NAME, LINE1, LINE2] as const;

// ─── The built-in set ─────────────────────────────────────────────────────────

/**
 * Twelve countries, chosen to cover every shape the field list can take rather
 * than to be a complete world list: a required region, an optional one, no
 * region at all, a required postal code, an optional one, none at all, and two
 * different orderings. Pass your own to `schemas` for anything else — there are
 * ~250 of these and a UI kit shipping all of them would be a data package.
 */
export const DEFAULT_ADDRESS_SCHEMAS: readonly AddressSchema[] = [
  {
    code: 'US', name: 'United States',
    // Free text, not a 50-entry list: the point here is the label and the
    // required flag, and a host that wants the dropdown can pass one.
    fields: [...head, city('City'), region('State', true), postal('ZIP code', true, 'numeric'), PHONE],
  },
  {
    code: 'CA', name: 'Canada',
    fields: [...head, city('City'), region('Province', true, CA_PROVINCES), postal('Postal code', true), PHONE],
  },
  {
    // ★ The headline case. County is OPTIONAL here, and the old form demanded it.
    code: 'GB', name: 'United Kingdom',
    fields: [...head, city('Town or city'), region('County', false), postal('Postcode', true), PHONE],
  },
  {
    code: 'IE', name: 'Ireland',
    // Eircode is optional: plenty of Irish addresses are still delivered without one.
    fields: [...head, city('Town or city'), region('County', false), postal('Eircode', false), PHONE],
  },
  {
    code: 'AU', name: 'Australia',
    fields: [...head, city('Suburb'), region('State', true, AU_STATES), postal('Postcode', true, 'numeric'), PHONE],
  },
  {
    // No region field, and postal code first — "10115 Berlin", not "Berlin 10115".
    code: 'DE', name: 'Germany',
    fields: [...head, postal('Postal code', true, 'numeric'), city('City'), PHONE],
  },
  {
    code: 'FR', name: 'France',
    fields: [...head, postal('Postal code', true, 'numeric'), city('City'), PHONE],
  },
  {
    code: 'JP', name: 'Japan',
    fields: [...head, postal('Postal code', true), region('Prefecture', true), city('City or ward'), PHONE],
  },
  {
    code: 'IN', name: 'India',
    fields: [...head, city('City'), region('State', true), postal('PIN code', true, 'numeric'), PHONE],
  },
  {
    code: 'BD', name: 'Bangladesh',
    fields: [...head, city('City'), region('District', true), postal('Postal code', false, 'numeric'), PHONE],
  },
  {
    // ★ No postal code exists. The field is absent, not empty-and-optional.
    code: 'HK', name: 'Hong Kong',
    fields: [...head, region('District', true), city('Area', false), PHONE],
  },
  {
    code: 'AE', name: 'United Arab Emirates',
    fields: [...head, region('Emirate', true), city('Area', false), PHONE],
  },
];

/**
 * Used before a country has been chosen. Everything past the street is optional,
 * because until the country is known there is nothing to require it on — and a
 * "Required" on a field that may not exist in the country the user is about to
 * pick is a lie the form would have to take back.
 */
export const GENERIC_ADDRESS_SCHEMA: AddressSchema = {
  code: '',
  name: '',
  fields: [
    ...head,
    city('City', false),
    region('State / Province / Region', false),
    postal('Postal code', false),
    PHONE,
  ],
};

// ─── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Find the schema for a stored `Address.country`, by name or by ISO code.
 *
 * Both are accepted because `Address.country` holds whatever the host put
 * there: the select writes `schema.name`, but records that predate this form —
 * or arrive from an API — often carry `"GB"`. Matching is case-insensitive and
 * trimmed, so `"united kingdom"` resolves rather than silently falling back to
 * the generic schema and dropping the country's required fields.
 */
export function resolveAddressSchema(
  schemas: readonly AddressSchema[],
  country: string,
): AddressSchema | null {
  const needle = country.trim().toLowerCase();
  if (!needle) return null;
  return (
    schemas.find((s) => s.name.toLowerCase() === needle) ??
    schemas.find((s) => s.code.toLowerCase() === needle) ??
    null
  );
}

// ─── Verification ─────────────────────────────────────────────────────────────

/**
 * ★ `unavailable` IS WHY THIS IS AN ENUM AND NOT A BOOLEAN.
 *
 * "Verified" and "wrong" are not the only answers a verifier gives. It also
 * times out, rate-limits and 500s, and a form that treats a missing answer as a
 * failing one stops accepting perfectly good addresses the moment a third party
 * has a bad afternoon.
 *
 * Whichever of these is set, **submit stays enabled**. The state is advisory: it
 * tells the person what is known about the address, and the value rides along on
 * `save` so the host knows whether what it is storing was ever checked.
 */
export type AddressVerificationStatus =
  /** Not checked — the initial state, and the one a host that has no verifier stays in. */
  | 'unverified'
  /** A check is in flight. */
  | 'verifying'
  /** The verifier recognised the address as entered. */
  | 'verified'
  /** The verifier recognised it, differently. `suggestion` holds its version. */
  | 'corrected'
  /** ★ The verifier could not be reached, or did not answer in time. */
  | 'unavailable'
  /** The verifier ran and does not recognise the address. */
  | 'failed';

export interface AddressVerification {
  readonly status: AddressVerificationStatus;
  /** Shown as-is; supply the host's own wording, already translated. */
  readonly message?: string;
  /** For `corrected`: the verifier's version, offered as a one-press fill. */
  readonly suggestion?: Address;
}

export interface AddressSaveEvent {
  readonly address: Address;
  /**
   * What was known about the address at the moment it was submitted — including
   * `unavailable`, which is the difference between "we checked and it is fine"
   * and "we never managed to check".
   */
  readonly verification: AddressVerificationStatus;
}
