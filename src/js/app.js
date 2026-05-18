// © 2026 TaxBackwards.ca. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-or-later

"use strict";

import { TAX_RATES, PROVINCE_ORDER } from "../data/taxRates.js";

// ---------------------------------------------------------------------------
// Calculation engine — pure functions, no DOM access, fully unit-testable
// ---------------------------------------------------------------------------

/**
 * Reverse-calculate the pre-tax base and individual tax amounts from a gross total.
 *
 * All arithmetic uses integer scaling (Math.round(value * 10000)) to eliminate
 * floating-point corruption of currency values. Division is performed once to
 * find the pre-tax base; all remaining operations are integer subtraction or
 * scaled multiplication. Results are divided back to decimal only at return time.
 *
 * @param {number} totalDollars  Gross transaction amount (e.g. 113.00)
 * @param {string} provinceKey   Two-letter province key matching a TAX_RATES entry
 * @returns {{ pretax: number, tax1: number, tax2: number, total: number, province: string }}
 */
export function calculateReverseTax(totalDollars, provinceKey) {
  const province = TAX_RATES[provinceKey];
  const totalScaled = Math.round(totalDollars * 10000);

  let pretaxScaled, tax1Scaled, tax2Scaled;

  if (province.type === "GST+QST") {
    // Quebec: both GST and QST are levied directly on the net consideration base.
    // pretax = total / (1 + gst + qst), then each tax is pretax × its own rate.
    pretaxScaled = Math.round(totalScaled / (1 + province.gst + province.qst));
    tax1Scaled   = Math.round(pretaxScaled * province.gst);
    tax2Scaled   = Math.round(pretaxScaled * province.qst);
  } else if (province.type === "GST+PST") {
    // BC / SK / MB: PST is also levied on the pre-tax base, same math as QST.
    pretaxScaled = Math.round(totalScaled / (1 + province.gst + province.pst));
    tax1Scaled   = Math.round(pretaxScaled * province.gst);
    tax2Scaled   = Math.round(pretaxScaled * province.pst);
  } else {
    // HST provinces (ON, NB, NS, PE, NL) and GST-only jurisdictions (AB, NT, NU, YT):
    // single combined rate — tax is derived by subtraction to preserve integer identity.
    pretaxScaled = Math.round(totalScaled / (1 + province.rate));
    tax1Scaled   = totalScaled - pretaxScaled;
    tax2Scaled   = 0;
  }

  return {
    pretax:  pretaxScaled / 10000,
    tax1:    tax1Scaled   / 10000,
    tax2:    tax2Scaled   / 10000,
    total:   totalDollars,
    province: provinceKey
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a numeric currency value according to the locale rules for the
 * selected province.
 *
 * Quebec (QC): French-Canadian locale with trailing $ separated by a
 * non-breaking space (e.g. "100,00\u00A0$").
 * All other provinces: English-Canadian locale with leading $ (e.g. "$100.00").
 *
 * @param {number} value        The numeric value to format
 * @param {string} provinceKey  Province key used to select locale rules
 * @returns {string}
 */
function formatCurrency(value, provinceKey) {
  if (provinceKey === "QC") {
    return (
      value.toLocaleString("fr-CA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + "\u00A0$"
    );
  }
  return (
    "$" +
    value.toLocaleString("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );
}

/**
 * Return the label for the primary tax row based on province type.
 * HST provinces show "HST Removed"; all others show "GST Removed".
 *
 * @param {string} provinceKey
 * @returns {string}
 */
function getTax1Label(provinceKey) {
  if (TAX_RATES[provinceKey].type === "HST") {
    return "HST Removed (ITC Eligible)";
  }
  return "GST Removed (ITC Eligible)";
}

/**
 * Return the label for the secondary tax row, or an empty string for
 * single-rate provinces.
 *
 * @param {string} provinceKey
 * @returns {string}
 */
function getTax2Label(provinceKey) {
  const type = TAX_RATES[provinceKey].type;
  if (type === "GST+QST") return "QST Removed (ITC Eligible)";
  if (type === "GST+PST") return "PST Removed (ITC Eligible)";
  return "";
}

// ---------------------------------------------------------------------------
// UI — province selector
// ---------------------------------------------------------------------------

/**
 * Populate the <select id="province-select"> element from PROVINCE_ORDER.
 * Uses createElement — never innerHTML — to prevent XSS.
 */
export function populateProvinceSelector() {
  const select = document.getElementById("province-select");
  PROVINCE_ORDER.forEach(function (key) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = TAX_RATES[key].name;
    select.appendChild(option);
  });
}

// ---------------------------------------------------------------------------
// UI — results rendering
// ---------------------------------------------------------------------------

/**
 * Write calculation results to the results section of the DOM.
 * Uses textContent only — never innerHTML — to prevent XSS.
 * Hides the secondary tax row for single-rate provinces (e.g. Ontario HST).
 *
 * @param {{ pretax: number, tax1: number, tax2: number, total: number, province: string }} result
 */
export function renderResults(result) {
  const provinceKey = result.province;
  const province = TAX_RATES[provinceKey];
  const fmt = function (v) { return formatCurrency(v, provinceKey); };
  const hasTax2 = province.type === "GST+QST" || province.type === "GST+PST";

  document.getElementById("result-pretax").textContent = fmt(result.pretax);
  document.getElementById("result-tax1").textContent   = fmt(result.tax1);
  document.getElementById("result-tax1-label").textContent = getTax1Label(provinceKey);

  const tax2Row = document.getElementById("result-tax2-row");
  if (hasTax2) {
    tax2Row.hidden = false;
    document.getElementById("result-tax2").textContent       = fmt(result.tax2);
    document.getElementById("result-tax2-label").textContent = getTax2Label(provinceKey);
  } else {
    tax2Row.hidden = true;
  }

  document.getElementById("result-total").textContent = fmt(result.total);
}

// ---------------------------------------------------------------------------
// UI — input error state
// ---------------------------------------------------------------------------

/**
 * Mark an input as invalid: set aria-invalid, add .input-error class, and
 * write the error message to the associated #inputId-error element.
 *
 * @param {string} inputId  The id attribute of the target input element
 * @param {string} message  Human-readable error message
 */
export function setInputError(inputId, message) {
  const input = document.getElementById(inputId);
  input.setAttribute("aria-invalid", "true");
  input.classList.add("input-error");
  const errorEl = document.getElementById(inputId + "-error");
  if (errorEl) {
    errorEl.textContent = message;
  }
}

/**
 * Clear any existing error state from an input field.
 *
 * @param {string} inputId  The id attribute of the target input element
 */
function clearInputError(inputId) {
  const input = document.getElementById(inputId);
  input.removeAttribute("aria-invalid");
  input.classList.remove("input-error");
  const errorEl = document.getElementById(inputId + "-error");
  if (errorEl) {
    errorEl.textContent = "";
  }
}

// ---------------------------------------------------------------------------
// UI — event handlers
// ---------------------------------------------------------------------------

/**
 * Validate the price input, run the reverse-tax calculation, and render
 * results. Attaches to both the Calculate button click and Enter keydown.
 *
 * Inputs are cast to Number() immediately and validated before any DOM write
 * or calculation proceeds, per security rules.
 *
 * @param {Event} e
 */
export function handleCalculate(e) {
  e.preventDefault();
  clearInputError("price-input");

  const rawInput    = document.getElementById("price-input").value.trim();
  const totalDollars = Number(rawInput);

  if (!rawInput || isNaN(totalDollars) || !isFinite(totalDollars) || totalDollars <= 0) {
    setInputError("price-input", "Please enter a valid amount greater than zero.");
    return;
  }

  const provinceKey = document.getElementById("province-select").value;
  const result      = calculateReverseTax(totalDollars, provinceKey);

  renderResults(result);

  const resultsSection = document.getElementById("results-section");
  if (resultsSection) {
    resultsSection.hidden = false;
  }
}

/**
 * Reset the price input and hide the results section.
 * Clears any active input error state.
 */
export function handleClear() {
  document.getElementById("price-input").value = "";
  clearInputError("price-input");
  const resultsSection = document.getElementById("results-section");
  if (resultsSection) {
    resultsSection.hidden = true;
  }
}

/**
 * On blur, reformat the price input to two decimal places if the current
 * value is a valid positive number.
 */
function handlePriceBlur() {
  const input = document.getElementById("price-input");
  const value = Number(input.value);
  if (input.value.trim() && isFinite(value) && !isNaN(value) && value > 0) {
    input.value = value.toFixed(2);
  }
}

/**
 * Allow Enter to trigger the calculation from the price input field.
 *
 * @param {KeyboardEvent} e
 */
function handlePriceKeydown(e) {
  if (e.key === "Enter") {
    handleCalculate(e);
  }
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Wire all event listeners and populate the province selector.
 * Called on DOMContentLoaded.
 */
export function init() {
  populateProvinceSelector();

  const calculateBtn = document.getElementById("calculate-btn");
  if (calculateBtn) {
    calculateBtn.addEventListener("click", handleCalculate);
  }

  const clearBtn = document.getElementById("clear-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", handleClear);
  }

  const priceInput = document.getElementById("price-input");
  if (priceInput) {
    priceInput.addEventListener("blur", handlePriceBlur);
    priceInput.addEventListener("keydown", handlePriceKeydown);
  }
}

// Guard against import in a Node.js test environment where document is undefined.
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}
