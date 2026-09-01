import Link from 'next/link';

export default function RegisterPendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A1628] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-400">AuroWater</p>
        <h1 className="mt-3 font-[Syne] text-2xl font-black">Your account is under review</h1>
        <p className="mt-3 text-sm text-white/60">
          Seller and agent accounts are checked by admin, usually within 24 hours. We notify you on WhatsApp when you can sign in.
        </p>
        <ol className="mt-8 space-y-3 text-left text-sm">
          <li className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-200">
            1. Application submitted
          </li>
          <li className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-cyan-200">
            2. Under review now
          </li>
          <li className="rounded-xl bg-white/5 px-4 py-3 text-white/50">3. Approved — sign in and go live</li>
        </ol>
        <p className="mt-6 text-xs text-white/40">
          If you only joined a city waitlist, you do not have a login yet. We will message you when we launch there.
        </p>
        <a
          href="https://wa.me/919889305803"
          className="mt-6 inline-block text-sm font-bold text-cyan-300"
        >
          WhatsApp support
        </a>
        <p className="mt-6 text-sm text-white/50">
          Already approved?{' '}
          <Link href="/login" className="font-bold text-white">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
