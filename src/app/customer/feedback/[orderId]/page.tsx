'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ChevronRight,
  Droplets,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

const ratings = [
  { value: 5, emoji: '😍', label: 'Excellent' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 2, emoji: '😞', label: 'Poor' },
  { value: 1, emoji: '😡', label: 'Very poor' },
];

const positiveOptions = [
  ['on_time', 'On-time service'],
  ['good_quality', 'Good quality'],
  ['professional_staff', 'Professional staff'],
  ['easy_booking', 'Easy booking'],
  ['good_value', 'Good value'],
  ['smooth_service', 'Smooth service'],
];

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
];

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

  const options =
    rating !== null && rating <= 3
      ? negativeOptions
      : positiveOptions;

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
  }

  async function submitFeedback() {
    if (!rating || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/customer/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          order_id: orderId,
          rating,
          tags,
          comment: comment.trim() || null,
          issue_category:
            rating <= 3 && tags.length > 0
              ? tags[0]
              : null,
          issue_description:
            comment.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(
          result.error || 'Unable to submit feedback'
        );
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit feedback'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#F5F9FF] px-4 py-10">
        <div className="mx-auto max-w-lg">
          <div className="rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Thank you for your feedback
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Your feedback helps AuroWater improve service
              quality for every customer.
            </p>

            {rating !== null && rating <= 3 && (
              <div className="mt-6 rounded-2xl bg-blue-50 p-4 text-left">
                <div className="flex items-start gap-3">
                  <MessageCircle className="mt-0.5 h-5 w-5 text-blue-600" />

                  <div>
                    <p className="font-semibold text-slate-900">
                      Need help with this order?
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Our support team can investigate the issue.
                    </p>

                    <button
                      onClick={() =>
                        router.push('/customer/support')
                      }
                      className="mt-3 text-sm font-semibold text-blue-600"
                    >
                      Contact support →
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => router.push('/customer/orders')}
              className="mt-7 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Back to my orders
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F9FF] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20">
            <Droplets className="h-7 w-7 text-white" />
          </div>

          <p className="text-sm font-semibold text-blue-600">
            AUROWATER
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            How was your service?
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Your feedback helps us make every delivery better.
          </p>
        </div>

        <div className="space-y-5">
          <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />

              <h2 className="font-bold text-slate-900">
                Rate your experience
              </h2>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {ratings.map((item) => {
                const active = rating === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setRating(item.value)}
                    className={[
                      'rounded-2xl border p-3 text-center transition',
                      active
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                        : 'border-slate-100 bg-slate-50 hover:border-blue-200',
                    ].join(' ')}
                  >
                    <div className="text-2xl">
                      {item.emoji}
                    </div>

                    <div className="mt-1 text-[10px] font-semibold text-slate-600 sm:text-xs">
                      {item.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {rating !== null && (
            <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="font-bold text-slate-900">
                {rating >= 4
                  ? 'What went well?'
                  : 'What could we improve?'}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select everything that applies.
              </p>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {options.map(([value, label]) => {
                  const active = tags.includes(value);

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleTag(value)}
                      className={[
                        'rounded-xl border px-4 py-3 text-left text-sm font-medium transition',
                        active
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300',
                      ].join(' ')}
                    >
                      {active ? '✓ ' : ''}
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {rating !== null && (
            <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="font-bold text-slate-900">
                Anything else?
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Optional. Tell us more if you want.
              </p>

              <textarea
                value={comment}
                onChange={(event) =>
                  setComment(event.target.value.slice(0, 1000))
                }
                placeholder={
                  rating <= 3
                    ? 'Tell us what happened...'
                    : 'Tell us what you liked...'
                }
                rows={5}
                className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />

              <div className="mt-2 text-right text-xs text-slate-400">
                {comment.length}/1000
              </div>
            </section>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {rating !== null && (
            <button
              type="button"
              disabled={submitting}
              onClick={submitFeedback}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                'Submitting...'
              ) : (
                <>
                  Submit feedback
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
