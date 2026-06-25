import {
  FED_BRACKETS,
  BPA_PARAMS,
  CEA_PARAMS,
  CPP_PARAMS,
  EI_PARAMS,
  LIMITS,
  MEDICAL_FLOOR,
  PROV_MEDICAL_FLOOR,

  PROV_LOWEST_RATE,
  TAX_FREE_FLOOR,
} from './brackets.js';
import { calcProv } from './taxBC.js';

// ─── UTILITY ─────────────────────────────────────────────────────────────────

// function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// CPP1 base rate (pre-enhancement). Permanent statutory value — CRA has never changed it.
const CPP1_BASE_RATE = 0.0495;

// ─── BRACKETED TAX ───────────────────────────────────────────────────────────

function bracketedTax(income, brackets) {
  if (income <= 0) return 0;
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const lo = brackets[i].lo;
    const hi = brackets[i + 1]?.lo ?? Infinity;
    if (income <= lo) break;
    tax += (Math.min(income, hi) - lo) * (brackets[i].r / 100);
  }
  return tax;
}

// ─── FEDERAL BPA (phase-out between fedThresh and fedMaxLim) ─────────────────

function fedBpa(netIncome, year) {
  const { fedMax, fedMin, fedThresh, fedMaxLim } = BPA_PARAMS[year];
  if (netIncome <= fedThresh) return fedMax;
  if (netIncome >= fedMaxLim) return fedMin;
  const frac = (netIncome - fedThresh) / (fedMaxLim - fedThresh);
  return fedMax - frac * (fedMax - fedMin);
}

// ─── CPP CALCULATIONS ────────────────────────────────────────────────────────
// Returns { t4Cpp1, t4Cpp2, seCpp1, seCpp2,
//           t4CppNrtcBase, t4EnhancedDeduction,
//           seEmployerDeduction, seEnhancedDeduction, seNrtcBase }
//
// T4:  4.95% base → Line 30800 NR credit
//      1.00% enhanced → Line 22215 deduction
//      full CPP2 → Line 22215 deduction
//
// SE:  4.95% base equivalent → Line 31000 NR credit
//      5.95% employer half → Line 22200 deduction
//      1.00% enhanced employee → Line 22215 deduction
//      full SE CPP2 → Line 22215 deduction 


