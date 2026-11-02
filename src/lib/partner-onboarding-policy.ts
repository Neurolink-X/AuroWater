/**
 * Registration policy shared by the applicant wizard, public validation and
 * admin review. A requested radius is NOT dispatch approval.
 * Only reviewed skills, city/zone and separately verified GPS govern jobs.
 */
export const PARTNER_ROLE_POLICY = {
  plumber: { skill: 'Plumbing', defaultRadiusKm: 15, maxRadiusKm: 50, label: 'Plumber' },
  borewell: { skill: 'Boring', defaultRadiusKm: 50, maxRadiusKm: 50, label: 'Borewell specialist' },
  tank: { skill: 'Maintenance', defaultRadiusKm: 50, maxRadiusKm: 50, label: 'Tank cleaning' },
  ro: { skill: 'RO Install', defaultRadiusKm: 15, maxRadiusKm: 50, label: 'RO technician' },
} as const;
export type TechnicianRegistrationRole = keyof typeof PARTNER_ROLE_POLICY;
export function isTechnicianRegistrationRole(input: string): input is TechnicianRegistrationRole {
  return Object.prototype.hasOwnProperty.call(PARTNER_ROLE_POLICY, input);
}
export function recommendedRadiusKm(role: TechnicianRegistrationRole): number {
  return PARTNER_ROLE_POLICY[role].defaultRadiusKm;
}
export function registrationRoleMatchesSkills(role: TechnicianRegistrationRole, skills: readonly string[]): boolean {
  return skills.includes(PARTNER_ROLE_POLICY[role].skill);
}
export const VERIFICATION_DOCUMENTS = ['aadhaar_front', 'aadhaar_back', 'skill_certificate'] as const;
