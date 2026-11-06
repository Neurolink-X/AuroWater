#!/usr/bin/env node
/**
 * AuroTap: source-attributed water news leads -> DRAFT store (hardened).
 *
 * What this script is
 *   Finds headline-only, source-attributed leads and saves them as DRAFTS in
 *   content/water-news-drafts.json. It does NOT fetch or read the linked
 *   article and does NOT verify anything. It never writes unverified items to
 *   src/data/water-news-reviewed.json (the file the frontend and SEO URLs read).
 *   A draft reaches the reviewed file only through --promote, and only when an
 *   editor has set "editor_approved": true on it.
 *
 * Guarantees
 *   - Never invents article details (fields come from the feed or fixed text).
 *   - Bounded network input: per-attempt timeout, overall deadline, byte cap,
 *     https only, no redirects, content-type check.
 *   - Serialized writes: exclusive lock with heartbeat + fencing check before
 *     every write, unique temp file + fsync + atomic rename. The lock protects
 *     runs that share a filesystem; across machines the CI concurrency group is
 *     what guarantees a single writer.
 *   - Published records are never trimmed or rewritten except by --promote
 *     (append only), so existing SEO URLs stay untouched.
 *   - Layered de-duplication against drafts AND published records.
 *   - --repair / --validate never depend on the news feed being available.
 *
 * Usage
 *   node publish-water-news.mjs                    discover and save new drafts
 *   node publish-water-news.mjs --dry-run          show what would change, write nothing
 *   node publish-water-news.mjs --validate         validate the draft store (no network)
 *   node publish-water-news.mjs --repair           quarantine invalid drafts FIRST (even if the
 *                                                  feed is down or empty), then discover
 *   node publish-water-news.mjs --promote          move editor-approved drafts into the reviewed
 *                                                  file (no network)
 *   node publish-water-news.mjs --max=3            save up to 3 drafts (default 1, cap 3)
 *   node publish-water-news.mjs --max-age-days=7
 *   node publish-water-news.mjs --retries=1        extra attempts on transient errors (0-3)
 *   node publish-water-news.mjs --feed-file=x.xml  read a local feed (tests/offline)
 *   node publish-water-news.mjs --verbose
 *
 * Place at: scripts/publish-water-news.mjs
 */
import {
  readFile, rename, open, unlink, stat, mkdir, link, utimes,
} from 'node:fs/promises';
import { readFileSync, unlinkSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { parseFeed } from './discover-water-news.mjs';

/* ───────────────────────── configuration ───────────────────────── */

// Published store: read by the frontend. Only --promote appends to it.
const REVIEWED_PATH = fileURLToPath(new URL('../src/data/water-news-reviewed.json', import.meta.url));
// Unverified leads live here, never in the published store.
const DRAFTS_PATH = fileURLToPath(new URL('../content/water-news-drafts.json', import.meta.url));
const LOCK_PATH = `${DRAFTS_PATH}.lock`;
const QUARANTINE_PATH = DRAFTS_PATH.replace(/\.json$/, '.quarantine.json');

const QUERY =
  '(drinking water quality OR water supply OR water purification OR water tanker OR water conservation) India when:7d';
const FEED_URL =
  'https://news.google.com/rss/search?q=' +
  encodeURIComponent(QUERY) +
  '&hl=en-IN&gl=IN&ceid=IN:en';

const MAX_BYTES = 160_000;
const ATTEMPT_TIMEOUT_MS = 5_000; // per attempt
const DEADLINE_MS = 12_000; // hard cap for all fetch attempts together
const DEFAULT_RETRIES = 1;
const LOCK_WAIT_MS = 10_000;
const LOCK_STALE_MS = 60_000;
const FUTURE_SKEW_MS = 5 * 60_000;
const MAX_STORE = 20; // max unapproved drafts kept
const LOCK_HEARTBEAT_MS = 10_000;
const MIN_SCORE = 3;
const MIN_TITLE = 25;
const MAX_TITLE = 200;
const LOCALE = 'en-IN';
const FALLBACK_PUBLISHER = 'Google News linked publisher';

/* ─────────────────────────── relevance ─────────────────────────── */

const SIGNALS = [
  [/\bdrinking water\b/i, 3],
  [/\bwater quality\b/i, 3],
  [/\bpurif(?:y|ier|iers|ication|ied)\b/i, 3],
  [/\bjal jeevan\b/i, 3],
  [/\bwater supply\b/i, 2],
  [/\bgroundwater\b/i, 2],
  [/\btankers?\b/i, 2],
  [/\bro (?:plant|plants|water)\b/i, 2],
  [/\bfiltration\b/i, 2],
  [/\b(?:contaminat\w*|arsenic|fluoride|nitrate)\b/i, 2],
  [/\bwater conservation\b/i, 2],
  [/\b(?:sanitation|pipeline|reservoir)\b/i, 1],
  [/\bwater\b/i, 1],
];

const REJECT =
  /\b(celebrity|cricket|election|stocks?|share price|astrology|horoscope|movie|political party|water polo|waterfall|water park|waterproof|water[- ]resistant|smartwatch|watermelon|discount|coupon|sale)\b/i;

const REGIONS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Mumbai', 'Bengaluru',
  'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Lucknow', 'Jaipur',
  'Ahmedabad', 'Patna', 'Bhopal', 'Noida', 'Gurugram', 'Gurgaon', 'Ghaziabad',
  'Kanpur', 'Varanasi', 'Prayagraj', 'Agra', 'Jammu', 'Kashmir', 'Ladakh',
];
const REGION_PATTERN = REGIONS.join('|');
const REGION_ALIASES = { bangalore: 'bengaluru', gurgaon: 'gurugram' };

