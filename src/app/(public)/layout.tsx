import PwaInstallBanner from '@/components/pwa/PwaInstallBanner';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PwaInstallBanner />
    </>
  );
}
