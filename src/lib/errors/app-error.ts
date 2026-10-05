// src/lib/errors/app-error.ts

export type AppErrorCategory =
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVICE_UNAVAILABLE'
  | 'MAINTENANCE'
  | 'BOOKING'
  | 'PAYMENT'
  | 'SERVICEABILITY'
  | 'DATABASE'
  | 'UNKNOWN';

export type ErrorAction =
  | 'RETRY'
  | 'SIGN_IN'
  | 'RESET_PASSWORD'
  | 'GO_BACK'
  | 'CONTACT_SUPPORT'
  | 'CHECK_STATUS'
  | 'NONE';

export type AppErrorOptions = {
  category?: AppErrorCategory;
  code?: string;
  status?: number;
  message?: string;
  technicalMessage?: string;
  requestId?: string;
  retryable?: boolean;
  action?: ErrorAction;
};

export class AppError extends Error {
  readonly category: AppErrorCategory;
  readonly code?: string;
  readonly status?: number;
  readonly technicalMessage?: string;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly action: ErrorAction;

  constructor(options: AppErrorOptions = {}) {
    super(options.message ?? 'Something went wrong. Please try again.');

    this.name = 'AppError';
    this.category = options.category ?? 'UNKNOWN';
    this.code = options.code;
    this.status = options.status;
    this.technicalMessage = options.technicalMessage;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
    this.action = options.action ?? 'NONE';
  }
}

export type FriendlyError = {
  title: string;
  message: string;
  category: AppErrorCategory;
  action: ErrorAction;
  actionLabel?: string;
  retryable: boolean;
  requestId?: string;
};

const GENERIC_MESSAGES: Record<
  AppErrorCategory,
  Omit<FriendlyError, 'requestId'>
> = {
  VALIDATION: {
    title: 'Please check your information',
    message: 'Some information needs your attention. Please check the highlighted fields and try again.',
    category: 'VALIDATION',
    action: 'NONE',
    retryable: false,
  },

  AUTHENTICATION: {
    title: 'Sign-in required',
    message: 'Your sign-in session could not be verified. Please sign in again.',
    category: 'AUTHENTICATION',
    action: 'SIGN_IN',
    actionLabel: 'Sign in',
    retryable: false,
  },

  AUTHORIZATION: {
    title: 'Access unavailable',
    message: "You don't have permission to perform this action.",
    category: 'AUTHORIZATION',
    action: 'GO_BACK',
    actionLabel: 'Go back',
    retryable: false,
  },

  NOT_FOUND: {
    title: 'We couldn't find that',
    message: 'The information you requested is no longer available or may have moved.',
    category: 'NOT_FOUND',
    action: 'GO_BACK',
    actionLabel: 'Go back',
    retryable: false,
  },

  CONFLICT: {
    title: 'This has already been handled',
    message: 'This request may already have been completed. Please refresh and check the latest status.',
    category: 'CONFLICT',
    action: 'CHECK_STATUS',
    actionLabel: 'Check status',
    retryable: false,
  },

  RATE_LIMIT: {
    title: 'Please wait a moment',
    message: 'We received several requests in a short time. Please wait a little and try again.',
    category: 'RATE_LIMIT',
    action: 'RETRY',
    actionLabel: 'Try again',
    retryable: true,
  },

  NETWORK: {
    title: 'Connection problem',
    message: 'We could not connect to AuroWater. Please check your internet connection and try again.',
    category: 'NETWORK',
    action: 'RETRY',
    actionLabel: 'Try again',
    retryable: true,
  },

  TIMEOUT: {
    title: 'That is taking longer than expected',
    message: 'The connection is taking longer than usual. Your request may not have completed. Please try again.',
    category: 'TIMEOUT',
    action: 'RETRY',
    actionLabel: 'Try again',
    retryable: true,
  },

  SERVICE_UNAVAILABLE: {
    title: 'AuroWater is temporarily busy',
    message: 'We could not complete your request right now. Please try again shortly.',
    category: 'SERVICE_UNAVAILABLE',
    action: 'RETRY',
    actionLabel: 'Try again',
    retryable: true,
  },

  MAINTENANCE: {
    title: 'We are improving AuroWater',
    message: 'This service is temporarily unavailable while we make improvements. Please try again shortly.',
    category: 'MAINTENANCE',
    action: 'RETRY',
    actionLabel: 'Try again',
    retryable: true,
  },

  BOOKING: {
    title: 'Booking could not be confirmed',
    message: 'Your booking was not confirmed. Please try again or check your bookings before placing another request.',
    category: 'BOOKING',
    action: 'CHECK_STATUS',
    actionLabel: 'Check bookings',
    retryable: false,
  },

  PAYMENT: {
    title: 'Payment was not completed',
    message: 'We could not confirm this payment. Please check your payment status before trying again.',
    category: 'PAYMENT',
    action: 'CHECK_STATUS',
    actionLabel: 'Check payment status',
    retryable: false,
  },

  SERVICEABILITY: {
    title: 'Service is unavailable here',
    message: 'AuroWater is not currently available for this location or service.',
    category: 'SERVICEABILITY',
    action: 'GO_BACK',
    actionLabel: 'Choose another option',
    retryable: false,
  },

  DATABASE: {
    title: 'We could not complete that',
    message: 'Something went wrong while processing your request. Your information has not been lost. Please try again shortly.',
    category: 'DATABASE',
    action: 'RETRY',
    actionLabel: 'Try again',
    retryable: true,
  },

  UNKNOWN: {
    title: 'Something went wrong',
    message: 'We could not complete your request right now. Please try again shortly.',
    category: 'UNKNOWN',
    action: 'RETRY',
    actionLabel: 'Try again',
    retryable: true,
  },
};

