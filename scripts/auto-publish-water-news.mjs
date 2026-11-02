#!/usr/bin/env node
/** Source-attributed automatic news briefs. Never fabricate article details.
 * Bounded network input, strict relevance, attribution and dedupe.
 * This is a headline-based brief, NOT independent fact verification.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseFeed } from './discover-water-news.mjs';
const output = new URL('../src/data/water-news-reviewed.json', import.meta.url);
const query = '(drinking water quality OR water supply OR water purification OR water tanker OR water conservation) India when:7d';
const feed = 'https://news.google.com/rss/search?q='+encodeURIComponent(query)+'&hl=en-IN&gl=IN&ceid=IN:en';
const MAX_BYTES = 160000;
const signal = AbortSignal.timeout(7000);
const response = await fetch(feed,{signal,headers:{Accept:'application/rss+xml, application/xml'},redirect:'error'});
if (!response.ok) throw Error('News feed unavailable: '+response.status);
const reader = response.body?.getReader();
if (!reader) throw Error('Missing feed stream');
const chunks=[];let bytes=0;
while (true) {const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;
  if(bytes>MAX_BYTES){await reader.cancel();throw Error('News feed exceeds memory limit');}chunks.push(part.value);}
const items=parseFeed(new TextDecoder().decode(Buffer.concat(chunks,bytes)));
const relevant=/\b(water|drinking|purif|tanker|pipeline|groundwater|reservoir|sanitation|filtration|jal jeevan|ro plant)\b/i;
const reject=/\b(celebrity|cricket|election|stocks|share price|astrology|horoscope|movie|political party)\b/i;
const existing=JSON.parse(await readFile(output,'utf8'));
if(!Array.isArray(existing)||existing.length>40)throw Error('Invalid or oversized news store');
const seen=new Set(existing.map(p=>p.source_url));
const candidate=items.find(p=>relevant.test(p.title)&&!reject.test(p.title)&&!seen.has(p.source_url)&&
  Date.now()-Date.parse(p.source_published_at)<7*86400000);
if(!candidate){console.log('No eligible sourced news; no fabricated post.');process.exit(0);}
const title=candidate.title.replace(/\s+-\s+[^-]+$/,'').trim();
const sourceName=candidate.title.includes(' - ')?candidate.title.split(' - ').at(-1).trim():'Google News linked publisher';
const slug='water-news-'+candidate.key.slice(0,60).replace(/[^a-z0-9]+/g,'-').replace(/-+$/,'');
if(existing.some(p=>p.slug===slug)){console.log('Already published');process.exit(0);}
const date=new Date().toISOString();
const brief={
 slug,title:('Water update: '+title).slice(0,180),
 summary:('A recent water-related report covers: '+title+'. This is an attributed news brief, not independent confirmation by AuroTap. Open the original publisher report for context, location, dates and details.').slice(0,900),
 source_name:sourceName.slice(0,100),source_url:candidate.source_url,
 source_published_at:candidate.source_published_at,reviewed_at:date,publish_at:date
};
await writeFile(output,JSON.stringify([...existing,brief].slice(-20),null,2)+'\n');
console.log('Published source-attributed news brief:',brief.slug);
