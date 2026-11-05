'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';
import { listMyFiles, shrinkImageIfNeeded, uploadPrivateFile, validateClientFile, type UserFile, type SlotInfo } from '@/lib/private-file-client';

type Receipt = {
  application: { id: string; type: string; role: string; status: string; created_at: string; reviewed_at: string | null; rejection_note: string | null };
  account_role: string;
};
type FileView = { files: UserFile[]; slots: SlotInfo[] };
const MANDATORY = ['aadhaar_front', 'aadhaar_back', 'skill_certificate'];
const LABELS: Record<string, [string, string]> = {
  aadhaar_front: ['पहचान पत्र - सामने', 'Government ID - front'],
  aadhaar_back: ['पहचान पत्र - पीछे', 'Government ID - back'],
  skill_certificate: ['काम या कौशल का प्रमाण', 'Skill / work-experience proof'],
};
function info(status: string): [string, string] {
  if (status === 'approved') return ['आपका आवेदन स्वीकृत है।', 'Your application is approved.'];
  if (status === 'rejected') return ['आवेदन में सुधार की आवश्यकता है।', 'Your application needs attention.'];
  return ['आवेदन दर्ज हो गया है। पहचान व कौशल सत्यापन बाकी है।', 'Application received. Identity and skills review are still pending.'];
}