const SAFE_CODE_MESSAGES: Record<
  string,
  Omit<FriendlyError, 'requestId'>
> = {
  EMAIL_EXISTS: {
    title: 'Account already exists',
    message: 'An account with this email already exists. Please sign in instead.',
    category: 'CONFLICT',
    action: 'SIGN_IN',
    actionLabel: 'Sign in',
    retryable: false,
  },

  PHONE_EXISTS: {
    title: 'Phone number already registered',
    message: 'This phone number is already linked to an account. Please sign in instead.',
    category: 'CONFLICT',
    action: 'SIGN_IN',
    actionLabel: 'Sign in',
    retryable: false,
  },

  EMAIL_NOT_CONFIRMED: {
    title: 'Please confirm your email',
    message: 'Your account was created, but your email address still needs to be confirmed.',
    category: 'AUTHENTICATION',
    action: 'NONE',
    retryable: false,
  },

  SESSION_EXPIRED: {
    title: 'Your session has expired',
    message: 'Please sign in again to continue.',
    category: 'AUTHENTICATION',
    action: 'SIGN_IN',
    actionLabel: 'Sign in',
    retryable: false,
  },

  INVALID_CREDENTIALS: {
    title: 'Sign-in unsuccessful',
    message: "The email or password doesn't match. Please try again.",
    category: 'AUTHENTICATION',
    action: 'SIGN_IN',
    actionLabel: 'Try again',
    retryable: false,
  },

  ADMIN_INVITE_INVALID: {
    title: 'Invitation code not accepted',
    message: 'The administrator invitation code is not valid. Please check it and try again.',
    category: 'AUTHORIZATION',
    action: 'NONE',
    retryable: false,
  },

  NETWORK: {
    title: 'Connection problem',
    message: 'We could not reach AuroWater. Please check your internet connection and try again.',
    category: 'NETWORK',
    action: 'RETRY',
    actionLabel: 'Try again',
    retryable: true,
  },

  DB_NOT_READY: {
    title: 'AuroWater is temporarily unavailable',
    message: 'We are unable to complete this request right now. Please try again shortly.',
    category: 'SERVICE_UNAVAILABLE',
    action: 'RETRY',
    actionLabel: 'Try again',
    retryable: true,
  },

  SERVICE_ROLE_MISSING: {
    title: 'Service temporarily unavailable',
    message: 'We could not complete this request right now. Please try again later.',
    category: 'SERVICE_UNAVAILABLE',
    action: 'RETRY',
    actionLabel: 'Try again',
    retryable: true,
  },
};

