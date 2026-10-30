// PATH: src/app/documents/page.tsx
import DocumentUploader from '@/components/private-files/DocumentUploader';

export const metadata = { title: 'My documents · AuroTap' };

export default function DocumentsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Verification</p>
        <h1 className="mt-2 text-3xl font-black">Your documents</h1>
        <p className="mt-2 mb-6 text-sm leading-6 text-slate-600">
          Files are stored privately and encrypted in transit. Only you and our verification team can open them.
        </p>
        <DocumentUploader />
      </div>
    </main>
  );
}
