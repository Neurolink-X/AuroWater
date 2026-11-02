#!/usr/bin/env node
/**
 * Bounded, zero-network editorial scheduler. Publishes original evergreen
 * information from a controlled, factual template pool; never paraphrases
 * unverified headlines or invents current events.
 */
import { readFile, writeFile } from 'node:fs/promises';
const target = new URL('../src/data/auto-guides.json', import.meta.url);
const DAY = 86400000;
const topics = [
  {slug:'water-can-handover-checks',title:'Water Can Delivery: Practical Checks at Handover',category:'Water delivery',
   summary:'A practical checklist for receiving a water can, inspecting the container, confirming the order and reporting a concern.',
   sections:[{heading:'Check the container before accepting',paragraphs:['Inspect the container and closure for visible damage or signs of tampering. If you notice a problem, contact the supplier or support before consuming the water.']},{heading:'Match the order details',paragraphs:['Confirm the quantity, selected water type and amount against your actual booking. Do not rely on promotional prices in old articles.']}]},
  {slug:'ro-service-visit-preparation',title:'How to Prepare for an RO Purifier Service Visit',category:'RO maintenance',
   summary:'Simple preparation tips for an RO purifier maintenance appointment, including symptoms, access and safe follow-up.',
   sections:[{heading:'Describe the symptoms clearly',paragraphs:['Note whether the purifier has reduced flow, unusual noise or a leak. Tell the technician when the issue started and whether it affects other taps.']},{heading:'Keep the work area accessible',paragraphs:['Provide safe access to the purifier and water connection. Do not attempt electrical repairs yourself; ask the technician to explain proposed work and costs.']}]},
  {slug:'water-tank-cleaning-preparation',title:'Water Tank Cleaning: A Homeowner Preparation Checklist',category:'Tank cleaning',
   summary:'What to check before booking water tank cleaning and how to prepare access, water supply and service details.',
   sections:[{heading:'Share tank details',paragraphs:['Tell the service provider the approximate tank capacity, location and access constraints. Confirm the work scope and final price before the appointment.']},{heading:'Plan around water use',paragraphs:['Ask about expected water interruption and any instructions before using the tank again. Follow the provider’s documented cleaning and safety guidance.']}]},
];
const today = new Date();
const day = Math.floor(today.getTime()/DAY);
if (day % 3 !== 0) { console.log('Not a publishing day'); process.exit(0); }
let old = [];
try { old = JSON.parse(await readFile(target,'utf8')); } catch {}
if (!Array.isArray(old)) throw Error('Invalid editorial store');
const existing = new Set(old.map(p=>p.slug));
const topic = topics.find(t=>!existing.has(t.slug+'-2026'));
if (!topic) { console.log('No approved unused topics: skip, never duplicate'); process.exit(0); }
const date = new Date().toISOString();
const post = {slug:topic.slug+'-2026',title:topic.title,description:topic.summary,category:topic.category,publishAt:date,updatedAt:date,sections:topic.sections};
if (old.length >= 50) throw Error('Editorial store at capacity; manual archive required');
await writeFile(target,JSON.stringify([...old,post],null,2)+'\n');
console.log('Prepared original evergreen article:',post.slug);
