import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import { calculateTax } from './lib/tax.js';
import { PROVINCE_NAMES, LIMITS } from './lib/brackets.js';
import {
  ALERTS, TOOLTIPS, MICRO_COPY, FOOTER_CREDIT, ONBOARDING_MODAL,
  clawbackAlert, step1Note, step2Note, step3Note, tfsaNote,
} from './lib/copywriting.js';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return Math.round(n ?? 0).toLocaleString('en-CA');
}

function fmtPct(n) {
  return (n ?? 0).toFixed(1) + '%';
}

// ─── INFO TOOLTIP ─────────────────────────────────────────────────────────────

// Circular info icon that reveals a dark tooltip bubble on hover/focus, with a
// smooth fade + scale transition.
function InfoTooltip({ text }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  const show = () => {
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
    setVisible(true);
  };
  const hide = () => setVisible(false);

  return (
    <span className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        tabIndex={0}
        aria-label="More information"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="w-3.5 h-3.5 rounded-full border border-slate-300 text-slate-400 flex items-center justify-center text-[9px] font-bold leading-none hover:border-brand-400 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-colors"
      >
        i
      </button>
      {pos && createPortal(
        <span
          role="tooltip"
          className={`fixed z-50 -translate-x-1/2 w-56 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs leading-snug shadow-lg transition-all duration-200 ease-out origin-top ${
            visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
          }`}
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}

// ─── STEPPER INPUT ────────────────────────────────────────────────────────────

function StepperInput({ label, value, onChange, prefix = '$', suffix = '', tooltip, children, className = '', inputRef }) {
  const [trailingDot, setTrailingDot] = useState(false);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    if (raw.endsWith('.')) {
      setTrailingDot(true);
      onChange(raw === '.' ? 0 : parseFloat(raw) || 0);
    } else {
      setTrailingDot(false);
      onChange(raw === '' ? 0 : parseFloat(raw) || 0);
    }
  };

  const displayValue = value === 0 && !trailingDot
    ? ''
    : (value === 0 ? '' : value.toLocaleString('en-CA')) + (trailingDot ? '.' : '');

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 leading-tight">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <div ref={inputRef} className="flex items-center min-w-0 border border-slate-200 rounded-lg overflow-hidden transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
        {prefix && (
          <span className="px-2 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 py-2 shrink-0">{prefix}</span>
        )}
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
          className="w-full min-w-0 px-2 py-2 text-sm text-slate-800 font-semibold bg-white outline-none text-left"
        />
        {suffix && (
          <span className="px-2 text-xs text-slate-400 bg-slate-50 border-l border-slate-200 py-2 shrink-0">{suffix}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── CHIP ─────────────────────────────────────────────────────────────────────

function Chip({ label, active, onClick, radio = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1 ${
        active
          ? 'bg-white text-brand-600 border-brand-500'
          : 'bg-white text-slate-500 border-slate-200 hover:border-brand-300 hover:text-brand-600'
      }`}
    >
      {(active || !radio) && <span className="text-sm font-bold leading-none">{active ? '✓' : '+'}</span>}
      {label}
    </button>
  );
}

// ─── SECTION CARD ─────────────────────────────────────────────────────────────

function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/60 p-[0.833rem] shadow-sm ${className}`}>
      <h3 className="text-sm font-bold uppercase tracking-widest text-brand-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

// Notification anchored directly under a given element (via `pos`), stays
// visible until the user dismisses it with the close button.
function Toast({ message, pos, onClose }) {
  return createPortal(
    <div
      className="fixed z-50 flex items-start gap-2 px-4 py-3 rounded-xl bg-warning-50 border border-warning-200 text-warning-800 text-sm leading-relaxed shadow-lg"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-warning-700 hover:bg-warning-200/60 transition-colors leading-none"
      >
        ✕
      </button>
    </div>,
    document.body,
  );
}

// ─── ALERT CARD ───────────────────────────────────────────────────────────────

function AlertCard({ variant, message }) {
  const styles = {
    crimson: 'bg-danger-50 border-danger-200 text-danger-800',
    amber:   'bg-warning-50 border-warning-200 text-warning-800',
    slate:   'bg-slate-100 border-slate-300 text-slate-700',
  };
  return (
    <div className={`rounded-xl border px-2.5 py-2.5 text-xs leading-normal ${styles[variant]}`}>
      {message}
    </div>
  );
}

// ─── STEP NOTE ────────────────────────────────────────────────────────────────

// Small status callout shown under each "Save & Optimize" step, color-coded by
// outcome: success (fully optimized), info (neutral fact, e.g. carryforward),
// warning (a shortfall or limit that needs attention).
function StepNote({ variant, inline, children }) {
  const icons = { success: '✓', info: 'ℹ', warning: '⚠' };
  if (inline) {
    const textStyles = {
      success: 'text-slate-600',
      info:    'text-slate-600',
      warning: 'text-warning-700',
    };
    return (
      <div className={`text-xs leading-normal ${textStyles[variant]}`}>
        <span className="font-bold mr-1.5">{icons[variant]}</span>
        {children}
      </div>
    );
  }
  const styles = {
    success: 'bg-accent-50 border-accent-200 text-accent-700',
    info:    'bg-slate-100 border-slate-300 text-slate-700',
    warning: 'bg-warning-50 border-warning-200 text-warning-800',
  };
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs leading-relaxed ${styles[variant]}`}>
      <span className="shrink-0 font-bold leading-none mt-0.5">{icons[variant]}</span>
      <span>{children}</span>
    </div>
  );
}

// ─── STEP BADGE ───────────────────────────────────────────────────────────────

function StepBadge({ n }) {
  return (
    <span className="flex-none w-6 h-6 rounded-full bg-brand-100 border border-brand-200 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">
      {n}
    </span>
  );
}

// ─── STAT PILL ────────────────────────────────────────────────────────────────

function StatPill({ label, value, accent, tooltip, note, noteAccent }) {
  return (
    <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
      <span className="flex items-center gap-1 text-sm font-semibold text-slate-500 leading-tight">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <div className="flex items-baseline justify-between flex-wrap gap-1">
        <span className={`text-base font-bold ${accent ? 'text-brand-600' : 'text-slate-900'}`}>{value}</span>
        {note && <span className={`text-xs font-semibold ${noteAccent ? 'text-brand-600' : 'text-slate-500'}`}>{note}</span>}
      </div>
    </div>
  );
}

// ─── FADE SWITCH ──────────────────────────────────────────────────────────────

// Crossfades between mutually-exclusive panels. `children` is a function so the
// hidden panel's content isn't evaluated (and can't throw on stale/null data)
// until it's actually shown again.
function FadeSwitch({ show, duration = 750, className = '', children }) {
  const [mounted, setMounted] = useState(show);
  const [visible, setVisible] = useState(show);
  const contentRef = useRef(null);
  if (show) contentRef.current = children();

  useEffect(() => {
    let timer;
    if (show) {
      setMounted(true);
      timer = setTimeout(() => setVisible(true), 20);
    } else {
      setVisible(false);
      timer = setTimeout(() => setMounted(false), duration);
    }
    return () => clearTimeout(timer);
  }, [show, duration]);

  if (!mounted) return null;
  return (
    <div className={`transition-opacity ease-in-out ${className}`} style={{ transitionDuration: `${duration}ms`, opacity: visible ? 1 : 0 }}>
      {contentRef.current}
    </div>
  );
}

// ─── HOW IT WORKS MODAL ───────────────────────────────────────────────────────

function HowItWorksModal({ onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[calc(100vh-4rem)] overflow-y-auto">

        <div className="relative flex flex-col items-center text-center px-10 pt-8 pb-5 border-b border-slate-100">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors text-lg leading-none"
          >
            ✕
          </button>
          <img src="/BracketWise-Logo-Horizontal-Dark.svg" alt="BracketWise" style={{ height: '40px', aspectRatio: '3081/923' }} />
          <p className="mt-2 text-sm font-semibold text-slate-500 tracking-wide">{ONBOARDING_MODAL.headline}</p>
        </div>

        <div className="px-6 pt-4 pb-0">
          <p className="text-sm text-slate-500 leading-relaxed">{ONBOARDING_MODAL.subheadline}</p>
        </div>

        <div className="p-6 flex flex-col gap-3">
          {ONBOARDING_MODAL.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-brand-100/55 border border-brand-200/70">
              <span className="flex-none w-6 h-6 rounded-full bg-brand-100/55 border border-brand-200 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-slate-800">{step.title}</h3>
                <p className="text-xs text-slate-500 leading-snug">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-50 border border-slate-400/70 text-xs text-slate-700">
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-slate-600" fill="none">
              <path d="M6 10V8a6 6 0 1112 0v2 M5 10h14v10H5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{ONBOARDING_MODAL.privacyBadge}</span>
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-3">
          <p className="text-xs text-slate-400 leading-relaxed text-center">{ONBOARDING_MODAL.disclaimer}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            Get Started
          </button>
        </div>

      </div>
    </div>,
    document.body,
  );
}

// ─── EMPTY STATE (SKELETON) ───────────────────────────────────────────────────

function EmptyState() {
  const skRow   = 'h-3 rounded bg-slate-200 animate-pulse';
  const skBlock = 'h-5 rounded bg-slate-200 animate-pulse';

  return (
    <div className="flex flex-col gap-1.5">

      {/* Skeleton: Save & Optimize */}
      <SectionCard title="Save & Optimize Your Tax">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-100 border border-brand-200 shrink-0 animate-pulse" />
                <div className={`${skRow} w-24`} />
              </div>
              <div className="p-3 rounded-xl bg-brand-50 border border-brand-200/60 flex flex-col gap-2">
                <div className={`${skBlock} w-16`} />
                <div className="border-t border-brand-200/60 pt-1.5 flex justify-between">
                  <div className={`${skRow} w-20`} />
                  <div className={`${skRow} w-12`} />
                </div>
                <div className={`${skRow} w-full`} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Skeleton: Income & Liabilities */}
      <SectionCard title="Income & Liabilities After Optimization">
        {/* Row 1 — 3 stat pills */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col gap-2">
              <div className={`${skRow} w-16`} />
              <div className={`${skBlock} w-20`} />
            </div>
          ))}
        </div>
        {/* Row 2 — 2 stat pills (Year-End Owing + Tax Saving) */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map(i => (
            <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col gap-2">
              <div className={`${skRow} w-24`} />
              <div className={`${skBlock} w-16`} />
            </div>
          ))}
        </div>
        {/* See breakdown toggle */}
        <div className="mt-2 flex justify-end">
          <div className={`${skRow} w-24`} />
        </div>
      </SectionCard>

      {/* Skeleton: Marginal Rate Chart */}
      <SectionCard title="Combined Marginal Tax Rate">
        <div className="flex gap-3 items-stretch">
          <div className="flex flex-col gap-2 shrink-0 w-32">
            {[0, 1].map(i => (
              <div key={i} className="flex-1 p-2 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col items-center justify-center gap-2">
                <div className={`${skRow} w-16`} />
                <div className={`${skBlock} w-10`} />
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="w-full h-[150px] rounded-xl bg-slate-100 animate-pulse" />
          </div>
        </div>
      </SectionCard>

    </div>
  );
}

// ─── TOGGLE SWITCH ────────────────────────────────────────────────────────────

// ─── CUSTOM DROPDOWN ──────────────────────────────────────────────────────────

function Dropdown({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 w-full"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── MARGINAL RATE CHART ──────────────────────────────────────────────────────

function MarginalRateChart({ plotData, incomeBefore, incomeAfter, marginalRateBefore, marginalRateAfter }) {
  const [hover, setHover] = useState(null); // { income, rate, label }

  if (!plotData || plotData.length === 0) return null;

  const W = 460, H = 240;
  const PAD = { top: 20, right: 20, bottom: 60, left: 56 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const maxIncome = Math.max(
    (plotData[plotData.length - 1]?.income ?? 0) * 1.15,
    (incomeBefore ?? 0) * 1.15,
    300000,
  );
  const maxRate = Math.max(...plotData.map(d => d.combinedRate), 40) + 0;

  const xS = (v) => PAD.left + (v / maxIncome) * cW;
  const yS = (v) => PAD.top + cH - (v / maxRate) * cH;

  // Step-line path
  let path = '';
  for (let i = 0; i < plotData.length; i++) {
    const { income, combinedRate } = plotData[i];
    const nextIncome = plotData[i + 1]?.income ?? maxIncome;
    const x1 = xS(income), x2 = xS(nextIncome), y = yS(combinedRate);
    path += i === 0 ? `M ${x1} ${y}` : ` L ${x1} ${y}`;
    path += ` L ${x2} ${y}`;
  }

  // Marginal rate at a given income, following the same step function as the line.
  const rateAtIncome = (income) => {
    let rate = plotData[0].combinedRate;
    for (const b of plotData) {
      if (income >= b.income) rate = b.combinedRate;
      else break;
    }
    return rate;
  };

  const xBefore = xS(incomeBefore ?? 0);
  const xAfter  = xS(incomeAfter ?? 0);
  const xLeft   = Math.min(xBefore, xAfter);
  const xRight  = Math.max(xBefore, xAfter);

  const xTicks = [0, 50000, 100000, 150000, 200000, 250000, 300000].filter(v => v <= maxIncome);
  const yTicks = [0, 10, 20, 30, 40, 50].filter(v => v <= maxRate);

  // Snap the hover point to the Before/After cursors when the mouse is close to them.
  const SNAP_PX = 8;
  const handleMouseMove = (e) => {
    const svg = e.currentTarget.closest('svg');
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;

    let income = ((px - PAD.left) / cW) * maxIncome;
    income = Math.max(0, Math.min(maxIncome, income));

    let label = null;
    let rate = rateAtIncome(income);
    if ((incomeBefore ?? 0) > 0 && Math.abs(xBefore - px) < SNAP_PX) {
      income = incomeBefore;
      label = 'Before';
      rate = marginalRateBefore ?? rateAtIncome(income);
    } else if ((incomeAfter ?? 0) > 0 && Math.abs(xAfter - px) < SNAP_PX) {
      income = incomeAfter;
      label = 'After';
      rate = marginalRateAfter ?? rateAtIncome(income);
    }

    setHover({ income, rate, label });
  };
  const handleMouseLeave = () => setHover(null);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-label="Combined marginal tax rate chart">
      {/* Grid */}
      {yTicks.map(t => (
        <line key={t} x1={PAD.left} x2={W - PAD.right} y1={yS(t)} y2={yS(t)} stroke="#e2e8f0" strokeWidth="1" />
      ))}

      {/* Income shielded zone */}
      {xRight > xLeft + 3 && (
        <rect x={xLeft} y={PAD.top} width={xRight - xLeft} height={cH} fill="var(--color-brand-100)" fillOpacity="0.55" />
      )}

      {/* Step-line */}
      <path d={path} fill="none" stroke="var(--color-brand-600)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Before cursor — grey dashed */}
      {(incomeBefore ?? 0) > 0 && (
        <>
          <line x1={xBefore} x2={xBefore} y1={PAD.top} y2={PAD.top + cH} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,4" />
          <text x={xBefore + 4} y={PAD.top + 13} fontSize="10" fill="#64748b" fontWeight="500">Before</text>
        </>
      )}

      {/* After cursor — teal solid */}
      {(incomeAfter ?? 0) > 0 && incomeAfter !== incomeBefore && (
        <>
          <line x1={xAfter} x2={xAfter} y1={PAD.top} y2={PAD.top + cH} stroke="var(--color-brand-600)" strokeWidth="2" />
          <text x={xAfter + 4} y={PAD.top + 27} fontSize="10" fill="var(--color-brand-600)" fontWeight="600">After</text>
        </>
      )}

      {/* Shielded zone label */}
      {xRight - xLeft > 50 && (
        <text x={(xLeft + xRight) / 2} y={PAD.top + cH / 2 + 5} textAnchor="middle" fontSize="10" fill="#065f46" fontWeight="700">
          Income Shielded
        </text>
      )}

      {/* Y-axis labels */}
      {yTicks.map(t => (
        <text key={t} x={PAD.left - 6} y={yS(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{t}%</text>
      ))}

      {/* X-axis labels */}
      {xTicks.map(t => (
        <text key={t} x={xS(t)} y={PAD.top + cH + 18} textAnchor="middle" fontSize="10" fill="#94a3b8">
          {t === 0 ? '$0' : `$${t / 1000}K`}
        </text>
      ))}

      {/* Axis titles */}
      <text x={W / 2} y={PAD.top + cH + 40} textAnchor="middle" fontSize="14" fill="#94a3b8">Annual Income</text>
      <text x={12} y={H / 2 + 4} textAnchor="middle" fontSize="14" fill="#94a3b8" transform={`rotate(-90, 12, ${H / 2})`}>Marginal Rate</text>

      {/* Hover capture surface */}
      <rect
        x={PAD.left} y={PAD.top} width={cW} height={cH}
        fill="transparent"
        style={{ cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Hover indicator + tooltip */}
      {hover && (() => {
        const hx = xS(hover.income);
        const hy = yS(hover.rate);
        const lines = hover.label
          ? [
              hover.label === 'Before' ? 'Before optimization' : 'After optimization',
              `Taxable income: $${Math.round(hover.income).toLocaleString('en-CA')}`,
              `${hover.rate.toFixed(1)}% marginal`,
            ]
          : [
              `$${Math.round(hover.income).toLocaleString('en-CA')}`,
              `${hover.rate.toFixed(1)}% marginal`,
            ];
        const boxW = 155;
        const boxH = lines.length * 18 + 14;
        let bx = hx + 12;
        let by = hy - boxH - 12;
        if (bx + boxW > W - PAD.right) bx = hx - boxW - 12;
        if (by < PAD.top) by = hy + 12;
        if (by + boxH > H - PAD.bottom) by = H - PAD.bottom - boxH;

        return (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={PAD.top} y2={PAD.top + cH} stroke="#0f172a" strokeWidth="1" strokeDasharray="3,3" opacity="0.35" />
            <circle cx={hx} cy={hy} r="4" fill="var(--color-brand-600)" stroke="#fff" strokeWidth="1.5" />
            <rect x={bx} y={by} width={boxW} height={boxH} rx="6" fill="#0f172a" opacity="0.92" />
            {lines.map((line, i) => (
              <text key={i} x={bx + 10} y={by + 18 + i * 18} fontSize="13" fill="#fff" fontWeight={i === 0 ? '700' : '400'}>{line}</text>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function App() {
  // Global
  const [year, setYear]         = useState(2026);
  const [province, setProvince] = useState('BC');
  const [isModalOpen, setIsModalOpen] = useState(true);

  // T4 Employment
  const [t4Income, setT4Income]         = useState(0);
  const [bonusIncome, setBonusIncome]   = useState(0);
  const [rrspMatchPct, setRrspMatchPct] = useState(0);

  // SE Income
  const [seGrossIncome, setSeGrossIncome]     = useState(0);
  const [businessExpenses, setBusinessExpenses] = useState(0);
  const seNetIncome = Math.max(0, seGrossIncome - businessExpenses);

  // Other Income chips
  const [capGainsActive, setCapGainsActive]         = useState(false);
  const [otherTaxableActive, setOtherTaxableActive] = useState(false);
  const [capitalGains, setCapitalGains]             = useState(0);
  const [otherTaxableIncome, setOtherTaxableIncome] = useState(0);
  const capGainsInputRef     = useRef(null);
  const otherTaxableInputRef = useRef(null);

  // Deduction chips
  const [childcareActive, setChildcareActive] = useState(false);
  const [medicalActive,   setMedicalActive]   = useState(false);
  const childcareInputRef = useRef(null);
  const medicalInputRef   = useRef(null);
  const [childcare,       setChildcare]       = useState(0);
  const [medicalExpenses, setMedicalExpenses] = useState(0);

  // Registered Accounts
  const [rrspRoomFromNoa,        setRrspRoomFromNoa]      = useState(0);
  const [rrspAlreadyContributed, setRrspAlreadyContrib]   = useState(0);
  const [fhsaAlreadyThisYear,    setFhsaAlreadyThisYear]  = useState(0);
  const [fhsaLifetimeUsed,       setFhsaLifetimeUsed]     = useState(0);
  const [fhsaRoomForYear,        setFhsaRoomForYear]      = useState(0);

  // Toast notification (e.g., for input validation messages)
  const [toast, setToast]               = useState(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const fhsaRoomInputRef = useRef(null);
  const fhsaLifetimeInputRef = useRef(null);
  const rrspRoomInputRef = useRef(null);
  const t4IncomeInputRef = useRef(null);
  const lastFocusedInputRef = useRef(null);

  const showLimitToast = (ref, message) => {
    const rect = ref.current.getBoundingClientRect();
    setToast({ message, pos: { top: rect.bottom + 8, left: rect.left, width: rect.width } });
  };

  const handleFhsaRoomChange = (val) => {
    if (val > 16000) {
      setFhsaRoomForYear(0);
      setCommittedInputs(prev => ({ ...prev, fhsaRoomForYear: 0 }));
      showLimitToast(fhsaRoomInputRef, ALERTS.fhsaRoomExceeded);
    } else {
      setFhsaRoomForYear(val);
    }
  };

  const handleFhsaLifetimeChange = (val) => {
    if (val > 40000) {
      setFhsaLifetimeUsed(0);
      setCommittedInputs(prev => ({ ...prev, fhsaLifetimeUsed: 0 }));
      showLimitToast(fhsaLifetimeInputRef, ALERTS.fhsaLifetimeExceeded);
    } else {
      setFhsaLifetimeUsed(val);
    }
  };

  const handleRrspRoomChange = (val) => {
    const max = LIMITS[Number(year)].rrspMax;
    if (val > max) {
      setRrspRoomFromNoa(0);
      setCommittedInputs(prev => ({ ...prev, rrspRoomFromNoa: 0 }));
      showLimitToast(rrspRoomInputRef, `RRSP Contribution Room can't exceed $${max.toLocaleString('en-CA')} for ${year} — that's the CRA annual deduction limit. Enter the exact amount from your Notice of Assessment (NOA).`);
    } else {
      setRrspRoomFromNoa(val);
    }
  };

  // Available Cash
  const [availableCashInput, setAvailableCashInput] = useState(0);
  const [cashIsMonthly, setCashIsMonthly]           = useState(true);
  const availableCash = cashIsMonthly ? availableCashInput * 12 : availableCashInput;

  // ── Calculation ─────────────────────────────────────────────────────────────
  // Debounce the calculation inputs so the results panel doesn't flash with
  // partial values while the user is mid-keystroke.
  const calcInputs = useMemo(() => ({
    year:                  Number(year),
    province,
    t4Income:              t4Income + bonusIncome,
    rrspMatchIncome:       t4Income,
    seNetIncome,
    capitalGains:          capGainsActive ? capitalGains : 0,
    otherTaxableIncome:    otherTaxableActive ? otherTaxableIncome : 0,
    childcare:             childcareActive ? childcare     : 0,
    medicalExpenses:       medicalActive  ? medicalExpenses : 0,
    rrspRoomFromNoa,
    rrspAlreadyContributed,
    rrspMatchPct,
    fhsaAlreadyThisYear,
    fhsaLifetimeUsed,
    fhsaRoomForYear,
    availableCash,
  }), [
    year, province, t4Income, bonusIncome, seNetIncome,
    capGainsActive, capitalGains, otherTaxableActive, otherTaxableIncome,
    childcareActive, childcare, medicalActive, medicalExpenses,
    rrspRoomFromNoa, rrspAlreadyContributed, rrspMatchPct,
    fhsaAlreadyThisYear, fhsaLifetimeUsed, fhsaRoomForYear, availableCash,
  ]);

  // Commit calcInputs to the results panel on blur (rather than on a timer),
  // so the panel updates the instant the user finishes editing a field.
  const [committedInputs, setCommittedInputs] = useState(calcInputs);
  const calcInputsRef = useRef(calcInputs);
  calcInputsRef.current = calcInputs;

  useEffect(() => {
    const handleFocusOut = (e) => {
      if (e.target.tagName === 'INPUT') {
        setCommittedInputs(calcInputsRef.current);
      }
    };
    const handleFocusIn = (e) => {
      if (e.target.tagName === 'INPUT') {
        lastFocusedInputRef.current = e.target;
      }
    };
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  useEffect(() => {
    if (document.activeElement?.tagName !== 'INPUT') {
      setCommittedInputs(calcInputs);
    }
  }, [calcInputs]);

  const hasIncome = committedInputs.t4Income > 0 || committedInputs.seNetIncome > 0;

  const result = useMemo(() => {
    if (!hasIncome) return null;
    try {
      return calculateTax(committedInputs);
    } catch (e) {
      console.error('Tax calculation error:', e);
      return null;
    }
  }, [committedInputs, hasIncome]);

  const monthlyLiabilities = result ? result.totalLiabilities / 12 : 0;
  const monthlyFhsa        = result ? result.fhsaContrib / 12 : 0;
  const monthlyRrsp        = result ? result.rrspContrib / 12 : 0;
  const monthlyTfsa        = result ? result.tfsa / 12 : 0;

  const fhsaLifetimeReached = result
    ? (LIMITS[committedInputs.year].fhsaLifetime - committedInputs.fhsaLifetimeUsed - result.fhsaContrib) <= 0
    : false;

  const focusInput = (ref) => setTimeout(() => ref.current?.querySelector('input')?.focus(), 0);
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      if (lastFocusedInputRef.current) {
        lastFocusedInputRef.current.focus();
      } else {
        focusInput(t4IncomeInputRef);
      }
    }, 0);
  };

  const otherIncomeChips = [
    { key: 'capGains',     label: 'Realized Capital Gains', active: capGainsActive,     toggle: () => { const next = !capGainsActive;     setCapGainsActive(next);     if (next) focusInput(capGainsInputRef); else setCapitalGains(0);     } },
    { key: 'otherTaxable', label: 'Other Taxable Income',   active: otherTaxableActive, toggle: () => { const next = !otherTaxableActive; setOtherTaxableActive(next); if (next) focusInput(otherTaxableInputRef); else setOtherTaxableIncome(0); } },
  ];

  const deductionChips = [
    { key: 'childcare', label: 'Childcare Expenses', active: childcareActive, toggle: () => { const next = !childcareActive; setChildcareActive(next); if (next) focusInput(childcareInputRef); } },
    { key: 'medical',   label: 'Medical Expenses',   active: medicalActive,   toggle: () => { const next = !medicalActive;   setMedicalActive(next);   if (next) focusInput(medicalInputRef);   } },
  ];

  const anyOtherIncome = capGainsActive || otherTaxableActive;
  const anyDeductions  = childcareActive || medicalActive;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-900 text-slate-900">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-slate-900 border-b border-slate-700/70 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 shrink-0">
            <img src="/BracketWise-Logo-Vertical-Light.svg"   alt="BracketWise" className="block lg:hidden" style={{ height: '60px', aspectRatio: '784/456' }} />
            <img src="/BracketWise-Logo-Horizontal-Light.svg" alt="BracketWise" className="hidden lg:block" style={{ height: '48px', aspectRatio: '3081/923' }} />
            <span className="hidden md:block border-l border-slate-700 pl-4 text-sm font-normal text-slate-400 tracking-wide">Proactive Tax &amp; Wealth Optimization</span>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 border border-slate-700 hover:border-brand-500 hover:text-brand-300 transition-colors"
          >
            <HelpCircle size={14} />
            <span>How it works</span>
          </button>
        </div>
      </header>

      {/* ── TEMPORARY BRAND SWATCHES ── remove when done */}
      {/* <div className="shrink-0 px-6 py-3 flex gap-2" style={{ background: '#f8fafc' }}>
        {[
          ['50',  '#E6F5F3'],
          ['100', '#C8EDE7'],
          ['200', '#97D5CF'],
          ['300', '#5CBFB6'],
          ['400', '#2DBEAF'],
          ['500', '#14B8A6'],
          ['600', '#0D9488'],
          ['700', '#0F766E'],
          ['800', '#115E59'],
        ].map(([level, hex]) => (
          <div key={level} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full h-10 rounded-lg shadow-sm" style={{ background: `var(--color-brand-${level})` }} />
            <span className="text-xs font-semibold text-slate-600">{level}</span>
            <span className="text-[9px] text-slate-400 font-mono">{hex}</span>
          </div>
        ))}
      </div> */}

      {/* ── top gradient ──────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
      <div className="pointer-events-none absolute top-4 inset-x-0 h-4 z-10" style={{ background: 'linear-gradient(to top, transparent, #0f172a)' }} />
      <main className="custom-scrollbar h-full max-w-7xl mx-auto px-6 pb-4 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-5 w-full overflow-y-auto lg:overflow-hidden">

        {/* ══ LEFT COLUMN — PROFILE COCKPIT ════════════════════════════════ */}
        <div className="custom-scrollbar flex flex-col gap-1.5 lg:h-full lg:overflow-y-auto lg:pr-1 py-4">

        {/* § Filing Details */}
        <SectionCard title="Filing Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-500 leading-tight">Tax Year</span>
              <Dropdown
                value={String(year)}
                onChange={v => setYear(Number(v))}
                options={[
                  { value: '2025', label: '2025 Tax Year' },
                  { value: '2026', label: '2026 Tax Year' },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-500 leading-tight">Province of Residence</span>
              <Dropdown
                value={province}
                onChange={setProvince}
                options={Object.entries(PROVINCE_NAMES).map(([k, v]) => ({ value: k, label: v }))}
              />
            </div>
          </div>
        </SectionCard>

        {/* § T4 Employment */}
        <SectionCard title="Employment Income">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <StepperInput
              label="T4 Employment Income"
              value={t4Income}
              onChange={setT4Income}
              tooltip={TOOLTIPS.t4Income}
              inputRef={t4IncomeInputRef}
            />
            <StepperInput
              label="Gross Taxable Bonus"
              value={bonusIncome}
              onChange={setBonusIncome}
              tooltip={TOOLTIPS.bonusIncome}
            />
          </div>
        </SectionCard>

        {/* § Self-Employment + Other Income */}
        <SectionCard title="Self-Employment & Other Income">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <StepperInput
              label="SE Gross Revenue"
              value={seGrossIncome}
              onChange={setSeGrossIncome}
              tooltip={TOOLTIPS.seGrossIncome}
            />
            <StepperInput
              label="Deductible Business Expenses"
              value={businessExpenses}
              onChange={setBusinessExpenses}
              tooltip={TOOLTIPS.businessExpenses}
            />
          </div>
          {seGrossIncome > 0 && (
            <div className="mt-3 flex items-center justify-end px-0 py-1 gap-1">
              <span className="text-xs text-slate-800 font-medium">Net SE Income: </span>
              <span className="text-xs text-slate-800 font-medium">${fmt(seNetIncome)}</span>
            </div>
          )}
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: seGrossIncome > 30000 ? '80px' : '0px' }}
          >
            <div className="mt-3">
              <AlertCard variant="crimson" message={ALERTS.gstRegistration} />
            </div>
          </div>

          <hr className="border-slate-200 my-4" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-3">
              <Chip label="Realized Capital Gains" active={capGainsActive} onClick={otherIncomeChips[0].toggle} />
              {capGainsActive && (
                <StepperInput
                  label="Realized Capital Gains"
                  value={capitalGains}
                  onChange={setCapitalGains}
                  tooltip={TOOLTIPS.capitalGains}
                  inputRef={capGainsInputRef}
                />
              )}
            </div>
            <div className="flex flex-col gap-3">
              <Chip label="Other Taxable Income" active={otherTaxableActive} onClick={otherIncomeChips[1].toggle} />
              {otherTaxableActive && (
                <StepperInput
                  label="Other Taxable Income"
                  value={otherTaxableIncome}
                  onChange={setOtherTaxableIncome}
                  tooltip={TOOLTIPS.otherTaxableIncome}
                  inputRef={otherTaxableInputRef}
                />
              )}
            </div>
          </div>
          {!anyOtherIncome && (
            <p className="text-xs text-slate-400 italic mt-1">No additional income sources selected.</p>
          )}
        </SectionCard>

        {/* § Available Cash */}
        <SectionCard title="Available Liquid Savings">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
              <div className="flex flex-col gap-1.5 pt-[1.625rem]">
                <div className="flex gap-2">
                  <Chip label="Monthly" active={cashIsMonthly} onClick={() => setCashIsMonthly(true)} radio />
                  <Chip label="Annually" active={!cashIsMonthly} onClick={() => setCashIsMonthly(false)} radio />
                </div>
              </div>
              <StepperInput
                label="Available Cash"
                value={availableCashInput}
                onChange={setAvailableCashInput}
                tooltip={TOOLTIPS.availableCash}
              />
            </div>
            {availableCashInput > 0 && (
              <p className="text-xs text-slate-800 font-medium text-right">
                {cashIsMonthly
                  ? <>Equal to <strong className="text-xs text-slate-800 font-medium">${fmt(availableCash)}</strong> annually</>
                  : <>Equal to <strong className="text-xs text-slate-800 font-medium">${fmt(availableCash / 12)}</strong> monthly</>}
              </p>
            )}
          </div>
        </SectionCard>

        {/* § Registered Accounts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <SectionCard title="First Home Savings Account">
            <div className="flex flex-col gap-5">
              <StepperInput
                label="FHSA Participation Room"
                value={fhsaRoomForYear}
                onChange={handleFhsaRoomChange}
                max={16000}
                tooltip={TOOLTIPS.fhsaRoomForYear}
                inputRef={fhsaRoomInputRef}
              />
              <StepperInput
                label="FHSA Contributed This Year"
                value={fhsaAlreadyThisYear}
                onChange={setFhsaAlreadyThisYear}
                max={16000}
                tooltip={TOOLTIPS.fhsaAlreadyContrib}
              />             
              <StepperInput
                label="Lifetime FHSA Contributions"
                value={fhsaLifetimeUsed}
                onChange={handleFhsaLifetimeChange}
                max={40000}
                tooltip={TOOLTIPS.fhsaLifetimeUsed}
                inputRef={fhsaLifetimeInputRef}
              />
            </div>
          </SectionCard>

          <SectionCard title="Retirement Savings Plan">
            <div className="flex flex-col gap-5">
              <StepperInput
                label="RRSP Contribution Room"
                value={rrspRoomFromNoa}
                onChange={handleRrspRoomChange}
                inputRef={rrspRoomInputRef}
                tooltip={TOOLTIPS.rrspRoom}
              />
              <StepperInput
                label="RRSP Contributed This Year"
                value={rrspAlreadyContributed}
                onChange={setRrspAlreadyContrib}
                tooltip={TOOLTIPS.rrspAlreadyContrib}
              />              
              <StepperInput
                label="Employer RRSP Match"
                value={rrspMatchPct}
                onChange={setRrspMatchPct}
                step={0.5}
                min={0}
                max={100}
                prefix=""
                suffix="%"
                tooltip={TOOLTIPS.rrspMatchPct}
              />
            </div>
          </SectionCard>
        </div>

        {/* § Deductions & Credits — chips */}
        <SectionCard title="Household Deductions &amp; Credits">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-3">
              <Chip label="Childcare Expenses" active={childcareActive} onClick={deductionChips[0].toggle} />
              {childcareActive && (
                <StepperInput
                  label="Childcare Expenses"
                  value={childcare}
                  onChange={setChildcare}
                  tooltip={TOOLTIPS.childcare}
                  inputRef={childcareInputRef}
                />
              )}
            </div>
            <div className="flex flex-col gap-3">
              <Chip label="Medical Expenses" active={medicalActive} onClick={deductionChips[1].toggle} />
              {medicalActive && (
                <StepperInput
                  label="Medical Expenses"
                  value={medicalExpenses}
                  onChange={setMedicalExpenses}
                  tooltip={TOOLTIPS.medicalExpenses}
                  inputRef={medicalInputRef}
                />
              )}
            </div>
          </div>
          {!anyDeductions && (
            <p className="text-xs text-slate-400 italic mt-1">No deductions or credits selected.</p>
          )}
        </SectionCard>

        </div>

        {/* ══ RIGHT COLUMN — RESULTS THEATER ═══════════════════════════════ */}
        <div
          className="custom-scrollbar flex flex-col gap-1.5 lg:h-full lg:overflow-y-auto lg:pr-1 py-4"
          aria-live="polite"
        >

        <div className="grid flex-1 min-h-0">

        <FadeSwitch show={!hasIncome} className="[grid-area:1/1] w-full">
          {() => <EmptyState />}
        </FadeSwitch>

        <FadeSwitch show={hasIncome && !!result} className="[grid-area:1/1] w-full h-full">
          {() => result && (
          <div className="flex flex-col gap-1.5 h-full">
            {/* State Alerts */}
            {(result.isInClawbackZone || result.isBpaWasted) && (
              <div className="flex flex-col gap-3">
                {result.isInClawbackZone && (
                  <AlertCard variant="amber" message={clawbackAlert(province)} />
                )}
                {result.isBpaWasted && (
                  <AlertCard variant="slate" message={ALERTS.bpaWasted} />
                )}
              </div>
            )}

            {/* Save & Optimize Your Tax */}
            <SectionCard title="Save & Optimize Your Tax" className="flex-1 flex flex-col">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                {(() => {
                  const s1 = step1Note(result.totalLiabilities, availableCash);
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <StepBadge n={1} />
                        <p className="text-sm font-semibold text-slate-800">Save for Owings</p>
                      </div>
                      <div className="flex-1 p-2.5 rounded-xl bg-brand-50 border border-brand-200/60 flex flex-col gap-1.5">
                        <p className="text-base font-bold text-slate-900">${fmt(monthlyLiabilities)}<span className="text-xs font-normal text-slate-500 ml-1">/ month</span></p>
                        <div className="flex justify-between text-xs border-t border-brand-200/60 pt-1.5 font-bold text-brand-900">
                          <span>Total Year-End Owing</span>
                          <span>${fmt(result.totalLiabilities)}</span>
                        </div>
                        <StepNote variant={s1.variant} inline>{s1.text}</StepNote>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const s2 = step2Note({ fhsaContrib: result.fhsaContrib, fhsaRoom: result.fhsaRoom, fhsaRoomForYear: committedInputs.fhsaRoomForYear, fhsaLifetimeReached, availableCash });
                  const yearEndTotal = fhsaAlreadyThisYear + result.fhsaContrib;
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <StepBadge n={2} />
                        <p className="text-sm font-semibold text-slate-800">Contribute to FHSA</p>
                      </div>
                      <div className="flex-1 p-2.5 rounded-xl bg-brand-50 border border-brand-200/60 flex flex-col gap-1.5">
                        <p className="text-base font-bold text-slate-900">${fmt(monthlyFhsa)}<span className="text-xs font-normal text-slate-500 ml-1">/ month</span></p>
                        <div className="flex justify-between text-xs text-slate-500 border-t border-brand-200/60 pt-1.5">
                          <span>Already Contributed</span>
                          <span className="font-semibold text-slate-700">${fmt(fhsaAlreadyThisYear)}</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-brand-200/60 pt-1.5 font-bold text-brand-900">
                          <span>Total Year-End Contribution</span>
                          <span>${fmt(yearEndTotal)}</span>
                        </div>
                        <StepNote variant={s2.variant} inline>{s2.text}</StepNote>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const s3 = step3Note({ rrspContrib: result.rrspContrib, rrspRoom: result.rrspRoom, rrspRoomFromNoa: committedInputs.rrspRoomFromNoa, availableCash });
                  const employerMatch = t4Income * (rrspMatchPct / 100) * 2;
                  const alreadyAndMatch = rrspAlreadyContributed + employerMatch;
                  const yearEndTotal = alreadyAndMatch + result.rrspContrib;
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <StepBadge n={3} />
                        <p className="text-sm font-semibold text-slate-800">Contribute to RRSP</p>
                      </div>
                      <div className="flex-1 p-2.5 rounded-xl bg-brand-50 border border-brand-200/60 flex flex-col gap-1.5">
                        <p className="text-base font-bold text-slate-900">${fmt(monthlyRrsp)}<span className="text-xs font-normal text-slate-500 ml-1">/ month</span></p>
                        <div className="flex justify-between items-start gap-2 text-xs text-slate-500 border-t border-brand-200/60 pt-1.5">
                          <span className="leading-tight">Already Contributed &amp; Employer Match</span>
                          <span className="font-semibold text-slate-700 shrink-0">${fmt(alreadyAndMatch)}</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-brand-200/60 pt-1.5 font-bold text-brand-900">
                          <span>Total Year-End Contribution</span>
                          <span>${fmt(yearEndTotal)}</span>
                        </div>
                        <StepNote variant={s3.variant} inline>{s3.text}</StepNote>
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const tfsa = tfsaNote(result.tfsa, result.tfsaAnnualLimit);
                  if (!tfsa) return null;
                  return (
                    <div className="sm:col-span-3">
                      <div className="p-2.5 rounded-xl bg-brand-50 border border-brand-200/60 flex items-center gap-6">
                        <p className="text-base font-bold text-slate-900 shrink-0">${fmt(monthlyTfsa)}<span className="text-xs font-normal text-slate-500 ml-1">/ month</span></p>
                        <StepNote variant={tfsa.variant} inline>{tfsa.text}</StepNote>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </SectionCard>

            {/* Income & Liabilities After Optimization */}
            <SectionCard title="Income & Liabilities After Optimization">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <StatPill label="Gross Income"     value={`$${fmt(result.grossIncome)}`}    tooltip={TOOLTIPS.grossIncome} />
                <StatPill label="After-Tax Income" value={`$${fmt(result.afterTaxIncome)}`} tooltip={TOOLTIPS.afterTaxIncome} />
                <StatPill label="Average Rate"     value={fmtPct(result.avgTaxRate)}        tooltip={TOOLTIPS.avgTaxRate} />
              </div>
              {(() => {
                const grossLiabilities = result.totalTax + result.totalCpp + result.ei;
                const totalWithheld    = result.t4TotalTax + result.t4Cpp + result.ei;
                const estimatedRefund  = Math.max(0, totalWithheld - grossLiabilities);
                const cppAndEi         = result.totalCpp + result.ei;
                const beforeGrossLiab  = result.beforeFedTax + result.beforeProvTax + cppAndEi;

                const tableRows = [
                  { label: 'Federal Tax',                  tip: TOOLTIPS.fedTax,           after: result.fedTax,    before: result.beforeFedTax,  prefix: ''  },
                  { label: `Provincial Tax (${province})`, tip: TOOLTIPS.provTax,          after: result.provTax,   before: result.beforeProvTax, prefix: ''  },
                  ...(cppAndEi > 0 ? [
                    { label: 'CPP & EI',                   tip: TOOLTIPS.seCpp,            after: cppAndEi,         before: null,                 prefix: ''  },
                  ] : []),
                  { label: 'Total Liabilities',            tip: TOOLTIPS.totalLiabilities, after: grossLiabilities, before: beforeGrossLiab,      prefix: '', bold: true },
                  ...(totalWithheld > 0 ? [
                    { label: 'Est. Withheld at Source',    tip: TOOLTIPS.withheldAtSource, after: totalWithheld,    before: null,                 prefix: '−' },
                  ] : []),
                ];

                return (
                  <>
                    {/* Primary — always visible */}
                    <div className="grid grid-cols-2 gap-2">

                      <StatPill
                        label="Tax Saving"
                        value={`$${fmt(result.taxSaving)}`}
                        accent={result.taxSaving > 0}
                        tooltip={TOOLTIPS.taxSaving}
                      />
                      <StatPill
                        label="Total Year-End Owing"
                        value={`$${fmt(result.totalLiabilities)}`}
                        tooltip={TOOLTIPS.yearEndOwing}
                        note={estimatedRefund > 0 ? `+$${fmt(estimatedRefund)} refund expected` : undefined}
                        noteAccent={estimatedRefund > 0}
                      />
                    </div>

                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => setBreakdownOpen(v => !v)}
                      className="mt-2 text-xs text-slate-400 hover:text-brand-600 flex items-center gap-1 transition-colors w-full justify-end"
                    >
                      {breakdownOpen ? 'Hide breakdown ▴' : 'See breakdown ▾'}
                    </button>

                    {/* Expandable 3-column breakdown */}
                    {breakdownOpen && (
                      <div className="mt-1 rounded-xl border border-slate-200 overflow-hidden text-xs">
                        <div className="grid grid-cols-[1fr_128px_128px] font-semibold text-slate-400 px-3 py-2 bg-slate-50 border-b border-slate-200">
                          <span></span>
                          <span className="text-right whitespace-nowrap">After Optimization</span>
                          <span className="text-right whitespace-nowrap">Before Optimization</span>
                        </div>
                        {tableRows.map(({ label, tip, after, before, prefix, bold }) => (
                          <div key={label} className={`grid grid-cols-[1fr_128px_128px] px-3 py-2 border-t ${bold ? 'border-slate-300 bg-slate-50/70 font-semibold' : 'border-slate-100'}`}>
                            <span className={`flex items-center gap-1 ${bold ? 'text-slate-700' : 'text-slate-500'}`}>
                              {label} {tip && <InfoTooltip text={tip} />}
                            </span>
                            <span className={`text-right font-semibold ${bold ? 'text-slate-800' : before !== null && after < before ? 'text-brand-700' : 'text-slate-700'}`}>
                              {prefix}${fmt(after)}
                            </span>
                            <span className={`text-right ${before === null ? 'text-[11px] italic text-slate-400' : 'text-slate-400'}`}>
                              {before === null ? 'same' : `${prefix}$${fmt(before)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </SectionCard>

            {/* Marginal Rate Chart */}
            <SectionCard title="Combined Marginal Tax Rate">
              <div className="flex gap-2 items-center">
                <div className="flex flex-col gap-2 shrink-0 w-32">
                  <div className="flex-1 p-2.5 rounded-xl border-2 border-brand-600 flex flex-col items-center justify-center text-center gap-0.5">
                    <p className="text-sm font-semibold text-slate-500 leading-tight flex items-center justify-center gap-0.5 flex-wrap">After Opt. <InfoTooltip text={TOOLTIPS.marginalAfter} /></p>
                    <p className="text-base font-bold text-slate-900">{fmtPct(result.marginalRateAfter)}</p>
                  </div>
                  {/* <div className="flex-1 p-1 rounded-xl bg-brand-100/55 flex flex-col items-center justify-center text-center gap-0.5">
                    <p className="text-xs text-brand-700 leading-tight flex items-center justify-center gap-0.5 flex-wrap">Save in Tax <InfoTooltip text={TOOLTIPS.taxSaving} /></p>
                    <p className="text-sm font-bold text-slate-900">${fmt(result.taxSaving)}</p>
                  </div> */}
                  <div className="flex-1 p-2.5 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center gap-0.5">
                    <p className="text-sm font-semibold text-slate-500 leading-tight flex items-center justify-center gap-0.5 flex-wrap">Before Opt.<InfoTooltip text={TOOLTIPS.marginalBefore} /></p>
                    <p className="text-base font-bold text-slate-900">{fmtPct(result.marginalRateBefore)}</p>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <MarginalRateChart
                    plotData={result.combinedBracketsPlotData}
                    incomeBefore={result.incomeBeforeContributions}
                    incomeAfter={result.incomeAfterContributions}
                    marginalRateBefore={result.marginalRateBefore}
                    marginalRateAfter={result.marginalRateAfter}
                  />
                </div>
              </div>
            </SectionCard>
          </div>
          )}
        </FadeSwitch>

        </div>

        </div>

      </main>
      {/* ── bottom gradient ──────────────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-4 inset-x-0 h-4 z-10" style={{ background: 'linear-gradient(to bottom, transparent, #0f172a)' }} />
      </div>

      {/* ── FOOTER / DISCLAIMER ──────────────────────────────────────────── */}
      <footer className="shrink-0 bg-slate-900 border-t border-slate-700/70 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">© {new Date().getFullYear()} BracketWise · For educational purposes only. Not tax advice.</span>
          <span className="text-xs text-slate-500">
            Designed &amp; developed by{' '}
            <a href="https://nahlania.com/" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 transition-colors">NahlaNia</a>
            {' · Built with Claude Code'}
          </span>
        </div>
      </footer>

      {toast && (
        <Toast message={toast.message} pos={toast.pos} onClose={() => setToast(null)} />
      )}
      {isModalOpen && <HowItWorksModal onClose={handleCloseModal} />}
    </div>
  );
}
