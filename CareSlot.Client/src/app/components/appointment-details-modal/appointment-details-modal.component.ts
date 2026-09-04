import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppointmentDetails } from '../../models/schedule.models';

@Component({
  selector: 'app-appointment-details-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        <!-- Header -->
        <div class="bg-slate-900 text-white p-5 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <span class="p-2 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <div>
              <h3 class="text-base font-bold">Clinical Patient Dossier</h3>
              <p class="text-xs text-slate-400">Doctor & Admin Medical Record Inspection</p>
            </div>
          </div>
          <button 
            (click)="close.emit()"
            class="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- HIPAA Security Notification -->
        <div class="bg-indigo-50 border-b border-indigo-100 p-3.5 flex items-center gap-3 text-xs text-indigo-900">
          <svg class="w-5 h-5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <span class="font-bold">HIPAA Audit Recorded:</span> This medical consultation record was decrypted on demand. This access event has been permanently appended to the immutable audit trail.
          </div>
        </div>

        <!-- Content Body -->
        <div *ngIf="details" class="p-6 space-y-4">
          <!-- Patient Name & Doctor -->
          <div class="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
            <div>
              <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient Name</span>
              <span class="text-base font-bold text-slate-900">{{ details.patientName }}</span>
            </div>
            <div>
              <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attending Clinician</span>
              <span class="text-sm font-semibold text-slate-800">{{ details.doctorName }}</span>
            </div>
          </div>

          <!-- Appointment Time & National ID -->
          <div class="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
            <div>
              <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Appointment Time</span>
              <span class="text-xs font-semibold text-slate-700">
                {{ details.startTime | date:'EEEE, MMM d, y' }}<br>
                <span class="text-blue-600 font-bold">{{ details.startTime | date:'shortTime' }} - {{ details.endTime | date:'shortTime' }}</span>
              </span>
            </div>
            <div>
              <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient National ID (Decrypted)</span>
              <span class="inline-block mt-0.5 px-2.5 py-1 bg-slate-100 font-mono text-xs font-bold text-slate-800 rounded-md border border-slate-200">
                {{ details.nationalId }}
              </span>
            </div>
          </div>

          <!-- Clinical Diagnosis & Chief Complaint -->
          <div>
            <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Clinical Diagnosis / Chief Complaint (Decrypted)
            </span>
            <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-mono whitespace-pre-wrap">
              {{ details.clinicalNotes }}
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="!details" class="p-12 flex flex-col items-center justify-center text-slate-400">
          <div class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p class="text-xs font-medium">Decrypting clinical PHI record from SQL Server...</p>
        </div>

        <!-- Footer -->
        <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <button 
            (click)="close.emit()"
            class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  `
})
export class AppointmentDetailsModalComponent {
  @Input() details: AppointmentDetails | null = null;
  @Output() close = new EventEmitter<void>();
}
