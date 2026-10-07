export default function OfflinePage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-[#1F1F1F] px-6 text-center text-white"
      role="main"
    >
      <img
        src="/icons/icon-192x192.png"
        alt="AuroTap"
        width={176}
        height={176}
        className="h-44 w-44 rounded-[2rem] object-contain"
      />

      <h1 className="mt-16 text-4xl font-normal tracking-tight text-white sm:text-5xl">
        You&apos;re offline
      </h1>
    </main>
  );
}
