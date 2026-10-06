'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import BottomNav from '@/components/customer/BottomNav';
import LanguageToggle from '@/components/LanguageToggle';
import {
  clearSession,
  getInitials,
  useAuth,
} from '@/hooks/useAuth';
import { getToken } from '@/lib/api-client';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type NotificationSettings = {
  whatsapp?: boolean;
  sms?: boolean;
  email?: boolean;
  push?: boolean;
};

type AccountSettings = {
  notifications?: NotificationSettings;
  language?: 'en' | 'hi';
  default_payment?: 'cash' | 'upi' | 'online';
  marketing_opt_in?: boolean;
  default_address_id?: string | null;

  /*
   * Legacy compatibility.
   * The backend does not use this key for new writes, but older records
   * may still contain it.
   */
  notifications_enabled?: boolean;

  [key: string]: unknown;
};

type ProfilePayload = {
  id: string;
  full_name: string | null;
  city: string | null;
  phone: string | null;
  created_at: string | null;
  settings?: AccountSettings | null;
};

type StatsPayload = {
  total_orders?: number;
  total_spent?: number;
  cans_ordered?: number;
  member_since?: string | null;
  avg_rating?: number | null;
  total_reviews?: number;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

type FormErrors = {
  full_name?: string;
  city?: string;
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const SUPPORT_PHONE = '+919889305803';

const WHATSAPP_URL = `https://wa.me/919889305803?text=${encodeURIComponent(
  'Hi AuroTap! I need help with my account.'
)}`;

const SERVICE_CITIES = [
  'Kanpur',
  'Gorakhpur',
  'Lucknow',
  'Varanasi',
  'Prayagraj',
  'Agra',
  'Meerut',
  'Bareilly',
  'Aligarh',
  'Mathura',
  'Delhi',
  'Noida',
  'Ghaziabad',
] as const;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatINR(value: number | string | null | undefined): string {
  const amount = Math.round(Number(value) || 0);

  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatMemberSince(
  iso: string | null | undefined
): string {
  if (!iso) return '—';

  const timestamp = new Date(iso).getTime();

  if (Number.isNaN(timestamp)) return '—';

  return new Date(timestamp).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

function maskPhone(value: string | null | undefined): string {
  if (!value) return '—';

  const digits = value.replace(/\D/g, '');

  if (digits.length < 6) return value;

  return `${digits.slice(0, 2)}••••${digits.slice(-4)}`;
}

function getNotificationPreference(
  settings: AccountSettings | null | undefined
): boolean {
  if (!settings) return true;

  if (typeof settings.notifications_enabled === 'boolean') {
    return settings.notifications_enabled;
  }

  const notifications = settings.notifications;

  if (!notifications) return true;

  const values = [
    notifications.whatsapp,
    notifications.sms,
    notifications.email,
    notifications.push,
  ].filter((value) => typeof value === 'boolean') as boolean[];

  if (!values.length) return true;

  return values.some(Boolean);
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

async function copyText(
  value: string,
  successMessage: string
): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    window.dispatchEvent(
      new CustomEvent('aurotap-copy-success', {
        detail: successMessage,
      })
    );
  } catch {
    window.dispatchEvent(
      new CustomEvent('aurotap-copy-failed')
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Small UI components                                                        */
/* -------------------------------------------------------------------------- */

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
        {eyebrow}
      </p>

      <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
        {title}
      </h2>

      {description ? (
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  loading,
}: {
  icon: string;
  value: string;
  label: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div
        className="h-[104px] animate-pulse rounded-2xl border border-slate-100 bg-white"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div
        className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-lg"
        aria-hidden="true"
      >
        {icon}
      </div>

      <p className="mt-2 truncate text-lg font-black text-slate-950 sm:text-xl">
        {value}
      </p>

      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  );
}

function MenuRow({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[70px] items-center gap-3 border-b border-slate-100 px-4 py-3.5 transition hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-lg"
        aria-hidden="true"
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-slate-900">
          {title}
        </span>

        <span className="mt-0.5 block text-xs font-medium text-slate-500">
          {description}
        </span>
      </span>

      <span
        className="text-lg font-bold text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-500"
        aria-hidden="true"
      >
        →
      </span>
    </Link>
  );
}

function ReadOnlyRow({
  icon,
  title,
  value,
  action,
}: {
  icon: string;
  title: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-lg"
        aria-hidden="true"
      >
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
          {title}
        </p>

        <p className="mt-1 truncate text-sm font-extrabold text-slate-900">
          {value}
        </p>
      </div>

      {action}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100',
        checked ? 'bg-emerald-600' : 'bg-slate-300',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      ].join(' ')}
      aria-label="Toggle order notifications"
    >
      <span
        className={[
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

function LoadingCard() {
  return (
    <div
      className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"
      aria-hidden="true"
    >
      <div className="h-6 w-32 animate-pulse rounded bg-slate-100" />
      <div className="mt-3 h-4 w-56 animate-pulse rounded bg-slate-100" />
      <div className="mt-6 h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
      <div className="mt-3 h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="rounded-3xl border border-rose-100 bg-rose-50 p-5"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 font-black text-rose-700"
          aria-hidden="true"
        >
          !
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-black text-rose-900">
            We couldn&apos;t load your account
          </p>

          <p className="mt-1 text-sm leading-6 text-rose-700">
            {message}
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

function SignOutModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-out-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-2xl">
          👋
        </div>

        <h2
          id="sign-out-title"
          className="mt-5 text-center text-xl font-black text-slate-950"
        >
          Sign out of AuroTap?
        </h2>

        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-slate-500">
          You can sign in again whenever you need your orders,
          addresses, and account details.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function CustomerAccountPage() {
  const router = useRouter();
  const pathname =
    usePathname() ?? '/customer/account';

  const {
    hydrated,
    isLoggedIn,
    isCustomer,
    session,
    updateSession,
    logout,
  } = useAuth();

  const [profile, setProfile] =
    useState<ProfilePayload | null>(null);

  const [stats, setStats] =
    useState<StatsPayload | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');

  const [notificationsEnabled, setNotificationsEnabled] =
    useState(true);

  const [formErrors, setFormErrors] =
    useState<FormErrors>({});

  const [signOutOpen, setSignOutOpen] =
    useState(false);

  const [copied, setCopied] = useState<
    'phone' | 'email' | null
  >(null);

  const ready =
    hydrated && isLoggedIn && isCustomer;

  /* ── SEO / account page should never compete with public SEO pages ── */
  useEffect(() => {
    document.title = 'My AuroTap Account';

    let robots = document.querySelector(
      'meta[name="robots"]'
    ) as HTMLMetaElement | null;

    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }

    robots.content = 'noindex,nofollow';
  }, []);

  /* ── Auth guard ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (!hydrated) return;

    if (!isLoggedIn) {
      router.replace(
        `/auth/login?returnTo=${encodeURIComponent(pathname)}`
      );
    }
  }, [
    hydrated,
    isLoggedIn,
    router,
    pathname,
  ]);

  /* ── Load account data in parallel ───────────────────────────────── */
  const load = useCallback(
    async (showRefreshState = false) => {
      if (!hydrated) return;

      if (!isLoggedIn || !isCustomer) {
        router.replace(
          `/auth/login?returnTo=${encodeURIComponent(pathname)}`
        );
        return;
      }

      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const token = await getToken();

        if (!token) {
          clearSession();

          router.replace(
            `/auth/login?returnTo=${encodeURIComponent(pathname)}`
          );

          return;
        }

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [profileResponse, statsResponse] =
          await Promise.all([
            fetch('/api/customer/profile', {
              credentials: 'include',
              headers,
              cache: 'no-store',
            }),
            fetch('/api/customer/stats', {
              credentials: 'include',
              headers,
              cache: 'no-store',
            }),
          ]);

        if (
          profileResponse.status === 401 ||
          statsResponse.status === 401
        ) {
          clearSession();

          router.replace(
            `/auth/login?returnTo=${encodeURIComponent(pathname)}`
          );

          return;
        }

        const profileJson =
          await readJson<ApiEnvelope<ProfilePayload>>(
            profileResponse
          );

        const statsJson =
          await readJson<ApiEnvelope<StatsPayload>>(
            statsResponse
          );

        if (
          !profileResponse.ok ||
          profileJson.success === false
        ) {
          throw new Error(
            profileJson.error ??
              'Could not load your profile.'
          );
        }

        if (
          !statsResponse.ok ||
          statsJson.success === false
        ) {
          throw new Error(
            statsJson.error ??
              'Could not load your account activity.'
          );
        }

        const nextProfile =
          profileJson.data ?? null;

        const nextStats =
          statsJson.data ?? null;

        setProfile(nextProfile);
        setStats(nextStats);

        const nextName =
          nextProfile?.full_name?.trim() ?? '';

        const nextCity =
          nextProfile?.city?.trim() ?? '';

        setFullName(nextName);
        setCity(nextCity);

        setNotificationsEnabled(
          getNotificationPreference(
            nextProfile?.settings
          )
        );
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'Could not load your account.';

        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      hydrated,
      isLoggedIn,
      isCustomer,
      pathname,
      router,
    ]
  );

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [ready, load]);

  /* ── Form state ──────────────────────────────────────────────────── */
  const originalName =
    profile?.full_name?.trim() ?? '';

  const originalCity =
    profile?.city?.trim() ?? '';

  const originalNotifications =
    getNotificationPreference(
      profile?.settings
    );

  const hasChanges =
    fullName.trim() !== originalName ||
    city.trim() !== originalCity ||
    notificationsEnabled !== originalNotifications;

  const initials = useMemo(
    () =>
      getInitials(
        profile?.full_name ??
          session?.name ??
          'AuroTap'
      ),
    [
      profile?.full_name,
      session?.name,
    ]
  );

  const email =
    session?.email?.trim() ?? '';

  const phone =
    profile?.phone?.trim() ??
    session?.phone?.trim() ??
    '';

  const memberSince =
    formatMemberSince(
      stats?.member_since ??
        profile?.created_at
    );

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};

    const name = fullName.trim();
    const selectedCity = city.trim();

    if (name.length < 2) {
      nextErrors.full_name =
        'Enter at least 2 characters.';
    } else if (name.length > 80) {
      nextErrors.full_name =
        'Name must be 80 characters or fewer.';
    }

    if (selectedCity.length < 2) {
      nextErrors.city =
        'Select your city.';
    }

    setFormErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  /* ── Save ────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!validateForm() || saving) {
      return;
    }

    setSaving(true);

    try {
      const token = await getToken();

      if (!token) {
        clearSession();

        router.replace(
          `/auth/login?returnTo=${encodeURIComponent(pathname)}`
        );

        return;
      }

      const existingSettings =
        profile?.settings ?? {};

      const existingNotifications =
        existingSettings.notifications ?? {};

      /*
       * IMPORTANT:
       * The backend profile API accepts the nested
       * `settings.notifications` structure.
       *
       * Do NOT send `notifications_enabled` as a new
       * backend field because it is not part of the API
       * whitelist.
       */
      const nextSettings: AccountSettings = {
        ...existingSettings,
        notifications: {
          ...existingNotifications,
          whatsapp: notificationsEnabled,
          sms: notificationsEnabled,
          email: notificationsEnabled,
          push: notificationsEnabled,
        },
      };

      const response = await fetch(
        '/api/customer/profile',
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            full_name: fullName.trim(),
            city: city.trim(),
            settings: nextSettings,
          }),
        }
      );

      if (response.status === 401) {
        clearSession();

        router.replace(
          `/auth/login?returnTo=${encodeURIComponent(pathname)}`
        );

        return;
      }

      const json =
        await readJson<ApiEnvelope<ProfilePayload>>(
          response
        );

      if (!response.ok || json.success === false) {
        throw new Error(
          json.error ??
            'Could not save your profile.'
        );
      }

      const savedProfile =
        json.data ??
        ({
          ...profile,
          full_name: fullName.trim(),
          city: city.trim(),
          settings: nextSettings,
        } as ProfilePayload);

      setProfile(savedProfile);

      updateSession({
        name:
          savedProfile.full_name ??
          session?.name ??
          '',
      });

      setFormErrors({});

      window.dispatchEvent(
        new CustomEvent('aurotap-profile-saved')
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : 'Could not save your profile.';

      setError(message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Clipboard feedback ──────────────────────────────────────────── */
  useEffect(() => {
    const onSuccess = (
      event: Event
    ) => {
      const customEvent =
        event as CustomEvent<string>;

      const message =
        customEvent.detail ?? 'Copied';

      setCopied(
        message.includes('email')
          ? 'email'
          : 'phone'
      );

      window.setTimeout(() => {
        setCopied(null);
      }, 1800);
    };

    const onFailed = () => {
      setCopied(null);
    };

    window.addEventListener(
      'aurotap-copy-success',
      onSuccess
    );

    window.addEventListener(
      'aurotap-copy-failed',
      onFailed
    );

    return () => {
      window.removeEventListener(
        'aurotap-copy-success',
        onSuccess
      );

      window.removeEventListener(
        'aurotap-copy-failed',
        onFailed
      );
    };
  }, []);

  const handleCopyPhone = async () => {
    if (!phone) return;

    try {
      await navigator.clipboard.writeText(
        phone
      );

      setCopied('phone');

      window.setTimeout(() => {
        setCopied(null);
      }, 1800);
    } catch {
      setCopied(null);
    }
  };

  const handleCopyEmail = async () => {
    if (!email) return;

    try {
      await navigator.clipboard.writeText(
        email
      );

      setCopied('email');

      window.setTimeout(() => {
        setCopied(null);
      }, 1800);
    } catch {
      setCopied(null);
    }
  };

  /* ── States ──────────────────────────────────────────────────────── */
  if (
    !hydrated ||
    (hydrated && !isLoggedIn)
  ) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-sky-50 px-4">
        <div className="text-center">
          <div
            className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600"
            aria-hidden="true"
          />

          <p className="mt-4 text-sm font-semibold text-slate-500">
            Loading your account…
          </p>
        </div>
      </main>
    );
  }

  if (!isCustomer) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div
            className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-xl font-black text-rose-600"
            aria-hidden="true"
          >
            !
          </div>

          <h1 className="mt-5 text-xl font-black text-slate-950">
            Customer account required
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            This account area is only available to
            customer accounts.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800"
          >
            Back to AuroTap
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <style>{`
        .aurotap-account {
          min-height: 100dvh;
          background:
            radial-gradient(circle at top right, rgba(14,165,233,0.10), transparent 28%),
            linear-gradient(180deg, #eff8ff 0%, #f8fbff 32%, #ffffff 100%);
        }

        .aurotap-account *,
        .aurotap-account *::before,
        .aurotap-account *::after {
          box-sizing: border-box;
        }

        @media (prefers-reduced-motion: reduce) {
          .aurotap-account *,
          .aurotap-account *::before,
          .aurotap-account *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <main className="aurotap-account pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                           */}
        {/* ---------------------------------------------------------------- */}
        <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 pb-5 pt-4 sm:px-6 sm:pt-6 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
                >
                  <span aria-hidden="true">←</span>
                  AuroTap Home
                </Link>

                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  My account
                </p>

                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  Account &amp; profile
                </h1>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Manage your personal details, preferences,
                  and account activity.
                </p>
              </div>

              <Link
                href="/customer/home"
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
              >
                Dashboard
              </Link>
            </div>

            {/* Profile hero */}
            <div className="mt-6 rounded-3xl bg-gradient-to-br from-[#092844] via-[#1155A6] to-[#0EA5E9] p-5 text-white shadow-lg shadow-sky-200/50 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[3px] border-white/40 bg-white/10 text-2xl font-black shadow-inner">
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
                    Customer profile
                  </p>

                  <h2 className="mt-1 truncate text-2xl font-black sm:text-3xl">
                    {loading
                      ? 'Loading…'
                      : profile?.full_name ||
                        session?.name ||
                        'Welcome'}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-white/70">
                    <span>
                      Member since {memberSince}
                    </span>

                    <span
                      className="h-1 w-1 rounded-full bg-white/35"
                      aria-hidden="true"
                    />

                    <span>
                      {profile?.city || 'City not set'}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/50">
                    Account
                  </p>

                  <p className="mt-1 text-sm font-black text-white">
                    Customer
                  </p>

                  <p className="mt-0.5 text-[11px] font-medium text-white/60">
                    AuroTap
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Body                                                             */}
        {/* ---------------------------------------------------------------- */}
        <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
          {error ? (
            <div className="mb-5">
              <ErrorCard
                message={error}
                onRetry={() => void load()}
              />
            </div>
          ) : null}

          {/* Activity */}
          <section>
            <SectionTitle
              eyebrow="Overview"
              title="Your activity"
              description="A quick view of your AuroTap usage."
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                icon="📦"
                value={String(
                  stats?.total_orders ?? 0
                )}
                label="Orders"
                loading={loading}
              />

              <StatCard
                icon="💧"
                value={String(
                  stats?.cans_ordered ?? 0
                )}
                label="Cans"
                loading={loading}
              />

              <StatCard
                icon="₹"
                value={formatINR(
                  stats?.total_spent ?? 0
                )}
                label="Total spent"
                loading={loading}
              />

              <StatCard
                icon="⭐"
                value={
                  stats?.avg_rating != null
                    ? String(stats.avg_rating)
                    : '—'
                }
                label="Your rating"
                loading={loading}
              />
            </div>
          </section>

          {/* Profile */}
          <section className="mt-6">
            <SectionTitle
              eyebrow="Personal information"
              title="Profile details"
              description="Keep your delivery information up to date."
            />

            {loading ? (
              <LoadingCard />
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                {/* Editable */}
                <div className="space-y-5 p-5 sm:p-6">
                  <div>
                    <label
                      htmlFor="customer-full-name"
                      className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                    >
                      Full name
                    </label>

                    <input
                      id="customer-full-name"
                      value={fullName}
                      onChange={(event) => {
                        setFullName(
                          event.target.value
                        );

                        if (formErrors.full_name) {
                          setFormErrors((current) => ({
                            ...current,
                            full_name: undefined,
                          }));
                        }

                        setError(null);
                      }}
                      autoComplete="name"
                      maxLength={80}
                      className={[
                        'mt-2 min-h-12 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition',
                        'focus:bg-white focus:ring-4',
                        formErrors.full_name
                          ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
                          : 'border-slate-200 focus:border-sky-400 focus:ring-sky-50',
                      ].join(' ')}
                      placeholder="Enter your full name"
                      aria-invalid={Boolean(
                        formErrors.full_name
                      )}
                    />

                    {formErrors.full_name ? (
                      <p className="mt-1.5 text-xs font-bold text-rose-600">
                        {formErrors.full_name}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="customer-city"
                      className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                    >
                      City
                    </label>

                    <select
                      id="customer-city"
                      value={city}
                      onChange={(event) => {
                        setCity(event.target.value);
                        setFormErrors((current) => ({
                          ...current,
                          city: undefined,
                        }));
                        setError(null);
                      }}
                      className={[
                        'mt-2 min-h-12 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition',
                        'focus:bg-white focus:ring-4',
                        formErrors.city
                          ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
                          : 'border-slate-200 focus:border-sky-400 focus:ring-sky-50',
                      ].join(' ')}
                      aria-invalid={Boolean(
                        formErrors.city
                      )}
                    >
                      <option value="">
                        Select your city
                      </option>

                      {SERVICE_CITIES.map(
                        (serviceCity) => (
                          <option
                            key={serviceCity}
                            value={serviceCity}
                          >
                            {serviceCity}
                          </option>
                        )
                      )}

                      {city &&
                      !SERVICE_CITIES.includes(
                        city as (typeof SERVICE_CITIES)[number]
                      ) ? (
                        <option value={city}>
                          {city}
                        </option>
                      ) : null}
                    </select>

                    {formErrors.city ? (
                      <p className="mt-1.5 text-xs font-bold text-rose-600">
                        {formErrors.city}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">
                          Order notifications
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Receive important updates about your
                          bookings and orders.
                        </p>
                      </div>

                      <Toggle
                        checked={
                          notificationsEnabled
                        }
                        disabled={saving}
                        onChange={(
                          value
                        ) => {
                          setNotificationsEnabled(
                            value
                          );
                          setError(null);
                        }}
                      />
                    </div>
                  </div>

                  {hasChanges ? (
                    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-emerald-900">
                          Unsaved changes
                        </p>

                        <p className="mt-1 text-xs text-emerald-700">
                          Save when everything looks right.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setFullName(
                            originalName
                          );

                          setCity(
                            originalCity
                          );

                          setNotificationsEnabled(
                            originalNotifications
                          );

                          setFormErrors({});
                          setError(null);
                        }}
                        disabled={saving}
                        className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
                      >
                        Discard
                      </button>
                    </div>
                  ) : null}

                  {hasChanges ? (
                    <button
                      type="button"
                      onClick={() =>
                        void handleSave()
                      }
                      disabled={saving}
                      className="flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? 'Saving changes…'
                        : 'Save changes'}
                    </button>
                  ) : null}
                </div>

                {/* Read-only identity */}
                <div className="border-t border-slate-100">
                  <ReadOnlyRow
                    icon="✉️"
                    title="Login email"
                    value={
                      email || 'Not available'
                    }
                    action={
                      email ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyEmail()
                          }
                          className="rounded-lg px-2.5 py-2 text-[11px] font-black text-sky-700 hover:bg-sky-50"
                        >
                          {copied === 'email'
                            ? 'Copied'
                            : 'Copy'}
                        </button>
                      ) : null
                    }
                  />

                  <ReadOnlyRow
                    icon="📱"
                    title="Mobile number"
                    value={
                      maskPhone(phone)
                    }
                    action={
                      phone ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyPhone()
                          }
                          className="rounded-lg px-2.5 py-2 text-[11px] font-black text-sky-700 hover:bg-sky-50"
                        >
                          {copied === 'phone'
                            ? 'Copied'
                            : 'Copy'}
                        </button>
                      ) : null
                    }
                  />
                </div>
              </div>
            )}
          </section>

          {/* Navigation */}
          <section className="mt-6">
            <SectionTitle
              eyebrow="Manage"
              title="Account shortcuts"
              description="Quick access to the things you use most."
            />

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <MenuRow
                href="/"
                icon="🏠"
                title="AuroTap home"
                description="Return to the public AuroTap homepage"
              />

              <MenuRow
                href="/customer/home"
                icon="📊"
                title="Customer dashboard"
                description="Orders, activity, tracking, and quick actions"
              />

              <MenuRow
                href="/customer/addresses"
                icon="📍"
                title="My addresses"
                description="Manage your saved delivery locations"
              />

              <MenuRow
                href="/customer/history"
                icon="📋"
                title="Order history"
                description="View your previous and current orders"
              />

              <MenuRow
                href="/pricing"
                icon="🏷️"
                title="Pricing"
                description="Review available service pricing"
              />
            </div>
          </section>

          {/* Language */}
          <section className="mt-6">
            <SectionTitle
              eyebrow="Preferences"
              title="Language"
              description="Choose how AuroTap is displayed."
            />

            <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-lg"
                  aria-hidden="true"
                >
                  🌐
                </span>

                <div>
                  <p className="text-sm font-black text-slate-900">
                    App language
                  </p>

                  <p className="mt-1 text-xs font-medium text-slate-500">
                    English or Hindi
                  </p>
                </div>
              </div>

              <LanguageToggle />
            </div>
          </section>

          {/* Support */}
          <section className="mt-6">
            <SectionTitle
              eyebrow="Need help?"
              title="AuroTap support"
              description="Reach us when you need assistance with your account or order."
            />

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="group flex min-h-[72px] items-center gap-3 border-b border-slate-100 px-4 py-3.5 hover:bg-slate-50"
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-lg"
                  aria-hidden="true"
                >
                  💬
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-slate-900">
                    WhatsApp support
                  </span>

                  <span className="mt-0.5 block text-xs font-medium text-slate-500">
                    Send us a message about your account
                  </span>
                </span>

                <span
                  className="text-lg text-slate-300 group-hover:text-emerald-500"
                  aria-hidden="true"
                >
                  →
                </span>
              </a>

              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="group flex min-h-[72px] items-center gap-3 border-b border-slate-100 px-4 py-3.5 hover:bg-slate-50"
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-lg"
                  aria-hidden="true"
                >
                  📞
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-slate-900">
                    Call support
                  </span>

                  <span className="mt-0.5 block text-xs font-medium text-slate-500">
                    {SUPPORT_PHONE}
                  </span>
                </span>

                <span
                  className="text-lg text-slate-300 group-hover:text-sky-500"
                  aria-hidden="true"
                >
                  →
                </span>
              </a>

              <Link
                href="/terms"
                className="group flex min-h-[72px] items-center gap-3 px-4 py-3.5 hover:bg-slate-50"
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-lg"
                  aria-hidden="true"
                >
                  📄
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-slate-900">
                    Terms &amp; Privacy
                  </span>

                  <span className="mt-0.5 block text-xs font-medium text-slate-500">
                    Review AuroTap policies
                  </span>
                </span>

                <span
                  className="text-lg text-slate-300 group-hover:text-violet-500"
                  aria-hidden="true"
                >
                  →
                </span>
              </Link>
            </div>
          </section>

          {/* Refresh */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() =>
                void load(true)
              }
              disabled={refreshing}
              className="inline-flex min-h-9 items-center rounded-xl px-3 text-xs font-bold text-slate-400 hover:bg-white hover:text-slate-600 disabled:opacity-60"
            >
              <span
                className={
                  refreshing
                    ? 'mr-1.5 animate-spin'
                    : 'mr-1.5'
                }
                aria-hidden="true"
              >
                ↻
              </span>

              {refreshing
                ? 'Refreshing…'
                : 'Refresh account'}
            </button>
          </div>

          {/* Sign out */}
          <section className="mt-4">
            <button
              type="button"
              onClick={() =>
                setSignOutOpen(true)
              }
              className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3.5 text-sm font-black text-rose-700 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
            >
              Sign out
            </button>
          </section>

          <footer className="px-2 pb-4 pt-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
              AUROTAP.IN
            </p>

            <p className="mt-1 text-[11px] font-medium text-slate-400">
              Your account, orders, and preferences in one place.
            </p>
          </footer>
        </div>
      </main>

      {signOutOpen ? (
        <SignOutModal
          onCancel={() =>
            setSignOutOpen(false)
          }
          onConfirm={() => {
            setSignOutOpen(false);
            logout({ redirectTo: '/' });
          }}
        />
      ) : null}

      <BottomNav />
    </>
  );
}
