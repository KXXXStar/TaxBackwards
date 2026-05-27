// ? 2026 TaxBackwards.ca. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-or-later

"use strict";

import { TAX_RATES, PROVINCE_ORDER, LAST_VERIFIED } from "../data/taxRates.js";

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

// Tracks whether Auditor Precision View Mode (4 decimals) is active.
let isAuditorMode = false;

// Holds the last successfully calculated result so copy buttons can access
// the raw numeric values without re-parsing formatted display strings.
let lastResult = null;

// ---------------------------------------------------------------------------
// Calculation engine ? pure functions, no DOM access, fully unit-testable
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
    // pretax = total / (1 + gst + qst), then each tax is pretax ? its own rate.
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
    // single combined rate ? tax derived by subtraction to preserve integer identity.
    pretaxScaled = Math.round(totalScaled / (1 + province.rate));
    tax1Scaled   = totalScaled - pretaxScaled;
    tax2Scaled   = 0;
  }

  return {
    pretax:   pretaxScaled / 10000,
    tax1:     tax1Scaled   / 10000,
    tax2:     tax2Scaled   / 10000,
    total:    totalDollars,
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
 * When Auditor Mode is active the caller passes decimals=4 for 4-decimal output.
 *
 * @param {number} value        The numeric value to format
 * @param {string} provinceKey  Province key used to select locale rules
 * @param {number} [decimals]   Decimal places (default 2; pass 4 for Auditor Mode)
 * @returns {string}
 */
function formatCurrency(value, provinceKey, decimals) {
  const dp = decimals || 2;
  if (provinceKey === "QC") {
    return (
      value.toLocaleString("fr-CA", {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp
      }) + "\u00A0$"
    );
  }
  return (
    "$" +
    value.toLocaleString("en-CA", {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp
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
 * BC PST is a consumer-level tax and is NOT recoverable as an ITC —
 * the label must reflect this accurately.
 *
 * @param {string} provinceKey
 * @returns {string}
 */
function getTax2Label(provinceKey) {
  const type = TAX_RATES[provinceKey].type;
  if (type === "GST+QST") return "QST Removed (ITC Eligible)";
  if (type === "GST+PST") return "PST Removed (NOT ITC Eligible)";
  return "";
}

// ---------------------------------------------------------------------------
// UI — math explainer (homepage)
// ---------------------------------------------------------------------------

/**
 * Format a decimal rate (e.g. 0.13) as a display percentage string.
 *
 * @param {number} rate
 * @returns {string}
 */
function formatRatePercent(rate) {
  const pct = rate * 100;
  return parseFloat(pct.toFixed(3)).toString() + "%";
}

/**
 * Format 1 + combinedRate as a divisor string (e.g. 1.14975).
 *
 * @param {number} combinedRate
 * @returns {string}
 */
function formatDivisor(combinedRate) {
  return parseFloat((1 + combinedRate).toFixed(5)).toString();
}

/**
 * Format a currency value for the math explainer (always en-CA, 2dp).
 *
 * @param {number} value
 * @returns {string}
 */
function formatExplainerMoney(value) {
  return "$" + value.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Return the provincial secondary-tax label for GST+PST provinces.
 * Manitoba uses RST; all others use PST.
 *
 * @param {string} provinceKey
 * @returns {string}
 */
function getProvincialTaxLabel(provinceKey) {
  return provinceKey === "MB" ? "RST" : "PST";
}

/**
 * Return the tax-type label used in the math explainer heading.
 *
 * @param {string} provinceKey
 * @returns {string}
 */
function getExplainerTaxTypeLabel(provinceKey) {
  const province = TAX_RATES[provinceKey];
  if (province.type === "HST") return "HST";
  if (province.type === "GST") return "GST";
  if (province.type === "GST+QST") return "GST + QST";
  if (province.type === "GST+PST") {
    return provinceKey === "MB" ? "GST + RST" : "GST + PST";
  }
  return "Sales Tax";
}

/**
 * Build a worked example anchored on a $100.00 net base using the same
 * calculation engine as the calculator.
 *
 * @param {string} provinceKey
 * @returns {{ gross: number, pretax: number, tax1: number, tax2: number }}
 */
function buildExplainerExample(provinceKey) {
  const province = TAX_RATES[provinceKey];
  const pretaxScaled = 1000000; // $100.00 net base
  let tax1Scaled;
  let tax2Scaled = 0;

  if (province.type === "GST+QST") {
    tax1Scaled = Math.round(pretaxScaled * province.gst);
    tax2Scaled = Math.round(pretaxScaled * province.qst);
  } else if (province.type === "GST+PST") {
    tax1Scaled = Math.round(pretaxScaled * province.gst);
    tax2Scaled = Math.round(pretaxScaled * province.pst);
  } else {
    tax1Scaled = Math.round(pretaxScaled * province.rate);
  }

  const grossScaled = pretaxScaled + tax1Scaled + tax2Scaled;

  return {
    gross: grossScaled / 10000,
    pretax: pretaxScaled / 10000,
    tax1: tax1Scaled / 10000,
    tax2: tax2Scaled / 10000
  };
}

/**
 * Update the homepage math explainer section for the selected province.
 * Called on page load and on every province selector change.
 *
 * @param {string} provinceKey
 */
function updateMathExplainer(provinceKey) {
  const province = TAX_RATES[provinceKey];
  if (!province) return;

  const headingEl = document.getElementById("math-explainer-heading");
  const introEl   = document.getElementById("math-explainer-intro");
  const formulaEl = document.getElementById("math-explainer-formula");
  const exampleEl = document.getElementById("math-explainer-example");

  if (!headingEl || !introEl || !formulaEl || !exampleEl) return;

  const example  = buildExplainerExample(provinceKey);
  const divisor  = formatDivisor(
    province.type === "GST+QST" ? province.gst + province.qst
      : province.type === "GST+PST" ? province.gst + province.pst
      : province.rate
  );

  headingEl.textContent = province.name + " \u2014 " + getExplainerTaxTypeLabel(provinceKey) + " Reverse Calculation";

  if (province.type === "HST") {
    introEl.textContent =
      "To extract the net pre-tax amount from a gross " + province.name +
      " total, divide by " + divisor + ". The HST portion is the difference " +
      "between gross and net. HST is fully ITC-eligible for CRA-registered businesses.";

    formulaEl.innerHTML =
      "Net = Gross \u00F7 " + divisor + "<br>" +
      "HST = Gross \u2212 Net  (ITC-eligible)";

    exampleEl.textContent =
      "Worked example: " + formatExplainerMoney(example.gross) + " gross \u00F7 " + divisor +
      " = " + formatExplainerMoney(example.pretax) + " net. " +
      formatExplainerMoney(example.tax1) + " HST is ITC-eligible for CRA-registered businesses.";

  } else if (province.type === "GST") {
    introEl.textContent =
      province.name + " has no provincial sales tax \u2014 only the 5% federal GST applies. " +
      "Divide the gross total by 1.05 to extract the net amount; the GST portion is ITC-eligible.";

    formulaEl.innerHTML =
      "Net = Gross \u00F7 1.05<br>" +
      "GST = Gross \u2212 Net  (ITC-eligible)";

    exampleEl.textContent =
      "Worked example: " + formatExplainerMoney(example.gross) + " gross \u00F7 1.05" +
      " = " + formatExplainerMoney(example.pretax) + " net. " +
      formatExplainerMoney(example.tax1) + " GST is ITC-eligible for CRA-registered businesses.";

  } else if (province.type === "GST+QST") {
    introEl.textContent =
      "In Quebec, GST (" + formatRatePercent(province.gst) + ") and QST (" +
      formatRatePercent(province.qst) + ") both apply directly to the net consideration base \u2014 " +
      "QST does not compound on top of GST. GST is ITC-eligible; QST is recoverable via an " +
      "Input Tax Refund (ITR) filed with Revenu Qu\u00E9bec.";

    formulaEl.innerHTML =
      "Net = Gross \u00F7 " + divisor + "<br>" +
      "GST = Net \u00D7 " + province.gst + "  (ITC-eligible)<br>" +
      "QST = Net \u00D7 " + province.qst + "  (recoverable via ITR)<br>" +
      "Gross = Net + GST + QST";

    exampleEl.textContent =
      "Worked example: " + formatExplainerMoney(example.gross) + " gross \u00F7 " + divisor +
      " = " + formatExplainerMoney(example.pretax) + " net. " +
      formatExplainerMoney(example.tax1) + " GST (ITC-eligible) and " +
      formatExplainerMoney(example.tax2) + " QST (recoverable via ITR with Revenu Qu\u00E9bec).";

  } else if (province.type === "GST+PST") {
    const provLabel = getProvincialTaxLabel(provinceKey);

    introEl.textContent =
      "In " + province.name + ", GST (" + formatRatePercent(province.gst) + ") and " +
      provLabel + " (" + formatRatePercent(province.pst) + ") both apply to the pre-tax base. " +
      "GST is ITC-eligible; " + provLabel + " is a provincial consumer tax and is not " +
      "recoverable as an ITC.";

    formulaEl.innerHTML =
      "Net = Gross \u00F7 " + divisor + "<br>" +
      "GST = Net \u00D7 " + province.gst + "  (ITC-eligible)<br>" +
      provLabel + " = Net \u00D7 " + province.pst + "  (not ITC-eligible)<br>" +
      "Gross = Net + GST + " + provLabel;

    exampleEl.textContent =
      "Worked example: " + formatExplainerMoney(example.gross) + " gross \u00F7 " + divisor +
      " = " + formatExplainerMoney(example.pretax) + " net. " +
      formatExplainerMoney(example.tax1) + " GST (ITC-eligible) and " +
      formatExplainerMoney(example.tax2) + " " + provLabel + " (" + provLabel +
      " is not ITC-eligible).";
  }
}

// ---------------------------------------------------------------------------
// UI ? province selector
// ---------------------------------------------------------------------------

/**
 * Update the Tax 2 help button's tooltip text and aria-label to match the
 * currently selected province type.
 *
 * QST (GST+QST): explains non-compounding structure since Jan 1, 2013.
 * PST (GST+PST): explicitly states PST is NOT an ITC — avoids misleading
 *   bookkeepers who might attempt to claim BC PST as a recoverable tax.
 *
 * Called on province change and on initial load.
 *
 * @param {string} provinceKey
 */
function updateTax2Tooltip(provinceKey) {
  const tax2HelpBtn = document.querySelector("#result-tax2-row .help-icon");
  if (!tax2HelpBtn) return;

  const type = TAX_RATES[provinceKey] && TAX_RATES[provinceKey].type;

  if (type === "GST+PST") {
    tax2HelpBtn.setAttribute(
      "data-tooltip",
      "BC PST is a consumer-level tax and is generally not recoverable as an Input Tax Credit. " +
      "Unlike the GST portion, PST paid on business inputs cannot be claimed back from the " +
      "BC Ministry of Finance — it is a real cost to the business, not a recoverable tax."
    );
    tax2HelpBtn.setAttribute("aria-label", "About PST");
  } else {
    tax2HelpBtn.setAttribute(
      "data-tooltip",
      "Since January 1, 2013, QST is calculated directly on the net consideration base " +
      "at 9.975% — it does not compound on top of GST."
    );
    tax2HelpBtn.setAttribute("aria-label", "About QST");
  }
}

/**
 * Clear all result output fields and hide the results section.
 * Resets lastResult to null so copy buttons are disabled.
 * Does NOT clear the price input — users must be able to switch provinces
 * and re-calculate the same gross amount without re-entering it.
 */
function clearResults() {
  lastResult = null;

  const fields = ["result-pretax", "result-tax1", "result-tax2", "result-total"];
  fields.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.textContent = "\u2014";
  });

  const tax2Row = document.getElementById("result-tax2-row");
  if (tax2Row) tax2Row.hidden = true;

  const resultsSection = document.getElementById("results-section");
  if (resultsSection) resultsSection.hidden = true;
}

/**
 * Handle province selector change events.
 * Clears stale results immediately and updates the Tax 2 tooltip so it
 * always reflects the newly selected province's tax structure.
 */
function handleProvinceChange() {
  const provinceKey = document.getElementById("province-select").value;
  clearResults();
  updateTax2Tooltip(provinceKey);
  updateMathExplainer(provinceKey);
}

/**
 * Populate the <select id="province-select"> element from PROVINCE_ORDER.
 * Active provinces render as normal selectable options.
 * Inactive provinces render as disabled with "? Coming Soon" suffix to
 * signal future availability without removing them from the list.
 * Uses createElement ? never innerHTML ? to prevent XSS.
 */
export function populateProvinceSelector() {
  const select = document.getElementById("province-select");
  if (!select) return;
  PROVINCE_ORDER.forEach(function (key) {
    const province = TAX_RATES[key];
    const option = document.createElement("option");
    option.value = key;
    if (province.active) {
      option.textContent = province.name;
    } else {
      option.textContent = province.name + " \u2014 Coming Soon";
      option.disabled = true;
    }
    select.appendChild(option);
  });
}

// ---------------------------------------------------------------------------
// UI ? results rendering
// ---------------------------------------------------------------------------

/**
 * Write calculation results to the results section of the DOM.
 * Uses textContent only ? never innerHTML ? to prevent XSS.
 * Hides the secondary tax row for single-rate provinces (e.g. Ontario HST).
 * Respects isAuditorMode for decimal precision.
 *
 * @param {{ pretax: number, tax1: number, tax2: number, total: number, province: string }} result
 */
export function renderResults(result) {
  const provinceKey = result.province;
  const province    = TAX_RATES[provinceKey];
  const dp          = isAuditorMode ? 4 : 2;
  const fmt         = function (v) { return formatCurrency(v, provinceKey, dp); };
  const hasTax2     = province.type === "GST+QST" || province.type === "GST+PST";

  document.getElementById("result-pretax").textContent          = fmt(result.pretax);
  document.getElementById("result-tax1").textContent            = fmt(result.tax1);
  document.getElementById("result-tax1-label").textContent      = getTax1Label(provinceKey);

  const tax2Row = document.getElementById("result-tax2-row");
  if (hasTax2) {
    tax2Row.hidden = false;
    document.getElementById("result-tax2").textContent          = fmt(result.tax2);
    document.getElementById("result-tax2-label").textContent    = getTax2Label(provinceKey);
  } else {
    tax2Row.hidden = true;
    document.getElementById("result-tax2").textContent       = "";
    document.getElementById("result-tax2-label").textContent = "";
  }

  // Total always displays at 2dp ? it is the user-entered gross amount.
  document.getElementById("result-total").textContent = formatCurrency(result.total, provinceKey, 2);
}

// ---------------------------------------------------------------------------
// UI ? input error state
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
// UI ? event handlers
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

  const rawInput     = document.getElementById("price-input").value.trim();
  const totalDollars = Number(rawInput);

  if (!rawInput || isNaN(totalDollars) || !isFinite(totalDollars) || totalDollars <= 0) {
    setInputError("price-input", "Please enter a valid amount greater than zero.");
    return;
  }

  const provinceKey = document.getElementById("province-select").value;
  const result      = calculateReverseTax(totalDollars, provinceKey);

  lastResult = result;
  renderResults(result);

  const resultsSection = document.getElementById("results-section");
  if (resultsSection) {
    resultsSection.hidden = false;
  }
}

/**
 * Reset the price input and hide the results section.
 * Clears any active input error state and resets lastResult.
 */
export function handleClear() {
  document.getElementById("price-input").value = "";
  clearInputError("price-input");
  lastResult = null;
  const tax2Row = document.getElementById("result-tax2-row");
  if (tax2Row) {
    tax2Row.hidden = true;
  }
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

/**
 * Toggle the dark/light theme, persist the choice to localStorage,
 * and update the toggle button's aria-label.
 */
function handleThemeToggle() {
  const html    = document.documentElement;
  const current = html.getAttribute("data-theme");
  const next    = current === "dark" ? "light" : "dark";

  html.setAttribute("data-theme", next);
  localStorage.setItem("tb-theme", next);

  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.setAttribute(
      "aria-label",
      next === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
  }
}

/**
 * Toggle Auditor Precision View Mode (4 decimals).
 * Updates aria-checked on the switch and re-renders results if available.
 */
function handleAuditorToggle() {
  isAuditorMode = !isAuditorMode;
  const btn = document.getElementById("auditor-toggle");
  if (btn) {
    btn.setAttribute("aria-checked", isAuditorMode ? "true" : "false");
  }
  const warning = document.getElementById("auditor-warning");
  if (warning) warning.style.display = isAuditorMode ? "block" : "none";
  if (lastResult) {
    renderResults(lastResult);
  }
}

/**
 * Write a raw numeric string (no currency symbols or locale separators) to
 * the clipboard. Falls back to document.execCommand for older browsers.
 * Flashes the copy button with class "copied" for 1.2 seconds.
 *
 * Clipboard copy must strip all formatting symbols ? only the raw decimal
 * string is written (e.g. "1250.50"), per localization rules.
 *
 * @param {Event} e  Click event from a .btn-copy button
 */
function handleCopy(e) {
  if (!lastResult) return;

  const key = e.currentTarget.getAttribute("data-copy");
  let value;
  if (key === "pretax") value = lastResult.pretax;
  else if (key === "tax1") value = lastResult.tax1;
  else if (key === "tax2") value = lastResult.tax2;
  else return;

  // Round to 2dp for clipboard, stripping all locale formatting symbols.
  const raw  = Math.round((value + Number.EPSILON) * 100) / 100;
  const text = raw.toFixed(2);

  const btn = e.currentTarget;

  function flashButton() {
    btn.classList.add("copied");
    btn.textContent = "Copied";
    setTimeout(function () {
      btn.classList.remove("copied");
      btn.textContent = "Copy";
    }, 1200);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(flashButton).catch(function () {
      fallbackCopy(text, flashButton);
    });
  } else {
    fallbackCopy(text, flashButton);
  }
}

/**
 * Clipboard fallback using a temporary textarea and document.execCommand.
 * Used when navigator.clipboard is unavailable (e.g. non-HTTPS or old browsers).
 *
 * @param {string}   text      The text to copy
 * @param {Function} onSuccess Called after the copy attempt
 */
function fallbackCopy(text, onSuccess) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "absolute";
  ta.style.left     = "-9999px";
  ta.style.top      = "-9999px";
  ta.setAttribute("aria-hidden", "true");
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    onSuccess();
  } catch (_) {
    // Silent failure ? copy is a convenience feature, not critical.
  }
  document.body.removeChild(ta);
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

  // Sync the Tax 2 tooltip to the province that is selected on load,
  // then register the change handler for all subsequent selections.
  const provinceSelect = document.getElementById("province-select");
  if (provinceSelect) {
    updateTax2Tooltip(provinceSelect.value);
    const initialProvince = provinceSelect.value || "ON";
    updateMathExplainer(initialProvince);
    provinceSelect.addEventListener("change", handleProvinceChange);
  }

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    // Sync aria-label to the current theme on first load.
    const current = document.documentElement.getAttribute("data-theme");
    themeToggle.setAttribute(
      "aria-label",
      current === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
    themeToggle.addEventListener("click", handleThemeToggle);
  }

  const auditorToggle = document.getElementById("auditor-toggle");
  if (auditorToggle) {
    auditorToggle.addEventListener("click", handleAuditorToggle);
  }

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
    priceInput.addEventListener("blur",    handlePriceBlur);
    priceInput.addEventListener("keydown", handlePriceKeydown);
  }

  // Copy buttons — delegate to a single handler per button.
  document.querySelectorAll(".btn-copy").forEach(function (btn) {
    btn.addEventListener("click", handleCopy);
  });

  // Populate the static rates-verified pill with month + year from LAST_VERIFIED.
  // Append T00:00:00 to force local-time parsing and avoid UTC offset shifting the month.
  const ratesDateEl = document.getElementById("rates-verified-date");
  if (ratesDateEl) {
    const d = new Date(LAST_VERIFIED + "T00:00:00");
    ratesDateEl.textContent = d.toLocaleString("en-CA", { month: "long", year: "numeric" });
  }
}

// Guard against import in a Node.js test environment where document is undefined.
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}
