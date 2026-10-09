import Image from 'next/image';

export default function Loading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Opening AuroTap"
      className="aw-launch-screen flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-white px-6 text-slate-900"
    >
      <div className="aw-launch-mark relative grid h-40 w-40 place-items-center">
        <span aria-hidden="true" className="aw-launch-halo absolute inset-0 rounded-full bg-sky-100/70" />
        <span aria-hidden="true" className="aw-launch-ring absolute inset-2 rounded-full border border-sky-200" />
        <span aria-hidden="true" className="aw-launch-ring aw-launch-ring-delay absolute inset-2 rounded-full border border-blue-200" />
        <Image
          src="/aurotap-mark.svg"
          alt="AuroTap"
          width={112}
          height={112}
          priority
          unoptimized
          className="aw-launch-drop relative z-10 h-28 w-28 object-contain"
        />
      </div>
      <p className="mt-5 text-lg font-extrabold tracking-tight">AuroTap</p>
      <p className="mt-1 text-sm font-medium text-slate-500">Water, made effortless.</p>
      <div className="mt-7 h-1 w-24 overflow-hidden rounded-full bg-slate-100">
        <span className="aw-launch-progress block h-full w-1/2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600" />
      </div>
      <style jsx>{`
        .aw-launch-halo { animation: haloPulse 2.2s ease-in-out infinite; }
        .aw-launch-ring { animation: ringPulse 2.2s ease-out infinite; }
        .aw-launch-ring-delay { animation-delay: 1.1s; }
        .aw-launch-drop { animation: dropFloat 2.2s ease-in-out infinite; }
        .aw-launch-progress { animation: progress 1.25s ease-in-out infinite alternate; }
        @keyframes haloPulse { 0%,100% { opacity:.35; transform:scale(.88); } 50% { opacity:1; transform:scale(1.05); } }
        @keyframes ringPulse { 0% { opacity:.65; transform:scale(.72); } 100% { opacity:0; transform:scale(1.18); } }
        @keyframes dropFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-5px); } }
        @keyframes progress { from { transform:translateX(-45%); } to { transform:translateX(145%); } }
        @media (prefers-reduced-motion: reduce) {
          .aw-launch-halo,.aw-launch-ring,.aw-launch-drop,.aw-launch-progress { animation:none; }
          .aw-launch-ring { opacity:.35; }
        }
      `}</style>
    </main>
  );
}
