'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Lang = 'en' | 'hi';

const KEY = 'aurotap-lang';
const EVENT = 'aurotap-language-change';

const dict = {
  en: {
    account: 'Account', home: 'Home', dashboard: 'Dashboard', orders: 'Orders',
    myAccount: 'My account', memberSince: 'Member since', cityNotSet: 'City not set',
    editProfile: 'Edit profile', myOrders: 'My orders', strength: 'Profile strength',
    allSet: 'All set for faster booking', add: 'Add your',
    activity: 'Your activity', ordersStat: 'Orders', cans: 'Cans', spent: 'Total spent', rating: 'Your rating',
    profile: 'Profile details', fullName: 'Full name', city: 'City', selectCity: 'Select your city',
    mobile: 'Mobile number', mobileHint: 'Used for delivery coordination.',
    notifications: 'Order notifications', notificationsHint: 'Updates about your bookings and orders.',
    language: 'Language', languageHint: 'Choose how AuroTap is displayed.',
    shortcuts: 'Shortcuts', addresses: 'My addresses', history: 'Order history',
    subscriptions: 'My subscriptions', subscriptionsHint: 'Pause, resume or cancel deliveries',
    support: 'Support', getSupport: 'Get support', whatsapp: 'Chat on WhatsApp', call: 'Call support',
    terms: 'Terms & Privacy', deleteAcc: 'Request account deletion',
    unsaved: 'Unsaved changes', discard: 'Discard', save: 'Save changes', saving: 'Saving…', saved: 'Profile saved',
    saveFail: 'Could not save changes', signOut: 'Sign out', cancel: 'Cancel',
    signOutQ: 'Sign out of AuroTap?', signOutBody: 'You can sign in again whenever you need your orders and account details.',
    retry: 'Try again', loadFail: "We couldn't load your account", partial: 'Some activity data is unavailable right now. Showing what we have.',
    offline: 'You are offline. Changes will work again when you reconnect.',
    copy: 'Copy', copied: 'Copied', show: 'Show', hide: 'Hide', refresh: 'Refresh',
    loading: 'Loading your account…', customerOnly: 'Customer account required',
    nameShort: 'Enter at least 2 characters.', phoneBad: 'Enter a valid 10-digit Indian mobile number.',
    phoneNeed: 'Enter your mobile number to finish account setup.',
  },
  hi: {
    account: 'खाता', home: 'होम', dashboard: 'डैशबोर्ड', orders: 'ऑर्डर',
    myAccount: 'मेरा खाता', memberSince: 'सदस्य बने', cityNotSet: 'शहर चुना नहीं गया',
    editProfile: 'प्रोफ़ाइल बदलें', myOrders: 'मेरे ऑर्डर', strength: 'प्रोफ़ाइल की मज़बूती',
    allSet: 'तेज़ बुकिंग के लिए तैयार', add: 'जोड़ें:',
    activity: 'आपकी गतिविधि', ordersStat: 'ऑर्डर', cans: 'कैन', spent: 'कुल खर्च', rating: 'आपकी रेटिंग',
    profile: 'प्रोफ़ाइल विवरण', fullName: 'पूरा नाम', city: 'शहर', selectCity: 'अपना शहर चुनें',
    mobile: 'मोबाइल नंबर', mobileHint: 'डिलीवरी के लिए संपर्क में काम आता है।',
    notifications: 'ऑर्डर सूचनाएँ', notificationsHint: 'बुकिंग और ऑर्डर की जानकारी पाएँ।',
    language: 'भाषा', languageHint: 'AuroTap किस भाषा में दिखे, चुनें।',
    shortcuts: 'शॉर्टकट', addresses: 'मेरे पते', history: 'ऑर्डर इतिहास',
    subscriptions: 'मेरी सदस्यताएँ', subscriptionsHint: 'डिलीवरी रोकें, फिर शुरू करें या रद्द करें',
    support: 'सहायता', getSupport: 'सहायता पाएँ', whatsapp: 'WhatsApp पर चैट करें', call: 'सहायता को कॉल करें',
    terms: 'नियम और गोपनीयता', deleteAcc: 'खाता हटाने का अनुरोध',
    unsaved: 'बदलाव सहेजे नहीं गए', discard: 'छोड़ें', save: 'बदलाव सहेजें', saving: 'सहेज रहे हैं…', saved: 'प्रोफ़ाइल सहेजी गई',
    saveFail: 'बदलाव सहेज नहीं सके', signOut: 'साइन आउट', cancel: 'रद्द करें',
    signOutQ: 'AuroTap से साइन आउट करें?', signOutBody: 'ऑर्डर और खाते की जानकारी के लिए आप कभी भी दोबारा साइन इन कर सकते हैं।',
    retry: 'फिर कोशिश करें', loadFail: 'आपका खाता लोड नहीं हो सका', partial: 'कुछ गतिविधि डेटा अभी उपलब्ध नहीं है।',
    offline: 'आप ऑफ़लाइन हैं। इंटरनेट लौटने पर बदलाव काम करेंगे।',
    copy: 'कॉपी', copied: 'कॉपी हुआ', show: 'दिखाएँ', hide: 'छिपाएँ', refresh: 'रीफ़्रेश',
    loading: 'आपका खाता लोड हो रहा है…', customerOnly: 'ग्राहक खाता आवश्यक है',
    nameShort: 'कम से कम 2 अक्षर लिखें।', phoneBad: 'सही 10 अंकों का भारतीय मोबाइल नंबर लिखें।',
    phoneNeed: 'खाता पूरा करने के लिए मोबाइल नंबर लिखें।',
  },
} as const;

export type TKey = keyof (typeof dict)['en'];

function read(): Lang {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'en' || v === 'hi') return v;
  } catch { /* storage blocked: fall through */ }
  return 'en';
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function setLang(next: Lang) {
  try { window.localStorage.setItem(KEY, next); } catch { /* ignore */ }
  try { document.cookie = `${KEY}=${next}; path=/; max-age=31536000; samesite=lax`; } catch { /* ignore */ }
  document.documentElement.lang = next;
  window.dispatchEvent(new Event(EVENT));
}

/** Use in any component: const { t, lang, setLang } = useLang(); */
export function useLang() {
  const lang = useSyncExternalStore(subscribe, read, () => 'en' as Lang);
  const t = useCallback((k: TKey): string => dict[lang][k] ?? dict.en[k] ?? k, [lang]);
  return { lang, t, setLang };
}
