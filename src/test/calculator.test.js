// © 2026 TaxBackwards.ca. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { calculateReverseTax } from "../js/app.js";

describe("calculateReverseTax — mandatory test cases", function () {
  it("Ontario $113.00 gross → $100.00 net, $13.00 HST", function () {
    const result = calculateReverseTax(113.00, "ON");
    expect(result.pretax).toBeCloseTo(100.00, 2);
    expect(result.tax1).toBeCloseTo(13.00, 2);
    expect(result.tax2).toBe(0);
    expect(result.total).toBe(113.00);
    expect(result.province).toBe("ON");
  });

  it("Quebec $114.98 gross → $100.00 net, total tax $14.98", function () {
    const result = calculateReverseTax(114.98, "QC");
    // Display at 2dp: pretax rounds to $100.00
    expect(Math.round((result.pretax + Number.EPSILON) * 100) / 100).toBe(100.00);
    // tax1 (GST) + tax2 (QST) must equal $14.98 at 2dp
    const totalTax = Math.round(((result.tax1 + result.tax2) + Number.EPSILON) * 100) / 100;
    expect(totalTax).toBe(14.98);
  });

  it("Quebec $114.98 net displays in French-Canadian format as '100,00\\u00A0$'", function () {
    const result = calculateReverseTax(114.98, "QC");
    const displayNet = Math.round((result.pretax + Number.EPSILON) * 100) / 100;
    const formatted = displayNet.toLocaleString("fr-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + "\u00A0$";
    expect(formatted).toBe("100,00\u00A0$");
  });

  it("Nova Scotia $114.00 gross → $100.00 net, $14.00 HST", function () {
    const result = calculateReverseTax(114.00, "NS");
    expect(result.pretax).toBeCloseTo(100.00, 2);
    expect(result.tax1).toBeCloseTo(14.00, 2);
    expect(result.tax2).toBe(0);
    expect(result.total).toBe(114.00);
    expect(result.province).toBe("NS");
  });

  it("Saskatchewan $111.00 gross → $100.00 net, $5.00 GST (ITC eligible), $6.00 PST (not ITC eligible)", function () {
    const result = calculateReverseTax(111.00, "SK");
    expect(result.pretax).toBeCloseTo(100.00, 2);
    expect(result.tax1).toBeCloseTo(5.00, 2);
    expect(result.tax2).toBeCloseTo(6.00, 2);
    expect(result.total).toBe(111.00);
    expect(result.province).toBe("SK");
  });

  it("Auditor Mode Ontario $100.00 gross → tax displays as '$11.5044' at 4 decimals", function () {
    const result = calculateReverseTax(100.00, "ON");
    // tax1 at 4dp precision: $100 × (13/113) = 11.504424...
    const formatted = "$" + result.tax1.toLocaleString("en-CA", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
    expect(formatted).toBe("$11.5044");
  });
});
