import Link from 'next/link';

export type ActionCard = {
  id: string;
  title: string;
  value: string;
  description: string;
  href: string;
  action: string;
  tone?: 'neutral' | 'attention' | 'good';
};

/** Only accepts derived authenticated role metrics; never guesses balances or payouts. */
export default function LiveOperationsActionCenter({
  title, description, cards, loading = false,
}: {
  title: string;
  description: string;
  cards: readonly ActionCard[];
  loading?: boolean;
}) {
  const tone = {
    neutral: 'border-slate-200 bg-white',
    attention: 'border-amber-200 bg-amber-50',
    good: 'border-emerald-200 bg-emerald-50',
  } as const;
  return <section aria-label={title} className="my-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-slate-900 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-extrabold">{title}</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">{description}</p>
      </div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">Live account data</span>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(card => <article key={card.id}
        className={`flex min-w-0 flex-col rounded-xl border p-4 shadow-sm ${tone[card.tone ?? 'neutral']}`}>
        <h3 className="text-sm font-bold text-slate-800">{card.title}</h3>
        <div className="mt-2 text-3xl font-extrabold tabular-nums" aria-label={card.title}>
          {loading ? '—' : card.value}
        </div>
        <p className="mt-2 flex-1 text-xs leading-5 text-slate-600">{card.description}</p>
        <Link href={card.href} className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-cyan-800 hover:underline focus-visible:underline">
          {card.action} →
        </Link>
      </article>)}
    </div>
  </section>;
}
