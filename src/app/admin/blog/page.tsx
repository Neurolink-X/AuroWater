'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type Section = { heading:string; paragraphs:string[] };
type Post = {
  id:string;slug:string;title:string;description:string;category:string;
  sections:Section[];status:'draft'|'published';publish_at:string|null;cover_image:string|null;updated_at:string;
};
type Editor = Omit<Post,'id'|'updated_at'>;
const blank = ():Editor => ({
  slug:'',title:'',description:'',category:'Water and home services',
  status:'draft',publish_at:null,cover_image:null,sections:[{heading:'',paragraphs:['']}],
});

export default function AdminBlogPage() {
  const [posts,setPosts] = useState<Post[]>([]);
  const [selected,setSelected] = useState<string|null>(null);
  const [editor,setEditor] = useState<Editor>(blank);
  const [busy,setBusy] = useState(false);
  const [uploading,setUploading] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  async function request<T>(url:string,init?:RequestInit):Promise<T> {
    const token = await getToken();
    if (!token) throw new Error('Admin sign-in required.');
    const response = await fetch(url,{
      ...init,cache:'no-store',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init?.headers},
    });
    const json = await response.json().catch(()=>null);
    if (!response.ok || !json || !('data' in json)) {
      throw new Error(json?.error ?? `Request failed (HTTP ${response.status})`);
    }
    return json.data as T;
  }
  async function load(){
    try { setPosts(await request<Post[]>('/api/admin/blog'));setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed to load posts.'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void load();},[]);
  const choose = (post:Post) => {
    setSelected(post.id);
    setEditor({slug:post.slug,title:post.title,description:post.description,category:post.category,
      sections:post.sections,status:post.status,publish_at:post.publish_at,cover_image:post.cover_image});
    setError('');setNotice('');
  };
  const updateSection=(index:number,update:Section)=>{
    setEditor(current=>({...current,sections:current.sections.map((s,i)=>i===index?update:s)}));
  };
  async function uploadCover(file: File) {
    setUploading(true); setError(''); setNotice('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Admin sign-in required.');
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/admin/blog/upload', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.data?.url) throw new Error(json?.error ?? 'Image upload failed.');
      setEditor(current => ({ ...current, cover_image: json.data.url }));
      setNotice('Cover image uploaded.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Image upload failed.');
    } finally { setUploading(false); }
  }
  async function save(publish:boolean) {
    setBusy(true);setError('');setNotice('');
    const status = publish?'published':'draft';
    const payload = {
      ...editor,status,
      publish_at:publish?(editor.publish_at ?? new Date().toISOString()):editor.publish_at,
      sections:editor.sections.map(section=>({
        heading:section.heading.trim(),
        paragraphs:section.paragraphs.map(p=>p.trim()).filter(Boolean),
      })),
    };
    if (!payload.title.trim() || !payload.description.trim() ||
        payload.sections.some(s=>!s.heading || !s.paragraphs.length)) {
      setError('Add a title, summary and at least one complete section.');setBusy(false);return;
    }
    try {
      if (selected){
        const {slug: _slug,...changes} = payload;
        void _slug;
        await request(`/api/admin/blog/${selected}`,{method:'PUT',body:JSON.stringify(changes)});
      } else {
        await request('/api/admin/blog',{method:'POST',body:JSON.stringify(payload)});
      }
      setNotice(publish?'Article published or scheduled.':'Draft saved.');
      setSelected(null);setEditor(blank());
      await load();
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to save post.');}
    finally{setBusy(false);}
  }
  return <main className="mx-auto max-w-7xl space-y-6 bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><Link href="/admin/dashboard" className="text-sm text-cyan-800">← Admin</Link>
        <h1 className="mt-2 text-3xl font-bold">Blog publishing</h1>
        <p className="mt-1 text-sm text-slate-600">Manually write, review, save drafts and publish articles. No automatic AI publication.</p>
      </div>
      <Link href="/blog" target="_blank" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">View public blog</Link>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">{notice}</p>}
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Articles</h2>
          <button type="button" className="text-sm font-semibold text-blue-700" onClick={()=>{setSelected(null);setEditor(blank());setNotice('');setError('');}}>+ New</button>
        </div>
        {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
        {!loading && posts.length===0 && <p className="mt-4 text-sm text-slate-500">No manual articles yet.</p>}
        <div className="mt-4 space-y-2">
          {posts.map(p=><button type="button" key={p.id} onClick={()=>choose(p)}
            className={`w-full rounded-xl border p-3 text-left ${selected===p.id?'border-cyan-500 bg-cyan-50':'border-slate-200 hover:bg-slate-50'}`}>
            <span className="block text-sm font-semibold">{p.title}</span>
            <span className="mt-1 block text-xs text-slate-500">{p.status} · {p.slug}</span>
          </button>)}
        </div>
      </aside>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-bold">{selected?'Edit article':'Create article'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Title
            <input value={editor.title} maxLength={180} onChange={e=>setEditor(p=>({...p,title:e.target.value}))} className="mt-1 w-full rounded-lg border p-3 font-normal"/>
          </label>
          <label className="block text-sm font-semibold">URL slug {selected?'(locked)':''}
            <input value={editor.slug} disabled={!!selected} maxLength={120} onChange={e=>setEditor(p=>({...p,slug:e.target.value.toLowerCase().trim().replace(/[^a-z0-9-]/g,'-')}))} placeholder="how-to-clean-water-tanks" className="mt-1 w-full rounded-lg border p-3 font-normal disabled:bg-slate-100"/>
          </label>
          <label className="block text-sm font-semibold sm:col-span-2">SEO summary
            <textarea value={editor.description} maxLength={400} rows={3} onChange={e=>setEditor(p=>({...p,description:e.target.value}))} className="mt-1 w-full rounded-lg border p-3 font-normal"/>
          </label>
          <label className="block text-sm font-semibold">Category
            <input value={editor.category} maxLength={80} onChange={e=>setEditor(p=>({...p,category:e.target.value}))} className="mt-1 w-full rounded-lg border p-3 font-normal"/>
          </label>
          <label className="block text-sm font-semibold">Publication date (UTC, optional for drafts)
            <input type="datetime-local" value={editor.publish_at?new Date(editor.publish_at).toISOString().slice(0,16):''}
              onChange={e=>setEditor(p=>({...p,publish_at:e.target.value?new Date(e.target.value+'Z').toISOString():null}))}
              className="mt-1 w-full rounded-lg border p-3 font-normal"/>
          </label>
        </div>
        <div className="space-y-2">
          <label htmlFor="blog-cover-upload" className="block text-sm font-semibold">Cover image (JPEG, PNG or WebP, max 5 MB)</label>
          <input id="blog-cover-upload" type="file" accept="image/jpeg,image/png,image/webp"
            disabled={uploading || busy} className="block w-full rounded-lg border p-3 text-sm"
            onChange={e=>{const file=e.target.files?.[0];if(file)void uploadCover(file);e.target.value='';}}/>
          {uploading && <p role="status" className="text-sm text-blue-700">Uploading image…</p>}
          {editor.cover_image && <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={editor.cover_image} alt="Blog cover preview" className="max-h-64 w-full rounded-xl border object-contain"/>
            <button type="button" className="text-sm font-semibold text-red-700"
              onClick={()=>setEditor(p=>({...p,cover_image:null}))}>Remove cover image</button>
          </div>}
        </div>
        <h3 className="pt-2 text-base font-bold">Article sections</h3>
        {editor.sections.map((section,i)=><div key={i} className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex justify-between"><span className="text-sm font-semibold">Section {i+1}</span>
            {editor.sections.length>1&&<button type="button" className="text-xs font-semibold text-red-700" onClick={()=>setEditor(p=>({...p,sections:p.sections.filter((_,j)=>j!==i)}))}>Remove</button>}
          </div>
          <input aria-label={`Heading for section ${i+1}`} placeholder="Section heading" value={section.heading}
            onChange={e=>updateSection(i,{...section,heading:e.target.value})} className="w-full rounded-lg border p-3"/>
          <textarea aria-label={`Paragraphs for section ${i+1}`} rows={6}
            placeholder="Write paragraphs here. Separate paragraphs with a blank line."
            value={section.paragraphs.join('\n\n')}
            onChange={e=>updateSection(i,{...section,paragraphs:e.target.value.split(/\n\s*\n/).map(p=>p.trim())})}
            className="w-full rounded-lg border p-3"/>
        </div>)}
        <button type="button" onClick={()=>setEditor(p=>({...p,sections:[...p.sections,{heading:'',paragraphs:['']}]}))}
          className="rounded-lg border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-900">+ Add section</button>
        <div className="flex flex-wrap gap-3 border-t pt-5">
          <button type="button" disabled={busy || uploading} onClick={()=>void save(false)} className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Save draft / Unpublish</button>
          <button type="button" disabled={busy} onClick={()=>void save(true)} className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Publish article</button>
        </div>
        <p className="text-xs text-slate-500">Publishing requires editorial review. Future publication dates remain hidden until scheduled. Existing file-based guides remain available.</p>
      </section>
    </div>
  </main>;
}
