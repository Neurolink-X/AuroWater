/** In-flight sharing only. No response cache, no persistence, no mutation replay. */
export function readRequestKey(path: string, init: RequestInit): string {
  const headers = [...new Headers(init.headers).entries()].sort(([a],[b])=>a.localeCompare(b));
  return JSON.stringify([path,headers,init.cache??'',init.credentials??'',init.mode??'',init.redirect??'',init.referrer??'',init.referrerPolicy??'',init.integrity??'']);
}
export function createReadCoordinator<T>() {
  type Entry = { controller: AbortController; subscribers: Set<symbol>; settled: boolean; promise: Promise<T> };
  const pending = new Map<string,Entry>();
  return {
    has(key: string) { return pending.has(key); },
    // Writes detach old generations; existing readers retain their own result.
    clear() { pending.clear(); },
    run(key: string, loader: (signal: AbortSignal)=>Promise<T>, signal?: AbortSignal): Promise<T> {
      if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException('Aborted','AbortError'));
      let entry = pending.get(key);
      if (!entry) {
        const controller = new AbortController();
        const created: Entry = {controller,subscribers:new Set(),settled:false,promise:Promise.resolve(undefined as T)};
        const finish = () => { created.settled=true; if(pending.get(key)===created) pending.delete(key); };
        created.promise = Promise.resolve().then(()=>{controller.signal.throwIfAborted();return loader(controller.signal);}).then(value=>{finish();return value;},error=>{finish();throw error;});
        pending.set(key,created); entry=created;
      }
      const shared=entry; const id=Symbol(); shared.subscribers.add(id);
      return new Promise<T>((resolve,reject)=>{
        let active=true;
        const leave=()=>{
          active=false;signal?.removeEventListener('abort',abort);shared.subscribers.delete(id);
          if(!shared.settled && shared.subscribers.size===0){if(pending.get(key)===shared)pending.delete(key);shared.controller.abort();}
        };
        const abort=()=>{if(!active)return;leave();reject(signal?.reason ?? new DOMException('Aborted','AbortError'));};
        signal?.addEventListener('abort',abort,{once:true});
        if(signal?.aborted) abort();
        shared.promise.then(value=>{if(active){leave();resolve(value);}},error=>{if(active){leave();reject(error);}});
      });
    },
  };
}
