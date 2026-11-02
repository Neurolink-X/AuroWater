/**
 * Browser cache hygiene: ONLY documented disposable cache keys are eligible.
 * Never touch Supabase auth keys, booking drafts, active orders, pricing version,
 * offline submissions, or user preferences.
 */
type StorageLike = Pick<Storage,'getItem'|'removeItem'>;
const SAFE_SESSION: Record<string,number> = {
 'aurotap:admin-dashboard:v2':15*60_000,
 'aurotap:admin-settings:v2':30*60_000,
 'aurotap:technicians:v1':5*60_000,
};
export function cleanupDisposableSessionCache(storage:StorageLike,now=Date.now()):number{
 let removed=0;
 for(const [key,ttl] of Object.entries(SAFE_SESSION)){
  try{
   const raw=storage.getItem(key);
   if(!raw)continue;
   const payload=JSON.parse(raw) as {savedAt?:unknown;at?:unknown};
   const stamp=Number(payload.savedAt??payload.at);
   if(!Number.isFinite(stamp)||stamp<=0||stamp>now+60_000||now-stamp>ttl){
    storage.removeItem(key);removed++;
   }
  }catch{
   try{storage.removeItem(key);removed++;}catch{/* storage disabled */}
  }
 }
 return removed;
}
