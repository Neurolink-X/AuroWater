'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  TECHNICIAN_SERVICE_OPTIONS,
  type TechnicianServiceKey,
} from '@/lib/technician-service-approval';

type Status = {
  city: string | null;
  full_name: string | null;
  account_active: boolean;
  documents_approved: boolean;
  approved_services: string[];
  pending_application: { id: string; status: string; requested_role: string | null } | null;
  recent_application: { id: string; status: string } | null;
};
type ServerReply<T> = { success?: boolean; data?: T; error?: string };

async function authorized<T>(method: 'GET' | 'POST', body?: object): Promise<T> {
  const token=await getToken();
  if(!token) throw new Error('SIGN_IN_REQUIRED');
  const response=await fetch('/api/technician/service-applications',{
    method,cache:'no-store',
    headers:{Authorization:`Bearer ${token}`, ...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,
  });
  const result=await response.json().catch(()=>({})) as ServerReply<T>;
  if(response.status===401)throw new Error('SIGN_IN_REQUIRED');
  if(response.status===403)throw new Error(result.error||'Technician account permission required.');
  if(!response.ok || !result.data)throw new Error(result.error || 'Service request unavailable. Please retry.');
  return result.data;
}

export default function TechnicianServiceApplicationPage() {
  const {hydrated,isLoggedIn,role}=useAuth();
  const {language}=useLanguage();
  const hi=language==='hi';
  const eligible=hydrated && isLoggedIn && role==='technician';
  const [status,setStatus]=useState<Status|null>(null);
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const [receipt,setReceipt]=useState('');
  const [serviceKey,setServiceKey]=useState<TechnicianServiceKey>('plumbing');
  const [workingArea,setWorkingArea]=useState('');
  const [workingPincode,setWorkingPincode]=useState('');
  const [experienceYears,setExperienceYears]=useState('1');
  const [description,setDescription]=useState('');

  const reload=useCallback(async()=>{
    if(!eligible)return;
    setLoading(true);setError('');
    try {
      const next=await authorized<Status>('GET');
      setStatus(next);
      const firstUnapproved=(Object.keys(TECHNICIAN_SERVICE_OPTIONS) as TechnicianServiceKey[])
        .find(key => !next.approved_services.includes(key));
      // Background refresh must NEVER overwrite the user's in-progress choice.
      // Only move the selector if the current service has become approved.
      if(firstUnapproved) setServiceKey(current =>
        next.approved_services.includes(current) ? firstUnapproved : current);
    }
    catch(e){setStatus(null);setError(e instanceof Error?e.message:'Could not load eligibility.');}
    finally{setLoading(false);}
  },[eligible]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(initial);
  }, [reload]);
  useEffect(()=>{
    if(!eligible)return;
    const visible=()=>{if(document.visibilityState==='visible' && navigator.onLine)void reload();};
    const timer=window.setInterval(visible,60000);
    window.addEventListener('online',visible);
    window.addEventListener('aurotap:verification-changed',visible);
    return()=>{window.clearInterval(timer);window.removeEventListener('online',visible);window.removeEventListener('aurotap:verification-changed',visible);};
  },[eligible,reload]);

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!eligible || submitting || !status)return;
    setError('');setReceipt('');
    if(!/^[1-9][0-9]{5}$/.test(workingPincode) || workingArea.trim().length<3 ||
       description.trim().length<20 || Number(experienceYears)<0 || Number(experienceYears)>60){
      setError(hi?'काम करने का इलाका, सही पिनकोड और अपने अनुभव की जानकारी भरें।':'Provide a valid working area, PIN and at least 20 characters about your experience.');
      return;
    }
    setSubmitting(true);
    try{
      const submitted=await authorized<{application_id:string;status:string;already_submitted:boolean}>('POST',{
        serviceKey,workingArea:workingArea.trim(),workingPincode,
        experienceYears:Number(experienceYears),workDescription:description.trim(),
      });
      setReceipt(submitted.application_id);
      await reload();
      window.dispatchEvent(new Event('aurotap:verification-changed'));
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not submit request.');}
    finally{setSubmitting(false);}
  }

  const name=(service:TechnicianServiceKey)=>hi?TECHNICIAN_SERVICE_OPTIONS[service].hindi:TECHNICIAN_SERVICE_OPTIONS[service].label;
  const keys=Object.keys(TECHNICIAN_SERVICE_OPTIONS) as TechnicianServiceKey[];
  const pending=status?.pending_application;
  const allServicesApproved=Boolean(status && (Object.keys(TECHNICIAN_SERVICE_OPTIONS) as TechnicianServiceKey[])
    .every(k => status.approved_services.includes(k)));
  const profileComplete=Boolean(status?.full_name?.trim() && status?.city?.trim());
  const canSubmit=eligible && Boolean(status?.account_active && status?.documents_approved) &&
    profileComplete && !pending && !loading && !allServicesApproved;
  const errorText=error==='SIGN_IN_REQUIRED'
    ? (hi?'फिर से लॉगिन करके आवेदन देखें।':'Sign in again to view or submit your application.')
    :error;

  return <main className="min-h-screen bg-slate-50 px-4 py-7 text-slate-900">
    <div className="mx-auto max-w-xl space-y-5">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold">
        <Link href="/technician/dashboard" className="text-emerald-800 underline">{hi?'← डैशबोर्ड पर जाएँ':'← Back to technician dashboard'}</Link>
        <Link href="/notifications" className="text-emerald-800 underline">{hi?'नए जॉब के अलर्ट':'Job alerts'}</Link>
      </nav>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-extrabold">{hi?'नई सर्विस के लिए मंज़ूरी लें':'Request service approval'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {hi?'आपका टेक्नीशियन अकाउंट पहले से है। नया अकाउंट, फोन नंबर या आधार दोबारा देने की ज़रूरत नहीं है। अपना काम चुनकर एडमिन को भेजें।':
            'You already have a technician account. Do not register again. Select the service you can perform and send it for admin review.'}
        </p>
        <button type="button" onClick={()=>void reload()} disabled={loading||submitting}
          className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-50">
          {loading?(hi?'चेक हो रहा है…':'Checking…'):(hi?'स्टेटस फिर देखें':'Refresh status')}
        </button>
        {hydrated&&!eligible&&<div role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          {hi?'यह पेज केवल टेक्नीशियन लॉगिन के लिए है।':'This page is only for an existing technician login.'}
          <Link href="/auth/login?returnTo=%2Ftechnician%2Fservices%2Fapply" className="ml-2 font-bold underline">{hi?'लॉगिन करें':'Sign in'}</Link>
        </div>}
        {errorText&&<p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{errorText}</p>}
        {receipt&&<div role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          <strong>{hi?'आवेदन जमा हो गया।':'Application submitted.'}</strong>
          <p>{hi?'आवेदन नंबर':'Reference'}: <span className="break-all font-mono">{receipt}</span></p>
          <p>{hi?'एडमिन जाँच के बाद यहाँ स्टेटस अपडेट होगा।':'Admin must verify your trade experience before enabling jobs.'}</p>
        </div>}
      </section>

      {eligible&&status&&<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1 text-sm text-slate-700">
          <p>{hi?'मौजूदा अकाउंट':'Existing account'}: <strong>{status.full_name || (hi?'नाम भरें':'Name missing')}</strong></p>
          <p>{hi?'शहर':'City'}: <strong>{status.city || (hi?'शहर भरें':'City missing')}</strong></p>
          <p>{hi?'पहचान के दस्तावेज़':'Identity documents'}: <strong>{status.documents_approved?(hi?'मंज़ूर':'Approved'):(hi?'जाँच बाकी':'Review pending')}</strong></p>
          <p>{hi?'मंज़ूर सेवाएँ':'Already approved'}: <strong>{status.approved_services.length?status.approved_services.join(', '):(hi?'अभी कोई नहीं':'None yet')}</strong></p>
        </div>
        {allServicesApproved ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          {hi?'इन सभी सर्विस के लिए मंज़ूरी मिल चुकी है। नई जॉब के लिए डैशबोर्ड देखें।':'All listed services are already approved. Open your dashboard to receive eligible jobs.'}
        </p> : !profileComplete ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {hi?'पहले प्रोफ़ाइल में नाम और शहर सही भरें।':'Add your registered name and city to your profile first.'}
          <Link href="/technician/dashboard#profile" className="ml-2 font-bold underline">{hi?'प्रोफ़ाइल खोलें':'Open profile'}</Link>
        </p> : pending ? <div role="status" className="mt-4 rounded-xl bg-sky-50 p-4 text-sm text-sky-950">
          <h2 className="font-bold">{hi?'आवेदन जाँच में है':'Application under review'}</h2>
          <p className="mt-2">{hi?'अलग से नया आवेदन करने की ज़रूरत नहीं है।':'Do not submit another registration while this request is pending.'}</p>
          <p className="mt-1 break-all font-mono">{pending.id}</p>
        </div> : !status.documents_approved ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          {hi?'पहले तीन पहचान के दस्तावेज़ एडमिन से मंज़ूर करवाएँ।':'Get your three identity documents approved first.'}
          <Link href="/technician/dashboard#documents" className="ml-2 font-bold underline">{hi?'दस्तावेज़ खोलें':'Open documents'}</Link>
        </p> : !status.account_active ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          {hi?'अकाउंट बंद या रुका हुआ है। सपोर्ट से बात करें।':'Your account is currently restricted. Contact support.'}
        </p> : <form onSubmit={e=>void submit(e)} className="mt-5 space-y-4">
          <div>
            <label htmlFor="service-key" className="block text-sm font-bold">{hi?'कौन सा काम करना है?':'Choose the service you offer'}</label>
            <select id="service-key" value={serviceKey} onChange={e=>setServiceKey(e.target.value as TechnicianServiceKey)}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3">
              {keys.map(k=><option key={k} value={k} disabled={status.approved_services.includes(k)}>{name(k)}{status.approved_services.includes(k)?' ✓':''}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="work-area" className="block text-sm font-bold">{hi?'काम करने का इलाका':'Working area'}</label>
            <input id="work-area" value={workingArea} maxLength={150} onChange={e=>setWorkingArea(e.target.value)}
              placeholder={hi?'जैसे: काकादेव, कानपुर':'e.g. Kakadeo, Kanpur'} required minLength={3}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3" />
          </div>
          <div>
            <label htmlFor="work-pin" className="block text-sm font-bold">{hi?'उस इलाके का पिनकोड':'Working area PIN'}</label>
            <input id="work-pin" value={workingPincode} onChange={e=>setWorkingPincode(e.target.value.replace(/[^0-9]/g,'').slice(0,6))}
              inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} required
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3" />
          </div>
          <div>
            <label htmlFor="experience" className="block text-sm font-bold">{hi?'कितने साल का अनुभव है?':'Years of experience'}</label>
            <input id="experience" type="number" min={0} max={60} step={1} required value={experienceYears}
              onChange={e=>setExperienceYears(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3"/>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-bold">{hi?'अपने काम का अनुभव बताएं':'Tell us about your work'}</label>
            <textarea id="description" rows={3} minLength={20} maxLength={700} required value={description}
              onChange={e=>setDescription(e.target.value)}
              placeholder={hi?'कौन सा काम करते हैं? कोई पुराना काम या रेफरेंस बताएं।':'Describe relevant jobs or references the admin can verify.'}
              className="mt-2 w-full rounded-xl border border-slate-300 p-3"/>
            <p className="mt-1 text-xs text-slate-500">{hi?'एडमिन आपकी जानकारी जाँचेगा; सिर्फ फॉर्म भरने से नई जॉब नहीं मिलेगी।':'Admin will verify your skills. Submitting a request does not enable jobs.'}</p>
          </div>
          <button disabled={!canSubmit||submitting||status.approved_services.includes(serviceKey)} type="submit"
            className="min-h-12 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {submitting?(hi?'आवेदन भेज रहे हैं…':'Submitting…'):(hi?'एडमिन की मंज़ूरी के लिए भेजें':'Send for admin approval')}
          </button>
        </form>}
      </section>}
      <p className="text-center text-xs text-slate-500">{hi?'आपकी मंज़ूरी और जॉब की सुविधा सुरक्षित रहेगी।':'New service jobs remain protected until the admin approves your skills.'}</p>
    </div>
  </main>;
}
