// ─── ALERT MESSAGES ──────────────────────────────────────────────────────────

export const ALERTS = {
  cashDeficit: `Your available cash is currently optimized entirely to cover your tax liabilities. Investment recommendations will unlock once your liquid cash exceeds your immediate tax owing.`,

  bpaWasted: `Your optimized net income is below the effective tax-free threshold. Your deductions may be more valuable applied against higher income years — consider carrying forward unused room.`,

  gstRegistration: `Your self-employment gross income exceeds $30,000. You are legally required to register for a GST/HST number with the CRA and collect sales tax on your services.`,

  fhsaRoomExceeded: `FHSA Participation Room can't exceed $16,000. Annual base limit is $8,000 and the maximum is $16,000 if you have carryforward room.`,

  fhsaLifetimeExceeded: `Lifetime FHSA Contributions can't exceed the $40,000 lifetime limit. Re-enter the correct total from your records.`,
};

// ─── CLAWBACK ZONE ALERT (BC-specific) ───────────────────────────────────────

export function clawbackAlert(province) {
  if (province !== 'BC') return null;
  return `Your income sits inside the BC Low-Income Tax Reduction phase-out window (3.56% effective clawback). Each additional dollar of income in this band erodes your provincial tax credit.`;
}

// ─── OPTIMIZATION STEP NOTES ─────────────────────────────────────────────────
// Each returns { variant: 'success' | 'info' | 'warning', text }, covering the
// edge cases for the "Save & Optimize Your Tax" action plan.

export function step1Note(totalLiabilities, availableCash) {
  if (availableCash <= 0) {
    if (totalLiabilities > 0) {
      return {
        variant: 'warning',
        text: `Enter your Available Cash above to start your savings plan. You'll need to save $${fmt(totalLiabilities)} ($${fmt(totalLiabilities / 12)}/month) to cover this year's projected owing.`,
      };
    }
    return {
      variant: 'info',
      text: `Enter your Available Cash above to see how much you can put toward your FHSA, RRSP, and TFSA this year.`,
    };
  }
  const diff = availableCash - totalLiabilities;
  if (diff < 0) {
    return {
      variant: 'warning',
      text: `Your available cash falls $${fmt(-diff)} short of your year-end owing. Consider saving an extra $${fmt(-diff / 12)}/month.`,
    };
  }
  if (diff === 0) {
    return {
      variant: 'info',
      text: `Your available cash exactly covers your year-end owing — nothing remains for FHSA, RRSP, or TFSA this year.`,
    };
  }
  return {
    variant: 'success',
    text: `Fully covered. $${fmt(diff)} remains for your FHSA, RRSP, and TFSA contributions.`,
  };
}

export function step2Note({ fhsaContrib, fhsaRoom, fhsaRoomForYear, fhsaLifetimeReached, availableCash }) {
  if (fhsaContrib <= 0) {
    if (fhsaLifetimeReached) {
      return { variant: 'info', text: `You've reached the $40,000 FHSA lifetime limit. This account is fully funded for good.` };
    }
    if (fhsaRoom <= 0) {
      if (fhsaRoomForYear <= 0) {
        return { variant: 'info', text: `Enter your FHSA Participation Room to include this account in tax optimization.` };
      }
      return { variant: 'info', text: `You've already contributed your full $${fmt(fhsaRoomForYear)} FHSA room for this year — no additional room available.` };
    }
    if (availableCash <= 0) {
      return { variant: 'info', text: `Enter your Available Cash above to begin contributing to your FHSA.` };
    }
    return { variant: 'info', text: `No FHSA contribution this year — no cash remains after covering your owing.` };
  }
  if (fhsaContrib < fhsaRoom) {
    return { variant: 'info', text: `$${fmt(fhsaRoom - fhsaContrib)} of your FHSA room is going unused this year due to limited available cash.` };
  }
  if (fhsaLifetimeReached) {
    return { variant: 'success', text: `This contribution uses your full $${fmt(fhsaContrib)} FHSA room and reaches your $40,000 lifetime limit — fully funded for good.` };
  }
  return { variant: 'success', text: `You've used your full $${fmt(fhsaContrib)} FHSA room for this year. The rest of your room carries forward to next year.` };
}

