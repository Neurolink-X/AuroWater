'use client';

import Link from 'next/link';
import {
  AlertCircle,
  ChevronRight,
  Headphones,
  LifeBuoy,
} from 'lucide-react';

export default function CustomerSupportPage() {
  return (
    <main className="min-h-screen bg-[#F5F9FF] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-gradient-to-br from-blue-700 to-blue-500 p-6 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-3">
              <Headphones className="h-6 w-6" />
            </div>

            <div>
              <p className="text-sm font-medium text-blue-100">
                AUROWATER SUPPORT
              </p>

              <h1 className="text-2xl font-bold">
                How can we help?
              </h1>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-blue-100">
            Tell us what happened. We will help resolve your
            issue as quickly as possible.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link
            href="/customer/orders"
            className="group rounded-3xl border border-blue-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <LifeBuoy className="h-7 w-7 text-blue-600" />

            <h2 className="mt-4 font-bold text-slate-900">
              Issue with an order?
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Select an order and report a problem.
            </p>

            <div className="mt-4 flex items-center text-sm font-semibold text-blue-600">
              View orders
              <ChevronRight className="ml-1 h-4 w-4" />
            </div>
          </Link>

          <Link
            href="/customer/orders"
            className="group rounded-3xl border border-blue-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <AlertCircle className="h-7 w-7 text-orange-500" />

            <h2 className="mt-4 font-bold text-slate-900">
              Report a service issue
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Report quality, delivery, staff or payment issues.
            </p>

            <div className="mt-4 flex items-center text-sm font-semibold text-blue-600">
              Get help
              <ChevronRight className="ml-1 h-4 w-4" />
            </div>
          </Link>
        </div>

        <div className="mt-6 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-900">
            AuroWater Service Promise
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Every complaint is reviewed to improve delivery,
            service quality and customer experience.
          </p>
        </div>
      </div>
    </main>
  );
}
