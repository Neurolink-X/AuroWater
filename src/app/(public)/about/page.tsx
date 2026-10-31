import Link from 'next/link';
import Image from 'next/image';
import { ILLUSTRATIONS, ILLUSTRATION_ALT, type ServiceKey } from '../services/services-data';
import JsonLd from '@/components/seo/JsonLd';
import { TRUST_REVIEWS } from '@/lib/trust-reviews';
import { APP_ORIGIN, BRAND, SITE } from '@/lib/seo';

/**
 * About page — server component (no client JS shipped).
 * - Neumorphic light "water" design, CSS only (no external font import, no JS hover).
 * - Metadata lives in ./layout.tsx (pageMeta) so it stays server-rendered.
 * - Structured data: AboutPage + BreadcrumbList + ItemList(Service) + FAQPage.
 * - Only claims the product can back up: no invented ratings, earnings or city counts.
 */

const WHATSAPP = 'https://wa.me/919889305803';

type Service = { key: ServiceKey; icon: string; title: string; desc: string };

const SERVICES: Service[] = [
  { key: 'water_can', icon: '💧', title: '20L Water Can Delivery', desc: 'Normal RO cans for homes and offices, with Chilled RO for one-time events where available. Pick a slot and see the total before you confirm.' },
  { key: 'water_tanker', icon: '🚚', title: 'Water Tanker Delivery', desc: 'Bulk water for societies, construction sites and functions. Request a tanker for your address and review the price first.' },
  { key: 'ro_service', icon: '🫧', title: 'RO Service & Repair', desc: 'Filter and membrane changes, leaks, low flow and routine care for RO water purifiers, by technician partners.' },
  { key: 'plumbing', icon: '🔧', title: 'Plumbing Services', desc: 'Taps, pipelines, fittings, leakage and bathroom or kitchen plumbing, booked online with a clear scope.' },
  { key: 'borewell', icon: '⛏️', title: 'Borewell Services', desc: 'Borewell installation and repair support for homes, farms and commercial properties.' },
  { key: 'motor_pump', icon: '⚙️', title: 'Motor & Submersible Pump Repair', desc: 'Diagnosis, repair and replacement for water motors and submersible pumps.' },
  { key: 'tank_cleaning', icon: '🛁', title: 'Water Tank Cleaning', desc: 'Overhead and underground tank cleaning so the water that reaches your taps stays hygienic.' },
];

const STEPS = [
  { n: '1', title: 'Check your address', desc: 'Enter your delivery address. We confirm whether your locality is serviceable before you go further.' },
  { n: '2', title: 'See the price', desc: 'The total is shown before you confirm. No hidden charges, no surprise fees.' },
  { n: '3', title: 'Choose a slot', desc: 'Pick a delivery or visit slot that suits you, and pay by UPI or cash as offered.' },
  { n: '4', title: 'Get it done', desc: 'A local supplier or technician partner accepts your order and completes it. You can track it from your account.' },
];

const VALUES = [
  { icon: '🤝', title: 'Transparency', desc: 'Full price shown before you confirm. No hidden charges, no surprise fees.' },
  { icon: '📍', title: 'Local availability', desc: 'Slots depend on your address and local supplier or technician capacity, so we tell you up front.' },
  { icon: '🛡️', title: 'Responsible onboarding', desc: 'Supplier and technician accounts go through identity, skill and operational checks before activation.' },
  { icon: '💧', title: 'Water-first', desc: 'We exist only for water: drinking water, tankers, purifiers, pumps, tanks and plumbing.' },
  { icon: '📞', title: 'Real support', desc: 'Reach us on the published WhatsApp, phone and email channels. Response times can vary.' },
  { icon: '🌱', title: 'Local livelihoods', desc: 'We give local technicians and suppliers digital orders while serving local households.' },
];

const ACTIVE_CITIES = [
  { name: 'Kanpur', slug: 'kanpur' },
  { name: 'Lucknow', slug: 'lucknow' },
  { name: 'Gorakhpur', slug: 'gorakhpur' },
];

const FAQS = [
  { q: 'Where does AuroTap deliver water?', a: 'AuroTap currently serves eligible areas of Kanpur, Lucknow and Gorakhpur in Uttar Pradesh. Serviceability is checked against your exact address in the booking flow. Other cities can join the waitlist.' },
  { q: 'What water services can I book?', a: 'You can book 20L water can delivery, water tanker delivery, RO purifier service and repair, plumbing, borewell services, motor and submersible pump repair, and water tank cleaning.' },
  { q: 'Will I see the price before I confirm?', a: 'Yes. The current total is shown before you confirm any booking, so there are no surprise charges at the door.' },
  { q: 'How can I pay?', a: 'You can pay with UPI or cash, depending on the options shown for your order. We do not run automatic subscription debits.' },
  { q: 'Are your technicians and suppliers verified?', a: 'Professional accounts can require identity, skill and operational checks before activation. Availability depends on your locality.' },
  { q: 'How do I become a supplier or technician partner?', a: 'Use the Contact page to apply. After onboarding checks you can receive digital orders in your area and manage them from your dashboard.' },
];

