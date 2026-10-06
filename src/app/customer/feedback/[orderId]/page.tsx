'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ChevronRight,
  Droplets,
  Heart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
} from 'lucide-react';
import { getToken } from '@/lib/api-client';

const ratings = [
  {
    value: 1,
    emoji: '😞',
    label: 'Very poor',
    title: "We're sorry",
    message:
      "We didn't meet your expectations. Tell us what went wrong and we'll use it to improve.",
  },
  {
    value: 2,
    emoji: '😕',
    label: 'Poor',
    title: 'Thanks for being honest',
    message:
      'Your feedback helps us identify what needs to be better.',
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
      'What did you enjoy most about your AuroWater experience?',
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

export default function CustomerFeedbackPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();

  const orderId = params.orderId;

  const [rating, setRating] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const selectedRating = useMemo(
    () => ratings.find((item) => item.value === rating) ?? null,
    [rating]
  );

  const options =
    rating !== null && rating <= 3
      ? negativeOptions
      : positiveOptions;

  function selectRating(value: number) {
    setRating(value);
    setTags([]);
    setError('');
  }

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );

    setError('');
  }

  async function submitFeedback() {
    if (!rating || submitting) {
      return;
    }

    if (!orderId) {
      setError('We could not identify this order. Please try again.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const token = await getToken();

      if (!token) {
        setError(
          'Your session has expired. Please log in again.'
        );
        return;
      }

      const trimmedComment = comment.trim();

      const response = await fetch('/api/customer/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          order_id: orderId,
          rating,
          tags,
          comment: trimmedComment || null,
          issue_category:
            rating <= 3 && tags.length > 0 ? tags[0] : null,
          issue_description:
            rating <= 3 ? trimmedComment || null : null,
        }),
      });

      let result: {
        success?: boolean;
        error?: string;
        message?: string;
      } | null = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok || result?.success === false) {
        if (response.status === 401) {
          setError(
            'Your session has expired. Please log in again.'
          );
          return;
        }

        if (response.status === 403) {
          setError(
            result?.error ||
              'You are not allowed to review this order.'
          );
          return;
        }

        if (response.status === 400) {
          setError(
            result?.error ||
              'This feedback cannot be submitted for this order.'
          );
          return;
        }

        throw new Error(
          result?.error ||
            result?.message ||
            'Unable to submit feedback right now.'
        );
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit feedback right now.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    const positive = rating !== null && rating >= 4;

    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e8f7ff_0%,#f6faff_42%,#eef5fb_100%)] px-4 py-8 sm:py-12">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
          <div className="w-full overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            <div className="relative px-6 pb-8 pt-10 text-center sm:px-10 sm:pt-12">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
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
                  ? 'Your feedback has been shared with the AuroWater team. It helps us keep improving every delivery.'
                  : 'Your feedback has been recorded for this order. Honest feedback helps us find problems and improve the experience.'}
              </p>

              <div className="mx-auto mt-7 max-w-sm rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 text-left">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Your feedback matters.
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Every genuine response gives our team a better
                      idea of what customers actually experience.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {selectedRating && (
              <div className="border-y border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-10">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl">
                    {selectedRating.emoji}
                  </span>

                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      You rated your experience
                    </p>

                    <p className="text-xs text-slate-500">
                      {selectedRating.label}
                    </p>
                  </div>

                  <div className="ml-auto rounded-full bg-white px-3 py-1 text-sm font-bold text-blue-600 shadow-sm">
                    {rating}/5
                  </div>
                </div>
              </div>
            )}

            {rating !== null && rating <= 3 && (
              <div className="px-6 pt-6 sm:px-10">
                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Want us to look into it?
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        If something went wrong with this order,
                        our support team can help investigate it.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          router.push('/customer/support')
                        }
                        className="mt-3 text-sm font-bold text-blue-600 transition hover:text-blue-700"
                      >
                        Contact support →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="px-6 pb-7 pt-6 sm:px-10 sm:pb-10">
              <button
                type="button"
                onClick={() =>
                  router.push('/customer/orders')
                }
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Back to my orders
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf7ff_0%,#f6faff_40%,#eef5fb_100%)] px-3 py-6 sm:px-5 sm:py-10">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 text-center sm:mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-xl shadow-blue-500/20">
            <Droplets className="h-7 w-7" />
          </div>

          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.25em] text-blue-600">
            AUROWATER
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            How did we do today?
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Your honest feedback helps us make every AuroWater
            delivery better.
          </p>
        </header>

        <div className="space-y-4">
          <section className="rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.07)] sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Sparkles className="h-4 w-4" />
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-950 sm:text-base">
                  Rate your experience
                </h2>

                <p className="text-xs text-slate-500">
                  There is no right or wrong answer.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-5 gap-1.5 sm:gap-2">
              {ratings.map((item) => {
                const active = rating === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => selectRating(item.value)}
                    aria-label={`Rate ${item.label}`}
                    aria-pressed={active}
                    className={[
                      'group rounded-2xl border p-2.5 text-center transition-all duration-200 sm:p-3',
                      active
                        ? 'scale-[1.03] border-blue-400 bg-blue-50 shadow-md shadow-blue-500/10 ring-2 ring-blue-100'
                        : 'border-slate-100 bg-slate-50 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'text-2xl transition-transform sm:text-3xl',
                        active
                          ? 'scale-110'
                          : 'group-hover:scale-105',
                      ].join(' ')}
                    >
                      {item.emoji}
                    </div>

                    <div className="mt-1.5 text-[9px] font-bold leading-tight text-slate-600 sm:text-[11px]">
                      {item.label}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedRating && (
              <div className="mt-5 rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50/70 p-4">
                <p className="text-sm font-bold text-slate-900">
                  {selectedRating.emoji} {selectedRating.title}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {selectedRating.message}
                </p>
              </div>
            )}
          </section>

          {rating !== null && (
            <section className="rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.07)] sm:p-7">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  {rating >= 4 ? (
                    <ThumbsUp className="h-4 w-4" />
                  ) : (
                    <MessageCircle className="h-4 w-4" />
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-bold text-slate-950 sm:text-base">
                    {rating >= 4
                      ? 'What made it good?'
                      : 'What could we improve?'}
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Choose anything that applies.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {options.map(([value, label]) => {
                  const active = tags.includes(value);

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleTag(value)}
                      aria-pressed={active}
                      className={[
                        'flex min-h-11 items-center rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all',
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
                })}
              </div>
            </section>
          )}

          {rating !== null && (
            <section className="rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.07)] sm:p-7">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <MessageCircle className="h-4 w-4" />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-slate-950 sm:text-base">
                    Anything else you'd like us to know?
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Optional. A few words can help us understand
                    your experience better.
                  </p>
                </div>
              </div>

              <textarea
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value.slice(0, 1000));
                  setError('');
                }}
                placeholder={
                  rating <= 3
                    ? 'Tell us what happened...'
                    : 'Tell us what you liked...'
                }
                rows={5}
                maxLength={1000}
                className="mt-5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />

              <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                <span>Optional</span>
                <span>{comment.length}/1000</span>
              </div>
            </section>
          )}

          {rating !== null && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

              <p className="text-xs leading-5 text-emerald-800">
                Your feedback is used to improve AuroWater service
                quality. We value honest feedback — positive or
                negative.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700"
            >
              <p className="font-semibold">
                We couldn't submit your feedback.
              </p>

              <p className="mt-1 text-xs leading-5 text-red-600">
                {error}
              </p>

              {error.toLowerCase().includes('session') && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/auth/login?returnTo=${encodeURIComponent(
                        `/customer/feedback/${orderId}`
                      )}`
                    )
                  }
                  className="mt-3 text-xs font-bold text-red-700 underline underline-offset-2"
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
              onClick={submitFeedback}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-4 text-sm font-bold text-white shadow-xl shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
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
                  <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          )}

          <p className="pb-4 text-center text-[11px] leading-5 text-slate-400">
            AuroWater • Better service, one delivery at a time.
          </p>
        </div>
      </div>
    </main>
  );
}
