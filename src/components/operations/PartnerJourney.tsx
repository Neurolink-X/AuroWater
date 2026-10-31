import Link from 'next/link';

type Role = 'supplier' | 'technician';
type JourneyStep = { title: string; description: string; href: string; cta: string };

const steps: Record<Role, readonly JourneyStep[]> = {
  supplier: [
    { title: '1. Set availability & coverage', description: 'Keep your delivery area, online status and contact details current. A PIN code alone is not proof of dispatch coverage.', href: '/supplier/settings', cta: 'Dispatch settings' },
    { title: '2. Check real stock', description: 'Reconcile available and reserved cans before you accept orders. Do not promise stock you cannot fulfil.', href: '/supplier/inventory', cta: 'Open inventory' },
    { title: '3. Deliver assigned orders', description: 'Accept only jobs you can fulfil; follow the order status and capture completion in the existing workflow.', href: '/supplier/orders', cta: 'Manage orders' },
    { title: '4. Reconcile earnings', description: 'Compare completed jobs with posted earnings and payout status. A payout marked paid is not bank-transfer proof.', href: '/supplier/earnings', cta: 'Review earnings' },
  ],
  technician: [
    { title: '1. Review your assignment', description: 'Confirm the assigned service, customer address and time slot before travelling.', href: '/technician/jobs', cta: 'View jobs' },
    { title: '2. Navigate & communicate', description: 'Use the accepted job detail for the address and authorized contact. Never share customer information outside the job.', href: '/technician/jobs', cta: 'Open assigned job' },
    { title: '3. Verify after work', description: 'Ask the customer for the free in-app service code only after finishing. Never request a login or payment OTP.', href: '/technician/jobs', cta: 'Complete a job' },
    { title: '4. Check completion & earnings', description: 'Confirm the job completion result before treating an amount as earned or collected.', href: '/technician/dashboard', cta: 'View dashboard' },
  ],
};
const hindi: Record<Role, string> = {
  supplier: 'सप्लायर का काम: उपलब्धता → स्टॉक → डिलीवरी → कमाई',
  technician: 'टेक्नीशियन का काम: असाइनमेंट → विज़िट → सत्यापन → कमाई',
};
export default function PartnerJourney({ role, isHindi = false }: { role: Role; isHindi?: boolean }) {
  const entries = steps[role];
  return <section aria-labelledby={`partner-journey-${role}`} className="my-5 rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id={`partner-journey-${role}`} className="text-base font-extrabold text-slate-900 sm:text-lg">
        {isHindi ? hindi[role] : role === 'supplier' ? 'Your daily delivery workflow' : 'Your job completion workflow'}
      </h2>
      <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800">4 steps</span>
    </div>
    <p className="mt-2 text-xs leading-5 text-slate-600">
      {isHindi ? 'ये काम की गाइड है, लाइव स्टेटस नहीं। अंतिम निर्णय ऐप के असली ऑर्डर और उपलब्धता पर होगा।'
        : 'A practical guide, not a live status indicator. Only real assigned jobs, stock and payments determine completion.'}
    </p>
    <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {entries.map(step => <li key={step.title} className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
        <p className="mt-2 flex-1 text-xs leading-5 text-slate-600">{step.description}</p>
        <Link href={step.href} className="mt-3 inline-flex min-h-10 items-center text-xs font-bold text-cyan-800 hover:underline focus-visible:underline">
          {step.cta} →
        </Link>
      </li>)}
    </ol>
  </section>;
}
