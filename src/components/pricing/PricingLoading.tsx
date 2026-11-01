'use client';
export default function PricingLoading({error,retry}:{error?:string|null;retry:()=>Promise<void>}) {
 return <section role="status" aria-live="polite" aria-busy={!error} className="mx-auto max-w-5xl px-5 py-16">
 <h1 className="text-2xl font-bold text-slate-900">{error?'Live prices unavailable':'Checking current prices'}</h1>
 <p className="mt-2 text-slate-600">{error?'Please retry before booking.':'Loading the latest published rates and fees for your city.'}</p>
 {error?<button type="button" className="mt-5 rounded-xl bg-cyan-800 px-5 py-3 font-bold text-white" onClick={()=>void retry()}>Retry prices</button>:<div aria-hidden="true" className="mt-8 grid gap-4 sm:grid-cols-3">{[1,2,3].map(n=><div key={n} className="h-40 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none"/>)}</div>}
 </section>;
}
