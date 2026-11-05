/**
 * Shared, executable business contract between the specialist application UI,
 * authenticated API and tests. A selected service never grants job entitlement.
 */
export const TECHNICIAN_SERVICE_OPTIONS = {
  plumbing: { role: 'plumber', skill: 'Plumbing', radiusKm: 15, label: 'Plumbing', hindi: 'प्लंबिंग' },
  ro_service: { role: 'ro', skill: 'RO Install', radiusKm: 15, label: 'RO service', hindi: 'RO सर्विस' },
  tank_cleaning: { role: 'tank', skill: 'Maintenance', radiusKm: 50, label: 'Tank cleaning', hindi: 'टंकी की सफाई' },
  borewell: { role: 'borewell', skill: 'Boring', radiusKm: 50, label: 'Borewell', hindi: 'बोरवेल' },
} as const;

export type TechnicianServiceKey = keyof typeof TECHNICIAN_SERVICE_OPTIONS;
export type ServiceRequestRole = (typeof TECHNICIAN_SERVICE_OPTIONS)[TechnicianServiceKey]['role'];
export const REQUIRED_TECHNICIAN_IDENTITY_SLOTS = ['aadhaar_front', 'aadhaar_back', 'profile_photo'] as const;

export type AccountForApproval = {
  role: string;
  status: string | null;
  is_active: boolean;
  city: string | null;
  full_name?: string | null;
  phone?: string | null;
};
export type PendingForApproval = { id: string; status: string; payload: unknown } | null;

export type ServiceApprovalDecision =
  | { ok: true; reused: false }
  | { ok: true; reused: true; applicationId: string }
  | { ok: false; status: 403 | 409 | 422; code: string; message: string };

export function isTechnicianServiceKey(input: string): input is TechnicianServiceKey {
  return Object.prototype.hasOwnProperty.call(TECHNICIAN_SERVICE_OPTIONS, input);
}

export function requiredDocumentStates(
  files: readonly { document_slot: string | null; review_status: string }[],
): Record<string, string> {
  // The API queries latest first. A replaced/rejected document overrides
  // its older approved version (never count an outdated attachment).
  const statuses: Record<string, string> = {};
  for (const f of files) {
    if (f.document_slot && REQUIRED_TECHNICIAN_IDENTITY_SLOTS.some(x => x === f.document_slot) &&
        !(f.document_slot in statuses)) statuses[f.document_slot] = f.review_status;
  }
  return statuses;
}

export function assessTechnicianServiceRequest(input: {
  account: AccountForApproval;
  serviceKey: TechnicianServiceKey;
  approvedServices: readonly string[];
  pending: PendingForApproval;
  documentStatuses: Readonly<Record<string, string>>;
}): ServiceApprovalDecision {
  const { account, serviceKey, approvedServices, pending, documentStatuses } = input;
  if (account.role !== 'technician') {
    return { ok: false, status: 403, code: 'NOT_TECHNICIAN', message: 'Sign in with your technician account.' };
  }
  if (account.status !== 'active' || account.is_active !== true) {
    return { ok: false, status: 403, code: 'ACCOUNT_RESTRICTED', message: 'Account is not active. Contact support before applying.' };
  }
  if (!account.city || !account.full_name?.trim()) {
    return { ok: false, status: 422, code: 'PROFILE_INCOMPLETE', message: 'Add your registered full name and city before applying.' };
  }
  if (approvedServices.includes(serviceKey)) {
    return { ok: false, status: 409, code: 'ALREADY_APPROVED', message: 'This service is already approved for your account.' };
  }
  const required = REQUIRED_TECHNICIAN_IDENTITY_SLOTS.filter(slot => documentStatuses[slot] !== 'approved');
  if (required.length) {
    return { ok: false, status: 409, code: 'DOCUMENTS_INCOMPLETE', message: 'Complete approval of Aadhaar front, Aadhaar back and profile photo first.' };
  }
  if (pending) {
    const payload = pending.payload;
    const requested = payload && typeof payload === 'object' && 'role' in payload
      ? (payload as { role?: unknown }).role : null;
    if (requested === TECHNICIAN_SERVICE_OPTIONS[serviceKey].role) {
      return { ok: true, reused: true, applicationId: pending.id };
    }
    return { ok: false, status: 409, code: 'OTHER_REQUEST_PENDING', message: 'Another service request is already under review. Finish that review before applying again.' };
  }
  return { ok: true, reused: false };
}

export function buildTechnicianServicePayload(input: {
  serviceKey: TechnicianServiceKey;
  account: AccountForApproval;
  workingArea: string;
  workingPincode: string;
  experienceYears: number;
  workDescription: string;
}) {
  const choice = TECHNICIAN_SERVICE_OPTIONS[input.serviceKey];
  return {
    type: 'technician' as const,
    role: choice.role,
    skills: [choice.skill],
    full_name: input.account.full_name!.trim(),
    phone: input.account.phone || '',
    city: input.account.city!.trim(),
    experience_years: input.experienceYears,
    working_area: input.workingArea.trim(),
    working_pincode: input.workingPincode,
    requested_radius_km: choice.radiusKm,
    work_description: input.workDescription.trim(),
    application_source: 'existing_technician_service_approval' as const,
  };
}
