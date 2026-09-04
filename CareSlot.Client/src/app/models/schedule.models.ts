export interface Doctor {
  id: string;
  name: string;
  specialty: string;
}

export type SlotStatusType = 'Available' | 'Held' | 'Booked';

export interface Slot {
  id: string;
  doctorId: string;
  startTime: string; // ISO string from API
  endTime: string;   // ISO string from API
  status: SlotStatusType;
  rowVersion: string; // Base64 concurrency token
  heldBy?: string | null;
  patientName?: string | null;
}

export interface HoldSlotRequest {
  connectionId: string;
  rowVersion: string;
}

export interface BookSlotRequest {
  patientName: string;
  nationalId: string;
  clinicalNotes: string;
  rowVersion: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceName: string;
  resourceId: string;
  ipAddress: string;
  timestampUtc: string;
}

