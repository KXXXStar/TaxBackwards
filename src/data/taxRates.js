// © 2026 TaxBackwards.ca. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-or-later

"use strict";

// Update LAST_VERIFIED whenever any provincial rate is changed and verified.
export const LAST_VERIFIED = "2026-05-23";

// Single source of truth for all Canadian provincial and territorial tax rates.
// Every province object must contain:
//   name, type, rate, fraction, editorialSummary, exemptionsNotice,
//   officialCraLink, active
// Quebec additionally carries separate gst and qst fields.
// GST+PST provinces additionally carry separate gst and pst fields.
// Never hardcode any tax rate outside this file.
// Never delete a province object — use active: false instead.
export const TAX_RATES = {
  ON: {
    name: "Ontario",
    type: "HST",
    rate: 0.13,
    fraction: 13 / 113,
    editorialSummary: "Ontario collects a 13% Harmonized Sales Tax (HST), a single combined federal and provincial tax administered by the Canada Revenue Agency.",
    exemptionsNotice: "Basic groceries, prescription drugs, and certain medical devices are zero-rated. Some financial services and insurance are also exempt.",
    officialCraLink: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html",
    active: true
  },
  QC: {
    name: "Quebec",
    type: "GST+QST",
    rate: 0.14975,
    gst: 0.05,
    qst: 0.09975,
    fraction: 14975 / 114975,
    editorialSummary: "Quebec collects the 5% federal GST and the 9.975% Quebec Sales Tax (QST). Both taxes apply directly to the same net consideration base. QST is administered by Revenu Québec, not the CRA.",
    exemptionsNotice: "Basic groceries, prescription drugs, and certain medical devices are generally exempt from both GST and QST. Some financial services carry partial exemptions.",
    officialCraLink: "https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/",
    active: true
  },
  NS: {
    name: "Nova Scotia",
    type: "HST",
    rate: 0.15,
    fraction: 15 / 115,
    editorialSummary: "Nova Scotia collects a 15% Harmonized Sales Tax (HST), a single combined federal and provincial tax administered by the Canada Revenue Agency.",
    exemptionsNotice: "Basic groceries, prescription drugs, and children's clothing are among the items exempt from HST in Nova Scotia.",
    officialCraLink: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html",
    active: true
  },
  NB: {
    name: "New Brunswick",
    type: "HST",
    rate: 0.15,
    fraction: 15 / 115,
    editorialSummary: "New Brunswick collects a 15% Harmonized Sales Tax (HST), a single combined federal and provincial tax administered by the Canada Revenue Agency.",
    exemptionsNotice: "Basic groceries, prescription drugs, and certain medical devices are zero-rated. Some financial services and insurance are also exempt.",
    officialCraLink: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html",
    active: false
  },
  PE: {
    name: "Prince Edward Island",
    type: "HST",
    rate: 0.15,
    fraction: 15 / 115,
    editorialSummary: "Prince Edward Island collects a 15% Harmonized Sales Tax (HST), a single combined federal and provincial tax administered by the Canada Revenue Agency.",
    exemptionsNotice: "Basic groceries, prescription drugs, and certain medical devices are zero-rated under HST rules.",
    officialCraLink: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html",
    active: false
  },
  NL: {
    name: "Newfoundland and Labrador",
    type: "HST",
    rate: 0.15,
    fraction: 15 / 115,
    editorialSummary: "Newfoundland and Labrador collects a 15% Harmonized Sales Tax (HST), a single combined federal and provincial tax administered by the Canada Revenue Agency.",
    exemptionsNotice: "Basic groceries, prescription drugs, and certain medical devices are zero-rated under HST rules.",
    officialCraLink: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html",
    active: false
  },
  BC: {
    name: "British Columbia",
    type: "GST+PST",
    rate: 0.12,
    gst: 0.05,
    pst: 0.07,
    fraction: 12 / 112,
    editorialSummary: "British Columbia applies the 5% federal GST alongside a 7% Provincial Sales Tax (PST). Both taxes apply to the pre-tax base.",
    exemptionsNotice: "Basic groceries and prescription drugs are generally exempt from PST. Consult the BC government website for the full exemption schedule.",
    officialCraLink: "https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst",
    active: true
  },
  AB: {
    name: "Alberta",
    type: "GST",
    rate: 0.05,
    fraction: 5 / 105,
    editorialSummary: "Alberta has no provincial sales tax. Only the 5% federal GST applies, making it the lowest-tax jurisdiction for most consumer purchases in Canada.",
    exemptionsNotice: "Basic groceries, prescription drugs, and certain medical devices are zero-rated under federal GST rules.",
    officialCraLink: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html",
    active: true
  },
  SK: {
    name: "Saskatchewan",
    type: "GST+PST",
    rate: 0.11,
    gst: 0.05,
    pst: 0.06,
    fraction: 11 / 111,
    editorialSummary: "Saskatchewan applies the 5% federal GST and a 6% Provincial Sales Tax (PST). Both taxes apply to the pre-tax base.",
    exemptionsNotice: "Basic groceries are exempt from federal GST. PST exemptions vary. Consult Saskatchewan Finance for the full schedule.",
    officialCraLink: "https://www.saskatchewan.ca/business/taxes-licensing-and-reporting/provincial-taxes-policies-and-bulletins/provincial-sales-tax",
    active: false
  },
  MB: {
    name: "Manitoba",
    type: "GST+PST",
    rate: 0.12,
    gst: 0.05,
    pst: 0.07,
    fraction: 12 / 112,
    editorialSummary: "Manitoba applies the 5% federal GST alongside a 7% Retail Sales Tax (RST), commonly referred to as PST. Both taxes apply to the pre-tax base.",
    exemptionsNotice: "Basic groceries and prescription drugs are exempt from RST. Other exemptions apply for specific goods and services.",
    officialCraLink: "https://www.gov.mb.ca/finance/taxation/taxes/retail.html",
    active: false
  },
  YT: {
    name: "Yukon",
    type: "GST",
    rate: 0.05,
    fraction: 5 / 105,
    editorialSummary: "Yukon levies no territorial sales tax. Only the 5% federal GST applies.",
    exemptionsNotice: "Basic groceries, prescription drugs, and certain medical devices are zero-rated under federal GST rules.",
    officialCraLink: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html",
    active: false
  },
  NT: {
    name: "Northwest Territories",
    type: "GST",
    rate: 0.05,
    fraction: 5 / 105,
    editorialSummary: "The Northwest Territories levies no territorial sales tax. Only the 5% federal GST applies.",
    exemptionsNotice: "Basic groceries, prescription drugs, and certain medical devices are zero-rated under federal GST rules.",
    officialCraLink: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html",
    active: false
  },
  NU: {
    name: "Nunavut",
    type: "GST",
    rate: 0.05,
    fraction: 5 / 105,
    editorialSummary: "Nunavut levies no territorial sales tax. Only the 5% federal GST applies.",
    exemptionsNotice: "Basic groceries, prescription drugs, and certain medical devices are zero-rated under federal GST rules.",
    officialCraLink: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html",
    active: false
  }
};

// Display order for the province selector.
// Active provinces appear first; inactive provinces follow with "Coming Soon" label.
export const PROVINCE_ORDER = [
  "ON", "QC",
  "NS", "NB", "PE", "NL",
  "BC", "AB", "SK", "MB",
  "YT", "NT", "NU"
];