const TAGS = [
  [/\bdrinking water\b/i, 'drinking water'],
  [/\bwater quality|contaminat\w*|arsenic|fluoride|nitrate\b/i, 'water quality'],
  [/\bpurif\w*|\bro (?:plant|plants|water)\b|filtration/i, 'water purification'],
  [/\bgroundwater\b/i, 'groundwater'],
  [/\btankers?\b/i, 'water tanker'],
  [/\bwater supply|pipeline|reservoir\b/i, 'water supply'],
  [/\bconservation\b/i, 'water conservation'],
  [/\bsanitation\b/i, 'sanitation'],
  [/\bjal jeevan\b/i, 'Jal Jeevan Mission'],
];

/* ──────────────────────────── text helpers ─────────────────────── */

const ENTITIES = {
  '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ',
};

export function cleanText(value) {
  return String(value ?? '')
    .replace(/&(?:amp|quot|#39|apos|lt|gt|nbsp);/g, (m) => ENTITIES[m])
    .replace(/<[^>]*>/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, '').trimEnd() + '…';
}

export function slugify(text, max = 50) {
  const slug = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= max) return slug;
  return slug.slice(0, max).replace(/-[^-]*$/, '').replace(/-+$/, '') || slug.slice(0, max);
}

const shortHash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 8);

export function splitTitle(raw) {
  const title = cleanText(raw);
  const i = title.lastIndexOf(' - ');
  const tail = title.length - i - 3;
  if (i >= MIN_TITLE - 5 && tail > 0 && tail <= 60) {
    return { headline: title.slice(0, i).trim(), publisher: title.slice(i + 3).trim() };
  }
  return { headline: title, publisher: FALLBACK_PUBLISHER };
}

function validPublisher(name) {
  return (
    typeof name === 'string' &&
    name.length >= 2 &&
    name.length <= 100 &&
    !/https?:|www\.|<|>/i.test(name)
  );
}

/* ─────────────────── URLs and article identifiers ──────────────── */

const TRACKING_PARAM = /^(?:utm_.*|fbclid|gclid|igshid|mc_.*|ref|ref_src|oc|ocid|cmpid|spm)$/i;

function isPublicHost(host) {
  if (!host || host.length > 253) return false;
  if (host === 'localhost') return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false; // IPv4 literal
  if (/\.(?:local|localhost|internal|lan|home|test|invalid|example)$/.test(host)) return false;
  return /^(?:[a-z0-9-]+\.)+[a-z0-9-]{2,}$/.test(host); // also rejects IPv6 and userinfo
}

/**
 * Canonical form for comparisons: https only, public host, no credentials,
 * no custom port, no fragment, no tracking params, sorted query, no trailing slash.
 * Returns null when the URL is not acceptable as a source link.
 */
