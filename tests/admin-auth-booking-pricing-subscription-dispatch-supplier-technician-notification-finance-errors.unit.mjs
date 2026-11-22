import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
import {bookedOrderPricing} from '../src/lib/pricing/booked-order.ts';
import {safeErrorPath,validatePlatformEvent,ERROR_CATALOG,errorGroup} from '../src/lib/observability/platform-errors.ts';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(p,'utf8');
function load(path,deps){const exports={};vm.runInNewContext(transpileModule(read(path),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022}}).outputText,{exports,URL,Response,AbortSignal,Date,console,process:{env:{}},require:id=>Object.hasOwn(deps,id)?deps[id]:require(id)});return exports;}

// Synthetic prices and quantities; no production transaction fixtures.
test('a subscription receipt preserves its booked rate independently of the current normal rate',()=>{
 const row={can_order_type:'subscription',can_count:3,can_price_per_unit:'22',base_amount:'66',total_amount:'66',pricing_version:7,pricing_snapshot:{config:{water_normal:27,water_subscription:22},unit_price:22,quantity:3}};
 const receipt=bookedOrderPricing(row);
 assert.equal(receipt.unit,22);assert.equal(receipt.quantity,3);assert.equal(receipt.total,66);assert.match(receipt.plan,/Subscription/);
 assert.equal(row.pricing_snapshot.config.water_normal,27);
});
test('one-time, zero fees, discounts and missing legacy receipt remain distinct',()=>{
 assert.equal(bookedOrderPricing({can_count:2,can_price_per_unit:25,total_amount:50}).total,50);
 const discounted=bookedOrderPricing({base_amount:0,total_amount:0,pricing_snapshot:{base_amount:25,total_amount:25,loyalty_discount_amount:25}});
 assert.equal(discounted.base,0);assert.equal(discounted.total,0);assert.equal(discounted.discount,25);
 assert.equal(bookedOrderPricing({}).unit,null);assert.equal(bookedOrderPricing({can_price_per_unit:'bad'}).unit,null);
});
test('diagnostic route templates never retain order IDs, contact details or query secrets',()=>{
 assert.equal(safeErrorPath('/api/customer/orders/secret-uuid?token=private'),'/api/customer/orders/[item]');
 assert.equal(safeErrorPath('/customer/person@example.com/9889305803'),'/customer/[item]/[item]');
 assert.equal(errorGroup('/api/supplier/orders'),'supplier');
 assert.equal(safeErrorPath('/api/public/ncr-waitlist'),'/api/public/ncr-waitlist');
 assert.equal(safeErrorPath('/admin/dispatch-queue'),'/admin/dispatch-queue');
 assert.equal(validatePlatformEvent({code:'arbitrary private exception',group:'admin'}),null);
 const event=validatePlatformEvent({code:'API_SERVER_ERROR',group:'public',path:'/book?phone=private',status:503,message:'secret',stack:'secret'});
 assert.equal(event.path,'/book');assert.ok(!JSON.stringify(event).includes('secret'));
 assert.ok(Object.values(ERROR_CATALOG).every(pair=>pair[0]&&pair[1]));
});
test('admin history rejects guests and non-admin roles before accessing storage',async()=>{
 const {NextRequest}=require('next/server');
 for(const role of ['guest','customer','supplier','technician']){
  let called=false;
  const api=load('src/app/api/admin/errors/route.ts',{
   '@/lib/api/supabase-request':{requireSupabaseAuth:async()=>role==='guest'?{ok:false,response:Response.json({error:'Unauthorized'},{status:401})}:{ok:true,ctx:{}},requireAdmin:()=>false},
   '@/utils/supabase/server':{createServiceClient:()=>{called=true;throw Error('must not read');}},
   '@/lib/observability/platform-errors':{ERROR_CATALOG,ERROR_GROUPS:['admin','customer','public','supplier','technician']},
  });
  assert.equal((await api.GET(new NextRequest('https://www.aurotap.in/api/admin/errors'))).status,role==='guest'?401:403);assert.equal(called,false);
 }
});
test('error intake rejects cross-origin, invalid event, forged server source and rate-limit outages',async()=>{
 const {NextRequest}=require('next/server');let writes=0;let allow=true;let unavailable=false;
 const api=load('src/app/api/internal/telemetry/errors/route.ts',{
  '@/utils/supabase/server':{createServiceClient:()=>({})},
  '@/lib/api/rate-limit':{consumeRateLimit:async()=>({allowed:allow,unavailable})},
  '@/lib/observability/platform-errors':{validatePlatformEvent},
  '@/lib/observability/platform-errors.server':{recordPlatformError:async()=>{writes++;return true;}},
 });
 const req=(body,origin='https://www.aurotap.in')=>new NextRequest('https://www.aurotap.in/api/internal/telemetry/errors',{method:'POST',headers:{origin},body:JSON.stringify(body)});
 const event={code:'RUNTIME_ERROR',path:'/book',group:'public',source:'browser'};
 assert.equal((await api.POST(req(event,'https://evil.example'))).status,403);
 assert.equal((await api.POST(req({...event,source:'server'}))).status,400);
 assert.equal((await api.POST(req({...event,code:'fake'}))).status,400);
 assert.equal((await api.POST(req(event))).status,204);assert.equal(writes,1);
 allow=false;assert.equal((await api.POST(req(event))).status,429);
 unavailable=true;assert.equal((await api.POST(req(event))).status,503);assert.equal(writes,1);
});
test('admin settings overlays the effective published price before its cache validator',async()=>{
 const {NextRequest,NextResponse}=require('next/server');
 const prices={water_normal:25,water_chilled:30,water_subscription:20,bulk_can_price:20,bulk_threshold:50,services:{plumbing:149},convenience_fee:0,delivery_fee:0,emergency_surcharge:0,surge_charge:30,gst_rate:0,city_key:'global'};
 const db={from:table=>{
  const result=table==='settings'?{data:[{key:'default_can_price',value:'20'}],error:null}:{data:{version:10,config:prices},error:null};
  const q=new Proxy({}, {get:(_t,k)=>k==='then'?Promise.resolve(result).then.bind(Promise.resolve(result)):()=>q});return q;
 }};
 const api=load('src/app/api/admin/settings/route.ts',{
  '@/lib/api/supabase-request':{requireSupabaseAuth:async()=>({ok:true,ctx:{supabase:db}}),requireAdmin:()=>true},
  '@/lib/api/json-response':{jsonErr:(error,status)=>NextResponse.json({error},{status})},
  '@/lib/api/settings-map':{rowsToSettingsPayload:()=>({default_can_price:20})},
  '@/lib/pricing/resolve-effective':{resolveEffectivePriceBook:v=>v,validateEffectivePriceBook:()=>[]},
 });
 const res=await api.GET(new NextRequest('https://www.aurotap.in/api/admin/settings'));
 const body=await res.json();assert.equal(body.data.default_can_price,25);assert.equal(body.data.subscription_can_price,20);assert.equal(body.data.service_base_prices.plumbing,149);
 assert.match(res.headers.get('cache-control'),/private/);
});
test('all new diagnostics are owned admin operations and migration revokes browser access',()=>{
 const sql=read('supabase/migrations/20261122114515_platform_error_diagnostics.sql');
 assert.match(sql,/enable row level security/i);assert.match(sql,/revoke all on public.platform_errors from public, anon, authenticated/i);
 assert.match(sql,/security invoker/i);assert.match(sql,/offset 5000 limit 100/);
 assert.match(read('src/components/admin/AdminShell.tsx'),/href: '\/admin\/errors'/);
 assert.match(read('src/components/observability/RuntimeErrorReporter.tsx'),/window.fetch === observedFetch/);
});

