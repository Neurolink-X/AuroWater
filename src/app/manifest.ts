import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/?source=pwa',
    name: 'AuroTap – Fresh Water Delivery in UP',
    short_name: 'AuroTap',
    description:
      'Order 20L water cans and request plumbing, RO purifier repair, pump service and water tank cleaning in eligible areas of Kanpur, Lucknow and Gorakhpur.',
    lang: 'en-IN',
    dir: 'ltr',

    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait-primary',

    // यहाँ बैकग्राउंड को एक फ्रेश और ब्राइट ब्लू टोन दिया गया है
    background_color: '#0284C7',
    theme_color: '#0284C7',

    categories: ['shopping', 'lifestyle', 'utilities', 'business'],
    prefer_related_applications: false,

    shortcuts: [
      {
        name: 'Book Water Delivery',
        short_name: 'Book',
        description: 'Order fresh water now',
        url: '/book?source=shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],

    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```[cite: 3]

---

### 2. अपडेटेड `loading.tsx` (ब्राइट और फ्रेश लुक)
```typescript
import Image from 'next/image';

export default function Loading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Opening AuroTap"
      className="flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-sky-600 px-6 text-white"
    >
      <div className="aw-launch-mark relative grid h-40 w-40 place-items-center rounded-full bg-white/10 shadow-lg backdrop-blur-sm">
        <Image
          src="/aurotap-mark.svg"
          alt="AuroTap"
          width={112}
          height={112}
          priority
          unoptimized
          className="relative z-10 h-28 w-28 object-contain"
        />
      </div>
      <p className="mt-5 text-2xl font-extrabold tracking-tight">AuroTap</p>
      <p className="mt-1 text-sm font-medium text-sky-100">Fresh water delivery & home services</p>
    </main>
  );
}
```[cite: 3]

### इस नए बदलाव से क्या फायदा होगा?
* **सकारात्मक प्रभाव:** यह चमकीला स्काई ब्लू (`sky-600` / `#0284C7`) रंग शुद्ध पानी, ताजगी और भरोसे का प्रतीक है, जो ग्राहकों को ऊर्जावान और मोटिवेटेड महसूस कराएगा।
* **परफेक्ट मैच:** इसमें भी सिस्टम का नेटिव बैकग्राउंड और आपकी लोडिंग स्क्रीन का रंग बिल्कुल एक जैसा रहेगा, जिससे डबल स्प्लैश की समस्या भी नहीं आएगी और लुक भी शानदार मिलेगा[cite: 3]।