export function canonicalUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  if (url.port && url.port !== '443') return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  if (!isPublicHost(host)) return null;
  const params = [...url.searchParams]
    .filter(([key]) => !TRACKING_PARAM.test(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = new URLSearchParams(params).toString();
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return `https://${host}${path}${query ? `?${query}` : ''}`;
}

/** Stable id for an article: Google News article id when present, else canonical URL. */
export function articleIdFor(canon) {
  const match = canon.match(/^https:\/\/news\.google\.com\/(?:rss\/)?(?:read|articles)\/([^/?#]+)/);
  return match ? `gn:${match[1]}` : `url:${canon}`;
}

/* ───────────────────────── headline similarity ─────────────────── */

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'has', 'have',
  'had', 'will', 'its', 'into', 'over', 'after', 'amid', 'says', 'said', 'new', 'news',
  'report', 'reports', 'how', 'why', 'what', 'who', 'not', 'but', 'more', 'than', 'out',
  // domain words present in nearly every headline carry no signal
  'water', 'india', 'indian',
]);

const STEM_ALIASES = {
  purifier: 'purif', purification: 'purif', purify: 'purif', purifi: 'purif',
  contamination: 'contaminat', contaminated: 'contaminat', contaminate: 'contaminat',
  crisis: 'shortage', scarcity: 'shortage', drought: 'shortage',
  dry: 'dry', dries: 'dry',
};

function stem(word) {
  let w = word;
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return STEM_ALIASES[w] ?? w;
}

export function normalizeHeadline(text) {
  return cleanText(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentTokens(normalized) {
  return normalized
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w) && (w.length > 2 || /^\d+$/.test(w)))
    .map(stem);
}

function regionsIn(text) {
  const found = new Set();
  for (const m of text.matchAll(new RegExp(`\\b(${REGION_PATTERN})\\b`, 'gi'))) {
    const key = m[1].toLowerCase();
    found.add(REGION_ALIASES[key] ?? key);
  }
  return found;
}

function numbersIn(text) {
  const found = new Set();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) found.add(m[0].replace(/,/g, ''));
  return found;
}

const intersects = (a, b) => [...a].some((x) => b.has(x));

function bigrams(tokens) {
  const out = new Set();
  for (let i = 0; i < tokens.length - 1; i++) out.add(`${tokens[i]} ${tokens[i + 1]}`);
  return out;
}

/**
 * Decide whether two headlines describe the same story.
 * Combines overlap measures and vetoes obvious look-alikes (different place,
 * different figures). It is a heuristic: it cannot read the articles.
 */
export function compareHeadlines(a, b) {
  const na = normalizeHeadline(a);
  const nb = normalizeHeadline(b);
  if (!na || !nb) return { duplicate: false, score: 0, reason: 'empty' };
  if (na === nb) return { duplicate: true, score: 1, reason: 'identical' };

  const ta = contentTokens(na);
  const tb = contentTokens(nb);
  const sa = new Set(ta);
  const sb = new Set(tb);
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared++;
  const smaller = Math.min(sa.size, sb.size);
  if (!smaller) return { duplicate: false, score: 0, reason: 'no-content-words' };

  const union = sa.size + sb.size - shared;
  const jaccard = shared / union;
  const containment = shared / smaller;
  const ba = bigrams(ta);
  const bb = bigrams(tb);
  let sharedBigrams = 0;
  for (const g of ba) if (bb.has(g)) sharedBigrams++;
  const dice = ba.size + bb.size ? (2 * sharedBigrams) / (ba.size + bb.size) : 0;

  const ra = regionsIn(a);
  const rb = regionsIn(b);
  const ma = numbersIn(a);
  const mb = numbersIn(b);

  // Vetoes: same template, different place or different figures.
  if (ra.size && rb.size && !intersects(ra, rb) && jaccard < 0.75) {
    return { duplicate: false, score: jaccard, reason: 'different-place' };
  }
  if (ma.size && mb.size && !intersects(ma, mb) && jaccard < 0.85) {
    return { duplicate: false, score: jaccard, reason: 'different-figures' };
  }

  if (jaccard >= 0.6) return { duplicate: true, score: jaccard, reason: 'high-overlap' };
  if (shared >= 5 && containment >= 0.85) {
    return { duplicate: true, score: containment, reason: 'one-contains-other' };
  }
  const sharedAnchor = intersects(ra, rb) || intersects(ma, mb);
  if (sharedAnchor && shared >= 4 && jaccard >= 0.45 && dice >= 0.15) {
    return { duplicate: true, score: jaccard, reason: 'anchored-overlap' };
  }
  return { duplicate: false, score: jaccard, reason: 'distinct' };
}

/* ───────────────────────── scoring and briefs ──────────────────── */

export function scoreItem(headline, ageMs, maxAgeMs) {
  if (headline.length < MIN_TITLE || headline.length > MAX_TITLE) return 0;
  if (REJECT.test(headline)) return 0;
  let score = 0;
  for (const [pattern, weight] of SIGNALS) if (pattern.test(headline)) score += weight;
  if (score < MIN_SCORE) return 0;
  score += 2 * (1 - Math.min(Math.max(ageMs, 0) / maxAgeMs, 1));
  if (new RegExp(`\\b(?:${REGION_PATTERN})\\b`, 'i').test(headline)) score += 0.5;
  return score;
}

export function buildBrief(c, nowIso) {
  const hasPublisher = c.publisher !== FALLBACK_PUBLISHER;
  const dateLabel = new Date(c.publishedAt).toLocaleDateString(LOCALE, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
  const from = hasPublisher ? c.publisher : 'a publisher linked through Google News';
  const tags = [...new Set(TAGS.filter(([re]) => re.test(c.headline)).map(([, t]) => t))];
  const region = [...regionsIn(c.headline)][0] ?? null;
  const slugBase = slugify(c.headline) || 'update';

  return {
    slug: `water-news-${slugBase}-${shortHash(c.articleId)}`,
    title: truncate(`Water update: ${c.headline}`, 180),
    summary: truncate(
      `Google News lists a report titled “${c.headline}” from ${from}, dated ${dateLabel}. ` +
        'This is an attributed news brief based on the headline only. AuroTap has not read or ' +
        'independently verified the report. Open the original publisher report for context, ' +
        'location, dates and details.',
      900,
    ),
    source_name: truncate(c.publisher, 100),
    source_url: c.sourceUrl,
    source_published_at: c.publishedAt,
    discovered_at: nowIso, // not reviewed_at: nobody has reviewed this yet
    status: 'draft',
    editor_approved: false,
    // Additive fields (all derived from the feed item or fixed text)
    headline: c.headline,
    article_id: c.articleId,
    verification_status: 'headline-only',
    verified: false,
    source_type: 'google-news-rss',
    seo_title: truncate(c.headline, 50) + ' | AuroTap',
    seo_description: truncate(`${c.headline}. Source: ${c.publisher}. Attributed news brief from AuroTap.`, 155),
    tags,
    region,
    locale: LOCALE,
    content_type: 'attributed-news-brief',
  };
}

/* ───────────────────────── record validation ───────────────────── */

const BASE_STRINGS = {
  slug: 120, title: 180, summary: 900, source_name: 100, source_url: 2048, source_published_at: 40,
};
// Drafts have not been reviewed, so they carry no reviewed_at / publish_at.
const KIND_STRINGS = {
  draft: { discovered_at: 40 },
  published: { reviewed_at: 40, publish_at: 40 },
};
const DATE_KEYS = ['source_published_at', 'discovered_at', 'reviewed_at', 'publish_at'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

const isDate = (v) => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Returns a list of problems; empty means valid. kind: 'draft' | 'published'. Unknown fields are allowed. */
export function validateRecord(rec, kind = 'draft') {
  if (!isObj(rec)) return ['not an object'];
  const errors = [];
  const required = { ...BASE_STRINGS, ...(KIND_STRINGS[kind] ?? {}) };
  for (const [key, max] of Object.entries(required)) {
    const v = rec[key];
    if (typeof v !== 'string' || !v.trim()) errors.push(`${key}: missing or empty`);
    else if (v.length > max) errors.push(`${key}: longer than ${max}`);
    else if (CONTROL_RE.test(v)) errors.push(`${key}: control characters`);
  }
  if (typeof rec.slug === 'string' && !SLUG_RE.test(rec.slug)) errors.push('slug: invalid format');
  if (typeof rec.source_url === 'string' && !canonicalUrl(rec.source_url)) {
    errors.push('source_url: must be a public https URL without credentials');
  }
  for (const key of DATE_KEYS) {
    if (typeof rec[key] === 'string' && !isDate(rec[key])) errors.push(`${key}: not a valid date`);
  }
  if (rec.tags !== undefined && !(Array.isArray(rec.tags) && rec.tags.length <= 12 && rec.tags.every((t) => typeof t === 'string' && t.length <= 60))) {
    errors.push('tags: must be an array of short strings');
  }
  if (rec.region !== undefined && rec.region !== null && typeof rec.region !== 'string') errors.push('region: must be string or null');
  if (rec.verified !== undefined && typeof rec.verified !== 'boolean') errors.push('verified: must be boolean');
  if (rec.editor_approved !== undefined && typeof rec.editor_approved !== 'boolean') errors.push('editor_approved: must be boolean');
  if (rec.verification_status !== undefined && typeof rec.verification_status !== 'string') errors.push('verification_status: must be string');
  return errors;
}

/** Split raw store content into valid records and invalid ones (with reasons). */
export function validateStore(data, kind = 'draft') {
  if (!Array.isArray(data)) throw new Error('News store must be a JSON array');
  const valid = [];
  const invalid = [];
  const slugs = new Set();
  const ids = new Set();
  data.forEach((rec, index) => {
    const errors = validateRecord(rec, kind);
    if (!errors.length) {
      if (slugs.has(rec.slug)) errors.push('slug: duplicate');
      const canon = canonicalUrl(rec.source_url);
      const id = rec.article_id ?? (canon ? articleIdFor(canon) : null);
      if (id && ids.has(id)) errors.push('article: duplicate source');
      if (!errors.length) {
        slugs.add(rec.slug);
        if (id) ids.add(id);
      }
    }
    if (errors.length) invalid.push({ index, errors, record: rec });
    else valid.push(rec);
  });
  return { valid, invalid };
}

/* ───────────────────────────── network ─────────────────────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readBounded(res) {
  if (Number(res.headers.get('content-length')) > MAX_BYTES) {
    throw Object.assign(new Error('News feed exceeds memory limit'), { retryable: false });
  }
  if (!res.body) throw Object.assign(new Error('Missing feed stream'), { retryable: false });
  const chunks = [];
  let bytes = 0;
  for await (const chunk of res.body) {
    bytes += chunk.byteLength;
    if (bytes > MAX_BYTES) {
      throw Object.assign(new Error('News feed exceeds memory limit'), { retryable: false });
    }
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks, bytes));
}

/** Bounded fetch: every attempt and the total time are capped, so worst case is DEADLINE_MS. */
async function fetchFeedText(retries) {
  const started = Date.now();
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const remaining = DEADLINE_MS - (Date.now() - started);
    if (remaining < 300) break;
    try {
      const res = await fetch(FEED_URL, {
        signal: AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, remaining)),
        headers: { Accept: 'application/rss+xml, application/xml', 'User-Agent': 'AuroTapNewsBot/1.0' },
        redirect: 'error',
      });
      if (!res.ok) {
        const err = new Error(`News feed unavailable: ${res.status}`);
        err.retryable = res.status === 429 || res.status >= 500;
        err.retryAfterMs = Math.min(Number(res.headers.get('retry-after')) * 1000 || 0, 2000);
        throw err;
      }
      const type = res.headers.get('content-type') ?? '';
      if (type && !/xml|rss|text\/plain/i.test(type)) {
        throw Object.assign(new Error(`Unexpected feed content-type: ${type}`), { retryable: false });
      }
      return await readBounded(res);
    } catch (error) {
      lastError = error;
      if ((error.retryable ?? true) === false || attempt === retries) break;
      const wait = Math.max(error.retryAfterMs || 0, 300 * 2 ** attempt);
      if (Date.now() - started + wait >= DEADLINE_MS) break;
      await sleep(wait);
    }
  }
  throw lastError ?? new Error('News feed unavailable: deadline exceeded');
}

