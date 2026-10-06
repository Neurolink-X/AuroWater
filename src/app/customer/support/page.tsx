'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Headphones,
  Home,
  LifeBuoy,
  Mail,
  MessageCircle,
  Phone,
  ReceiptText,
} from 'lucide-react';

import BottomNav from '@/components/customer/BottomNav';
import { useAuth } from '@/hooks/useAuth';

const SUPPORT_PHONE = '+919889305803';
const SUPPORT_EMAIL = 'support.aurotap@gmail.com';

const WHATSAPP_URL = `https://wa.me/919889305803?text=${encodeURIComponent(
  'Hi AuroTap! I need help with my order or service.'
)}`;

export default function CustomerSupportPage() {
  const router = useRouter();
  const pathname =
    usePathname() ?? '/customer/support';

  const {
    hydrated,
    isLoggedIn,
    isCustomer,
  } = useAuth();

  useEffect(() => {
    if (!hydrated) return;

    if (!isLoggedIn || !isCustomer) {
      router.replace(
        `/auth/login?returnTo=${encodeURIComponent(pathname)}`
      );
    }
  }, [
    hydrated,
    isLoggedIn,
    isCustomer,
    pathname,
    router,
  ]);

  useEffect(() => {
    document.title = 'Customer Support | AuroTap';

    let robots = document.querySelector(
      'meta[name="robots"]'
    ) as HTMLMetaElement | null;

    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }

    robots.content = 'noindex,nofollow';
  }, []);

  if (
    !hydrated ||
    (hydrated && !isLoggedIn)
  ) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <div
            className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600"
            aria-hidden="true"
          />

          <p className="mt-4 text-sm font-semibold text-slate-500">
            Loading support…
          </p>
        </div>
      </main>
    );
  }

  if (!isCustomer) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertCircle
              className="h-7 w-7"
              aria-hidden="true"
            />
          </div>

          <h1 className="mt-5 text-xl font-black text-slate-950">
            Customer support
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Please sign in with a customer account to
            access customer support.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800"
          >
            Back to AuroTap
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-[100dvh] bg-gradient-to-b from-sky-50 via-white to-white pb-[calc(6rem+env(safe-area-inset-bottom))] text-slate-900">
        <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">

          {/* Header */}
          <header>
            <Link
              href="/customer/home"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 py-2 text-sm font-black text-slate-600 transition hover:bg-white hover:text-sky-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
            >
              <ArrowLeft
                className="h-4 w-4"
                aria-hidden="true"
              />
              Dashboard
            </Link>

            <div className="mt-4 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#072B49] via-[#075985] to-[#0EA5E9] p-6 text-white shadow-xl shadow-sky-200/50 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
                    <Headphones
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    AuroTap Support
                  </div>

                  <h1 className="mt-4 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
                    We&apos;re here to help.
                  </h1>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
                    Get help with an order, delivery, payment,
                    water quality, or another AuroTap service.
                  </p>
                </div>

                <div className="hidden shrink-0 sm:block">
                  <div className="grid h-20 w-20 place-items-center rounded-3xl border border-white/15 bg-white/10 backdrop-blur">
                    <LifeBuoy
                      className="h-10 w-10 text-white"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Primary support choices */}
          <section className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">

              <Link
                href="/customer/history"
                className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50">
                    <ReceiptText
                      className="h-6 w-6 text-sky-700"
                      aria-hidden="true"
                    />
                  </div>

                  <ChevronRight
                    className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-sky-500"
                    aria-hidden="true"
                  />
                </div>

                <h2 className="mt-5 text-lg font-black text-slate-950">
                  Need help with an order?
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Open your order history, choose the relevant
                  order, and review its tracking and details.
                </p>

                <div className="mt-5 inline-flex items-center text-sm font-black text-sky-700">
                  View my orders
                  <ArrowRight
                    className="ml-1.5 h-4 w-4"
                    aria-hidden="true"
                  />
                </div>
              </Link>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="group rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50">
                    <MessageCircle
                      className="h-6 w-6 text-emerald-700"
                      aria-hidden="true"
                    />
                  </div>

                  <ChevronRight
                    className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-500"
                    aria-hidden="true"
                  />
                </div>

                <h2 className="mt-5 text-lg font-black text-slate-950">
                  Talk to support
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Contact the AuroTap support team directly on
                  WhatsApp for help with your situation.
                </p>

                <div className="mt-5 inline-flex items-center text-sm font-black text-emerald-700">
                  Open WhatsApp
                  <ArrowRight
                    className="ml-1.5 h-4 w-4"
                    aria-hidden="true"
                  />
                </div>
              </a>
            </div>
          </section>

          {/* Common issues */}
          <section className="mt-6">
            <div className="mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
                Common help
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-950">
                What can we help with?
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HelpTopic
                icon="💧"
                title="Water quality"
                description="Quality or delivery concerns"
              />

              <HelpTopic
                icon="🚚"
                title="Delivery"
                description="Late, missed, or wrong delivery"
              />

              <HelpTopic
                icon="💳"
                title="Payment"
                description="Payment or billing questions"
              />

              <HelpTopic
                icon="🧰"
                title="Service"
                description="Home water service concerns"
              />
            </div>
          </section>

          {/* How support works */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50">
                <CheckCircle2
                  className="h-5 w-5 text-emerald-600"
                  aria-hidden="true"
                />
              </div>

              <div>
                <p className="text-sm font-black text-slate-950">
                  What happens next?
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Start with your order details or contact
                  support directly. Keeping the order number and
                  issue details ready helps us understand the
                  problem faster.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <SupportStep
                number="1"
                title="Identify the issue"
                text="Open the relevant order or describe what happened."
              />

              <SupportStep
                number="2"
                title="Contact us"
                text="Use WhatsApp or call support when you need direct help."
              />

              <SupportStep
                number="3"
                title="Resolve it"
                text="We review the situation and guide you on the next step."
              />
            </div>
          </section>

         {/* Direct contact */}
<section className="mt-6">
  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5 sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        Direct contact
      </p>

      <h2 className="mt-1 text-lg font-black text-slate-950">
        Prefer to contact us directly?
      </h2>
    </div>

    <div className="grid sm:grid-cols-3">
      {/* WhatsApp */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        className="group flex items-center gap-3 border-b border-slate-100 p-5 transition hover:bg-emerald-50 sm:border-b-0 sm:border-r"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50">
          <MessageCircle
            className="h-5 w-5 text-emerald-700"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">
            WhatsApp
          </p>

          <p className="mt-0.5 text-xs text-slate-500">
            Message AuroTap support
          </p>
        </div>

        <ArrowRight
          className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-600"
          aria-hidden="true"
        />
      </a>

      {/* Phone */}
      <a
        href={`tel:${SUPPORT_PHONE}`}
        className="group flex items-center gap-3 border-b border-slate-100 p-5 transition hover:bg-sky-50 sm:border-b-0 sm:border-r"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-50">
          <Phone
            className="h-5 w-5 text-sky-700"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">
            Call support
          </p>

          <p className="mt-0.5 text-xs text-slate-500">
            {SUPPORT_PHONE}
          </p>
        </div>

        <ArrowRight
          className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-sky-600"
          aria-hidden="true"
        />
      </a>

      {/* Email */}
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="group flex items-center gap-3 p-5 transition hover:bg-violet-50"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-50">
          <Mail
            className="h-5 w-5 text-violet-700"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">
            Email support
          </p>

          <p className="mt-0.5 break-all text-xs text-slate-500">
            {SUPPORT_EMAIL}
          </p>
        </div>

        <ArrowRight
          className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-violet-600"
          aria-hidden="true"
        />
      </a>
    </div>
  </div>
</section>
          {/* Footer navigation */}
          <section className="mt-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/customer/home"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Home
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                Customer dashboard
              </Link>

              <Link
                href="/"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800"
              >
                <Home
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                AuroTap home
              </Link>
            </div>
          </section>

          <footer className="px-2 pb-4 pt-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
              AUROTAP.IN
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Clear help. Direct support. Better service.
            </p>
          </footer>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Supporting components                                                      */
/* -------------------------------------------------------------------------- */

function HelpTopic({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className="text-xl"
        aria-hidden="true"
      >
        {icon}
      </div>

      <h3 className="mt-3 text-sm font-black text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function SupportStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs font-black text-white">
          {number}
        </span>

        <h3 className="text-sm font-black text-slate-900">
          {title}
        </h3>
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {text}
      </p>
    </div>
  );
}
