import Image from 'next/image';

export default function Loading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Opening AuroTap"
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#05111B] px-6 text-white select-none"
    >
      {/* Background Ambient Glow Effect for Premium Look */}
      <div className="absolute h-64 w-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none animate-pulse" />

      {/* Pulsing Ripple Rings */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-36 w-36 rounded-full border border-sky-400/20 animate-ping opacity-75" />
        <div className="absolute h-28 w-28 rounded-full border border-sky-400/40 animate-pulse" />

        {/* Brand Logo Container with Glassmorphism */}
        <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-b from-white/10 to-white/5 shadow-2xl backdrop-blur-md border border-white/10 animate-bounce-subtle">
          <Image
            src="/aurotap-mark.svg"
            alt="AuroTap"
            width={64}
            height={64}
            priority
            unoptimized
            className="h-14 w-14 object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]"
          />
        </div>
      </div>

      {/* Brand Typography */}
      <div className="mt-8 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">
          AuroTap
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-sky-400/90">
          Fresh Water Delivery & Services
        </p>
      </div>

      {/* Modern Minimalist Loader Bar */}
      <div className="mt-8 h-1 w-32 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-full origin-left bg-gradient-to-r from-sky-400 to-cyan-300 animate-loading-bar" />
      </div>

      {/* Inline Styles for Custom Smooth Animations */}
      <style jsx global>{`
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        .animate-loading-bar {
          animation: loadingBar 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }
        @keyframes subtleBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-bounce-subtle {
          animation: subtleBounce 2.5s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
