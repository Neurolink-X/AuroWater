'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BOREWELL_GUIDE, estimateBorewell, type BorewellDiameter, type BorewellJob } from '@/lib/borewell-estimate';

const currency = (amount: number) => '₹' + amount.toLocaleString('en-IN');
const field = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';
const diameters: BorewellDiameter[] = ['4.5', '6', '6.5', '8'];

export default function BorewellEstimator() {
  const [job, setJob] = useState<BorewellJob>('drilling');
  const [diameter, setDiameter] = useState<BorewellDiameter>('4.5');
  const [depth, setDepth] = useState(300);
  const [rate, setRate] = useState(100);
  const [casingFeet, setCasingFeet] = useState(0);
  const [pump, setPump] = useState(false);
  const [electrical, setElectrical] = useState(false);
  const [survey, setSurvey] = useState(false);
  const guide = BOREWELL_GUIDE.drilling[diameter];
  const estimate = useMemo(() => {
    try {
      return { result: estimateBorewell({
        job, diameter, depthFeet: depth, ratePerFoot: rate,
        casingFeet, includePump: pump, includeElectrical: electrical, includeSurvey: survey,
      }), error: '' };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : 'Invalid estimate' };
    }
  }, [job, diameter, depth, rate, casingFeet, pump, electrical, survey]);

  const changeDiameter = (next: BorewellDiameter) => {
    setDiameter(next);
    setRate(BOREWELL_GUIDE.drilling[next].min);
  };
  return (
    <section aria-labelledby="borewell-estimate-heading" className="mx-auto max-w-6xl px-5 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-blue-700">Understand the cost before requesting a quote</p>
        <h2 id="borewell-estimate-heading" className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">Borewell cost calculator</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Choose the type of work. For new drilling, enter your estimated depth in feet. The amount below is a planning estimate, not a final bill or confirmed booking price.</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 font-semibold text-slate-900">1. What do you need?</legend>
              <div className="grid grid-cols-3 gap-2">
                {(['drilling', 'inspection', 'repair'] as const).map(option => (
                  <button type="button" key={option} onClick={() => setJob(option)} aria-pressed={job === option} className={`min-h-12 rounded-xl border px-2 py-3 text-sm font-semibold capitalize ${job === option ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-800'}`}>{option}</button>
                ))}
              </div>
            </fieldset>
            {job === 'drilling' ? (
              <>
                <label className="block font-semibold text-slate-900">2. Borewell diameter
                  <select className={`mt-2 ${field}`} value={diameter} onChange={event => changeDiameter(event.target.value as BorewellDiameter)}>
                    {diameters.map(d => <option key={d} value={d}>{d}-inch ({currency(BOREWELL_GUIDE.drilling[d].min)}–{currency(BOREWELL_GUIDE.drilling[d].max)}/ft)</option>)}
                  </select>
                </label>
                <label className="block font-semibold text-slate-900">3. Estimated drilling depth (feet)
                  <input className={`mt-2 ${field}`} type="number" inputMode="numeric" min={50} max={2000} step={1} value={depth} onChange={event => setDepth(Number(event.target.value))} />
                  <span className="mt-1 block text-xs font-normal text-slate-500">Your contractor will confirm the actual depth.</span>
                </label>
                <label className="block font-semibold text-slate-900">4. Indicative drilling rate (₹ per foot)
                  <input className={`mt-2 ${field}`} type="number" inputMode="numeric" min={guide.min} max={guide.max} step={1} value={rate} onChange={event => setRate(Number(event.target.value))} />
                  <span className="mt-1 block text-xs font-normal text-slate-500">Guide: {currency(guide.min)}–{currency(guide.max)}/ft. Actual price depends on terrain, diameter and depth.</span>
                </label>
                <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4">
                  <legend className="px-2 font-semibold text-slate-900">Optional work</legend>
                  <label className="flex items-center gap-3 text-sm text-slate-800"><input type="checkbox" checked={casingFeet > 0} onChange={event => setCasingFeet(event.target.checked ? Math.min(depth, 50) : 0)} /> Include casing pipe</label>
                  {casingFeet > 0 && <label className="block text-sm text-slate-800">Estimated casing length (feet)<input className={`mt-2 ${field}`} type="number" min={0} max={depth} value={casingFeet} onChange={event => setCasingFeet(Number(event.target.value))} /><span className="block text-xs text-slate-500">Allowance uses ₹200/ft; actual casing type and length are confirmed on site.</span></label>}
                  <label className="flex items-center gap-3 text-sm text-slate-800"><input type="checkbox" checked={pump} onChange={event => setPump(event.target.checked)} /> Submersible pump (from ₹15,000)</label>
                  <label className="flex items-center gap-3 text-sm text-slate-800"><input type="checkbox" checked={electrical} onChange={event => setElectrical(event.target.checked)} /> Wiring and panel (from ₹15,000)</label>
                  <label className="flex items-center gap-3 text-sm text-slate-800"><input type="checkbox" checked={survey} onChange={event => setSurvey(event.target.checked)} /> Survey (from ₹3,000)</label>
                </fieldset>
              </>
            ) : <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">For {job}, describe your problem when booking. The technician will confirm the inspection or repair charges before work.</p>}
          </div>
          <aside aria-live="polite" className="self-start rounded-2xl bg-slate-950 p-6 text-white">
            <p className="text-sm font-semibold text-sky-200">Provisional cost breakdown</p>
            {estimate.error ? <p role="alert" className="mt-4 text-amber-200">{estimate.error}</p> : estimate.result && job === 'drilling' ? (
              <>
                <p className="mt-3 text-3xl font-extrabold">{currency(estimate.result.subtotal)}</p>
                <dl className="mt-5 space-y-3 border-t border-white/20 pt-4">
                  {estimate.result.lines.map(line => <div key={line.label} className="flex justify-between gap-3 text-sm"><dt className="text-slate-200">{line.label}</dt><dd className="shrink-0 font-bold">{currency(line.amount)}</dd></div>)}
                </dl>
                <p className="mt-5 text-xs leading-5 text-slate-300">This is an indicative subtotal. It excludes unselected items, transport, unforeseen site work, applicable taxes and permissions. Deeper drilling may have stepped rates. Final quote requires site assessment and your approval.</p>
              </>
            ) : <p className="mt-4 text-sm text-slate-200">Inspection and repair require a site-specific quotation.</p>}
            <Link href="/book?service=borewell" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-sky-400 px-4 font-bold text-slate-950 hover:bg-sky-300">Continue to borewell booking →</Link>
            <p className="mt-3 text-center text-xs text-slate-300">The estimator does not reserve a drilling slot or collect payment.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