async function readFeedFile(path) {
  const info = await stat(path);
  if (info.size > MAX_BYTES) throw new Error('Feed file exceeds memory limit');
  return readFile(path, 'utf8');
}

/* ───────────────────────── lock and storage ────────────────────── */

let heldToken = null;
let heartbeat = null;

function releaseLockSync() {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
  if (!heldToken) return;
  try {
    const current = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
    if (current.token === heldToken) unlinkSync(LOCK_PATH);
  } catch {
    /* already gone */
  }
  heldToken = null;
}

/** Fencing: call right before every write. Aborts if the lock is no longer ours. */
async function assertLockHeld() {
  let current;
  try {
    current = JSON.parse(await readFile(LOCK_PATH, 'utf8'));
  } catch {
    throw new Error('Lost the news store lock; nothing was written');
  }
  if (!heldToken || current.token !== heldToken) throw new Error('Lost the news store lock; nothing was written');
}

/** A live holder keeps touching the lock, so its age never reaches LOCK_STALE_MS, on any machine. */
function startHeartbeat() {
  heartbeat = setInterval(async () => {
    try {
      const current = JSON.parse(await readFile(LOCK_PATH, 'utf8'));
      if (current.token === heldToken) {
        const now = new Date();
        await utimes(LOCK_PATH, now, now);
      }
    } catch {
      /* the fencing check will catch a lost lock before any write */
    }
  }, LOCK_HEARTBEAT_MS);
  heartbeat.unref();
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/**
 * Remove the lock only if it is provably abandoned (no heartbeat for LOCK_STALE_MS, or a dead
 * pid on this host). The lock is first moved aside atomically and re-checked, so a lock that
 * was refreshed or replaced meanwhile is put back instead of deleted.
 * Returns true if the caller should retry now.
 */
async function clearStaleLock() {
  let info;
  let raw;
  try {
    info = await stat(LOCK_PATH);
    raw = await readFile(LOCK_PATH, 'utf8');
  } catch (error) {
    return error.code === 'ENOENT';
  }
  let stale = Date.now() - info.mtimeMs > LOCK_STALE_MS;
  if (!stale) {
    try {
      const meta = JSON.parse(raw);
      stale = meta.host === hostname() && Number.isInteger(meta.pid) && !pidAlive(meta.pid);
    } catch {
      /* partially written lock: wait for it */
    }
  }
  if (!stale) return false;

  const aside = `${LOCK_PATH}.stale.${randomUUID()}`;
  try {
    await rename(LOCK_PATH, aside);
  } catch {
    return true; // someone else already removed or replaced it
  }
  try {
    const moved = await stat(aside);
    // rename keeps mtime: a different mtime or content means the holder refreshed it meanwhile.
    if (moved.mtimeMs === info.mtimeMs && (await readFile(aside, 'utf8')) === raw) {
      await unlink(aside).catch(() => {});
      return true;
    }
    await link(aside, LOCK_PATH).catch(() => {}); // restore if the slot is still free
  } finally {
    await unlink(aside).catch(() => {});
  }
  return false;
}

async function acquireLock(waitMs) {
  const token = randomUUID();
  const body = JSON.stringify({ pid: process.pid, host: hostname(), token, createdAt: new Date().toISOString() });
  const deadline = Date.now() + waitMs;
  await mkdir(dirname(LOCK_PATH), { recursive: true });
  for (;;) {
    try {
      const handle = await open(LOCK_PATH, 'wx'); // exclusive create: fails if it exists
      try {
        await handle.writeFile(body);
      } finally {
        await handle.close();
      }
      heldToken = token;
      startHeartbeat();
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    if (await clearStaleLock()) continue;
    if (Date.now() >= deadline) {
      throw new Error('Could not acquire the news store lock: another run is active');
    }
    await sleep(40 + Math.random() * 80);
  }
}

async function withLock(fn) {
  await acquireLock(LOCK_WAIT_MS);
  const onSignal = (signal) => {
    releaseLockSync();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    return await fn();
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    releaseLockSync();
  }
}

/**
 * Read a JSON array store. Missing file -> []. With salvage, an unreadable file
 * (bad JSON or not an array) is moved aside and replaced by an empty store, so a
 * corrupt file can never block --repair.
 */
async function readRawStore(path, { salvage = false } = {}) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { data: [], salvaged: null };
    throw error;
  }
  let problem = null;
  let data;
  try {
    data = JSON.parse(text);
    if (!Array.isArray(data)) problem = 'not a JSON array';
  } catch (error) {
    problem = `not valid JSON: ${error.message}`;
  }
  if (!problem) return { data, salvaged: null };
  if (!salvage) throw new Error(`${path} is ${problem}`);
  const aside = `${path}.corrupt-${Date.now()}`;
  await rename(path, aside);
  return { data: [], salvaged: aside };
}

