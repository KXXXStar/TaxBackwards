/**
 * TaxBackwards.ca — taxRates.js
 * Copyright (C) 2025 TaxBackwards.ca
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * MAINTENANCE: This is the ONLY file where tax rates may be defined.
 * Never hardcode rates in app.js, index.html, or any other file.
 * Update LAST_VERIFIED and effectiveDate whenever rates change.
 * Set up a Google Alert for "GST HST rate change" and "QST rate change"
 * as an early warning system.
 */

"use strict";

/**
 * ISO 8601 date this rate data was last verified against official sources.
 * Sources:
 *   - Canada Revenue Agency: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html
 *   - Revenu Québec: https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/basic-rules-for-applying-the-gsthst-and-qst/
 * @type {string}
 */
export const LAST_VERIFIED = "2025-05-17";

/**
 * Tax rate object shape (all provinces follow this structure):
 *
 * @typedef {Object} ProvinceRates
 * @property {string}   code            — ISO 3166-2 province code (e.g. "CA-ON")
 * @property {string}   name            — Display name for UI
 * @property {string}   locale          — BCP 47 locale tag for toLocaleString formatting
 * @property {string}   currencySymbol  — Symbol and position: "prefix" ($10.00) or "suffix" (10,00 $)
 * @property {string}   symbolPosition  — "prefix" | "suffix"
 * @property {number}   gst             — Federal GST rate as a decimal (e.g. 0.05 = 5%)
 * @property {number|null} pst          — Provincial Sales Tax rate as a decimal, null if not applicable
 * @property {number|null} hst          — Harmonized Sales Tax rate as a decimal, null if not applicable
 * @property {number|null} qst          — Quebec Sales Tax rate as a decimal, null if not applicable
 * @property {string}   federalTaxName  — How the federal component is labelled in this province's UI
 * @property {string|null} provincialTaxName — How the provincial component is labelled, null if none
 * @property {boolean}  qstOnGst        — true if provincial tax is applied on top of (price + GST), i.e. Quebec compound base
 * @property {string}   effectiveDate   — ISO 8601 date the current rates took effect
 * @property {string}   notes           — Human-readable audit note
 */

/**
 * Ontario
 *
 * Ontario uses HST (Harmonized Sales Tax) — a single combined federal/provincial
 * tax collected as one line item. There is no separate GST + PST in Ontario.
 * HST rate: 13% (5% federal component + 8% provincial component)
 *
 * Reverse calculation: pretaxAmount = totalPrice / (1 + hst)
 * Tax amount: taxAmount = totalPrice - pretaxAmount
 *
 * Integer scaling note: 13% = 0.13 exactly in IEEE 754 double. No rounding hazard
 * on the rate itself, but all intermediate math must still use Math.round(x * 10000)
 * to avoid accumulation errors.
 */
export const ON = {
  code: "CA-ON",
  name: "Ontario",
  locale: "en-CA",
  currencySymbol: "$",
  symbolPosition: "prefix",
  gst: 0.05,           // 5% federal component (informational — not used separately in ON)
  pst: null,           // Ontario has no standalone PST
  hst: 0.13,           // 13% HST = 5% GST + 8% PVAT, effective 2010-07-01
  qst: null,
  federalTaxName: "HST",
  provincialTaxName: null,
  qstOnGst: false,
  effectiveDate: "2010-07-01",
  notes: "Ontario HST has been 13% since harmonization on 2010-07-01. Source: CRA."
};

/**
 * Quebec
 *
 * Quebec uses a two-tax system:
 *   1. GST (federal): 5% applied to the pre-tax price
 *   2. QST (provincial): 9.975% applied to the pre-tax price
 *      IMPORTANT: QST is calculated on the pre-tax price ONLY, not on (price + GST).
 *      This changed on 2013-01-01 — before that date QST was compounded on top of GST.
 *      Post-2013 the effective combined rate is: 5% + 9.975% = 14.975%
 *
 * Reverse calculation:
 *   combinedRate = gst + qst = 0.05 + 0.09975 = 0.14975
 *   pretaxAmount = totalPrice / (1 + combinedRate)
 *   gstAmount    = pretaxAmount * gst
 *   qstAmount    = pretaxAmount * qst
 *
 * Integer scaling note: 9.975% = 0.09975 — this is NOT exactly representable in
 * IEEE 754 binary floating point. Always apply Math.round(x * 10000) before any
 * arithmetic involving this rate. The scaled integer for QST is 997.5 per $10,000,
 * which means you must work at the $0.01 (cent) level minimum. Rounding is to the
 * nearest cent ($0.005 rounds up) per CRA guidance.
 *
 * Quebec UI formatting:
 *   - Use toLocaleString('fr-CA') for all number formatting
 *   - Currency symbol ($) appears as a SUFFIX: "10,00 $" not "$10.00"
 *   - Decimal separator is a comma in fr-CA
 */
export const QC = {
  code: "CA-QC",
  name: "Quebec",
  locale: "fr-CA",
  currencySymbol: "$",
  symbolPosition: "suffix",
  gst: 0.05,           // 5% federal GST
  pst: null,
  hst: null,           // Quebec never harmonized — uses separate GST + QST
  // NOTE: 0.09975 is not exactly representable in IEEE 754. See scaling note above.
  qst: 0.09975,        // 9.975% QST, effective 2013-01-01 (non-compounding basis)
  federalTaxName: "GST / TPS",
  provincialTaxName: "QST / TVQ",
  qstOnGst: false,     // false = QST calculated on pre-tax price only (post-2013 rule)
  effectiveDate: "2013-01-01",
  notes: "QST 9.975% on pre-tax base since 2013-01-01. Pre-2013 compound method no longer applies. Source: Revenu Québec."
};

/**
 * Master province map — keyed by province code string.
 * app.js should import TAX_RATES and look up by key (e.g. TAX_RATES["ON"]).
 * Add new provinces here only — never create rate objects outside this file.
 *
 * @type {Object.<string, ProvinceRates>}
 */
export const TAX_RATES = {
  ON,
  QC
};

/**
 * Ordered array for UI province selector — controls display order in dropdowns.
 * Add entries here when new provinces are added to TAX_RATES.
 * @type {string[]}
 */
export const PROVINCE_ORDER = ["ON", "QC"];
