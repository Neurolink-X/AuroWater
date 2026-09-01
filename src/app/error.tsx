'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A1628] px-4">
      <div className="max-w-sm text-center">
        <div className="mb-4 text-4xl" aria-hidden>
          ⚡
        </div>
        <h2 className="mb-2 text-xl font-bold text-white">Something went wrong</h2>
        <p className="mb-6 text-sm text-neutral-400">
          {process.env.NODE_ENV === 'development' ? error.message : 'Please try again.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-cyan-400"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
