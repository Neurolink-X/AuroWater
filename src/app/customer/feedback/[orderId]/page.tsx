'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Heart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import { getToken } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

const ratings = [
  {
    value: 1,
    emoji: '😞',
    label: 'Very poor',
    title: "We're sorry",
    message:
      'We missed the mark. Tell us what went wrong and we will use it to improve.',
  },
  {
    value: 2,
    emoji: '😕',
    label: 'Poor',
    title: 'Thanks for being honest',
    message:
      'Your feedback helps us identify what needs to improve.',
  },
  {
    value: 3,
    emoji: '😐',
    label: 'Okay',
    title: 'We can do better',
    message:
      'Tell us what would have made this experience better.',
  },
  {
    value: 4,
    emoji: '🙂',
    label: 'Good',
    title: 'Nice to hear that',
    message:
      'What made your experience good today?',
  },
  {
    value: 5,
    emoji: '🤩',
    label: 'Excellent',
    title: 'That made our day!',
    message:
      'What did you enjoy most about your AuroTap experience?',
  },
] as const;

const positiveOptions = [
  ['on_time', 'On-time service'],
  ['good_quality', 'Good quality'],
  ['professional_staff', 'Professional staff'],
  ['easy_booking', 'Easy booking'],
  ['good_value', 'Good value'],
  ['smooth_service', 'Smooth service'],
] as const;

const negativeOptions = [
  ['late_delivery', 'Late delivery'],
  ['water_quality', 'Water/service quality'],
  ['hygiene', 'Hygiene issue'],
  ['staff_behaviour', 'Staff behaviour'],
  ['quantity', 'Wrong quantity'],
  ['packaging', 'Packaging issue'],
  ['pricing', 'Price/value'],
  ['communication', 'Communication'],
  ['address_issue', 'Address/delivery issue'],
  ['other', 'Other'],
] as const;

type ApiResult = {
  data?: {
    quality_case_id?: string | null;
  };
  error?: string;
  message?: string;
};