export function step3Note({ rrspContrib, rrspRoom, rrspRoomFromNoa, availableCash }) {
  if (rrspContrib <= 0) {
    if (rrspRoom <= 0) {
      if (rrspRoomFromNoa <= 0) {
        return { variant: 'info', text: `Enter your RRSP Contribution Room to include this account in tax optimization.` };
      }
      return { variant: 'info', text: `Your $${fmt(rrspRoomFromNoa)} RRSP room is already fully used by your contributions and employer match this year.` };
    }
    if (availableCash <= 0) {
      return { variant: 'info', text: `Enter your Available Cash above to begin contributing to your RRSP.` };
    }
    return { variant: 'info', text: `No RRSP contribution this year — no cash remains after FHSA.` };
  }
  const carryforward = rrspRoom - rrspContrib;
  if (carryforward > 0) {
    return { variant: 'info', text: `$${fmt(carryforward)} of your RRSP room is unused and carries forward indefinitely — it never expires.` };
  }
  return { variant: 'success', text: `Your full RRSP room is used this year — no carryforward remaining.` };
}

export function tfsaNote(tfsaAmount, tfsaLimit) {
  if (tfsaAmount <= 0) return null;
  if (tfsaAmount > tfsaLimit) {
    return {
      variant: 'info',
      text: `Max out your $${fmt(tfsaLimit)} TFSA room for tax-free growth. Put the remaining $${fmt(tfsaAmount - tfsaLimit)} in a non-registered investment account, or hold it for next year's TFSA room.`,
    };
  }
  return {
    variant: 'success',
    text: `Save the remaining $${fmt(tfsaAmount)} in your TFSA for tax-free growth — fully within your $${fmt(tfsaLimit)} annual room.`,
  };
}

// ─── TOOLTIPS ────────────────────────────────────────────────────────────────

export const TOOLTIPS = {
  t4Income:              'Your standard salaried income before any taxes are deducted. If you are referencing a CRA tax slip, this is the total amount found in Box 14 of your T4.',
  bonusIncome:           'Performance or signing bonuses paid through payroll. Enter the full gross amount before any withholding tax was deducted.',
  rrspMatchPct:          'The percentage of your base salary your employer matches into your group RRSP. Both your contribution and the employer match reduce your available RRSP room. The engine automatically excludes your bonus from this calculation.',
  seGrossIncome:         'Your total freelance or business revenue before any business expenses.',
  businessExpenses:      'Eligible costs to run your business (software, home office, etc.). The engine subtracts this to calculate your Net Business Income.',
  capitalGains:          'Total realized profit from the sale of investments or property. The engine automatically applies the correct inclusion rate (50% inclusion for up to $250,000, and 66.67% for amounts above that).',
  otherTaxableIncome:    'Interest, foreign income, taxable dividends, RRIF withdrawals, and other fully taxable income not covered above. Included 100% at your marginal taxrate.',
  childcare:             'Deductible expenses for daycare, nannies, or camps. Per CRA guidelines, this must be claimed by the spouse with the lower net income.',
  medicalExpenses:       'Out-of-pocket health and dental costs. Expenses must exceed 3% of your net income to qualify. For couples, optimize by pooling all receipts on the file of lower-income spouse.',
  rrspRoom:              'Your total available RRSP room. You can find this exact number printed on your most recent CRA Notice of Assessment (NOA)',
  rrspAlreadyContrib:    'Money you have already deposited into your RRSP this calendar year or the first 60 days of the following year. DO NOT include employer-matched contributions.',
  fhsaAlreadyContrib:    'Amount already contributed to your FHSA this calendar year.\nAnnual base limit is $8,000 and the maximum is $16,000 if you have carryforward room.',
  fhsaRoomForYear:       'The amount shown as "Your FHSA participation room" on your CRA Notice of Assessment (NOA). If it\'s your first year with an FHSA, input $8,000.',
  fhsaLifetimeUsed:      'Total amount deposited into your FHSA in all previous years combined — regardless of whether you claimed the deduction. You can defer the tax deduction to a future year, but deposits always count against your $40,000 lifetime limit the moment they are made.',
  availableCash:         'Total liquid savings you are willing to allocate toward taxes and registered investments this year.',

  // Results panel
  grossIncome:        'Total income before any deductions or taxes — the starting point for your tax calculation.',
  afterTaxIncome:     'Take-home income after all federal and provincial taxes, CPP, and EI have been deducted.',
  avgTaxRate:         'Total tax as a percentage of gross income. Unlike the marginal rate, this reflects what you actually pay across all your income combined — not just the rate on your last dollar.',
  fedTax:             'Federal income tax on your taxable income, calculated using the CRA federal brackets for the selected tax year.',
  provTax:            'Provincial income tax based on your province of residence and its tax schedule.',
  seCpp:              'CPP contributions on self-employment net income. Self-employed individuals pay both the employee and employer portions — roughly double the rate of a salaried worker.',
  totalLiabilities:   'Total of all taxes and CPP owing before any employer withholding is credited.',
  withheldAtSource:   'Tax your employer has already deducted from your T4 pay and remitted to the CRA on your behalf (Box 22 of your T4 slip).',
  yearEndOwing:       'Estimated balance when you file. Positive means a payment is due by April 30. Zero or negative means you may receive a refund.',
  estimatedRefund:    'Your employer withheld more tax than you actually owe — the excess is returned when you file your return.',
  marginalAfter:      'The rate applied to your last dollar of income after FHSA and RRSP contributions reduce your taxable income.',
  taxSaving:          'Estimated reduction in tax from FHSA and RRSP deductions. These contributions pull your income out of higher brackets.',
  marginalBefore:     'The rate applied to your last dollar of income before any registered account contributions.',
};

