/**
 * Location recovery guidance for the booking flow and other user roles.
 *
 * Never assume that a permission failure means the phone's GPS switch is off.
 * Browser permissions, OS location services, insecure contexts and timeout
 * errors have different causes. Manual entry must remain available.
 */
export type LocationFailure =
  | 'permission-denied'
  | 'device-location-off'
  | 'timeout'
  | 'position-unavailable'
  | 'unsupported'
  | 'insecure-context'
  | 'network'
  | 'unknown';

export type LocationGuidance = {
  title: string;
  summary: string;
  steps: readonly string[];
  fallback: string;
  retryLabel: string;
  severity: 'info' | 'warning' | 'error';
};

const MANUAL_FALLBACK =
  'You can continue without GPS. Enter your house or flat number, area, city and 6-digit PIN code.';

const LOCATION_GUIDANCE: Record<LocationFailure, LocationGuidance> = {
  'permission-denied': {
    title: 'Location access is not allowed',
    summary: 'AuroTap cannot read your location because permission was denied or blocked.',
    steps: [
      'Check that Location is turned on in your phone settings.',
      'Open the browser settings for this website and allow Location access.',
      'Return to AuroTap and select Try again.',
    ],
    fallback: MANUAL_FALLBACK,
    retryLabel: 'Try location again',
    severity: 'warning',
  },
  'device-location-off': {
    title: 'Check your device location setting',
    summary: 'Your phone may have location services switched off.',
    steps: [
      'Open Settings on your phone.',
      'Find Location or Location Services and turn it on.',
      'Return to the browser and try automatic detection again.',
    ],
    fallback: MANUAL_FALLBACK,
    retryLabel: 'Detect location again',
    severity: 'warning',
  },
  timeout: {
    title: 'Location is taking longer than expected',
    summary: 'GPS can be slow indoors or when the signal is weak.',
    steps: [
      'Check your device location setting.',
      'Move closer to a window or an open area if convenient.',
      'Try again once, or enter your address directly.',
    ],
    fallback: MANUAL_FALLBACK,
    retryLabel: 'Try again',
    severity: 'info',
  },
  'position-unavailable': {
    title: 'Location could not be detected',
    summary: 'Your device has not provided a reliable location.',
    steps: [
      'Check that your phone location setting is on.',
      'Check that the browser has permission to use location.',
      'If detection still fails, fill in the address fields manually.',
    ],
    fallback: MANUAL_FALLBACK,
    retryLabel: 'Try again',
    severity: 'warning',
  },
  unsupported: {
    title: 'Automatic location is unavailable',
    summary: 'This browser or device does not support location detection.',
    steps: [
      'Use an updated browser if you want automatic detection.',
      'Enter your address and PIN code manually to continue.',
    ],
    fallback: MANUAL_FALLBACK,
    retryLabel: 'Check again',
    severity: 'info',
  },
  'insecure-context': {
    title: 'Secure connection required',
    summary: 'Automatic location works only on secure HTTPS pages in supported browsers.',
    steps: [
      'Open the official secure AuroTap website.',
      'If you are already using HTTPS, check browser permissions.',
      'Enter your address manually if detection is unavailable.',
    ],
    fallback: MANUAL_FALLBACK,
    retryLabel: 'Try again',
    severity: 'warning',
  },
  network: {
    title: 'Address lookup is temporarily unavailable',
    summary: 'Your device may have found its location, but we could not look up the address.',
    steps: [
      'Check your internet connection.',
      'Enter your house number, area, city and PIN code.',
      'Save your address to continue booking.',
    ],
    fallback: MANUAL_FALLBACK,
    retryLabel: 'Retry address lookup',
    severity: 'warning',
  },
  unknown: {
    title: 'We could not detect your location',
    summary: 'Automatic location did not finish. Your booking can still continue.',
    steps: [
      'Check your phone location setting and browser permission.',
      'Try again if you prefer automatic detection.',
      'Otherwise enter your address manually.',
    ],
    fallback: MANUAL_FALLBACK,
    retryLabel: 'Try again',
    severity: 'warning',
  },
};

export function getLocationGuidance(failure: LocationFailure): LocationGuidance {
  return LOCATION_GUIDANCE[failure];
}

export function classifyGeolocationError(
  code: number | null | undefined,
  context: { secure?: boolean; supported?: boolean } = {},
): LocationFailure {
  if (context.secure === false) return 'insecure-context';
  if (context.supported === false) return 'unsupported';
  if (code === 1) return 'permission-denied';
  if (code === 2) return 'position-unavailable';
  if (code === 3) return 'timeout';
  return 'unknown';
}

export function canContinueWithoutLocation(): boolean {
  return true;
}

export function formatLocationHint(failure: LocationFailure): string {
  const guidance = getLocationGuidance(failure);
  return [guidance.summary, guidance.fallback].join(' ');
}

export function getAllLocationFailureTypes(): LocationFailure[] {
  return Object.keys(LOCATION_GUIDANCE) as LocationFailure[];
}
