'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';

type ReviewModalProps = {
  orderId: string;
  onClose: () => void;
};

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? '#f59e0b' : 'none'}
      stroke={filled ? '#f59e0b' : '#cbd5e1'}
      strokeWidth={1.5}
      className="h-10 w-10"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 0-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 0-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 0 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
      />
    </svg>
  );
}

export function ReviewModal({ orderId, onClose }: ReviewModalProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const onSubmit = async () => {
    if (stars < 1 || submitting) return;
    setSubmitting(true);
    try {
      await api.customer.reviews.create({
        order_id: orderId,
        stars,
        comment: comment.trim() || undefined,
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem(`reviewed_${orderId}`, '1');
      }
      toast.success('Thanks for your review!');
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="review-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdrop}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-100 shadow-xl p-6 space-y-5">
        <h2 id="review-modal-title" className="text-xl font-bold text-slate-900">
          How was your delivery?
        </h2>

        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStars(s)}
              className="p-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label={`${s} stars`}
            >
              <StarIcon filled={stars >= s} />
            </button>
          ))}
        </div>

        <div className="relative">
          <textarea
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[88px] text-slate-800"
            placeholder="Tell us more… (optional)"
            maxLength={120}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <span className="absolute bottom-2 right-2 text-[11px] text-slate-400">
            {comment.length} / 120
          </span>
        </div>

        <button
          type="button"
          disabled={stars < 1 || submitting}
          onClick={() => void onSubmit()}
          className="w-full rounded-xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <span className="inline-block h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : null}
          Submit Review
        </button>
      </div>
    </div>
  );
}
