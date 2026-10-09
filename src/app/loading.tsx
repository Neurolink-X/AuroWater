import Image from 'next/image';

export default function Loading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Opening AuroTap"
      className="flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[#071A2B] px-6 text-white"
    >
      <div className="aw-launch-mark relative grid h-40 w-40 place-items-center">

        <Image
          src="/aurotap-mark.svg"
          alt="AuroTap"
          width={112}
          height={112}
          priority
          unoptimized
          className="relative z-10 h-28 w-28 object-contain"
        />
      </div>
      <p className="mt-5 text-lg font-extrabold tracking-tight">AuroTap</p>
      <p className="mt-1 text-sm font-medium text-sky-100/75">Water delivery & home services</p>

    </main>
  );
}