test('browser API observation preserves response identity, request options and native failure without replays',async()=>{
 const listeners=new Map();const beacons=[];let calls=0;let effectCleanup;
 const response=new Response('unchanged body',{status:503});const init={method:'POST',body:'original',headers:{Authorization:'Bearer untouched'}};
 const native=async (_input,options)=>{calls++;if(_input==='/api/throw')throw new TypeError('network');if(_input==='/api/customer/orders')assert.equal(options,init);return response;};
 const fakeWindow={location:{pathname:'/book',origin:'https://www.aurotap.in'},fetch:native,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 const output=transpileModule(read('src/components/observability/RuntimeErrorReporter.tsx'),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(output,{exports,URL,Request,Response,Blob,Date,Map,DOMException,window:fakeWindow,navigator:{sendBeacon:(url,body)=>{beacons.push({url,body});return true;}},process:{env:{NODE_ENV:'production'}},require:id=>id==='react'?{useEffect:fn=>{effectCleanup=fn();}}:id==='@/lib/observability/platform-errors'?{safeErrorPath,errorGroup}:require(id)});
 exports.default();
 assert.equal(await fakeWindow.fetch('/api/customer/orders',init),response);
 assert.equal(await response.text(),'unchanged body');
 await fakeWindow.fetch('/api/customer/orders',init);
 assert.equal(beacons.length,1);assert.equal(calls,2);
 await fakeWindow.fetch('/api/internal/telemetry/errors');assert.equal(beacons.length,1);
 await assert.rejects(fakeWindow.fetch('/api/throw'),/network/);assert.equal(calls,4);assert.equal(beacons.length,2);
 const payload=JSON.parse(await beacons[0].body.text());assert.equal(payload.code,'API_SERVER_ERROR');assert.equal(payload.status,503);assert.ok(!JSON.stringify(payload).includes('untouched'));
 effectCleanup();assert.equal(fakeWindow.fetch,native);assert.equal(listeners.size,0);
});