export default function ProApplicationSuccessPage() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [files, setFiles] = useState<FileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustLogin, setMustLogin] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [hi, setHi] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = await getToken();
      if (!token) { setMustLogin(true); return; }
      setMustLogin(false);
      const id = new URLSearchParams(window.location.search).get('id');
      const url = '/api/applications/me' + (id ? '?id=' + encodeURIComponent(id) : '');
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      const body = await r.json().catch(() => ({}));
      if (r.status === 401) { setMustLogin(true); return; }
      if (!r.ok || !body?.data) { setReceipt(null); setError(body.error || 'No submitted application found.'); return; }
      const data = body.data as Receipt;
      setReceipt(data);
      if (data.application.type === 'technician') {
        const docs = await listMyFiles();
        setFiles({ slots: docs.slots, files: docs.files });
      } else setFiles(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to verify the application receipt.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function sendDocument(slot: SlotInfo, file?: File) {
    if (!file || uploading) return;
    setUploadError(''); setUploading(slot.slot);
    try {
      const candidate = await shrinkImageIfNeeded(file);
      const issue = await validateClientFile(candidate);
      if (issue) throw new Error(issue);
      await uploadPrivateFile({ file: candidate, category: slot.category, slot: slot.slot, retries: 0 });
      const docs = await listMyFiles();
      setFiles({ slots: docs.slots, files: docs.files });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally { setUploading(''); }
  }
  const base = 'min-h-screen bg-slate-950 px-4 py-12 text-white';
  const loginHref = '/auth/login?returnTo=' + encodeURIComponent('/register/pro/success' + (typeof window !== 'undefined' ? window.location.search : ''));
  return <main className={base}>
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-bold text-cyan-300">← AuroTap</Link>
        <button type="button" onClick={() => setHi(v => !v)} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold">
          {hi ? 'English' : 'हिंदी'}
        </button>
      </div>
      <section className="rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-xl sm:p-7" aria-live="polite">
        {loading ? <p role="status">{hi ? 'आवेदन की जाँच हो रही है…' : 'Checking your application…'}</p>
          : mustLogin ? <>
            <h1 className="text-2xl font-extrabold">{hi ? 'आवेदन की स्थिति देखने के लिए साइन इन करें' : 'Sign in to view application status'}</h1>
            <p className="mt-3 text-slate-300">{hi ? 'फ़ॉर्म की जानकारी इस डिवाइस पर ड्राफ्ट के रूप में हो सकती है। साइन इन करने के बाद Submit Application दबाएँ।' : 'Your form may be saved as a draft on this device. Sign in and press Submit Application to actually send it.'}</p>
            <Link href={loginHref} className="mt-5 inline-flex rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">{hi ? 'साइन इन करें' : 'Sign in'}</Link>
          </> : !receipt ? <>
            <h1 className="text-2xl font-extrabold">{hi ? 'आवेदन जमा होने की पुष्टि नहीं हुई' : 'Application not confirmed'}</h1>
            <p className="mt-3 text-amber-200">{error || (hi ? 'इस खाते में जमा आवेदन नहीं मिला।' : 'No saved application for this account.')}</p>
            <Link href="/register/pro?role=plumber#apply" className="mt-5 inline-flex rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">{hi ? 'ड्राफ्ट खोलें / आवेदन करें' : 'Return to application'}</Link>
          </> : <>
            <h1 className="text-2xl font-extrabold">{hi ? info(receipt.application.status)[0] : info(receipt.application.status)[1]}</h1>
            <div className="mt-4 space-y-1 rounded-xl bg-white/5 p-4 text-sm text-slate-200">
              <p>{hi ? 'आवेदन संख्या' : 'Application ID'}: <span className="break-all font-mono text-cyan-300">{receipt.application.id}</span></p>
              <p>{hi ? 'कार्य' : 'Role'}: <strong>{receipt.application.role.replaceAll('_', ' ')}</strong></p>
              <p>{hi ? 'स्थिति' : 'Status'}: <strong>{receipt.application.status.replaceAll('_', ' ')}</strong></p>
            </div>
            {receipt.application.rejection_note && <p role="alert" className="mt-4 rounded-xl bg-rose-900/50 p-3 text-rose-100">{receipt.application.rejection_note}</p>}
            <p className="mt-4 text-sm text-slate-300">{hi ? 'जाँच के बाद व्यवस्थापक आपके खाते में भूमिका सक्रिय करेंगे। बिना स्वीकृति कोई सर्विस जॉब नहीं मिलेगा। आपका लॉगिन वही रहेगा।' : 'Admin reviews your documents and activates the service role after approval. You cannot receive jobs before approval. Use your existing login.'}</p>
            {receipt.application.status === 'approved' && <Link href={receipt.account_role === 'supplier' ? '/supplier/dashboard' : '/technician/dashboard'} className="mt-4 inline-flex rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950">{hi ? 'डैशबोर्ड खोलें' : 'Open dashboard'}</Link>}
          </>}
      </section>

      {receipt?.application.type === 'technician' && receipt.application.status !== 'rejected' && <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-7">
        <div>
          <h2 className="text-xl font-bold">{hi ? 'ज़रूरी दस्तावेज़ / सत्यापन' : 'Required documents / verification'}</h2>
          <p className="mt-2 text-sm text-slate-300">{hi ? 'केवल एक बार सुरक्षित अपलोड करें। JPG, PNG, WebP या PDF, अधिकतम 5 MB। दस्तावेज़ सिर्फ़ सत्यापन टीम देखेगी।' : 'Upload securely once. JPG, PNG, WebP or PDF, maximum 5 MB. Only authorized reviewers can access your private documents.'}</p>
        </div>
        {MANDATORY.map(key => {
          const slot = files?.slots.find(x => x.slot === key);
          const latest = files?.files.find(x => x.document_slot === key);
          const approved = latest?.review_status === 'approved';
          return <div key={key} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{hi ? LABELS[key][0] : LABELS[key][1]}</p>
              <p className={'mt-1 text-sm ' + (approved ? 'text-emerald-300' : latest?.review_status === 'rejected' ? 'text-rose-300' : 'text-amber-200')}>{!latest ? (hi ? 'जमा नहीं हुआ' : 'Not uploaded') : latest.review_status === 'approved' ? (hi ? 'स्वीकृत' : 'Approved') : latest.review_status === 'rejected' ? (hi ? 'अस्वीकृत — दोबारा अपलोड करें' : 'Rejected — upload a corrected document') : (hi ? 'जाँच जारी है' : 'Pending review')}</p>
              {latest?.review_note && latest.review_status === 'rejected' && <p className="mt-1 text-xs text-rose-200">{latest.review_note}</p>}
            </div>
            {!approved && slot && <label className={'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-4 py-2 text-sm font-bold ' + (uploading ? 'bg-slate-600 text-slate-200' : 'bg-cyan-400 text-slate-950')}>
              {uploading === key ? (hi ? 'अपलोड हो रहा है…' : 'Uploading…') : latest?.review_status === 'pending' ? (hi ? 'नया अपलोड' : 'Replace pending') : (hi ? 'अपलोड करें' : 'Upload')}
              <input aria-label={hi ? LABELS[key][0] : LABELS[key][1]} className="sr-only" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" disabled={Boolean(uploading)} onChange={e => { void sendDocument(slot, e.target.files?.[0]); e.target.value=''; }} />
            </label>}
          </div>;
        })}
        {uploadError && <p role="alert" className="rounded-xl bg-rose-950 p-3 text-sm text-rose-200">{uploadError}</p>}
        {!files && <p className="text-sm text-amber-200">{hi ? 'दस्तावेज़ सूची उपलब्ध नहीं है। लॉगिन और कनेक्शन जाँचें।' : 'Document list is unavailable. Check your login and connection.'}</p>}
        <p className="text-xs text-slate-400">{hi ? 'कौशल प्रमाण के लिए सर्टिफ़िकेट या काम का उचित प्रमाण दें। अंतिम स्वीकृति एडमिन जाँच के बाद होगी।' : 'Provide a trade certificate or verifiable work evidence. Final eligibility requires admin review.'}</p>
      </section>}
      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <button onClick={() => void load()} className="rounded-xl border border-white/20 px-4 py-3 text-cyan-200">{hi ? 'स्थिति रिफ्रेश करें' : 'Refresh status'}</button>
        <Link href="/contact" className="rounded-xl border border-white/20 px-4 py-3 text-slate-200">{hi ? 'सहायता' : 'Contact support'}</Link>
      </div>
    </div>
  </main>;
}
