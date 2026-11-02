import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanupDisposableSessionCache} from '../src/lib/pwa/disposable-cache-cleanup.ts';
import {readFileSync} from 'node:fs';
function fake(items){const values=new Map(Object.entries(items));return {values,getItem:k=>values.get(k)??null,removeItem:k=>values.delete(k)}}
test('removes only expired disposable snapshots, leaves authenticated/booking state untouched',()=>{
 const now=1_000_000;
 const store=fake({
  'aurotap:admin-dashboard:v2':JSON.stringify({savedAt:now-950_000}),
  'aurotap:admin-settings:v2':JSON.stringify({savedAt:now-120_000}),
  'aurotap:technicians:v1':JSON.stringify({at:now-200_000}),
  'sb-auth-token':'protected-session',
  'aurotap:pro-draft:supplier':'in-progress-form',
  'aw_settings_v3':'published-pricing',
 });
 assert.equal(cleanupDisposableSessionCache(store,now),1);
 assert.equal(store.values.has('aurotap:admin-dashboard:v2'),false);
 assert.equal(store.values.has('aurotap:admin-settings:v2'),true);
 assert.equal(store.values.has('aurotap:technicians:v1'),true);
 assert.equal(store.values.get('sb-auth-token'),'protected-session');
 assert.equal(store.values.get('aurotap:pro-draft:supplier'),'in-progress-form');
 assert.equal(store.values.get('aw_settings_v3'),'published-pricing');
});
test('unparseable disposable entry is removed without touching unrelated entries',()=>{
 const store=fake({'aurotap:admin-settings:v2':'{bad','other':'keep'});
 assert.equal(cleanupDisposableSessionCache(store,Date.now()),1);
 assert.equal(store.values.get('other'),'keep');
});
test('service worker does not cache authenticated APIs or wipe unrelated caches',()=>{
 const sw=readFileSync('public/sw.js','utf8');
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/request\.headers\.has\('authorization'\)/);
 assert.match(sw,/name\.startsWith\('aurowater-'\)/);
 assert.match(sw,/MAX_IMAGE_CONTENT_LENGTH/);
 assert.match(sw,/PREVIOUS_ASSET_CACHE/);
 assert.match(sw,/navigator|navigationPreload/);
 assert.doesNotMatch(sw,/caches\.delete\('supabase/);
});