/** Unique temp name + fsync + atomic rename. Always call while holding the lock. */
async function writeJsonAtomic(path, value) {
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    await mkdir(dirname(path), { recursive: true });
    handle = await open(tmp, 'w', 0o644);
    await handle.writeFile(JSON.stringify(value, null, 2) + '\n');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(tmp, path);
  } catch (error) {
    try { await handle?.close(); } catch { /* ignore */ }
    await unlink(tmp).catch(() => {});
    throw error;
  }
}

/* ────────────────────── candidate ranking + selection ──────────── */

export function rankCandidates(items, now, maxAgeMs) {
  const stats = { feedItems: items.length, badSource: 0, outOfWindow: 0, irrelevant: 0 };
  const ranked = [];
  for (const item of items) {
    const canon = canonicalUrl(item?.source_url);
    const published = Date.parse(item?.source_published_at);
    if (!canon || Number.isNaN(published)) { stats.badSource++; continue; }
    const ageMs = now - published;
    if (ageMs > maxAgeMs || ageMs < -FUTURE_SKEW_MS) { stats.outOfWindow++; continue; }

    const split = splitTitle(item.title);
    const feedPublisher = cleanText(item.source_name);
    const publisher = validPublisher(feedPublisher) ? feedPublisher : split.publisher;
    const score = scoreItem(split.headline, ageMs, maxAgeMs);
    if (!score) { stats.irrelevant++; continue; }

    ranked.push({
      headline: split.headline,
      publisher,
      sourceUrl: new URL(item.source_url).href,
      canon,
      articleId: articleIdFor(canon),
      publishedAt: new Date(published).toISOString(),
      score,
      published,
    });
  }
  ranked.sort((a, b) => b.score - a.score || b.published - a.published);
  return { ranked, stats };
}