export default function CustomerFeedbackPage() {
  const auth = useAuth();
  const router = useRouter();
  const params =
    useParams<{
      orderId: string;
    }>();

  const orderId =
    params.orderId;

  const [rating, setRating] =
    useState<number | null>(
      null
    );

  const [tags, setTags] =
    useState<string[]>(
      []
    );

  const [comment, setComment] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [duplicate, setDuplicate] =
    useState(false);

  const [qualityCaseCreated, setQualityCaseCreated] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    document.title =
      'Share Feedback | AuroTap';

    let robots =
      document.head.querySelector(
        'meta[name="robots"]'
      ) as HTMLMetaElement | null;

    if (!robots) {
      robots =
        document.createElement('meta');

      robots.name = 'robots';

      document.head.appendChild(
        robots
      );
    }

    robots.content =
      'noindex, nofollow';
  }, []);

  useEffect(() => {
    if (
      !auth.hydrated ||
      auth.loading
    ) {
      return;
    }

    if (!auth.isLoggedIn) {
      router.replace(
        `/auth/login?returnTo=${encodeURIComponent(
          `/customer/feedback/${orderId}`
        )}`
      );

      return;
    }

    if (!auth.isCustomer) {
      router.replace('/');
    }
  }, [
    auth.hydrated,
    auth.loading,
    auth.isLoggedIn,
    auth.isCustomer,
    orderId,
    router,
  ]);

  const selectedRating =
    useMemo(
      () =>
        ratings.find(
          (item) =>
            item.value ===
            rating
        ) ?? null,
      [rating]
    );

  const options =
    rating !== null &&
    rating <= 3
      ? negativeOptions
      : positiveOptions;

  function selectRating(
    value: number
  ) {
    setRating(value);
    setTags([]);
    setError('');
    setDuplicate(false);
  }

  function toggleTag(
    tag: string
  ) {
    setTags(
      (current) =>
        current.includes(tag)
          ? current.filter(
              (item) =>
                item !== tag
            )
          : [
              ...current,
              tag,
            ]
    );

    setError('');
  }

  async function submitFeedback() {
    if (
      !rating ||
      submitting
    ) {
      return;
    }

    if (!orderId) {
      setError(
        'We could not identify this order. Please try again.'
      );

      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const token =
        await getToken();

      if (!token) {
        setError(
          'Your session has expired. Please log in again.'
        );

        return;
      }

      const response =
        await fetch(
          '/api/customer/reviews',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
            credentials:
              'include',
            body: JSON.stringify({
              order_id:
                orderId,

              rating,

              tags,

              comment:
                comment.trim() ||
                null,

              issue_category:
                rating <= 3 &&
                tags.length > 0
                  ? tags[0]
                  : null,

              issue_description:
                rating <= 3
                  ? comment.trim() ||
                    null
                  : null,
            }),
          }
        );

      let result:
        ApiResult = {};

      try {
        result =
          (await response.json()) as ApiResult;
      } catch {
        result = {};
      }

      if (
        response.status ===
        409
      ) {
        setDuplicate(
          true
        );

        return;
      }

      if (
        response.status ===
        401
      ) {
        setError(
          'Your session has expired. Please log in again.'
        );

        return;
      }

      if (
        response.status ===
        403
      ) {
        setError(
          result.error ||
            'You are not allowed to review this order.'
        );

        return;
      }

      if (
        !response.ok
      ) {
        setError(
          result.error ||
            result.message ||
            'Unable to submit feedback right now.'
        );

        return;
      }

      setQualityCaseCreated(
        Boolean(
          result.data
            ?.quality_case_id
        )
      );

      setSubmitted(
        true
      );
    } catch {
      setError(
        'Unable to submit feedback right now. Please try again.'
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }

  if (
    auth.loading ||
    !auth.hydrated
  ) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-xl animate-pulse">
          <div className="h-8 w-36 rounded bg-slate-200" />
          <div className="mt-4 h-40 rounded-[2rem] bg-white" />
          <div className="mt-4 h-72 rounded-[2rem] bg-white" />
        </div>
      </main>
    );
  }

  if (
    !auth.isLoggedIn ||
    !auth.isCustomer
  ) {
    return null;
  }

  if (duplicate) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e9f8ff_0%,#f6faff_48%,#eef4fa_100%)] px-4 py-8 sm:py-12">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
          <section className="w-full overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />

            <div className="px-6 py-10 text-center sm:px-10">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 ring-8 ring-blue-50/70">
                <CheckCircle2 className="h-10 w-10 text-blue-600" />
              </div>

              <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                Already received
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                You already reviewed this order
              </h1>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                Thank you. Your feedback for this order is already
                recorded in AuroTap.
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    '/customer/history'
                  )
                }
                className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                View my orders
                <ChevronRight className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    '/customer/home'
                  )
                }
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to home
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (submitted) {
    const positive =
      rating !== null &&
      rating >= 4;

    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e8f7ff_0%,#f7fbff_45%,#eef5fb_100%)] px-4 py-8 sm:py-12">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
          <section className="w-full overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />

            <div className="px-6 pb-8 pt-10 text-center sm:px-10 sm:pt-12">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/70">
                {positive ? (
                  <Heart className="h-9 w-9 fill-emerald-500 text-emerald-500" />
                ) : (
                  <CheckCircle2 className="h-9 w-9 text-emerald-600" />
                )}
              </div>

              <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                Feedback received
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                {positive
                  ? 'Thank you for sharing the good vibes 💙'
                  : 'Thank you for telling us honestly'}
              </h1>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                {positive
                  ? 'Your feedback helps us keep improving every AuroTap delivery.'
                  : 'Your feedback has been recorded and will help us improve the service.'}
              </p>

              <div className="mx-auto mt-7 max-w-md rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 text-left">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Your feedback matters
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Every genuine response helps our team understand
                      the real customer experience.
                    </p>
                  </div>
                </div>
              </div>

              {qualityCaseCreated && (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-left">
                  <p className="text-sm font-bold text-slate-900">
                    Your issue has been flagged
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    We created a service-quality case so the relevant
                    team can investigate it.
                  </p>
                </div>
              )}

              {rating !== null && (
                <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <span className="text-3xl">
                    {
                      ratings.find(
                        (item) =>
                          item.value ===
                          rating
                      )?.emoji
                    }
                  </span>

                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">
                      Your rating
                    </p>

                    <p className="text-xs text-slate-500">
                      {rating}/5 ·{' '}
                      {
                        ratings.find(
                          (item) =>
                            item.value ===
                            rating
                        )?.label
                      }
                    </p>
                  </div>
                </div>
              )}

              {rating !== null &&
                rating <= 3 && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        '/customer/support'
                      )
                    }
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                  >
                    Need help with this issue?
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}

              <button
                type="button"
                onClick={() =>
                  router.push(
                    '/customer/history'
                  )
                }
                className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                Back to my orders
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e7f7ff_0%,#f8fbff_40%,#eef4f9_100%)] px-4 pb-10 pt-5 sm:pt-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              router.push(
                '/customer/history'
              )
            }
            className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
          >
            <ChevronLeft className="h-4 w-4" />
            Orders
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                '/customer/support'
              )
            }
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-blue-600 transition hover:bg-white"
          >
            <MessageCircle className="h-4 w-4" />
            Support
          </button>
        </div>

        <section className="mt-3 overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />

          <div className="px-6 pb-7 pt-8 sm:px-10 sm:pb-9 sm:pt-10">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Droplets className="h-6 w-6" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                  AuroTap feedback
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  How was your experience?
                </h1>

                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                  One quick rating helps us make delivery and service
                  better for you.
                </p>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-2">
              <div
                className={[
                  'h-1.5 rounded-full',
                  rating !== null
                    ? 'bg-blue-600'
                    : 'bg-slate-200',
                ].join(' ')}
              />

              <div
                className={[
                  'h-1.5 rounded-full',
                  rating !== null
                    ? 'bg-blue-600'
                    : 'bg-slate-200',
                ].join(' ')}
              />

              <div
                className={[
                  rating !== null &&
                  (tags.length > 0 ||
                    comment.trim())
                    ? 'bg-blue-600'
                    : 'bg-slate-200',
                  'h-1.5 rounded-full',
                ].join(' ')}
              />
            </div>

            <p className="mt-2 text-[11px] font-semibold text-slate-400">
              {rating === null
                ? 'Step 1 of 3 · Rate'
                : tags.length === 0 &&
                    !comment.trim()
                  ? 'Step 2 of 3 · Add details'
                  : 'Step 3 of 3 · Submit'}
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-[1.75rem] border border-white bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.07)] sm:p-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                Rate this order
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Choose the rating that best matches your experience.
              </p>
            </div>

            {rating !== null && (
              <div className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                {rating}/5
              </div>
            )}
          </div>

          <div
            className="mt-5 grid grid-cols-5 gap-2 sm:gap-3"
            role="radiogroup"
            aria-label="Order rating"
          >
            {ratings.map(
              (item) => {
                const active =
                  rating ===
                  item.value;

                return (
                  <button
                    key={
                      item.value
                    }
                    type="button"
                    role="radio"
                    aria-checked={
                      active
                    }
                    onClick={() =>
                      selectRating(
                        item.value
                      )
                    }
                    className={[
                      'group rounded-2xl border px-2 py-3 transition-all duration-200',
                      active
                        ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30',
                    ].join(' ')}
                  >
                    <span className="block text-3xl transition-transform group-hover:scale-105 sm:text-4xl">
                      {item.emoji}
                    </span>

                    <span
                      className={[
                        'mt-2 block text-[10px] font-bold sm:text-xs',
                        active
                          ? 'text-blue-700'
                          : 'text-slate-500',
                      ].join(' ')}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {selectedRating && (
            <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-sm font-bold text-slate-900">
                {selectedRating.title}
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {selectedRating.message}
              </p>
            </div>
          )}
        </section>

        {rating !== null && (
          <section className="mt-4 rounded-[1.75rem] border border-white bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.07)] sm:p-7">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Sparkles className="h-4 w-4" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-950">
                  {rating <= 3
                    ? 'What could be better?'
                    : 'What did you like?'}
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Select everything that matches your experience.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {options.map(
                ([value, label]) => {
                  const active =
                    tags.includes(
                      value
                    );

                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={
                        active
                      }
                      onClick={() =>
                        toggleTag(
                          value
                        )
                      }
                      className={[
                        'flex min-h-12 items-center rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all',
                        active
                          ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/30',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                          active
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-slate-300 text-transparent',
                        ].join(' ')}
                      >
                        ✓
                      </span>

                      {label}
                    </button>
                  );
                }
              )}
            </div>
          </section>
        )}

        {rating !== null && (
          <section className="mt-4 rounded-[1.75rem] border border-white bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.07)] sm:p-7">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <MessageCircle className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-950">
                  Anything else?
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Optional. A few words can help our team understand
                  your experience better.
                </p>
              </div>
            </div>

            <textarea
              value={comment}
              onChange={(event) => {
                setComment(
                  event.target.value.slice(
                    0,
                    1000
                  )
                );

                setError(
                  ''
                );
              }}
              maxLength={1000}
              rows={5}
              placeholder={
                rating <= 3
                  ? 'Tell us what happened...'
                  : 'Tell us what you liked...'
              }
              className="mt-5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Optional</span>
              <span>
                {comment.length}/1000
              </span>
            </div>
          </section>
        )}

        {rating !== null && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

            <p className="text-xs leading-5 text-emerald-800">
              Your feedback is used to improve AuroTap service quality.
              Honest feedback — positive or negative — helps us improve.
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4"
          >
            <p className="text-sm font-bold text-red-800">
              We couldn&apos;t submit your feedback.
            </p>

            <p className="mt-1 text-xs leading-5 text-red-700">
              {error}
            </p>

            {error
              .toLowerCase()
              .includes(
                'session'
              ) && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/auth/login?returnTo=${encodeURIComponent(
                      `/customer/feedback/${orderId}`
                    )}`
                  )
                }
                className="mt-3 text-xs font-bold text-red-800 underline underline-offset-2"
              >
                Log in again
              </button>
            )}
          </div>
        )}

        {rating !== null && (
          <button
            type="button"
            disabled={submitting}
            onClick={
              submitFeedback
            }
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-sm font-bold text-white shadow-xl shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving your feedback...
              </>
            ) : (
              <>
                {rating >= 4
                  ? 'Share my feedback'
                  : 'Send my feedback'}

                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>
        )}

        <p className="mt-5 pb-4 text-center text-[11px] leading-5 text-slate-400">
          AuroTap · Better service, one delivery at a time.
        </p>
      </div>
    </main>
  );
}
