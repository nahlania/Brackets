# BracketWise Engine — Flowchart Companion

This document explains each block in `bracketwise-flow-simplified.drawio`. The diagram shows the calculation pipeline at a conceptual level; this doc provides the rules, formulas, and design decisions behind each step.

---

## 1. Income

The engine accepts four income streams. All four feed into a single aggregated figure called `taxableGrossIncome`.

| Block | What it represents |
|---|---|
| **T4 Employment** | Gross employment income from T4 slips |
| **Self-Employment** | Net business income (revenue minus business expenses) |
| **Capital Gains** | Realized capital gains — included at 50% for the first $250K, 2/3 above that (2024+ inclusion rate change) |
| **Other Income** | Interest, rental income, dividends, and any other taxable income |

`taxableGrossIncome = T4 + SE + Other + (capitalGains × inclusionRate)`

Capital gains are adjusted before being added so that only the taxable portion enters the brackets. A separate `grossIncome` figure (using full capital gains) is kept for display purposes and for computing take-home income.

---

## 2. Mandatory Contributions

These are calculated before any optimization. They affect both the amount deducted from income and the tax credits available later.

### T4 CPP — Tier 1 & 2
CPP on T4 employment income is split into two tiers:
- **Tier 1** covers earnings from the basic exemption ($3,500) up to the Year's Maximum Pensionable Earnings (YMPE: $74,600 in 2026). Employee rate: 5.95%.
- **Tier 2** covers the band from YMPE to the Year's Additional Maximum Pensionable Earnings (YAMPE: $85,000 in 2026). Employee rate: 4.00%.

The Tier 1 base portion (4.95%) goes to Line 30800 as a non-refundable credit base. The enhanced 1% and all of Tier 2 go to Line 22215 as an income deduction.

### Employment Insurance (EI)
`EI = min( min(T4, maxInsurable) × rate, maxPremium )`
For 2026: rate = 1.63%, max insurable = $68,900, max premium = $1,123.07.
Self-employed income is excluded — SE EI is voluntary and out of scope.
EI is a non-refundable credit at Line 31200.

### SE CPP — Tier 1 & 2
Self-employed individuals pay both the employee and employer halves of CPP. T4 income consumes YMPE/YAMPE room first, so the SE CPP calculation begins from whatever headroom remains.
- 50% of SE CPP Tier 1 is deducted from income (Line 22200 — the "employer half")
- The enhanced portion of Tier 1 and all of Tier 2 are deducted from income (Line 22215)
- The base portion of Tier 1 goes to Line 31000 as a non-refundable credit base (mirroring Line 30800 for T4)

---

## 3. Net Taxable Income

`netIncome` is CRA Line 23600, which also equals Line 26000 in this application (no LCGE or loss carryforwards are modelled).

```
netIncome = taxableGrossIncome
          - SE CPP employer deduction    (Line 22200)
          - SE CPP enhanced deduction    (Line 22215)
          - T4 CPP enhanced + Tier 2     (Line 22215)
          - FHSA already contributed     (Line 20805)
          - FHSA new contribution        (Line 20805)
          - RRSP contribution            (Line 20800)
          - Childcare                    (Line 21400)
```

**Before optimization**, only the CPP lines apply. FHSA new and RRSP are $0. This produces the baseline netIncome used in sections 4 and 5.

After the optimization loop converges, the final singlePass uses the optimized FHSA and RRSP amounts, producing a lower netIncome and therefore lower tax.

---

## 4. Tax Calculation

Both federal and provincial tax are computed on `netIncome` using the same bracket structure.

### Federal Income Tax
1. Apply federal brackets to `netIncome` → `rawFed`
2. Subtract non-refundable credits (all applied at the first bracket rate, ~14% in 2026):
   - **BPA** (Basic Personal Amount): $16,452 in 2026; phases out between $181K–$258K
   - **CPP NR credit**: base portion from Lines 30800 (T4) + 31000 (SE)
   - **EI credit**: Line 31200
   - **Canada Employment Amount**: min(T4, $1,498) — T4 employment income only
   - **Medical credit**: expenses above the lesser of 3% of netIncome or $2,890 (2026 federal floor)
3. `fedTax = max(0, rawFed - credits)`