export function selectNew(ranked, existing, max, nowIso, log = () => {}) {
  const seenIds = new Set();
  const seenSlugs = new Set();
  const known = [];
  for (const rec of existing) {
    const canon = canonicalUrl(rec.source_url);
    if (canon) { seenIds.add(`url:${canon}`); seenIds.add(articleIdFor(canon)); }
    if (rec.article_id) seenIds.add(rec.article_id);
    seenSlugs.add(rec.slug);
    const knownHeadline = rec.headline ?? String(rec.title ?? '').replace(/^Water update:\s*/i, '');
    if (knownHeadline) known.push(knownHeadline);
  }

  const picked = [];
  for (const c of ranked) {
    if (picked.length >= max) break;
    const ids = [c.articleId, `url:${c.canon}`];
    if (ids.some((id) => seenIds.has(id))) { log(`skip (same article): ${c.headline}`); continue; }
    let duplicateOf = null;
    for (const headline of known) {
      const verdict = compareHeadlines(headline, c.headline);
      if (verdict.duplicate) { duplicateOf = { headline, verdict }; break; }
    }
    if (duplicateOf) {
      log(`skip (${duplicateOf.verdict.reason} ${duplicateOf.verdict.score.toFixed(2)}): ${c.headline}`);
      continue;
    }
    const brief = buildBrief(c, nowIso);
    if (seenSlugs.has(brief.slug)) { log(`skip (slug exists): ${brief.slug}`); continue; }
    ids.forEach((id) => seenIds.add(id));
    seenSlugs.add(brief.slug);
    known.push(c.headline);
    picked.push(brief);
    log(`+ [${c.score.toFixed(1)}] ${c.headline}`);
  }
  return picked;
}