// ─── MICRO-COPY LABELS ────────────────────────────────────────────────────────

export const MICRO_COPY = {
  childcare:       '📋 Note: Per CRA guidelines, childcare deductions must be claimed by the lower net-income household earner.',
  medicalExpenses: '📋 Note: Medical expenses must exceed 3% of your net income to qualify. For couples, optimization is maximized by pooling receipts on the lower-income earner\'s return.',
};

// ─── DISCLAIMER ──────────────────────────────────────────────────────────────

export const DISCLAIMER = `For educational planning only. Results are estimates based on published CRA figures, not professional tax advice. Always consult a qualified CPA before making financial decisions.`;

// ─── FOOTER ──────────────────────────────────────────────────────────────────

export const FOOTER_CREDIT = `Designed & developed by NahlaNia · Built with Claude Code`;

// ─── ONBOARDING MODAL ────────────────────────────────────────────────────────

export const ONBOARDING_MODAL = {
  headline: 'Proactive Tax & Wealth Optimization',
  subheadline: 'Stop guessing your year-end liabilities. Instantly map your mixed income to the optimal tax and investment strategy.',
  steps: [
    {
      title: 'Map Your Income',
      description: 'Enter your T4 salary, self-employment revenue, and other income sources to establish your exact federal and provincial tax brackets.',
    },
    {
      title: 'Define CRA Limits',
      description: 'Input your available RRSP and FHSA contribution room (found on your Notice of Assessment) to set the boundaries for the optimization engine.',
    },
    {
      title: 'Allocate Liquid Savings',
      description: 'Enter your total available cash pool. The engine requires this to know exactly how much capital it can safely allocate.',
    },
    {
      title: 'Get Optimized',
      description: 'The engine secures your mandatory Tax and CPP liabilities first, then automatically cascades the remaining cash into your registered accounts for maximum tax efficiency.',
    },
  ],
  privacyBadge: '100% Private & Secure. All calculations run instantly on your own device. Your financial data is never sent to a server, saved, or tracked.',
  disclaimer: 'For educational planning only. Results are estimates based on published CRA figures, not professional tax advice. Always consult a qualified CPA.',
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function fmt(n) {
  return Math.round(n).toLocaleString('en-CA');
}
