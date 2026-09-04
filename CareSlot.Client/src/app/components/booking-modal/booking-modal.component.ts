import { Component, EventEmitter, Input, Output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Slot, BookSlotRequest } from '../../models/schedule.models';

@Component({
  selector: 'app-booking-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        <!-- Modal Header -->
        <div class="bg-slate-900 text-white p-5 flex justify-between items-center">
          <div>
            <h3 class="text-lg font-bold">Book Clinical Appointment</h3>
            <p class="text-xs text-slate-400 mt-0.5">
              {{ slot.startTime | date:'EEEE, MMM d, y' }} &bull; 
              {{ slot.startTime | date:'shortTime' }} - {{ slot.endTime | date:'shortTime' }}
            </p>
          </div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Slot Held
          </span>
        </div>

        <!-- HIPAA Security Banner -->
        <div class="bg-emerald-50 border-b border-emerald-100 p-3.5 flex items-center gap-3 text-xs text-emerald-800">
          <svg class="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div>
            <span class="font-bold">HIPAA Security Protected:</span> Patient National ID and Clinical Notes are encrypted at rest using AES-256 with per-record IVs.
          </div>
        </div>

        <!-- Booking Form -->
        <form [formGroup]="bookingForm" (ngSubmit)="onSubmit()" class="p-6 space-y-4">
          <!-- Patient Name -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Patient Full Name *
            </label>
            <input 
              type="text" 
              formControlName="patientName"
              placeholder="e.g. John Doe"
              class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p *ngIf="bookingForm.get('patientName')?.invalid && bookingForm.get('patientName')?.touched" class="text-xs text-rose-600 mt-1">
              Patient name is required.
            </p>
          </div>

          <!-- National ID (Encrypted) -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>National ID / SSN *</span>
              <span class="text-[10px] text-emerald-600 font-medium">🔒 Encrypted at rest</span>
            </label>
            <input 
              type="text" 
              formControlName="nationalId"
              placeholder="e.g. NID-987654321"
              class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p *ngIf="bookingForm.get('nationalId')?.invalid && bookingForm.get('nationalId')?.touched" class="text-xs text-rose-600 mt-1">
              National ID is required for clinical audit compliance.
            </p>
          </div>

          <!-- Clinical Notes (Encrypted) -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Clinical Symptoms / Notes *</span>
              <span class="text-[10px] text-emerald-600 font-medium">🔒 Encrypted at rest</span>
            </label>
            <textarea 
              formControlName="clinicalNotes"
              rows="3"
              placeholder="Reason for visit, symptoms, or clinician notes..."
              class="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            ></textarea>
            <p *ngIf="bookingForm.get('clinicalNotes')?.invalid && bookingForm.get('clinicalNotes')?.touched" class="text-xs text-rose-600 mt-1">
              Clinical notes are required.
            </p>
          </div>

          <!-- Error Alert (e.g. Concurrency Collision) -->
          <div *ngIf="errorMessage" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg p-3">
            {{ errorMessage }}
          </div>

          <!-- Actions -->
          <div class="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button 
              type="button" 
              (click)="onCancel()"
              [disabled]="isSubmitting"
              class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel & Release
            </button>
            <button 
              type="submit" 
              [disabled]="bookingForm.invalid || isSubmitting"
              class="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span *ngIf="isSubmitting" class="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Confirm Appointment
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class BookingModalComponent implements OnInit {
  private fb = inject(FormBuilder);

  @Input({ required: true }) slot!: Slot;
  @Input() defaultPatientName?: string;
  @Input() errorMessage: string | null = null;
  @Input() isSubmitting = false;

  @Output() book = new EventEmitter<BookSlotRequest>();
  @Output() cancel = new EventEmitter<void>();

  public bookingForm: FormGroup = this.fb.group({
    patientName: ['', [Validators.required, Validators.minLength(2)]],
    nationalId: ['', [Validators.required, Validators.minLength(4)]],
    clinicalNotes: ['', [Validators.required, Validators.minLength(5)]]
  });

  ngOnInit(): void {
    if (this.defaultPatientName) {
      this.bookingForm.patchValue({ patientName: this.defaultPatientName });
    }
  }

  public onSubmit(): void {
    if (this.bookingForm.invalid || this.isSubmitting) return;

    const formValues = this.bookingForm.value;
    const request: BookSlotRequest = {
      patientName: formValues.patientName,
      nationalId: formValues.nationalId,
      clinicalNotes: formValues.clinicalNotes,
      rowVersion: this.slot.rowVersion
    };

    this.book.emit(request);
  }

  public onCancel(): void {
    this.cancel.emit();
  }
}