/* ────────────────────────────── main ───────────────────────────── */

function parseArgs(argv) {
  const flag = (name) => argv.includes(`--${name}`);
  const raw = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const num = (name, fallback) => {
    const n = Number(raw(name));
    return raw(name) !== undefined && Number.isFinite(n) ? n : fallback;
  };
  return {
    dryRun: flag('dry-run'),
    verbose: flag('verbose'),
    validate: flag('validate'),
    repair: flag('repair'),
    promote: flag('promote'),
    feedFile: raw('feed-file') ?? null,
    max: Math.min(Math.max(Math.trunc(num('max', 1)), 1), 3),
    maxAgeDays: Math.min(Math.max(num('max-age-days', 7), 1), 14),
    retries: Math.min(Math.max(Math.trunc(num('retries', DEFAULT_RETRIES)), 0), 3),
  };
}

function describeInvalid(invalid) {
  return invalid
    .map((x) => `  #${x.index} (${x.record?.slug ?? 'no slug'}): ${x.errors.join('; ')}`)
    .join('\n');
}

/** Published records, read-only: used for de-duplication and as the append target of --promote. */
async function readPublished() {
  const { data } = await readRawStore(REVIEWED_PATH);
  return { raw: data, records: data.filter(isObj) };
}

function indexPublished(records) {
  const slugs = new Set();
  const ids = new Set();
  const add = (rec) => {
    if (typeof rec.slug === 'string') slugs.add(rec.slug);
    if (rec.article_id) ids.add(rec.article_id);
    const canon = canonicalUrl(rec.source_url);
    if (canon) { ids.add(`url:${canon}`); ids.add(articleIdFor(canon)); }
  };
  records.forEach(add);
  return { slugs, ids, add };
}

function isPublished(rec, idx) {
  if (idx.slugs.has(rec.slug)) return true;
  if (rec.article_id && idx.ids.has(rec.article_id)) return true;
  const canon = canonicalUrl(rec.source_url);
  return Boolean(canon && (idx.ids.has(`url:${canon}`) || idx.ids.has(articleIdFor(canon))));
}

/** Append invalid records to the quarantine file (never overwrites earlier quarantined records). */
async function quarantine(invalid) {
  let existing = [];
  try {
    const parsed = JSON.parse(await readFile(QUARANTINE_PATH, 'utf8'));
    if (Array.isArray(parsed)) existing = parsed;
  } catch {
    /* none yet */
  }
  const seen = new Set(existing.map((x) => JSON.stringify(x?.record)));
  const stamp = new Date().toISOString();
  const added = invalid
    .filter((x) => !seen.has(JSON.stringify(x.record)))
    .map((x) => ({ errors: x.errors, record: x.record, quarantined_at: stamp }));
  await writeJsonAtomic(QUARANTINE_PATH, [...existing, ...added]);
}

/** Keep at most MAX_STORE unapproved drafts (oldest dropped first). Approved drafts are never dropped. */
export function trimDrafts(list) {
  let drop = list.length - MAX_STORE;
  if (drop <= 0) return list;
  return list.filter((rec) => {
    if (drop > 0 && rec.editor_approved !== true) { drop--; return false; }
    return true;
  });
}

/** Quarantine invalid drafts. Touches no network, so it works when the feed is down or empty. */
async function repairDrafts(opts, log) {
  const { data, salvaged } = await readRawStore(DRAFTS_PATH, { salvage: !opts.dryRun });
  if (salvaged) console.log(`Draft store was unreadable; moved to ${salvaged} and started fresh.`);
  const { valid, invalid } = validateStore(data, 'draft');
  if (!invalid.length) {
    log('Repair: no invalid drafts.');
    return 0;
  }
  if (opts.dryRun) {
    console.log(`Dry run: would quarantine ${invalid.length} invalid draft(s):\n${describeInvalid(invalid)}`);
    return invalid.length;
  }
  await assertLockHeld();
  await quarantine(invalid);
  await writeJsonAtomic(DRAFTS_PATH, valid);
  console.log(`Quarantined ${invalid.length} invalid draft(s) to ${QUARANTINE_PATH}`);
  return invalid.length;
}