const TECHNICAL_PATTERNS: Array<{
  pattern: RegExp;
  category: AppErrorCategory;
}> = [
  { pattern: /network|failed to fetch|fetch failed|offline/i, category: 'NETWORK' },
  { pattern: /timeout|timed out|abort/i, category: 'TIMEOUT' },
  { pattern: /42P01|relation .* does not exist|column .* does not exist/i, category: 'DATABASE' },
  { pattern: /PGRST|PostgrestError|postgres|postgresql/i, category: 'DATABASE' },
  { pattern: /supabase.*error/i, category: 'DATABASE' },
  { pattern: /maintenance/i, category: 'MAINTENANCE' },
];

function safeCode(code?: string): string {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

function containsTechnicalInformation(message: string): boolean {
  return (
    /42P01|23505|23503|PGRST|PostgrestError|postgres|postgresql/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /column .* does not exist/i.test(message) ||
    /stack trace|at .*:\d+:\d+/i.test(message)
  );
}

function categoryFromStatus(status?: number): AppErrorCategory {
  switch (status) {
    case 400:
      return 'VALIDATION';
    case 401:
      return 'AUTHENTICATION';
    case 403:
      return 'AUTHORIZATION';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 408:
      return 'TIMEOUT';
    case 429:
      return 'RATE_LIMIT';
    case 502:
    case 503:
    case 504:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'UNKNOWN';
  }
}

function categoryFromMessage(message: string): AppErrorCategory | null {
  for (const item of TECHNICAL_PATTERNS) {
    if (item.pattern.test(message)) {
      return item.category;
    }
  }

  return null;
}

export function classifyError(
  error: unknown,
  options: {
    status?: number;
    code?: string;
    context?: string;
  } = {},
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  const code = safeCode(options.code);

  if (SAFE_CODE_MESSAGES[code]) {
    const safe = SAFE_CODE_MESSAGES[code];

    return new AppError({
      ...safe,
      code,
      status: options.status,
      technicalMessage: message || undefined,
    });
  }

  const category =
    categoryFromStatus(options.status) ??
    categoryFromMessage(message) ??
    'UNKNOWN';

  return new AppError({
    category,
    code,
    status: options.status,
    technicalMessage: message || undefined,
    retryable:
      category === 'NETWORK' ||
      category === 'TIMEOUT' ||
      category === 'SERVICE_UNAVAILABLE' ||
      category === 'DATABASE',
  });
}

export function getFriendlyError(
  error: unknown,
  options: {
    status?: number;
    code?: string;
  } = {},
): FriendlyError {
  const appError = classifyError(error, options);
  const code = safeCode(appError.code);

  if (SAFE_CODE_MESSAGES[code]) {
    return {
      ...SAFE_CODE_MESSAGES[code],
      requestId: appError.requestId,
    };
  }

  /*
   * Never expose database, Supabase, Postgres or stack-trace details.
   */
  if (containsTechnicalInformation(appError.message)) {
    const safe = GENERIC_MESSAGES[appError.category];

    return {
      ...safe,
      requestId: appError.requestId,
    };
  }

  /*
   * Safe validation/business messages can be shown to users.
   */
  if (
    appError.category === 'VALIDATION' ||
    appError.category === 'CONFLICT'
  ) {
    return {
      title:
        appError.category === 'CONFLICT'
          ? 'We could not complete that'
          : 'Please check your information',
      message: appError.message,
      category: appError.category,
      action: appError.action,
      actionLabel: appError.action === 'RETRY' ? 'Try again' : undefined,
      retryable: appError.retryable,
      requestId: appError.requestId,
    };
  }

  const safe = GENERIC_MESSAGES[appError.category];

  return {
    ...safe,
    requestId: appError.requestId,
  };
}

export function getUserErrorMessage(
  error: unknown,
  options: {
    status?: number;
    code?: string;
  } = {},
): string {
  return getFriendlyError(error, options).message;
}
