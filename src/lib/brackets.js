// ─── FEDERAL TAX BRACKETS ────────────────────────────────────────────────────
// 2025: first bracket blended at 14.5% (rate was cut from 15% to 14% on July 1 2025).
// 4th bracket rate is the statutory 29%; the ~29.3x% figure cited elsewhere is an
// effective rate that already bakes in the BPA phase-out — handled separately by fedBpa().

export const FED_BRACKETS = {
  2025: [
    { lo: 0,       r: 14.5 },
    { lo: 57375,   r: 20.5 },
    { lo: 114750,  r: 26   },
    { lo: 177882,  r: 29   },
    { lo: 253414,  r: 33   },
  ],
  2026: [
    { lo: 0,       r: 14   },
    { lo: 58524,   r: 20.5 },
    { lo: 117046,  r: 26   },
    { lo: 181441,  r: 29   },
    { lo: 258483,  r: 33   },
  ],
};

// ─── PROVINCIAL TAX BRACKETS ────────────────────────────────────────────────
// AB 2025: new 8% first bracket on first $60,000 introduced (previously 10% from $0).
// BC 2026: lowest rate raised from 5.06% to 5.60%.

export const PROV_BRACKETS = {
  2025: {
    AB: [
      { lo: 0,       r: 8  },
      { lo: 60000,   r: 10 },
      { lo: 151234,  r: 12 },
      { lo: 181481,  r: 13 },
      { lo: 241974,  r: 14 },
      { lo: 362961,  r: 15 },
    ],
    BC: [
      { lo: 0,       r: 5.06  },
      { lo: 49279,   r: 7.7   },
      { lo: 98560,   r: 10.5  },
      { lo: 113158,  r: 12.29 },
      { lo: 137407,  r: 14.7  },
      { lo: 186306,  r: 16.8  },
      { lo: 259829,  r: 20.5  },
    ],
    SK: [
      { lo: 0,       r: 10.5 },
      { lo: 53463,   r: 12.5 },
      { lo: 152750,  r: 14.5 },
    ],
  },
  2026: {
    AB: [
      { lo: 0,       r: 8  },
      { lo: 61200,   r: 10 },
      { lo: 154259,  r: 12 },
      { lo: 185111,  r: 13 },
      { lo: 246813,  r: 14 },
      { lo: 370220,  r: 15 },
    ],
    BC: [
      { lo: 0,       r: 5.6   },
      { lo: 50363,   r: 7.7   },
      { lo: 100727,  r: 10.5  },
      { lo: 115648,  r: 12.29 },
      { lo: 140430,  r: 14.7  },
      { lo: 190405,  r: 16.8  },
      { lo: 265545,  r: 20.5  },
    ],
    SK: [
      { lo: 0,       r: 10.5 },
      { lo: 54532,   r: 12.5 },
      { lo: 155805,  r: 14.5 },
    ],
  },
};

// ─── BASIC PERSONAL AMOUNT PARAMETERS ───────────────────────────────────────
// fedMax / fedMin scale linearly between fedThresh and fedMaxLim.
// AB / BC / SK are flat provincial BPA values.

export const BPA_PARAMS = {
  2025: {
    fedMax:    16129,
    fedMin:    14538,
    fedThresh: 177882,
    fedMaxLim: 253414,
    AB:        22323,
    BC:        12932,
    SK:        19491,
  },
  2026: {
    fedMax:    16452,
    fedMin:    14829,
    fedThresh: 181441,
    fedMaxLim: 258483,
    AB:        22769,
    BC:        13216,
    SK:        20381,
  },
};

// ─── CPP TIER PARAMETERS ─────────────────────────────────────────────────────
// Source: CRA official CPP maximums table (PDF, June 2025).
//
// CPP1: employee rate 5.95% each side; SE rate 11.90% (both halves combined).
// CPP2: employee rate 4.00% each side; SE rate 8.00% (both halves combined).
//
export const CPP_PARAMS = {
  2025: {
    ympe:      71300,
    yampe:     81200,
    basicEx:   3500,
    emCPP1:    0.0595,  // CPP1 employee (and employer) rate
    seCPP1:    0.119,   // CPP1 SE combined rate (both halves)
    emMaxCPP1: 4034.10, // CPP1 max per side (employee or employer)
    seMaxCPP1: 8068.20, // CPP1 max SE total (both halves)
    emCPP2:    0.04,    // CPP2 employee (and employer) rate
    seCPP2:    0.08,    // CPP2 SE combined rate (both halves)
    emMaxCPP2: 396.00,  // CPP2 max per side: (81200−71300)×4% — source: CRA payroll tables
    seMaxCPP2: 792.00,  // CPP2 max SE total (both halves)
  },
  2026: {
    ympe:      74600,
    yampe:     85000,
    basicEx:   3500,
    emCPP1:    0.0595,
    seCPP1:    0.119,
    emMaxCPP1: 4230.45,
    seMaxCPP1: 8460.90,
    emCPP2:    0.04,
    seCPP2:    0.08,
    emMaxCPP2: 416.00,  // CPP2 max per side: (85000−74600)×4% — source: CRA payroll tables
    seMaxCPP2: 832.00,  // CPP2 max SE total (both halves)
  },
};

// ─── EI PARAMETERS (display-only; not part of optimization loop) ─────────────
// T4 employee premiums only. SE EI is voluntary and excluded from scope.

export const EI_PARAMS = {
  2025: { rate: 0.0164, maxInsurable: 65700,  maxPremium: 1077.48 },
  2026: { rate: 0.0163, maxInsurable: 68900,  maxPremium: 1123.07 },
};

// ─── BC LOW-INCOME TAX REDUCTION ─────────────────────────────────────────────
// Full credit below lo; linear clawback at 3.56% between lo and hi; $0 above hi.

export const BC_CLAWBACK = {
  2025: { lo: 25020, hi: 40807, rate: 0.0356, maxCredit: 562  },
  2026: { lo: 25570, hi: 44952, rate: 0.0356, maxCredit: 690  },
};

// ─── REGISTERED ACCOUNT LIMITS ───────────────────────────────────────────────

export const LIMITS = {
  2025: { rrspMax: 32490, fhsaAnnual: 8000, tfsaAnnual: 7000, fhsaLifetime: 40000 },
  2026: { rrspMax: 33810, fhsaAnnual: 8000, tfsaAnnual: 7000, fhsaLifetime: 40000 },
};

// ─── CANADA EMPLOYMENT AMOUNT ────────────────────────────────────────────────
// Federal NR credit (Line 31260): lesser of actual T4 income and this indexed limit.
// Applies only to T4 employment income; not available on SE or investment income.
// 2025: $1,469 × 14.5% = $213 credit. 2026 indexed at the 2.0% federal factor.

export const CEA_PARAMS = {
  2025: 1469,
  2026: 1498,
};

// ─── MEDICAL EXPENSE FLOOR ───────────────────────────────────────────────────
// Deductible floor = lesser of (3% of net income) or this indexed limit.
// Federal and provincial caps are indexed independently each year.
// Sources: taxtips.ca non-refundable credits tables; BC Gov Basic Credits page.

export const MEDICAL_FLOOR = {
  2025: 2834,
  2026: 2890,
};

// Provincial caps differ from federal. AB is indexed at 2%/yr (Bill 32 cap).
export const PROV_MEDICAL_FLOOR = {
  2025: { AB: 2884, BC: 2689, SK: 2681 },
  2026: { AB: 2942, BC: 2748, SK: 2736 },
};

// ─── TAX-FREE INCOME FLOORS FOR OPTIMIZATION ENGINE ──────────────────────────
// AB and SK: dynamic — equals the federal BPA fedMax for the selected year.
// BC: fixed at $21,000. This is an empirical optimization floor tracking the
//     true zero-tax liability threshold in BC, caused by the BC Tax Reduction
//     credit stacking on top of the provincial BPA. It is NOT a statutory CRA
//     baseline and does not change with annual indexing.

export const TAX_FREE_FLOOR = {
  BC: 21000,
};

// ─── PROVINCE DISPLAY NAMES ──────────────────────────────────────────────────

export const PROVINCE_NAMES = {
  AB: 'Alberta (AB)',
  BC: 'British Columbia (BC)',
  SK: 'Saskatchewan (SK)',
};

// ─── LOWEST PROVINCIAL RATE (for medical credit and BPA credit calculations) ─
// Year-specific because BC raised its lowest bracket from 5.06% to 5.60% in 2026,
// and AB introduced a new 8% first bracket in 2025 (previously 10% from $0).

export const PROV_LOWEST_RATE = {
  2025: { AB: 8,   BC: 5.06, SK: 10.5 },
  2026: { AB: 8,   BC: 5.6,  SK: 10.5 },
};
