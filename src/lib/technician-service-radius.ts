export const TECHNICIAN_RADIUS_DEFAULTS: Record<string,number> = {
  plumbing:15,ro_service:15,motor_pump:15,borewell:50,tank_cleaning:50,
};
export function technicianRadius(service:string, saved?:number|null):number {
  const fallback=TECHNICIAN_RADIUS_DEFAULTS[service] ?? 15;
  const value=Number(saved);
  return saved!=null && Number.isInteger(value) && value>=1 && value<=75 ? value : fallback;
}
export const TECHNICIAN_RADIUS_MAX:Record<string,number>={
  plumbing:50,ro_service:50,motor_pump:50,borewell:75,tank_cleaning:75,
};
