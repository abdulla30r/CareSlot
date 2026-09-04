import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Doctor, Slot, HoldSlotRequest, BookSlotRequest, AuditLog, AppointmentDetails } from '../models/schedule.models';
import { SignalRService } from './signalr.service';

@Injectable({
  providedIn: 'root'
})
export class SchedulingService {
  private http = inject(HttpClient);
  private signalR = inject(SignalRService);

  /**
   * Fetches all doctors for the clinician selector.
   */
  public getDoctors(): Observable<Doctor[]> {
    return this.http.get<Doctor[]>('/api/doctors');
  }

  /**
   * Fetches the weekly slots for a specific doctor.
   */
  public getSlots(doctorId: string, startDate?: string, endDate?: string): Observable<Slot[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);

    return this.http.get<Slot[]>(`/api/doctors/${doctorId}/slots`, { params });
  }

  /**
   * Generates Monday-Friday 30-minute demo slots for a doctor.
   */
  public generateWeeklySlots(doctorId: string, weekStartDate?: string): Observable<Slot[]> {
    let params = new HttpParams();
    if (weekStartDate) params = params.set('weekStartDate', weekStartDate);

    return this.http.post<Slot[]>(`/api/doctors/${doctorId}/slots/generate`, {}, { params });
  }

  /**
   * Holds an available slot for 2 minutes while filling the booking form.
   * Sends the caller's unique SignalR connectionId and the slot's rowVersion.
   */
  public holdSlot(slotId: string, rowVersion: string): Observable<Slot> {
    const payload: HoldSlotRequest = {
      connectionId: this.signalR.connectionId(),
      rowVersion: rowVersion
    };

    return this.http.post<Slot>(`/api/slots/${slotId}/hold`, payload);
  }

  /**
   * Releases a held slot back to Available (e.g. if the user cancels the form).
   */
  public releaseSlot(slotId: string): Observable<Slot> {
    const params = new HttpParams().set('connectionId', this.signalR.connectionId());
    return this.http.post<Slot>(`/api/slots/${slotId}/release`, {}, { params });
  }

  /**
   * Confirms the booking. Transmits patient details to be encrypted at rest by EF Core.
   */
  public bookSlot(slotId: string, request: BookSlotRequest): Observable<Slot> {
    return this.http.post<Slot>(`/api/slots/${slotId}/book`, request);
  }

  /**
   * Fetches the immutable HIPAA audit trail.
   */
  public getAuditLogs(limit = 50): Observable<AuditLog[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<AuditLog[]>('/api/audit-logs', { params });
  }

  /**
   * Fetches the confidential clinical dossier (Doctor & Admin only).
   */
  public getSlotDetails(slotId: string): Observable<AppointmentDetails> {
    return this.http.get<AppointmentDetails>(`/api/slots/${slotId}/details`);
  }
}

