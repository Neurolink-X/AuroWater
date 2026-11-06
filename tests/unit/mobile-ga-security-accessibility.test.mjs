import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nextConfig = readFileSync('next.config.ts', 'utf8');
const layout = readFileSync('src/app/layout.tsx', 'utf8');
const homepage = readFileSync('src/app/(public)/HomeClient.tsx', 'utf8');

test('GA4 script and collect origins match exactly the allowed CSP hosts', () => {
  const script = nextConfig.split('\n').find(line => /^\s*"script-src /.test(line));
  const connect = nextConfig.split('\n').find(line => /^\s*"connect-src /.test(line));
  assert.ok(script, 'Missing active script-src CSP');
  assert.ok(connect, 'Missing active connect-src CSP');
  assert.match(script, /https:\/\/www\.googletagmanager\.com/);
  assert.doesNotMatch(script, /\shttps:\s|\s\*\s/);
  assert.match(connect, /https:\/\/www\.google-analytics\.com/);
  assert.match(connect, /https:\/\/\*\.google-analytics\.com/);
  assert.match(connect, /https:\/\/\*\.supabase\.co/);
  assert.match(connect, /wss:\/\/\*\.supabase\.co/);
  assert.match(layout, /googletagmanager\.com\/gtag\/js\?id=/);
  assert.match(layout, /NEXT_PUBLIC_GA_ID/);
});

test('light-background pricing labels have readable contrast', () => {
  assert.match(homepage, /text-slate-600"> \/ can<\/span>/);
  assert.match(homepage, /'text-emerald-600' : 'text-slate-600'/);
  assert.match(homepage, /text-slate-600"> visit charge<\/span>/);
  assert.doesNotMatch(homepage, /text-slate-400"> \/ can<\/span>/);
  assert.doesNotMatch(homepage, /text-slate-400"> visit charge<\/span>/);
  assert.match(homepage, /bg-white p-4 sm:p-6 border/);
});
