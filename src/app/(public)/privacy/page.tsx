import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-4 text-slate-700">
        This is a simplified privacy policy for AuroWater. For production, replace this with your legal text.
      </p>
      <div className="mt-8 text-sm text-slate-600">
        <p>Last updated: {new Date().getFullYear()}</p>
        <Link href="/contact" className="text-emerald-600 hover:underline">Contact support</Link>
      </div>
    </main>
  );
}

