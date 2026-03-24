export type Language = 'en' | 'hi';

type TranslationMap = Record<string, string>;

export const translations: Record<Language, TranslationMap> = {
  en: {
    // Navigation
    nav_home: 'Home',
    nav_services: 'Services',
    nav_how_it_works: 'How It Works',
    nav_pricing: 'Pricing',
    nav_technicians: 'Technicians',
    nav_about: 'About Us',
    nav_contact: 'Contact',
    nav_dashboard: 'Dashboard',
    nav_book_now: 'Book Now',
    nav_login: 'Login',
    nav_login_customer: 'Customer Login',
    nav_login_technician: 'Technician Login',
    nav_login_admin: 'Admin Login',

    // Auth – Login
    auth_login_title: 'Login',
    auth_login_subtitle_customer: 'Customer access to your dashboard and orders',
    auth_login_subtitle_technician: 'Technician access to your jobs and earnings',
    auth_login_identifier_label: 'Phone or Email',
    auth_login_identifier_placeholder: 'Enter phone or email',
    auth_login_password_label: 'Password',
    auth_login_password_placeholder: '••••••',
    auth_login_button: 'Login',
    auth_login_button_loading: 'Logging in...',
    auth_login_error_generic: 'Login failed. Please try again.',
    auth_login_error_admin_blocked: 'Admin accounts must sign in via the Admin login page.',
    auth_login_error_locked: 'Your account is locked for 15 minutes due to failed attempts.',
    auth_login_forgot_whatsapp: 'WhatsApp us',
    auth_login_new_here: 'New here?',
    auth_login_new_here_customer: 'Customer signup',
    auth_login_new_here_supplier: 'Become a supplier',
    auth_login_new_here_plumber: 'Join as plumber',

    // Auth – Register (customer)
    auth_register_title: 'Create customer account',
    auth_register_full_name: 'Full name',
    auth_register_phone: 'Phone number',
    auth_register_email: 'Email (optional)',
    auth_register_password: 'Password',
    auth_register_city: 'City',
    auth_register_submit: 'Create account',
    auth_register_have_account: 'Already have an account?',
    auth_register_login_link: 'Login',
    auth_register_supplier_cta: 'Want to supply water? Apply as supplier',
    auth_register_plumber_cta: 'Are you a plumber? Join as plumber',
    auth_error_phone_required: 'Phone is required',
    auth_error_phone_invalid: 'Invalid phone number',
    auth_error_password_required: 'Password is required',
    auth_error_password_too_short: 'Password must be at least 6 characters',

    // Generic
    generic_loading: 'Loading...',
  },
  hi: {
    // Navigation
    nav_home: 'होम',
    nav_services: 'सर्विसेज़',
    nav_how_it_works: 'कैसे काम करता है',
    nav_pricing: 'कीमतें',
    nav_technicians: 'टेक्नीशियन',
    nav_about: 'हमारे बारे में',
    nav_contact: 'कॉन्टैक्ट',
    nav_dashboard: 'डैशबोर्ड',
    nav_book_now: 'अभी बुक करें',
    nav_login: 'लॉगिन',
    nav_login_customer: 'कस्टमर लॉगिन',
    nav_login_technician: 'टेक्नीशियन लॉगिन',
    nav_login_admin: 'एडमिन लॉगिन',

    // Auth – Login
    auth_login_title: 'लॉगिन',
    auth_login_subtitle_customer: 'अपने ऑर्डर और डैशबोर्ड के लिए लॉगिन करें',
    auth_login_subtitle_technician: 'अपनी जॉब्स और कमाई के लिए लॉगिन करें',
    auth_login_identifier_label: 'फोन या ईमेल',
    auth_login_identifier_placeholder: 'फोन या ईमेल दर्ज करें',
    auth_login_password_label: 'पासवर्ड',
    auth_login_password_placeholder: '••••••',
    auth_login_button: 'लॉगिन',
    auth_login_button_loading: 'लॉगिन हो रहा है...',
    auth_login_error_generic: 'लॉगिन नहीं हो पाया। दोबारा कोशिश करें।',
    auth_login_error_admin_blocked: 'एडमिन अकाउंट के लिए अलग लॉगिन पेज का उपयोग करें।',
    auth_login_error_locked: 'लगातार गलत प्रयास के कारण आपका अकाउंट 15 मिनट के लिए लॉक है।',
    auth_login_forgot_whatsapp: 'WhatsApp करें',
    auth_login_new_here: 'नए हैं?',
    auth_login_new_here_customer: 'कस्टमर साइनअप',
    auth_login_new_here_supplier: 'सप्लायर बनें',
    auth_login_new_here_plumber: 'प्लम्बर के रूप में जुड़ें',

    // Auth – Register (customer)
    auth_register_title: 'कस्टमर अकाउंट बनाएं',
    auth_register_full_name: 'पूरा नाम',
    auth_register_phone: 'मोबाइल नंबर',
    auth_register_email: 'ईमेल (वैकल्पिक)',
    auth_register_password: 'पासवर्ड',
    auth_register_city: 'शहर',
    auth_register_submit: 'अकाउंट बनाएं',
    auth_register_have_account: 'पहले से अकाउंट है?',
    auth_register_login_link: 'लॉगिन करें',
    auth_register_supplier_cta: 'पानी सप्लाई करना चाहते हैं? सप्लायर बनें',
    auth_register_plumber_cta: 'क्या आप प्लम्बर हैं? यहाँ जुड़ें',
    auth_error_phone_required: 'मोबाइल नंबर ज़रूरी है',
    auth_error_phone_invalid: 'मोबाइल नंबर सही नहीं है',
    auth_error_password_required: 'पासवर्ड ज़रूरी है',
    auth_error_password_too_short: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए',

    // Generic
    generic_loading: 'लोड हो रहा है...',
  },
};