### Provincial Income Tax (BC example)
1. Apply BC brackets to `netIncome` → `rawProv`
2. Subtract provincial non-refundable credits (at BC's lowest rate, 5.6% in 2026):
   - **BC BPA**: $13,216 in 2026
   - **CPP/EI credit**: (T4 NR base + SE NR base + EI) × 5.6%
   - **BC Low-Income Tax Reduction (LITR)**: up to $690 credit in 2026; claws back at 3.56% for incomes between $25,570 and $44,952
   - **Medical credit**: provincial floor is $2,748 (BC 2026)
3. `adjProvTax = max(0, rawProv - credits - medCredit)`

`totalTax = fedTax + adjProvTax`

---

## 5. Before Optimization Baseline

The engine runs a full tax calculation with RRSP = $0 and FHSA new = $0 to establish the unoptimized picture. This is the reference point for computing tax savings.

| Block | Formula |
|---|---|
| **Tax Owing** | `max(0, totalTax - t4TotalTax)` — the April balance after subtracting what the employer already withheld on T4 income |
| **Take-Home Income** | `grossIncome - totalTax - totalCpp - EI` — economic take-home; RRSP/FHSA not subtracted since money stays in registered accounts |
| **Effective Rate** | `(totalTax + totalCpp + EI) / grossIncome` — all mandatory obligations as a share of gross |
| **Marginal Rate** | Computed by probing: run singlePass again with +$100 of other income, compare the tax difference. Not read from the chart curve (which uses a T4-only scenario and would be wrong for mixed-income users) |

`t4TotalTax` is computed separately by running a T4-only singlePass with no SE income and no contributions — it approximates what the employer withholds at source.

---

## 6. Optimization Engine

### Constraints
These four values are fixed before the loop begins and do not change between passes.

| Block | What it represents |
|---|---|
| **Available Cash Budget** | Monthly available cash × 12 = annual budget for contributions and tax |
| **FHSA Room** | `min(roomForYear - alreadyContributedThisYear, fhsaLifetime - lifetimeUsed)` — max additional FHSA the optimizer can contribute |
| **RRSP Room** | `roomFromNOA - alreadyContributed - matchImpact`, where matchImpact accounts for employer match reducing the user's effective room |
| **Tax-Free Floor** | BC: $21,000 (empirical — reflects where LITR + BPA stack to zero tax). AB/SK: the federal BPA for the year. RRSP contributions can never reduce netIncome below this floor |

### 5-Pass Convergence Loop
RRSP is self-referential: contributing to an RRSP reduces netIncome, which reduces totalTax, which reduces the April tax owing, which frees up more cash, which can go into RRSP. A single-pass calculation underestimates the optimal RRSP amount. Five passes converge to a stable solution.

Each pass executes these six steps:

| Step | What happens |
|---|---|
| **1. Calculate Tax** | `singlePass(inputs, currentRrsp, currentFhsa)` — full tax calculation with current contribution guesses |
| **2. Tax Owing** | `max(0, totalTax - t4TotalTax)` — how much cash must be held aside for April |
| **3. Investable Pool** | `max(0, annualCash - taxOwing - seCpp)` — safe cash remaining for registered contributions |
| **4. Fill FHSA First** | `min(pool, fhsaRoom)` — FHSA is prioritized because contributions are deductible AND withdrawals are tax-free |
| **5. RRSP Headroom** | `netIncome + rrspPrev + fhsaPrev - fhsaNew - floor` — maximum RRSP that keeps netIncome above the floor |
| **6. RRSP Amount** | `min(pool - fhsaNew, rrspRoom, headroom)` — final RRSP for this pass; feeds back as the input for step 1 on the next pass |

After 5 passes the contributions have converged. A final `singlePass` with the converged amounts produces all output values.

---

## 7. Optimized Results

| Block | What it represents |
|---|---|
| **Registered Contributions** | `fhsaContrib`, `rrspContrib`, and `tfsa = min(max(0, pool - fhsa - rrsp), tfsaAnnualLimit)` |
| **Tax Saving** | `beforePass.totalTax - result.totalTax` — the reduction in income tax achieved by the optimization |
| **April Liabilities** | `taxOwing + seCpp` — total cash needed by the April tax deadline (SE CPP is not withheld at source, so it arrives as a lump sum) |
| **Income & Rates** | `afterTaxIncome`, `avgTaxRate`, and `marginalRateAfter` (same direct-probe method as the baseline) |

---

## Key CRA Lines Referenced

| Line | Description |
|---|---|
| 20800 | RRSP deduction |
| 20805 | FHSA deduction |
| 21400 | Childcare expenses |
| 22200 | SE CPP employer half deduction |
| 22215 | CPP enhanced and Tier 2 deduction |
| 23600 | Net income |
| 26000 | Taxable income (equals Line 23600 in this app) |
| 30000 | Basic Personal Amount |
| 30800 | T4 CPP1 base non-refundable credit |
| 31000 | SE CPP1 base non-refundable credit |
| 31200 | EI non-refundable credit |
| 31260 | Canada Employment Amount |
| 33099 | Medical expenses |
