'use client';
import {useEffect} from 'react';
import {cleanupDisposableSessionCache} from '@/lib/pwa/disposable-cache-cleanup';
export default function DisposableCacheMaintenance(){
 useEffect(()=>{
  const run=()=>{try{cleanupDisposableSessionCache(window.sessionStorage)}catch{/* optional */}};
  const idle=window as Window & {requestIdleCallback?:(callback:()=>void,options?:{timeout:number})=>number;cancelIdleCallback?:(id:number)=>void};
  const job=idle.requestIdleCallback?idle.requestIdleCallback(run,{timeout:5000}):null;
  const fallback=job===null?window.setTimeout(run,2500):null;
  const onVisible=()=>{if(document.visibilityState==='visible')run()};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{document.removeEventListener('visibilitychange',onVisible);if(job!==null)idle.cancelIdleCallback?.(job);if(fallback!==null)window.clearTimeout(fallback)};
 },[]);
 return null;
}
