import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Doctor } from '../../models/schedule.models';
import { SchedulingService } from '../../services/scheduling.service';

@Component({
  selector: 'app-manage-doctors-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        <!-- Header -->
        <div class="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
          <div class="flex items-center gap-3">
            <span class="p-2 rounded-xl bg-blue-600 text-white text-base">👨‍⚕️</span>
            <div>
              <h3 class="text-base font-bold">Manage Clinic Doctors</h3>
              <p class="text-xs text-slate-400 mt-0.5">Admin oversight: add, update, and manage attending medical staff</p>
            </div>
          </div>
          <button 
            type="button" 
            (click)="onClose()"
            class="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Alert messages -->
        <div *ngIf="errorMessage()" class="m-4 mb-0 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 flex items-center gap-2 shrink-0">
          <svg class="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ errorMessage() }}</span>
        </div>

        <div *ngIf="successMessage()" class="m-4 mb-0 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl p-3 flex items-center gap-2 shrink-0">
          <svg class="w-4 h-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{{ successMessage() }}</span>
        </div>

        <!-- Content Area: Form & Doctor List -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1">
          
          <!-- Form Card: Add or Edit Doctor -->
          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700">
                {{ editingDoctorId() ? 'Edit Clinician Details' : 'Add New Clinician' }}
              </h4>
              <button 
                *ngIf="editingDoctorId()" 
                type="button" 
                (click)="cancelEdit()"
                class="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Cancel Edit
              </button>
            </div>

            <form [formGroup]="doctorForm" (ngSubmit)="onFormSubmit()" class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Doctor Full Name *
                  </label>
                  <input 
                    type="text" 
                    formControlName="name"
                    placeholder="e.g. Dr. Alexander Fleming"
                    class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900 bg-white"
                  />
                  <p *ngIf="doctorForm.get('name')?.invalid && doctorForm.get('name')?.touched" class="text-[10px] text-rose-600 mt-0.5">
                    Name is required.
                  </p>
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Medical Specialty *
                  </label>
                  <input 
                    type="text" 
                    formControlName="specialty"
                    placeholder="e.g. Cardiology, Neurology, Pediatrics"
                    class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900 bg-white"
                  />
                  <p *ngIf="doctorForm.get('specialty')?.invalid && doctorForm.get('specialty')?.touched" class="text-[10px] text-rose-600 mt-0.5">
                    Specialty is required.
                  </p>
                </div>
              </div>

              <!-- Quick Specialty Tags -->
              <div class="flex flex-wrap items-center gap-1.5 pt-1">
                <span class="text-[10px] text-slate-400 font-medium">Quick suggestions:</span>
                <button 
                  *ngFor="let s of commonSpecialties" 
                  type="button"
                  (click)="setSpecialty(s)"
                  class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all cursor-pointer"
                >
                  {{ s }}
                </button>
              </div>

              <div class="pt-2 flex justify-end">
                <button 
                  type="submit" 
                  [disabled]="doctorForm.invalid || isSaving()"
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  <span *ngIf="isSaving()" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{{ editingDoctorId() ? 'Update Clinician' : 'Add Clinician' }}</span>
                </button>
              </div>
            </form>
          </div>

          <!-- Doctor List -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700">
                Active Clinicians ({{ doctors.length }})
              </h4>
            </div>

            <div class="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div *ngFor="let doc of doctors" class="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div class="flex items-center gap-3">
                  <span class="w-9 h-9 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold flex items-center justify-center shrink-0">
                    {{ getInitials(doc.name) }}
                  </span>
                  <div>
                    <h5 class="text-xs font-bold text-slate-900">{{ doc.name }}</h5>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 mt-0.5">
                      {{ doc.specialty }}
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5">
                  <button 
                    type="button" 
                    (click)="startEdit(doc)"
                    class="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button 
                    type="button" 
                    (click)="deleteDoctor(doc)"
                    [disabled]="isDeletingId() === doc.id"
                    class="px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200 cursor-pointer disabled:opacity-50"
                  >
                    <span *ngIf="isDeletingId() === doc.id">...</span>
                    <span *ngIf="isDeletingId() !== doc.id">Delete</span>
                  </button>
                </div>
              </div>

              <div *ngIf="doctors.length === 0" class="p-6 text-center text-xs text-slate-400">
                No clinicians found. Use the form above to add one.
              </div>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button 
            type="button" 
            (click)="onClose()"
            class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  `
})
export class ManageDoctorsModalComponent {
  @Input() doctors: Doctor[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() doctorsChanged = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private schedulingService = inject(SchedulingService);

  public commonSpecialties = ['Cardiology', 'Neurology', 'Pediatrics', 'General Medicine', 'Dermatology', 'Orthopedics', 'Psychiatry'];

  public isSaving = signal<boolean>(false);
  public isDeletingId = signal<string | null>(null);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);
  public editingDoctorId = signal<string | null>(null);

  public doctorForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    specialty: ['', [Validators.required, Validators.minLength(2)]]
  });

  public setSpecialty(s: string): void {
    this.doctorForm.patchValue({ specialty: s });
  }

  public getInitials(name: string): string {
    const parts = name.replace(/^Dr\.\s*/i, '').trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  public startEdit(doc: Doctor): void {
    this.editingDoctorId.set(doc.id);
    this.doctorForm.setValue({
      name: doc.name,
      specialty: doc.specialty
    });
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  public cancelEdit(): void {
    this.editingDoctorId.set(null);
    this.doctorForm.reset();
  }

  public onFormSubmit(): void {
    if (this.doctorForm.invalid || this.isSaving()) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { name, specialty } = this.doctorForm.value;
    const editingId = this.editingDoctorId();

    if (editingId) {
      // Update
      this.schedulingService.updateDoctor(editingId, { name, specialty }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.successMessage.set(`Clinician '${name}' updated successfully.`);
          this.cancelEdit();
          this.doctorsChanged.emit();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(err.error?.message || 'Failed to update clinician.');
        }
      });
    } else {
      // Create
      this.schedulingService.createDoctor({ name, specialty }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.successMessage.set(`Clinician '${name}' added successfully.`);
          this.doctorForm.reset();
          this.doctorsChanged.emit();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(err.error?.message || 'Failed to add clinician.');
        }
      });
    }
  }

  public deleteDoctor(doc: Doctor): void {
    if (!confirm(`Are you sure you want to remove ${doc.name}? Active booked appointments cannot be deleted.`)) {
      return;
    }

    this.isDeletingId.set(doc.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.schedulingService.deleteDoctor(doc.id).subscribe({
      next: () => {
        this.isDeletingId.set(null);
        this.successMessage.set(`Clinician '${doc.name}' removed successfully.`);
        if (this.editingDoctorId() === doc.id) {
          this.cancelEdit();
        }
        this.doctorsChanged.emit();
      },
      error: (err) => {
        this.isDeletingId.set(null);
        this.errorMessage.set(err.error?.message || 'Failed to remove clinician.');
      }
    });
  }

  public onClose(): void {
    this.close.emit();
  }
}