const CSS = `
.ab{--bg:#E4EDF5;--ink:#0F2A3D;--ink2:#4A6178;--brand:#0B8A60;--brand2:#08694B;--aqua:#0277B6;
--raise:8px 8px 18px #C3CFDB,-8px -8px 18px #fff;--raise-sm:4px 4px 10px #C3CFDB,-4px -4px 10px #fff;
--inset:inset 4px 4px 9px #C3CFDB,inset -4px -4px 9px #fff;
background:var(--bg);color:var(--ink);font-family:var(--font-sans),system-ui,sans-serif;line-height:1.6;min-height:100vh;
-webkit-font-smoothing:antialiased;overflow-x:clip}
.ab *,.ab *::before,.ab *::after{box-sizing:border-box}
.ab h1,.ab h2,.ab h3{font-family:var(--font-display),var(--font-sans),sans-serif;margin:0;color:var(--ink);letter-spacing:-.02em}
.ab p{margin:0}
.ab a{color:inherit}
.ab-wrap{max-width:1200px;margin:0 auto;padding:0 20px}
.ab-sec{margin-top:clamp(40px,6vw,72px)}
.ab-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:var(--bg);box-shadow:var(--raise-sm);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--brand2)}
.ab-dot{width:8px;height:8px;border-radius:50%;background:var(--brand);box-shadow:0 0 0 3px rgba(11,138,96,.2)}
.ab-h2{font-size:clamp(1.5rem,3.6vw,2.3rem);font-weight:800;line-height:1.15;margin-top:14px}
.ab-lead{color:var(--ink2);font-size:15px;max-width:640px;margin-top:10px}
.ab-card{background:var(--bg);border-radius:22px;box-shadow:var(--raise);padding:clamp(22px,3vw,34px)}
.ab-inset{background:var(--bg);border-radius:16px;box-shadow:var(--inset)}
.ab-crumb{padding-top:18px;font-size:12px;font-weight:600;color:var(--ink2)}
.ab-crumb a{text-decoration:none}.ab-crumb a:hover{color:var(--brand2)}
.ab-hero{margin-top:14px;border-radius:28px;background:linear-gradient(145deg,#EAF3FA,#DCE8F2);box-shadow:var(--raise);padding:clamp(28px,6vw,64px);position:relative;overflow:hidden;animation:ab-in .5s ease both}
.ab-hero::after{content:"";position:absolute;right:-90px;top:-90px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle at 35% 35%,rgba(2,119,182,.16),rgba(11,138,96,.05) 60%,transparent 70%);pointer-events:none}
.ab-hero h1{font-size:clamp(2rem,6vw,3.8rem);font-weight:800;line-height:1.05;max-width:800px;margin-top:18px}
.ab-hero h1 em{font-style:normal;color:var(--brand)}
.ab-hero p.lead{margin-top:18px;max-width:600px;font-size:clamp(15px,2vw,17px);color:var(--ink2)}
.ab-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px;position:relative;z-index:1}
.ab-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 24px;border-radius:14px;font-weight:800;font-size:14px;text-decoration:none;border:0;transition:box-shadow .15s,transform .15s,filter .15s}
.ab-btn--p{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;box-shadow:5px 5px 12px #B5C3D1,-4px -4px 10px #fff}
.ab-btn--s{background:var(--bg);color:var(--ink);box-shadow:var(--raise-sm)}
.ab-btn:active{transform:scale(.98);box-shadow:var(--inset)}
.ab-btn--p:active{box-shadow:inset 3px 3px 8px rgba(0,0,0,.25)}
.ab-btn:focus-visible,.ab a:focus-visible,.ab summary:focus-visible{outline:3px solid var(--aqua);outline-offset:3px}
.ab-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-top:28px}
.ab-stat{padding:20px 14px;text-align:center;border-radius:18px;box-shadow:var(--raise-sm);background:var(--bg)}
.ab-stat b{display:block;font-family:var(--font-display),sans-serif;font-size:34px;line-height:1;color:var(--brand2)}
.ab-stat span{display:block;margin-top:8px;font-size:12px;font-weight:700;color:var(--ink2)}
.ab-grid{display:grid;gap:18px;margin-top:26px}
.ab-g2{grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))}
.ab-g3{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
.ab-ico{width:50px;height:50px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:var(--inset);background:var(--bg);margin-bottom:14px}
.ab-svc{display:flex;flex-direction:column;text-decoration:none;transition:box-shadow .18s,transform .18s;content-visibility:auto;contain-intrinsic-size:auto 230px}
.ab-svc-photo{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:14px;margin-bottom:16px;background:#e7f1f3}
.ab-svc-photo img{object-fit:cover;transition:transform .25s ease}
@media (hover:hover) and (prefers-reduced-motion:no-preference){.ab-svc:hover .ab-svc-photo img{transform:scale(1.035)}}
.ab-svc h3{font-size:17px;font-weight:800}
.ab-svc p{margin-top:8px;font-size:13.5px;color:var(--ink2);flex:1}
.ab-more{margin-top:14px;font-size:13px;font-weight:800;color:var(--brand2)}
.ab-step{display:flex;gap:14px;align-items:flex-start;padding:18px;border-radius:18px;box-shadow:var(--inset)}
.ab-step i{flex:none;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--brand),var(--brand2));box-shadow:2px 2px 6px #B5C3D1}
.ab-step h3{font-size:15px;font-weight:800}
.ab-step p{margin-top:4px;font-size:13px;color:var(--ink2)}
.ab-val h3{font-size:16px;font-weight:800}
.ab-val p{margin-top:6px;font-size:13.5px;color:var(--ink2)}
.ab-pills{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}
.ab-pill{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border-radius:999px;background:var(--bg);box-shadow:var(--raise-sm);font-weight:800;font-size:14px;text-decoration:none;transition:box-shadow .15s}
.ab-pill:active{box-shadow:var(--inset)}
.ab-pill--soft{box-shadow:var(--inset);color:var(--ink2);font-weight:700}
.ab-faq details{border-radius:16px;background:var(--bg);box-shadow:var(--raise-sm);padding:0 20px;margin-top:14px}
.ab-faq details[open]{box-shadow:var(--inset)}
.ab-faq summary{cursor:pointer;list-style:none;min-height:56px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:800;font-size:15px}
.ab-faq summary::-webkit-details-marker{display:none}
.ab-faq summary::after{content:"+";font-size:22px;color:var(--brand2);line-height:1}
.ab-faq details[open] summary::after{content:"–"}
.ab-faq details p{padding:0 0 18px;font-size:14px;color:var(--ink2)}
.ab-check{display:flex;gap:10px;align-items:flex-start;font-size:14px;font-weight:600;margin-top:10px}
.ab-check::before{content:"✓";flex:none;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--brand2);box-shadow:var(--inset)}
.ab-banner{border-radius:26px;padding:clamp(28px,5vw,48px);display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#0B8A60,#08694B);color:#fff;box-shadow:var(--raise)}
.ab-banner h2{color:#fff}
.ab-banner .ab-btn--w{background:#fff;color:var(--brand2);box-shadow:3px 3px 10px rgba(0,0,0,.2)}
.ab-banner .ab-btn--o{background:rgba(255,255,255,.14);color:#fff;border:1.5px solid rgba(255,255,255,.4)}
.ab-founder{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.ab-avatar{width:84px;height:84px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:26px;color:#fff;background:linear-gradient(135deg,var(--brand),var(--aqua));box-shadow:var(--raise-sm)}
@media (hover:hover){
.ab-svc:hover{transform:translateY(-3px);box-shadow:12px 12px 24px #C3CFDB,-10px -10px 22px #fff}
.ab-btn--p:hover{filter:brightness(1.07)}.ab-btn--s:hover,.ab-pill:hover{box-shadow:6px 6px 14px #C3CFDB,-6px -6px 14px #fff}
}
@keyframes ab-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ab *{animation:none!important;transition:none!important}}
`;