function calcCpp(t4Income, seNetIncome, year) {
  const { ympe, yampe, basicEx, emCPP1, seCPP1, emCPP2, seCPP2, emMaxCPP1, seMaxCPP1, emMaxCPP2, seMaxCPP2 } = CPP_PARAMS[year];
  const enhR1 = emCPP1 - CPP1_BASE_RATE; // 1.00% enhanced employee rate

  // ==========================================
  // 1. T4 SALARY INCOME CPP CALCULATIONS
  // ==========================================
  // Tier 1 Pensionable earnings capped at YMPE
  const t4Pensionable1 = Math.max(0, Math.min(t4Income, ympe) - basicEx);
  // Employee T4 CPP1 contributions deducted at source
  const t4Cpp1 = Math.min(t4Pensionable1 * emCPP1, emMaxCPP1);

  // Non-refundable tax credit (Line 30800) and Enhanced deduction (Line 22215)
  const t4CppNrtcBase       = t4Cpp1 * (CPP1_BASE_RATE / emCPP1);
  const t4EnhancedDeduction = t4Cpp1 - t4CppNrtcBase;

  // Tier 2 (CPP2) earnings within the YMPE to YAMPE band
  const t4Cpp2Pensionable2 = Math.max(0, Math.min(t4Income, yampe) - ympe);
  const t4Cpp2 = Math.min(t4Cpp2Pensionable2 * emCPP2, emMaxCPP2);


  // ==========================================
  // 2. SELF-EMPLOYED (SE) INCOME CPP CALCULATIONS
  // ==========================================
  // --- SE Tier 1 (Base + First Additional) ---
  // Total allowed pensionable earnings across both income streams capped at YMPE
  const totalCombinedPensionable1 = Math.min(Math.max(0, t4Income) + Math.max(0, seNetIncome), ympe);
  // Calculate remaining SE earnings allocation available under the YMPE ceiling
  const seAllowedEarnings1 = Math.max(0, totalCombinedPensionable1 - Math.max(0, t4Income));

  // Net contributory earnings after applying single basic exemption buffer
  // If T4 income didn't fully use the exemption, the remainder shields SE income
  const t4UnderExemptionBonus = Math.max(0, basicEx - Math.min(t4Income, basicEx));
  const seContributoryEarnings1 = Math.max(0, seAllowedEarnings1 - t4UnderExemptionBonus);

  // Apply self-employed Tier 1 contribution calculations
  const seCpp1Raw = seContributoryEarnings1 * seCPP1;
  // Hard cap SE obligations against total remaining annual space
  const remainingSeMax1 = Math.max(0, seMaxCPP1 - (Math.min(t4Income, ympe) > basicEx ? (Math.min(t4Income, ympe) - basicEx) * seCPP1 : 0));
  const seCpp1 = Math.min(seCpp1Raw, remainingSeMax1);

  // --- SE Tier 2 (CPP2 Additional) ---
  // Total allowed earnings spanning the Tier 2 band across both income streams
  const totalCombinedPensionable2 = Math.min(Math.max(0, t4Income) + Math.max(0, seNetIncome), yampe);
  const totalYampeEarningsAllocated = Math.max(0, totalCombinedPensionable2 - ympe);
  const t4YampeEarningsConsumed = Math.max(0, Math.min(t4Income, yampe) - ympe);

  // Net remaining Tier 2 space available exclusively for SE allocation
  const seAllowedEarnings2 = Math.max(0, totalYampeEarningsAllocated - t4YampeEarningsConsumed);

  const seCpp2Raw = seAllowedEarnings2 * seCPP2;
  const remainingSeMax2 = Math.max(0, seMaxCPP2 - (t4YampeEarningsConsumed * seCPP2));
  const seCpp2 = Math.min(seCpp2Raw, remainingSeMax2);


  // ==========================================
  // 3. TAX REPORTING LINE ALLOCATIONS
  // ==========================================
  // SE Employer Share Deduction (Line 22200): Exactly 50% of Tier 1
  const seEmployerDeduction = seCpp1 * 0.5;

  // SE Enhanced Employee Deduction (Line 22215): 1.00% Enhanced Tier 1 + 100% of CPP2
  const seEnhancedDeduction = (seCpp1 * (enhR1 / seCPP1)) + seCpp2;

  // SE Non-Refundable Tax Credit Base (Line 31000): 4.95% Base Tier 1
  const seNrtcBase = seCpp1 * (CPP1_BASE_RATE / seCPP1);

  return {
    t4Cpp1,
    t4Cpp2,
    seCpp1,
    seCpp2,
    t4CppNrtcBase,
    t4EnhancedDeduction,
    seEmployerDeduction,
    seEnhancedDeduction,
    seNrtcBase
  };
}


// ─── EI WITHHOLDING (display-only, T4 only) ──────────────────────────────────

export function calcEI(t4Income, year) {
  const { rate, maxInsurable, maxPremium } = EI_PARAMS[year];
  const insurableEarnings = Math.max(0, Math.min(t4Income, maxInsurable));
  return Math.min(insurableEarnings * rate, maxPremium);
}

// ─── CAPITAL GAINS INCLUSION ─────────────────────────────────────────────────
// ≤ $250K: 50% inclusion; beyond $250K: 2/3 (66.67%) inclusion on excess.

function capitalGainsInclusion(gains) {
  if (gains <= 0) return 0;
  const threshold = 250000;
  if (gains <= threshold) return gains * 0.5;
  return threshold * 0.5 + (gains - threshold) * (2 / 3);
}

// ─── FEDERAL TAX ─────────────────────────────────────────────────────────────

function calcFedTax(netIncome, t4Income, cppData, eiPremium, medExp, province, year) {
  const rawFed  = bracketedTax(netIncome, FED_BRACKETS[year]);
  const bpa     = fedBpa(netIncome, year);

  // CRA non-refundable credit rate = lowest marginal bracket rate.
  // 15% in 2025; cut to 14% in 2026 with the first-bracket reduction.
  // Using a hardcoded 0.15 would overstate every NR credit by 1 pp in 2026,
  // understating federal tax by ~$200–350 depending on income and credits.
  const nrcRate = FED_BRACKETS[year][0].r / 100;

  const bpaCred = bpa * nrcRate;
  const cppNrtc = (cppData.t4CppNrtcBase + cppData.seNrtcBase) * nrcRate;
  const eiCred  = eiPremium * nrcRate;
  // Canada Employment Amount (Line 31260): T4 employment income only.
  const ceaCred = Math.min(t4Income, CEA_PARAMS[year]) * nrcRate;

  const medCred = (() => {
    const indexedFloor = MEDICAL_FLOOR[year];
    const pctFloor     = netIncome * 0.03;
    const floor        = Math.min(pctFloor, indexedFloor);
    const eligible     = Math.max(0, medExp - floor);
    return eligible * nrcRate;
  })();

  return Math.max(0, rawFed - bpaCred - cppNrtc - eiCred - ceaCred - medCred);
}

// ─── RRSP AVAILABLE ROOM ─────────────────────────────────────────────────────

function calcRrspRoom(rrspRoomFromNoa, alreadyContributed, t4Income, matchPct) {
  const matchImpact = t4Income * (matchPct / 100) * 2; // employee + employer each at match%
  return Math.max(0, rrspRoomFromNoa - alreadyContributed - matchImpact);
}

// ─── FHSA AVAILABLE ROOM ─────────────────────────────────────────────────────

function calcFhsaRoom(alreadyThisYear, lifetimeUsed, roomForYear, year) {
  const lifetime = LIMITS[year].fhsaLifetime;
  const annualRoom   = Math.max(0, roomForYear - alreadyThisYear);
  const lifetimeRoom = Math.max(0, lifetime - lifetimeUsed);
  return Math.min(annualRoom, lifetimeRoom);
}

// ─── OPTIMIZATION FLOOR ──────────────────────────────────────────────────────

function getFloor(province, year) {
  if (province === 'BC') return TAX_FREE_FLOOR.BC;
  // AB / SK zero-tax threshold = federal fedMax.
  // nrcRate equals fedFirstRate (dynamic), so (fedBpa × nrcRate) / fedFirstRate = fedBpa.
  // Provincial BPA (e.g. AB $22,323) exceeds fedMax in all years, so federal is binding.
  return BPA_PARAMS[year].fedMax;
}

// ─── COMBINED BRACKETS PLOT DATA ─────────────────────────────────────────────
// Samples the tax engine at $100 increments to derive the effective marginal
// rate curve, capturing hidden brackets (BPA phase-out, BC LITR clawback)
// that statutory bracket tables miss.

function buildBracketsPlotData(province, year) {
  const baseInputs = {
    year, province,
    t4Income: 0,
    seNetIncome: 0, otherTaxableIncome: 0, capitalGains: 0,
    childcare: 0, medicalExpenses: 0,
    rrspRoomFromNoa: 0, rrspAlreadyContributed: 0, rrspMatchPct: 0,
    fhsaAlreadyThisYear: 0, fhsaLifetimeUsed: 0,
  };

  const result = [];
  let currentRate = null;
  let prevTax = 0;

  for (let income = 0; income <= 350000; income += 100) {
    const nextTax = singlePass({ ...baseInputs, t4Income: income + 100 }, 0, 0).totalTax;
    const rate    = Math.round(((nextTax - prevTax) / 100) * 100 * 100) / 100;

    if (rate !== currentRate) {
      result.push({ income, combinedRate: rate });
      currentRate = rate;
    }

    prevTax = nextTax;
  }

  return result;
}

// ─── SINGLE FULL-CALCULATION PASS ────────────────────────────────────────────

function singlePass(inputs, rrspContrib, fhsaContrib) {
  const {
    year, province,
    t4Income, seNetIncome, otherTaxableIncome, capitalGains,
    childcare, medicalExpenses,
    rrspRoomFromNoa, rrspAlreadyContributed, rrspMatchPct,
    fhsaAlreadyThisYear, fhsaLifetimeUsed,
  } = inputs;

  const cpp = calcCpp(t4Income, seNetIncome, year);

  // ── Net income deductions ────────────────────────────────────────────────
  const cgInclusion = capitalGainsInclusion(capitalGains);
  // Taxable-basis income: capital gains counted at their CRA inclusion rate
  // (50% / 2/3). This feeds netIncome for bracket calculations.
  const taxableGrossIncome = t4Income + seNetIncome + otherTaxableIncome + cgInclusion;
  // Economic gross income: 100% of capital gains, since the untaxed portion
  // is still cash the taxpayer receives. Used for display, after-tax income,
  // and the effective tax rate.
  const grossIncome = t4Income + seNetIncome + otherTaxableIncome + capitalGains;

  // Line 22200: SE employer CPP1 + SE enhanced CPP1 + SE CPP2 (seEnhancedDeduction)
  // Line 22215: T4 enhanced CPP1 + T4 CPP2
  const seCppDeductions = cpp.seEmployerDeduction + cpp.seEnhancedDeduction;
  const t4CppLine22215  = cpp.t4EnhancedDeduction + cpp.t4Cpp2;

  const netIncome = Math.max(
    0,
    taxableGrossIncome
      - seCppDeductions
      - t4CppLine22215
      - (rrspAlreadyContributed || 0)
      - rrspContrib
      - (fhsaAlreadyThisYear || 0)
      - fhsaContrib
      - childcare,
  );

  // ── Federal tax ──────────────────────────────────────────────────────────
  const ei     = calcEI(t4Income, year);
  const fedTax = calcFedTax(
    netIncome, t4Income, cpp, ei, medicalExpenses, province, year,
  );

  // ── Provincial tax ───────────────────────────────────────────────────────
  const provCppNrtcBase = cpp.t4CppNrtcBase + cpp.seNrtcBase;
  const { provTax, isInClawbackZone } = calcProv(netIncome, province, year, provCppNrtcBase, ei);

  // ── Provincial NR credit for medical (applied to prov tax externally) ───
  const medFloor    = Math.min(netIncome * 0.03, PROV_MEDICAL_FLOOR[year][province]);
  const provMedCred = Math.max(0, medicalExpenses - medFloor) * (PROV_LOWEST_RATE[year][province] / 100);
  const adjProvTax  = Math.max(0, provTax - provMedCred);

  const totalTax = fedTax + adjProvTax;
  const totalCpp = cpp.t4Cpp1 + cpp.t4Cpp2 + cpp.seCpp1 + cpp.seCpp2;

  return {
    netIncome,
    fedTax,
    provTax: adjProvTax,
    totalTax,
    cpp,
    totalCpp,
    ei,
    isInClawbackZone,
    grossIncome,
    cgInclusion,
  };
}

// ─── ESTIMATED T4 WITHHOLDING ────────────────────────────────────────────────
// Mirrors what a CRA payroll system withholds for a basic TD1 employee:
// tax on T4 income alone with standard NR credits (BPA, CPP, EI).

function estimateT4Withholding(t4Income, year, province) {
  if (!t4Income || t4Income <= 0) return 0;
  const { totalTax: t4TotalTax } = singlePass({
    year, province,
    t4Income,
    seNetIncome: 0, otherTaxableIncome: 0, capitalGains: 0,
    childcare: 0, medicalExpenses: 0,
    rrspRoomFromNoa: 0, rrspAlreadyContributed: 0, rrspMatchPct: 0,
    fhsaAlreadyThisYear: 0, fhsaLifetimeUsed: 0,
  }, 0, 0);
  return t4TotalTax;
}

// ─── MARGINAL RATE LOOKUP ─────────────────────────────────────────────────────

function getMarginalRate(income, plotData) {
  let rate = plotData.length > 0 ? plotData[0].combinedRate : 0;
  for (const b of plotData) {
    if (income >= b.income) rate = b.combinedRate;
    else break;
  }
  return rate;
}

// ─── MAIN EXPORT: calculateTax ────────────────────────────────────────────────

export function calculateTax(inputs) {
  const {
    year, province,
    t4Income, rrspMatchIncome, seNetIncome, capitalGains,
    availableCash,
    rrspRoomFromNoa, rrspAlreadyContributed, rrspMatchPct,
    fhsaAlreadyThisYear, fhsaLifetimeUsed, fhsaRoomForYear,
  } = inputs;

  const floor       = getFloor(province, year);
  const rrspRoom    = calcRrspRoom(rrspRoomFromNoa, rrspAlreadyContributed, rrspMatchIncome ?? t4Income, rrspMatchPct);
  const fhsaRoom    = calcFhsaRoom(fhsaAlreadyThisYear, fhsaLifetimeUsed, fhsaRoomForYear, year);
  const t4TotalTax  = estimateT4Withholding(t4Income, year, province);

  // ── Pre-optimization pass (zero contributions) — for before/after comparison
  const beforePass = singlePass(inputs, 0, 0);

  let rrspContrib = 0;
  let fhsaContrib = 0;
  let lastPass    = null;

  // ── 5-pass convergence loop ───────────────────────────────────────────────
  for (let pass = 0; pass < 5; pass++) {
    lastPass = singlePass(inputs, rrspContrib, fhsaContrib);
    const { totalTax, cpp: loopCpp } = lastPass;
    const loopSeCpp      = loopCpp.seCpp1 + loopCpp.seCpp2;
    const loopTaxOwing   = Math.max(0, totalTax - t4TotalTax);
    const totalLiabilities = loopTaxOwing + loopSeCpp;
    const investablePool   = Math.max(0, availableCash - totalLiabilities);

    // Priority 1: FHSA (immediate tax deduction + tax-free growth)
    const prevFhsaContrib = fhsaContrib;
    fhsaContrib = Math.min(investablePool, fhsaRoom);

    // Priority 2: RRSP (top marginal bracket compression)
    // Only contribute down to the optimization floor.
    // lastPass.netIncome already has CPP + prevRrsp + prevFhsa subtracted.
    // We add them back and subtract the new fhsaContrib to find true headroom.
    const rrspHeadroom = Math.max(
      0,
      lastPass.netIncome + rrspContrib + prevFhsaContrib - fhsaContrib - floor,
    );
    const remaining = Math.max(0, investablePool - fhsaContrib);
    rrspContrib = Math.min(remaining, rrspRoom, rrspHeadroom);
  }

  // ── Final pass with converged contributions ──────────────────────────────
  const result          = singlePass(inputs, rrspContrib, fhsaContrib);
  const { ei }          = result;
  const t4Cpp           = result.cpp.t4Cpp1 + result.cpp.t4Cpp2;
  const seCpp           = result.cpp.seCpp1 + result.cpp.seCpp2;
  const taxOwing        = Math.max(0, result.totalTax - t4TotalTax);
  const totalLiabilities = taxOwing + seCpp;
  const investablePool  = Math.max(0, availableCash - totalLiabilities);
  const tfsaAnnualLimit = LIMITS[year].tfsaAnnual;
  const tfsa            = Math.min(Math.max(0, investablePool - fhsaContrib - rrspContrib), tfsaAnnualLimit);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const afterTaxIncome = result.grossIncome - result.totalTax - result.totalCpp - ei;

  // Effective rate = (post-optimization income tax + CPP + EI) ÷ gross income.
  // Consistent with afterTaxIncome, which also uses result.totalTax.
  const avgTaxRate = result.grossIncome > 0
    ? ((result.totalTax + result.totalCpp + ei) / result.grossIncome) * 100 : 0;

  const taxSaving      = Math.max(0, beforePass.totalTax - result.totalTax);

  // ── Marginal rates before / after optimization ────────────────────────────
  const combinedBracketsPlotData = buildBracketsPlotData(province, year);

  // Direct engine probe: add $100 of other income to capture the true effective
  // marginal rate at the user's actual income mix. Avoids the gross/net mismatch
  // that arises when looking up net income in the gross-indexed chart.
  const probeInputs    = { ...inputs, otherTaxableIncome: (inputs.otherTaxableIncome ?? 0) + 100 };
  const probeBefore    = singlePass(probeInputs, 0, 0);
  const probeAfter     = singlePass(probeInputs, rrspContrib, fhsaContrib);
  const marginalRateBefore = Math.round((probeBefore.totalTax - beforePass.totalTax) * 100) / 100;
  const marginalRateAfter  = Math.round((probeAfter.totalTax  - result.totalTax)      * 100) / 100;

  // ── Flags ─────────────────────────────────────────────────────────────────
  const isCashDeficit          = availableCash < totalLiabilities;
  const isBpaWasted            = result.netIncome < floor && result.netIncome > 0;
  const isGstThresholdExceeded = seNetIncome > 30000;

  return {
    // Income
    grossIncome:     result.grossIncome,
    netIncome:       result.netIncome,
    afterTaxIncome,

    // Tax
    fedTax:          result.fedTax,
    provTax:         result.provTax,
    totalTax:        result.totalTax,
    t4TotalTax,
    taxOwing,
    avgTaxRate,
    taxSaving,
    marginalRateBefore,
    marginalRateAfter,

    // CPP / EI
    cpp:             result.cpp,
    t4Cpp,
    seCpp,
    totalCpp:        result.totalCpp,
    ei,

    // Liabilities (year-end owing: taxOwing + seCpp)
    totalLiabilities,

    // Allocations
    fhsaContrib,
    rrspContrib,
    tfsa,
    tfsaAnnualLimit,
    fhsaRoom,
    rrspRoom,

    // Flags
    isCashDeficit,
    isBpaWasted,
    isGstThresholdExceeded,
    isInClawbackZone: result.isInClawbackZone,

    // Chart
    combinedBracketsPlotData,
    incomeBeforeContributions: beforePass.netIncome,
    incomeAfterContributions:  result.netIncome,
    beforeFedTax:  beforePass.fedTax,
    beforeProvTax: beforePass.provTax,
  };
}