/** Move editor-approved drafts into the published store (append only, nothing trimmed). */
async function promoteDrafts(opts, log) {
  const nowIso = new Date().toISOString();
  const { valid, invalid } = validateStore((await readRawStore(DRAFTS_PATH)).data, 'draft');
  if (invalid.length) {
    throw new Error(
      `Draft store has ${invalid.length} invalid record(s); nothing was promoted.\n` +
        `${describeInvalid(invalid)}\nRun with --repair first.`,
    );
  }
  const { raw: publishedRaw, records } = await readPublished();
  const idx = indexPublished(records);
  const approved = [];
  const remaining = [];
  for (const rec of valid) {
    if (isPublished(rec, idx)) { log(`drop (already published): ${rec.slug}`); continue; }
    if (rec.editor_approved !== true) { remaining.push(rec); continue; }
    const pub = { ...rec, status: 'published', reviewed_at: nowIso, publish_at: nowIso };
    delete pub.editor_approved;
    const errors = validateRecord(pub, 'published');
    if (errors.length) {
      console.error(`Not promoted (${rec.slug}): ${errors.join('; ')}`);
      remaining.push(rec);
      continue;
    }
    approved.push(pub);
    idx.add(pub);
  }
  const dropped = valid.length - approved.length - remaining.length;
  if (opts.dryRun) {
    console.log(JSON.stringify(approved, null, 2));
    console.log(`Dry run: ${approved.length} draft(s) would be promoted, ${dropped} already-published draft(s) dropped.`);
    return approved;
  }
  if (!approved.length && !dropped) {
    console.log('No editor-approved drafts to promote.');
    return [];
  }
  await assertLockHeld();
  // Published store first: a crash in between only leaves an already-published draft, which is dropped next run.
  if (approved.length) await writeJsonAtomic(REVIEWED_PATH, [...publishedRaw, ...approved]);
  await writeJsonAtomic(DRAFTS_PATH, remaining);
  for (const rec of approved) console.log('Promoted to published store:', rec.slug);
  return approved;
}

export async function run(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const log = (msg) => { if (opts.verbose) console.log(msg); };

  if (opts.validate) {
    const { valid, invalid } = validateStore((await readRawStore(DRAFTS_PATH)).data, 'draft');
    console.log(`Drafts: ${valid.length} valid, ${invalid.length} invalid record(s).`);
    if (invalid.length) {
      console.error(describeInvalid(invalid));
      process.exitCode = 1;
    }
    return { valid, invalid };
  }

  if (opts.promote) {
    return opts.dryRun ? promoteDrafts(opts, log) : withLock(() => promoteDrafts(opts, log));
  }

  // Repair comes first and never depends on the feed: it runs even if the feed is down or empty.
  if (opts.repair) {
    await (opts.dryRun ? repairDrafts(opts, log) : withLock(() => repairDrafts(opts, log)));
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // Network WITHOUT the lock, so other runs are never blocked by a slow feed.
  const feedText = opts.feedFile ? await readFeedFile(opts.feedFile) : await fetchFeedText(opts.retries);
  const items = parseFeed(feedText);
  if (!Array.isArray(items)) throw new Error('Feed parser returned no list');

  const { ranked, stats } = rankCandidates(items, now, opts.maxAgeDays * 86_400_000);
  log(`Feed items: ${stats.feedItems}, bad source: ${stats.badSource}, out of window: ${stats.outOfWindow}, irrelevant: ${stats.irrelevant}, eligible: ${ranked.length}`);
  if (!ranked.length) {
    console.log('No eligible sourced news; no fabricated post.');
    return [];
  }

  // Read-validate-select-write is one critical section: stores are re-read under the lock.
  const critical = async () => {
    const { valid, invalid } = validateStore((await readRawStore(DRAFTS_PATH)).data, 'draft');
    if (invalid.length && !(opts.repair && opts.dryRun)) {
      throw new Error(
        `Draft store has ${invalid.length} invalid record(s); nothing was written.\n` +
          `${describeInvalid(invalid)}\nRerun with --repair to quarantine them.`,
      );
    }
    const { records: published } = await readPublished();
    const idx = indexPublished(published);
    const pending = valid.filter((rec) => !isPublished(rec, idx)); // drafts that were published since
    const dropped = valid.length - pending.length;
    const picked = selectNew(ranked, [...published, ...pending], opts.max, nowIso, log);

    if (opts.dryRun) {
      console.log(JSON.stringify(picked, null, 2));
      console.log(`Dry run: ${picked.length} draft(s) not written.`);
      return picked;
    }
    if (!picked.length && !dropped) {
      console.log('No new eligible news (all candidates already known or too similar).');
      return [];
    }
    await assertLockHeld();
    await writeJsonAtomic(DRAFTS_PATH, trimDrafts([...pending, ...picked]));
    for (const brief of picked) console.log('Saved draft brief for editorial review:', brief.slug);
    return picked;
  };

  // A dry run never writes, so it needs no lock.
  return opts.dryRun ? critical() : withLock(critical);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run().catch((error) => {
    console.error('News brief failed:', error?.message ?? error);
    process.exitCode = 1;
  });
}
