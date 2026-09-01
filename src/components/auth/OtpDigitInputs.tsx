'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (digits: string) => void;
  disabled?: boolean;
  error?: boolean;
  length?: number;
};

export default function OtpDigitInputs({
  value,
  onChange,
  disabled,
  error,
  length = 6,
}: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');

  const focusAt = (i: number) => {
    refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();
  };

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = chars.slice();
    next[i] = digit;
    const joined = next.join('').slice(0, length);
    onChange(joined);
    if (digit) focusAt(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (chars[i]) {
        const next = chars.slice();
        next[i] = '';
        onChange(next.join(''));
      } else {
        focusAt(i - 1);
        const next = chars.slice();
        if (i > 0) next[i - 1] = '';
        onChange(next.join(''));
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(i + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    focusAt(Math.min(length - 1, pasted.length));
  };

  return (
    <div className={`otp-row ${error ? 'otp-row-err' : ''}`} onPaste={handlePaste}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={c}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          className="otp-box"
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