export default function AboutPage() {
  const url = `${APP_ORIGIN}/about`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': `${url}#webpage`,
      url,
      name: `About ${BRAND} (AuroTap): local water delivery & home water services`,
      description:
        'AuroTap is a local-first platform for 20L water can delivery, water tankers, RO service, plumbing, borewell, pump repair and tank cleaning in eligible areas of Kanpur, Lucknow and Gorakhpur.',
      inLanguage: 'en-IN',
      about: { '@id': `${APP_ORIGIN}/#organization` },
      publisher: { '@id': `${APP_ORIGIN}/#organization` },
      breadcrumb: { '@id': `${url}#breadcrumb` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${APP_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'About', item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${url}#services`,
      name: 'AuroTap water services',
      itemListElement: SERVICES.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Service',
          name: s.title,
          description: s.desc,
          url: `${APP_ORIGIN}/services/${s.key}`,
          provider: { '@id': `${APP_ORIGIN}/#organization` },
          areaServed: ACTIVE_CITIES.map((c) => ({ '@type': 'City', name: c.name, containedInPlace: { '@type': 'AdministrativeArea', name: 'Uttar Pradesh' } })),
        },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];

  return (
    <div className="ab">
      <style>{CSS}</style>
      <JsonLd data={jsonLd} id="about" />

      <div className="ab-wrap">
        <nav className="ab-crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span aria-current="page">About</span>
        </nav>

        {/* HERO */}
        <header className="ab-hero">
          <span className="ab-eyebrow"><span className="ab-dot" aria-hidden="true" />Kanpur · Lucknow · Gorakhpur</span>
          <h1>
            Water delivery and home water services, <em>simple, fair &amp; reliable.</em>
          </h1>
          <p className="lead">
            AuroTap makes essential water services easy to book: 20L cans, tankers, RO care, plumbing, borewell, pumps and tank
            cleaning. Check your address, see the price, pick a slot. No endless calls, no guessing.
          </p>
          <div className="ab-cta">
            <Link href="/book" className="ab-btn ab-btn--p">Book a service →</Link>
            <Link href="/pricing" className="ab-btn ab-btn--s">View pricing</Link>
            <a href={WHATSAPP} className="ab-btn ab-btn--s" target="_blank" rel="noopener noreferrer">WhatsApp us</a>
          </div>
        </header>

        {/* STATS */}
        <section className="ab-stats" aria-label="AuroTap at a glance">
          <div className="ab-stat"><b>7</b><span>Water service categories</span></div>
          <div className="ab-stat"><b>3</b><span>Live cities in Uttar Pradesh</span></div>
          <div className="ab-stat"><b>2</b><span>Payment options: UPI &amp; cash</span></div>
          <div className="ab-stat"><b>0</b><span>Automatic subscription debits</span></div>
        </section>

        {/* MISSION */}
        <section className="ab-sec" aria-labelledby="mission">
          <div className="ab-grid ab-g2" style={{ marginTop: 0 }}>
            <div className="ab-card">
              <span className="ab-eyebrow">Our mission</span>
              <h2 id="mission" className="ab-h2">Clean water access, for every household.</h2>
              <p className="ab-lead">
                To make water supply and water-system services easy to book, fair to pay for and dependable to receive, with clear
                pricing and onboarded local professionals.
              </p>
              <div style={{ marginTop: 18 }}>
                <div className="ab-check">Price shown before you confirm</div>
                <div className="ab-check">Professional accounts go through onboarding checks</div>
                <div className="ab-check">No hidden charges or surprise fees</div>
              </div>
            </div>
            <div className="ab-card">
              <span className="ab-eyebrow">Our approach</span>
              <h2 className="ab-h2">Built for local reliability.</h2>
              <p className="ab-lead">
                Water is a daily need, so we start local. We focus on serviceable areas, honest slots and recurring water delivery
                that works, and we grow city by city instead of promising everywhere.
              </p>
              <div className="ab-inset" style={{ marginTop: 18, padding: '14px 16px', fontSize: 13.5, color: 'var(--ink2)' }}>
                One platform for households, suppliers and technicians: customers book, local partners accept, and every order is
                tracked from request to completion.
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section className="ab-sec" aria-labelledby="services">
          <span className="ab-eyebrow">What we do</span>
          <h2 id="services" className="ab-h2">Every water service your home or business needs</h2>
          <p className="ab-lead">From daily drinking water to pumps, purifiers and tanks. Availability depends on your address.</p>
          <div className="ab-grid ab-g3">
            {SERVICES.map((s) => (
              <Link key={s.key} href={`/services/${s.key}`} className="ab-card ab-svc" aria-label={`${s.title}: learn more`}>
                <div className="ab-svc-photo"><Image src={ILLUSTRATIONS[s.key]} alt={ILLUSTRATION_ALT[s.key]} fill sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 350px" loading="lazy" /></div>
                <div className="ab-ico" aria-hidden="true">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <span className="ab-more">Learn more →</span>
              </Link>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="ab-sec" aria-labelledby="how">
          <div className="ab-card">
            <span className="ab-eyebrow">How AuroTap works</span>
            <h2 id="how" className="ab-h2">From address check to delivered, in four steps</h2>
            <div className="ab-grid ab-g2">
              {STEPS.map((s) => (
                <div key={s.n} className="ab-step">
                  <i aria-hidden="true">{s.n}</i>
                  <div><h3>{s.title}</h3><p>{s.desc}</p></div>
                </div>
              ))}
            </div>
            <div className="ab-pills">
              <Link href="/how-it-works" className="ab-pill">See the full process →</Link>
              <Link href="/pricing" className="ab-pill">Check pricing →</Link>
            </div>
          </div>
        </section>

        {/* VALUES */}
        <section className="ab-sec" aria-labelledby="values">
          <span className="ab-eyebrow">Our values</span>
          <h2 id="values" className="ab-h2">What drives us every day</h2>
          <div className="ab-grid ab-g3">
            {VALUES.map((v) => (
              <div key={v.title} className="ab-card ab-val" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 190px' }}>
                <div className="ab-ico" aria-hidden="true">{v.icon}</div>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* COVERAGE */}
        <section className="ab-sec" aria-labelledby="coverage">
          <div className="ab-card">
            <span className="ab-eyebrow">Service coverage</span>
            <h2 id="coverage" className="ab-h2">Serving eligible areas in Kanpur, Lucknow &amp; Gorakhpur</h2>
            <p className="ab-lead">Tap your city for local water can delivery details. Varanasi and Agra are coming soon; other cities can join the waitlist.</p>
            <div className="ab-pills">
              {ACTIVE_CITIES.map((c) => (
                <Link key={c.slug} href={`/water-delivery/${c.slug}`} className="ab-pill">
                  <span className="ab-dot" aria-hidden="true" />Water delivery in {c.name}
                </Link>
              ))}
              <span className="ab-pill ab-pill--soft">Varanasi · Agra: coming soon</span>
              <Link href="/contact" className="ab-pill ab-pill--soft">Other areas: join waitlist</Link>
            </div>
          </div>
        </section>

        {/* REVIEWS (verified only) */}
        <section className="ab-sec" aria-labelledby="reviews">
          <span className="ab-eyebrow">Customer trust</span>
          <h2 id="reviews" className="ab-h2">Customer reviews</h2>
          <p className="ab-lead">Only verified customer reviews are published here, linked to completed orders.</p>
          <div className="ab-grid ab-g3">
            {TRUST_REVIEWS.length === 0 ? (
              <p className="ab-inset" style={{ gridColumn: '1 / -1', padding: 22, fontSize: 14, color: 'var(--ink2)' }}>
                Verified customer feedback will appear here once it is linked to completed orders. AuroTap does not publish
                unverified testimonials.
              </p>
            ) : (
              TRUST_REVIEWS.map((r) => (
                <figure key={`${r.name}-${r.date}`} className="ab-card" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>{r.city} · {r.service}</div>
                    </div>
                    <div aria-label={`${r.rating} out of 5 stars`} style={{ color: '#B45309', letterSpacing: 1 }}>
                      {'★'.repeat(Math.max(0, Math.min(5, r.rating)))}
                      <span style={{ color: '#B7C4D1' }}>{'★'.repeat(5 - Math.max(0, Math.min(5, r.rating)))}</span>
                    </div>
                  </div>
                  <blockquote style={{ margin: '14px 0 0', fontSize: 14, color: 'var(--ink2)' }}>“{r.text}”</blockquote>
                  <figcaption style={{ marginTop: 10, fontSize: 11, color: 'var(--ink2)', fontWeight: 600 }}>{r.date}</figcaption>
                </figure>
              ))
            )}
          </div>
        </section>

        {/* FOUNDER */}
        <section className="ab-sec" aria-labelledby="team">
          <div className="ab-card">
            <span className="ab-eyebrow">The team</span>
            <h2 id="team" className="ab-h2">People behind AuroTap</h2>
            <div className="ab-founder" style={{ marginTop: 22 }}>
              <div className="ab-avatar" aria-hidden="true">AC</div>
              <div style={{ flex: '1 1 280px' }}>
                <div style={{ fontWeight: 800, fontSize: 17 }}>Arjun Chaurasiya</div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--brand2)' }}>Founder</div>
                <p style={{ marginTop: 8, fontSize: 14, color: 'var(--ink2)' }}>
                  Building a local-first water delivery and home water-services platform with transparent pricing and dependable
                  service workflows.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="ab-sec ab-faq" aria-labelledby="faq">
          <span className="ab-eyebrow">Questions</span>
          <h2 id="faq" className="ab-h2">Frequently asked questions</h2>
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        {/* PARTNERS */}
        <section className="ab-sec" aria-labelledby="partners">
          <h2 id="partners" className="ab-h2" style={{ marginTop: 0 }}>Grow with AuroTap</h2>
          <div className="ab-grid ab-g2">
            <div className="ab-card">
              <div className="ab-ico" aria-hidden="true">👷</div>
              <h3 style={{ fontSize: 20, fontWeight: 800 }}>Are you a technician or plumber?</h3>
              <p className="ab-lead" style={{ fontSize: 14 }}>Join our onboarded network, accept job requests in your area and build your rating.</p>
              <div style={{ margin: '14px 0 20px' }}>
                <div className="ab-check">Digital job requests in your city</div>
                <div className="ab-check">Verification with private document upload</div>
                <div className="ab-check">Earnings and payout tracking</div>
              </div>
              <Link href="/contact" className="ab-btn ab-btn--p">Apply now →</Link>
            </div>
            <div className="ab-card">
              <div className="ab-ico" aria-hidden="true">🚛</div>
              <h3 style={{ fontSize: 20, fontWeight: 800 }}>Are you a water supplier?</h3>
              <p className="ab-lead" style={{ fontSize: 14 }}>Receive digital orders, manage deliveries and grow your tanker or can supply business.</p>
              <div style={{ margin: '14px 0 20px' }}>
                <div className="ab-check">Digital order management</div>
                <div className="ab-check">Live can inventory and low-stock alerts</div>
                <div className="ab-check">Earnings and payout tracking</div>
              </div>
              <Link href="/contact" className="ab-btn ab-btn--p">Partner with us →</Link>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="ab-sec" style={{ paddingBottom: 72 }} aria-label="Book now">
          <div className="ab-banner">
            <div>
              <span className="ab-eyebrow" style={{ background: 'rgba(255,255,255,.14)', color: '#fff', boxShadow: 'none' }}>Clean water for all</span>
              <h2 className="ab-h2" style={{ marginTop: 14 }}>Ready for water services done right?</h2>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link href="/book" className="ab-btn ab-btn--w">Book now →</Link>
              <Link href="/pricing" className="ab-btn ab-btn--o">View pricing</Link>
            </div>
          </div>
          <p style={{ marginTop: 18, fontSize: 12, color: 'var(--ink2)', textAlign: 'center' }}>
            Questions? Email <a href={`mailto:${SITE.email}`} style={{ fontWeight: 700 }}>{SITE.email}</a> or message us on{' '}
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>WhatsApp</a>.
          </p>
        </section>
      </div>
    </div>
  );
}










// 'use client';

// import React, { useEffect, useMemo, useRef, useState } from 'react';
// import Link from 'next/link';
// import { TRUST_REVIEWS } from '@/lib/trust-reviews';
// import SectionWrapper from '@/components/ui/SectionWrapper';

// // ── Count-up hook ──────────────────────────────────────────────────────────
// function useCountUp(target: number, durationMs: number) {
//   const [value, setValue] = useState(0);
//   const ref = useRef<HTMLDivElement | null>(null);

//   useEffect(() => {
//     if (!ref.current) return;
//     const el = ref.current;
//     const obs = new IntersectionObserver(
//       (entries) => {
//         const entry = entries[0];
//         if (!entry?.isIntersecting) return;
//         obs.disconnect();
//         const start = performance.now();
//         const tick = (now: number) => {
//           const t = Math.min(1, (now - start) / durationMs);
//           const eased = 1 - Math.pow(1 - t, 3);
//           setValue(target * eased);
//           if (t < 1) requestAnimationFrame(tick);
//         };
//         requestAnimationFrame(tick);
//       },
//       { threshold: 0.25 }
//     );
//     obs.observe(el);
//     return () => obs.disconnect();
//   }, [target, durationMs]);

//   return { value, ref };
// }

// // ── Avatar gradient ────────────────────────────────────────────────────────
// const AVATAR_COLORS: [string, string][] = [
//   ['#0D9B6C', '#065F46'],
//   ['#0369A1', '#0C4A6E'],
//   ['#7C3AED', '#4C1D95'],
//   ['#D97706', '#78350F'],
//   ['#DC2626', '#7F1D1D'],
// ];
// function avatarGradient(name: string): [string, string] {
//   return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
// }

// // ── Inline SVG icons ───────────────────────────────────────────────────────
// const DropIcon = ({ size = 18, color = '#0D9B6C' }: { size?: number; color?: string }) => (
//   <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
//     <path d="M12 2C12 2 5 9.5 5 14.5C5 18.09 8.13 21 12 21C15.87 21 19 18.09 19 14.5C19 9.5 12 2 12 2Z"
//       fill={color} opacity="0.18" stroke={color} strokeWidth="1.5" />
//     <path d="M9 15.5C9.5 17.5 11 18.5 13 18" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
//   </svg>
// );

// const ArrowRightIcon = ({ color = '#fff' }: { color?: string }) => (
//   <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
//     <path d="M3 7.5h9M8.5 4L12 7.5 8.5 11" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//   </svg>
// );

// const CheckCircle = ({ color = '#0D9B6C' }: { color?: string }) => (
//   <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
//     <circle cx="8" cy="8" r="8" fill={color} opacity="0.12" />
//     <path d="M5 8L7 10L11 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//   </svg>
// );

// const StarIcon = ({ filled }: { filled: boolean }) => (
//   <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
//     <polygon points="7,1 8.8,5.2 13,5.6 10,8.4 10.9,12.5 7,10.3 3.1,12.5 4,8.4 1,5.6 5.2,5.2"
//       fill={filled ? '#F59E0B' : '#E5E7EB'} />
//   </svg>
// );

// // ── Reusable Pill label ────────────────────────────────────────────────────
// function SectionPill({ children }: { children: React.ReactNode }) {
//   return (
//     <div style={{
//       display: 'inline-flex', alignItems: 'center', gap: 6,
//       background: '#ECFDF5', border: '1px solid #A7F3D0',
//       borderRadius: 999, padding: '4px 12px', marginBottom: 12,
//     }}>
//       <span style={{ fontSize: 10, fontWeight: 800, color: '#065F46', letterSpacing: '0.1em' }}>{children}</span>
//     </div>
//   );
// }

// // ── Main Page ──────────────────────────────────────────────────────────────
// export default function AboutPage() {
//   const stats = useMemo(() => [
//     { label: 'Service categories', value: 7, suffix: '', icon: '💧', format: (n: number) => Math.floor(n).toLocaleString('en-IN') },
//     { label: 'Live service zones', value: 3, suffix: '', icon: '📍', format: (n: number) => Math.floor(n).toLocaleString('en-IN') },
//     { label: 'Payment options', value: 2, suffix: '', icon: '💳', format: (n: number) => Math.floor(n).toLocaleString('en-IN') },
//     { label: 'Automatic subscription debits', value: 0, suffix: '', icon: '🔒', format: (n: number) => Math.floor(n).toLocaleString('en-IN') },
//   ], []);

//   const c1 = useCountUp(stats[0].value, 1600);
//   const c2 = useCountUp(stats[1].value, 1600);
//   const c3 = useCountUp(stats[2].value, 1600);
//   const c4 = useCountUp(stats[3].value, 1600);
//   const counts = [c1, c2, c3, c4];

//   const team = useMemo(() => [
//     { name: 'Arjun Chaurasiya', role: 'Founder', initials: 'AC', bio: 'Building a local-first water delivery and home water-services platform with transparent pricing and dependable service workflows.' },
//   ], []);

//   const cities = ['Kanpur', 'Lucknow', 'Gorakhpur'];

//   const values = [
//     { icon: '🤝', title: 'Transparency', desc: 'Full price shown before you confirm. No hidden charges, no surprise fees — ever.' },
//     { icon: '⚡', title: 'Local availability', desc: 'Delivery and service slots depend on your address and local supplier or technician capacity.' },
//     { icon: '🛡️', title: 'Responsible onboarding', desc: 'Professional accounts can require identity, skill and operational checks before activation.' },
//     { icon: '💧', title: 'Water-first', desc: 'We exist solely for water services. Not a generic marketplace — deep expertise only.' },
//     { icon: '📞', title: 'Support', desc: 'Contact support using the published WhatsApp, phone and email channels. Response times can vary.' },
//     { icon: '🌱', title: 'Community', desc: 'We create livelihoods for local technicians while serving local households.' },
//   ];

//   const milestones = [
//     { year: 'NOW', event: 'Focused on reliable local serviceability, clear pricing and recurring water delivery in supported areas.' },
//   ];

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Clash+Display:wght@600;700&family=Bricolage+Grotesque:wght@300;400;500;600;700;800&display=swap');

//         .about-page * { box-sizing: border-box; }
//         .about-page { font-family: 'Bricolage Grotesque', sans-serif; }
//         .about-page .clash { font-family: 'Clash Display', sans-serif; }

//         @keyframes floatA {
//           0%, 100% { transform: translateY(0) rotate(-6deg); }
//           50% { transform: translateY(-14px) rotate(-6deg); }
//         }
//         @keyframes floatB {
//           0%, 100% { transform: translateY(0) rotate(10deg); }
//           50% { transform: translateY(-10px) rotate(10deg); }
//         }
//         @keyframes pulseDot {
//           0%, 100% { box-shadow: 0 0 0 3px rgba(52,211,153,0.25); }
//           50% { box-shadow: 0 0 0 7px rgba(52,211,153,0.06); }
//         }
//         @keyframes fadeUp {
//           from { opacity: 0; transform: translateY(22px); }
//           to { opacity: 1; transform: translateY(0); }
//         }
//         @keyframes scaleIn {
//           from { opacity: 0; transform: scale(0.94); }
//           to { opacity: 1; transform: scale(1); }
//         }
//         @keyframes slideRight {
//           from { width: 0; }
//           to { width: 100%; }
//         }

//         .about-page .stat-card {
//           animation: fadeUp 0.5s ease both;
//         }
//         .about-page .stat-card:nth-child(1) { animation-delay: 0ms; }
//         .about-page .stat-card:nth-child(2) { animation-delay: 80ms; }
//         .about-page .stat-card:nth-child(3) { animation-delay: 160ms; }
//         .about-page .stat-card:nth-child(4) { animation-delay: 240ms; }

//         .about-page .val-card {
//           transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.2s;
//         }
//         .about-page .val-card:hover {
//           transform: translateY(-5px);
//           box-shadow: 0 16px 40px rgba(13,155,108,0.1);
//           border-color: #A7F3D0 !important;
//         }

//         .about-page .team-card {
//           transition: transform 0.22s ease, box-shadow 0.22s ease;
//         }
//         .about-page .team-card:hover {
//           transform: translateY(-5px);
//           box-shadow: 0 20px 48px rgba(0,0,0,0.09);
//         }

//         .about-page .review-card {
//           transition: transform 0.2s ease, box-shadow 0.2s;
//         }
//         .about-page .review-card:hover {
//           transform: translateY(-4px);
//           box-shadow: 0 16px 40px rgba(0,0,0,0.08);
//         }

//         .about-page .city-pill {
//           transition: all 0.18s ease;
//           cursor: default;
//         }
//         .about-page .city-pill:hover {
//           background: #0D9B6C !important;
//           color: #fff !important;
//           border-color: #0D9B6C !important;
//           transform: translateY(-2px);
//         }

//         .about-page .cta-btn {
//           transition: transform 0.18s ease, box-shadow 0.18s ease;
//         }
//         .about-page .cta-btn:hover {
//           transform: translateY(-2px);
//           box-shadow: 0 8px 24px rgba(13,155,108,0.38);
//         }
//         .about-page .cta-btn:active { transform: scale(0.97); }
//       `}</style>

//       <div className="about-page" style={{ minHeight: '100vh', background: '#F7FAF8' }}>

//         {/* ══ HERO ═══════════════════════════════════════════════════════════ */}
//         <div style={{
//           background: 'linear-gradient(150deg, #011F14 0%, #033D26 45%, #0A5535 100%)',
//           padding: 'clamp(60px,9vw,100px) 24px clamp(80px,11vw,120px)',
//           position: 'relative', overflow: 'hidden',
//         }}>
//           {/* bg circles */}
//           {[
//             { s: 420, t: -120, r: -100, op: 0.07 },
//             { s: 180, b: -60, l: -50, op: 0.05 },
//             { s: 110, t: 60, l: '38%', op: 0.04 },
//           ].map((c: { s: number; t?: number; r?: number; b?: number; l?: number | string; op: number }, i) => (
//             <div key={i} style={{
//               position: 'absolute', width: c.s, height: c.s,
//               top: c.t, right: c.r, bottom: c.b, left: c.l as string | number | undefined,
//               borderRadius: '50%', background: '#34D399', opacity: c.op, pointerEvents: 'none',
//             }} />
//           ))}
//           {/* dot grid */}
//           <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

//           {/* floating drops */}
//           <div style={{ position: 'absolute', top: 40, right: '8%', animation: 'floatA 5s ease-in-out infinite', pointerEvents: 'none' }}>
//             <svg width="100" height="120" viewBox="0 0 100 120" fill="none" opacity="0.13">
//               <path d="M50 4C50 4 8 48 8 78C8 103 27 118 50 118C73 118 92 103 92 78C92 48 50 4 50 4Z" fill="#34D399" />
//             </svg>
//           </div>
//           <div style={{ position: 'absolute', bottom: 30, right: '20%', animation: 'floatB 6.5s ease-in-out infinite', pointerEvents: 'none' }}>
//             <svg width="50" height="60" viewBox="0 0 50 60" fill="none" opacity="0.09">
//               <path d="M25 2C25 2 4 24 4 39C4 51.5 13.5 59 25 59C36.5 59 46 51.5 46 39C46 24 25 2 25 2Z" fill="#6EE7B7" />
//             </svg>
//           </div>

//           <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
//             {/* live badge */}
//             <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.28)', borderRadius: 999, padding: '5px 14px', marginBottom: 24 }}>
//               <span className="pulseDot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', display: 'inline-block', animation: 'pulseDot 2s infinite' }} />
//               <span style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.1em' }}>SERVING 35 CITIES ACROSS UTTAR PRADESH</span>
//             </div>

//             <h1 className="clash" style={{
//               margin: 0, fontSize: 'clamp(2rem,7vw,4.6rem)',
//               fontWeight: 700, color: '#fff', letterSpacing: '-1.5px',
//               lineHeight: 1.05, maxWidth: 780,
//             }}>
//               Making water services
//               <br />
//               <span style={{ color: '#34D399' }}>simple, fair & reliable.</span>
//             </h1>

//             <p style={{ margin: '22px 0 0', fontSize: 16, color: 'rgba(255,255,255,0.55)', maxWidth: 520, lineHeight: 1.75 }}>
//               We built AuroWater because booking essential water services shouldn't require endless calls, waiting, or guessing the price. Clean water is a right, not a privilege.
//             </p>

//             <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
//               <Link href="/book" style={{
//                 display: 'inline-flex', alignItems: 'center', gap: 8,
//                 background: '#0D9B6C', color: '#fff', fontWeight: 700, fontSize: 14,
//                 padding: '13px 24px', borderRadius: 12, textDecoration: 'none',
//                 boxShadow: '0 4px 18px rgba(13,155,108,0.45)', transition: 'all 0.2s',
//               }}
//                 onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; }}
//                 onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
//               >
//                 Book a Service <ArrowRightIcon />
//               </Link>
//               <Link href="/contact" style={{
//                 display: 'inline-flex', alignItems: 'center', gap: 8,
//                 background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 700, fontSize: 14,
//                 padding: '13px 24px', borderRadius: 12, textDecoration: 'none',
//                 border: '1.5px solid rgba(255,255,255,0.18)', transition: 'all 0.2s',
//               }}
//                 onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.15)'; }}
//                 onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.08)'; }}
//               >
//                 Contact Us
//               </Link>
//             </div>
//           </div>
//         </div>

//         {/* ══ STATS ══════════════════════════════════════════════════════════ */}
//         <div style={{ maxWidth: 1200, margin: '-36px auto 0', padding: '0 24px', position: 'relative', zIndex: 10 }}>
//           <div style={{ background: '#fff', borderRadius: 20, border: '1.5px solid #E5E7EB', boxShadow: '0 8px 36px rgba(0,0,0,0.09)', padding: '28px 24px' }}>
//             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1 }}>
//               {stats.map((s, i) => {
//                 const counter = counts[i];
//                 return (
//                   <div
//                     key={s.label}
//                     className="stat-card"
//                     style={{
//                       textAlign: 'center', padding: '20px 16px',
//                       borderRight: i < stats.length - 1 ? '1px solid #F3F4F6' : 'none',
//                     }}
//                   >
//                     <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
//                     <div ref={counter.ref} className="clash" style={{ fontSize: 36, fontWeight: 700, color: '#0D9B6C', letterSpacing: '-1px', lineHeight: 1 }}>
//                       {s.format(counter.value)}{s.suffix}
//                     </div>
//                     <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginTop: 6, letterSpacing: '0.03em' }}>{s.label}</div>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         </div>

//         {/* ══ MISSION + STORY ════════════════════════════════════════════════ */}
//         <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px' }}>
//           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
//             {/* Mission */}
//             <div style={{ background: '#fff', borderRadius: 22, border: '1.5px solid #E5E7EB', padding: '36px 36px', position: 'relative', overflow: 'hidden' }}>
//               <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: '#ECFDF5', pointerEvents: 'none' }} />
//               <div style={{ position: 'relative', zIndex: 1 }}>
//                 <SectionPill>OUR MISSION</SectionPill>
//                 <h2 className="clash" style={{ margin: '0 0 14px', fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.8px', lineHeight: 1.2 }}>
//                   Clean water access,<br />for every household.
//                 </h2>
//                 <p style={{ margin: 0, fontSize: 14, color: '#6B7280', lineHeight: 1.8 }}>
//                   To make water supply and water-system services easy to book, fair to pay, and dependable to receive — with clear pricing and verified technicians.
//                 </p>
//                 <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
//                   {['Transparent pricing before you confirm', 'Verified professionals on every job', 'Zero hidden charges or surprise fees'].map((f) => (
//                     <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#374151', fontWeight: 500 }}>
//                       <CheckCircle /> {f}
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             </div>

//             {/* Story / Timeline */}
//             <div style={{ background: '#0F172A', borderRadius: 22, padding: '36px 36px', position: 'relative', overflow: 'hidden' }}>
//               <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: '#0D9B6C', opacity: 0.08, pointerEvents: 'none' }} />
//               <SectionPill>OUR JOURNEY</SectionPill>
//               <h2 className="clash" style={{ margin: '0 0 24px', fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1.2 }}>
//                 Built for<br />local reliability.
//               </h2>
//               <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
//                 {milestones.map((m, i) => (
//                   <div key={m.year} style={{ display: 'flex', gap: 16, position: 'relative', paddingBottom: i < milestones.length - 1 ? 24 : 0 }}>
//                     {/* line */}
//                     {i < milestones.length - 1 && (
//                       <div style={{ position: 'absolute', left: 19, top: 28, bottom: 0, width: 1, background: 'rgba(255,255,255,0.1)' }} />
//                     )}
//                     <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
//                       <div style={{ width: 38, height: 38, borderRadius: '50%', background: i === milestones.length - 1 ? '#0D9B6C' : 'rgba(255,255,255,0.07)', border: `1.5px solid ${i === milestones.length - 1 ? '#0D9B6C' : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
//                         <span style={{ fontSize: 10, fontWeight: 800, color: i === milestones.length - 1 ? '#fff' : 'rgba(255,255,255,0.5)', letterSpacing: '0.02em' }}>{m.year}</span>
//                       </div>
//                     </div>
//                     <div style={{ paddingTop: 9 }}>
//                       <p style={{ margin: 0, fontSize: 13, color: i === milestones.length - 1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)', fontWeight: i === milestones.length - 1 ? 600 : 400, lineHeight: 1.6 }}>
//                         {m.event}
//                       </p>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* ══ VALUES ══════════════════════════════════════════════════════════ */}
//         <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px' }}>
//           <div style={{ marginBottom: 28 }}>
//             <SectionPill>OUR VALUES</SectionPill>
//             <h2 className="clash" style={{ margin: 0, fontSize: 'clamp(1.5rem,4vw,2.4rem)', fontWeight: 700, color: '#0F172A', letterSpacing: '-1px' }}>
//               What drives us every day
//             </h2>
//           </div>
//           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
//             {values.map((v, i) => (
//               <div
//                 key={v.title}
//                 className="val-card"
//                 style={{
//                   background: '#fff', borderRadius: 18, border: '1.5px solid #F3F4F6',
//                   padding: '24px 24px', animation: 'fadeUp 0.4s ease both',
//                   animationDelay: `${i * 60}ms`,
//                 }}
//               >
//                 <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F0FDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 14 }}>
//                   {v.icon}
//                 </div>
//                 <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 7, letterSpacing: '-0.2px' }}>{v.title}</div>
//                 <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{v.desc}</div>
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* ══ CUSTOMER REVIEWS ════════════════════════════════════════════════ */}
//         <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px' }}>
//           <div style={{ marginBottom: 28 }}>
//             <SectionPill>CUSTOMER TRUST</SectionPill>
//             <h2 className="clash" style={{ margin: '0 0 6px', fontSize: 'clamp(1.5rem,4vw,2.4rem)', fontWeight: 700, color: '#0F172A', letterSpacing: '-1px' }}>
//               Customer reviews
//             </h2>
//             <p style={{ margin: 0, fontSize: 14, color: '#9CA3AF', fontWeight: 500 }}>
//               Only verified customer reviews should be published here. Reviews will appear after they are connected to completed orders.
//             </p>
//           </div>

//           <SectionWrapper>
//             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
//               {TRUST_REVIEWS.length === 0 ? (
//                 <p style={{ gridColumn: '1 / -1', margin: 0, padding: 24, borderRadius: 16, background: '#F8FAFC', color: '#64748B', fontSize: 14, lineHeight: 1.7 }}>
//                   Verified customer feedback will be shown here when linked to completed orders. AuroWater does not publish unverified testimonials.
//                 </p>
//               ) : TRUST_REVIEWS.map((r) => (
//                 <div
//                   key={`${r.name}-${r.date}`}
//                   className="review-card"
//                   style={{ background: '#fff', borderRadius: 20, border: '1.5px solid #F3F4F6', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}
//                 >
//                   {/* Header */}
//                   <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
//                     <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
//                       {(() => {
//                         const [from, to] = avatarGradient(r.name);
//                         return (
//                           <div style={{
//                             width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
//                             background: `linear-gradient(135deg, ${from}, ${to})`,
//                             display: 'flex', alignItems: 'center', justifyContent: 'center',
//                             color: '#fff', fontWeight: 800, fontSize: 16,
//                             boxShadow: `0 4px 12px ${from}44`,
//                           }}>
//                             {r.initials}
//                           </div>
//                         );
//                       })()}
//                       <div>
//                         <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', letterSpacing: '-0.2px' }}>{r.name}</div>
//                         <div style={{ marginTop: 3 }}>
//                           <span style={{ fontSize: 11, fontWeight: 700, color: '#0D9B6C', background: '#ECFDF5', padding: '2px 8px', borderRadius: 999, border: '1px solid #A7F3D0' }}>
//                             {r.city}
//                           </span>
//                         </div>
//                       </div>
//                     </div>
//                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
//                       <div style={{ display: 'flex', gap: 1 }}>
//                         {Array.from({ length: 5 }).map((_, i) => (
//                           <StarIcon key={i} filled={i < r.rating} />
//                         ))}
//                       </div>
//                       <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{r.date}</span>
//                     </div>
//                   </div>

//                   {/* Service tag */}
//                   <span style={{ display: 'inline-flex', alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, color: '#374151', background: '#F9FAFB', padding: '4px 10px', borderRadius: 999, border: '1.5px solid #E5E7EB' }}>
//                     {r.service}
//                   </span>

//                   {/* Review text */}
//                   <p style={{ margin: 0, fontSize: 13, color: '#4B5563', lineHeight: 1.75, fontStyle: 'italic', borderLeft: '3px solid #A7F3D0', paddingLeft: 12 }}>
//                     "{r.text}"
//                   </p>
//                 </div>
//               ))}
//             </div>
//           </SectionWrapper>
//         </div>

//         {/* ══ TEAM ═══════════════════════════════════════════════════════════ */}
//         <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px' }}>
//           <div style={{ marginBottom: 28 }}>
//             <SectionPill>THE TEAM</SectionPill>
//             <h2 className="clash" style={{ margin: 0, fontSize: 'clamp(1.5rem,4vw,2.4rem)', fontWeight: 700, color: '#0F172A', letterSpacing: '-1px' }}>
//               People behind AuroWater
//             </h2>
//           </div>
//           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
//             {team.map((m) => {
//               const [from, to] = avatarGradient(m.name);
//               return (
//                 <div
//                   key={m.name}
//                   className="team-card"
//                   style={{ background: '#fff', borderRadius: 22, border: '1.5px solid #F3F4F6', padding: '32px 28px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
//                 >
//                   <div style={{
//                     width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
//                     background: `linear-gradient(135deg, ${from}, ${to})`,
//                     display: 'flex', alignItems: 'center', justifyContent: 'center',
//                     color: '#fff', fontWeight: 800, fontSize: 24,
//                     boxShadow: `0 8px 24px ${from}50`,
//                   }}>
//                     {m.initials}
//                   </div>
//                   <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A', letterSpacing: '-0.3px' }}>{m.name}</div>
//                   <div style={{ fontSize: 12, color: '#0D9B6C', fontWeight: 700, marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{m.role}</div>
//                   <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{m.bio}</p>
//                 </div>
//               );
//             })}
//           </div>
//         </div>

//         {/* ══ COVERAGE ════════════════════════════════════════════════════════ */}
//         <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px' }}>
//           <div style={{ background: '#fff', borderRadius: 22, border: '1.5px solid #E5E7EB', padding: 'clamp(28px,4vw,44px)', position: 'relative', overflow: 'hidden' }}>
//             <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: '#ECFDF5', pointerEvents: 'none' }} />
//             <div style={{ position: 'relative', zIndex: 1 }}>
//               <SectionPill>SERVICE COVERAGE</SectionPill>
//               <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
//                 <h2 className="clash" style={{ margin: 0, fontSize: 'clamp(1.4rem,3.5vw,2rem)', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.8px' }}>
//                   Serving eligible areas in Kanpur, Lucknow & Gorakhpur
//                 </h2>
//                 <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>Other areas can join the waitlist</span>
//               </div>
//               <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
//                 {cities.map((c) => (
//                   <span
//                     key={c}
//                     className="city-pill"
//                     style={{
//                       padding: '8px 16px', borderRadius: 999,
//                       border: '1.5px solid #E5E7EB', background: '#F9FAFB',
//                       color: '#374151', fontSize: 13, fontWeight: 600,
//                       display: 'inline-flex', alignItems: 'center', gap: 6,
//                     }}
//                   >
//                     <DropIcon size={12} color="#0D9B6C" />
//                     {c}
//                   </span>
//                 ))}
//                 <span style={{ padding: '8px 16px', borderRadius: 999, border: '1.5px dashed #E5E7EB', background: '#F9FAFB', color: '#64748B', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
//                   Other areas: waitlist
//                 </span>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* ══ PARTNER CTA ═════════════════════════════════════════════════════ */}
//         <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px 80px' }}>
//           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
//             {/* Technician */}
//             <div style={{
//               background: 'linear-gradient(135deg, #022C22 0%, #065F46 100%)',
//               borderRadius: 22, padding: 'clamp(28px,4vw,40px)', position: 'relative', overflow: 'hidden',
//             }}>
//               <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: '#34D399', opacity: 0.1, pointerEvents: 'none' }} />
//               <div style={{ position: 'relative', zIndex: 1 }}>
//                 <div style={{ fontSize: 36, marginBottom: 12 }}>👷</div>
//                 <div className="clash" style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: 8 }}>Are you a Technician?</div>
//                 <p style={{ margin: '0 0 22px', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
//                   Join our verified network. Accept job requests in your city, build your rating, and grow your income.
//                 </p>
//                 <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
//                   {['Earn ₹30,000+ / month', 'Flexible working hours', 'ID verified badge'].map((f) => (
//                     <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
//                       <CheckCircle color="#34D399" /> {f}
//                     </div>
//                   ))}
//                 </div>
//                 <Link href="/contact" className="cta-btn" style={{
//                   display: 'inline-flex', alignItems: 'center', gap: 8,
//                   background: '#fff', color: '#065F46', fontWeight: 800, fontSize: 14,
//                   padding: '12px 24px', borderRadius: 12, textDecoration: 'none',
//                   boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
//                 }}>
//                   Apply Now <ArrowRightIcon color="#065F46" />
//                 </Link>
//               </div>
//             </div>

//             {/* Supplier */}
//             <div style={{
//               background: '#fff', borderRadius: 22, border: '1.5px solid #E5E7EB',
//               padding: 'clamp(28px,4vw,40px)', position: 'relative', overflow: 'hidden',
//               boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
//             }}>
//               <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: '#ECFDF5', pointerEvents: 'none' }} />
//               <div style={{ position: 'relative', zIndex: 1 }}>
//                 <div style={{ fontSize: 36, marginBottom: 12 }}>🚛</div>
//                 <div className="clash" style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 8 }}>Are you a Supplier?</div>
//                 <p style={{ margin: '0 0 22px', fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>
//                   Get your AuroTap ID, receive digital orders, manage deliveries, and grow your tanker or can supply business.
//                 </p>
//                 <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
//                   {['Digital order management', 'Route-optimised delivery', 'Monthly GST invoicing'].map((f) => (
//                     <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', fontWeight: 500 }}>
//                       <CheckCircle /> {f}
//                     </div>
//                   ))}
//                 </div>
//                 <Link href="/contact" className="cta-btn" style={{
//                   display: 'inline-flex', alignItems: 'center', gap: 8,
//                   background: '#0D9B6C', color: '#fff', fontWeight: 800, fontSize: 14,
//                   padding: '12px 24px', borderRadius: 12, textDecoration: 'none',
//                   boxShadow: '0 4px 16px rgba(13,155,108,0.35)',
//                 }}>
//                   Partner with Us <ArrowRightIcon />
//                 </Link>
//               </div>
//             </div>
//           </div>

//           {/* Bottom CTA Banner */}
//           <div style={{
//             marginTop: 20,
//             background: 'linear-gradient(135deg, #022C22 0%, #065F46 55%, #0D9B6C 100%)',
//             borderRadius: 22, padding: 'clamp(36px,5vw,52px) clamp(28px,5vw,52px)',
//             display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24,
//             position: 'relative', overflow: 'hidden',
//           }}>
//             <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
//             <div style={{ position: 'absolute', top: -70, right: -70, width: 260, height: 260, borderRadius: '50%', background: '#34D399', opacity: 0.09, pointerEvents: 'none' }} />
//             <div style={{ position: 'relative', zIndex: 1 }}>
//               <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 999, padding: '4px 12px', marginBottom: 12 }}>
//                 <span style={{ fontSize: 10, fontWeight: 800, color: '#6EE7B7', letterSpacing: '0.1em' }}>CLEAN WATER FOR ALL</span>
//               </div>
//               <div className="clash" style={{ fontSize: 'clamp(1.3rem,3.5vw,2rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
//                 Ready to experience<br />water services done right?
//               </div>
//             </div>
//             <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
//               <Link href="/book" style={{
//                 display: 'inline-flex', alignItems: 'center', gap: 8,
//                 background: '#fff', color: '#065F46', fontWeight: 800, fontSize: 14,
//                 padding: '13px 28px', borderRadius: 12, textDecoration: 'none',
//                 boxShadow: '0 4px 18px rgba(0,0,0,0.2)', transition: 'all 0.2s',
//               }}
//                 onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; }}
//                 onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
//               >
//                 Book Now <ArrowRightIcon color="#065F46" />
//               </Link>
//               <Link href="/pricing" style={{
//                 display: 'inline-flex', alignItems: 'center', gap: 8,
//                 background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, fontSize: 14,
//                 padding: '13px 24px', borderRadius: 12, textDecoration: 'none',
//                 border: '1.5px solid rgba(255,255,255,0.2)', transition: 'all 0.2s',
//               }}
//                 onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.18)'; }}
//                 onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.1)'; }}
//               >
//                 View Pricing
//               </Link>
//             </div>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }

