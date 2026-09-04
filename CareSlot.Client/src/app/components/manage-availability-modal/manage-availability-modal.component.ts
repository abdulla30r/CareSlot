import { Component, EventEmitter, Input, Output, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Doctor } from '../../models/schedule.models';
import { SchedulingService } from '../../services/scheduling.service';

@Component({
  selector: 'app-manage-availability-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        <!-- Header -->
        <div class="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
          <div class="flex items-center gap-3">
            <span class="p-2 rounded-xl bg-emerald-600 text-white text-base">📅</span>
            <div>
              <h3 class="text-base font-bold">Manage Clinician Availability</h3>
              <p class="text-xs text-slate-400 mt-0.5">
                {{ doctor?.name }} &bull; {{ doctor?.specialty }}
              </p>
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

        <!-- Mode Toggle Tabs -->
        <div class="px-6 pt-4 pb-0 bg-white shrink-0">
          <div class="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button 
              type="button" 
              (click)="activeTab.set('generate')"
              [class]="activeTab() === 'generate' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
              class="flex-1 py-1.5 text-xs rounded-lg transition-all text-center cursor-pointer"
            >
              Set Shift & Generate Slots
            </button>
            <button 
              type="button" 
              (click)="activeTab.set('clear')"
              [class]="activeTab() === 'clear' ? 'bg-white text-rose-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
              class="flex-1 py-1.5 text-xs rounded-lg transition-all text-center cursor-pointer"
            >
              Time Off / Clear Slots
            </button>
          </div>
        </div>

        <!-- Alert messages -->
        <div *ngIf="errorMessage()" class="mx-6 mt-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 flex items-center gap-2 shrink-0">
          <svg class="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ errorMessage() }}</span>
        </div>

        <div *ngIf="successMessage()" class="mx-6 mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl p-3 flex items-center gap-2 shrink-0">
          <svg class="w-4 h-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{{ successMessage() }}</span>
        </div>

        <!-- Tab 1: Generate Availability Slots -->
        <div *ngIf="activeTab() === 'generate'" class="p-6 overflow-y-auto space-y-4 flex-1">
          <form [formGroup]="generateForm" (ngSubmit)="onGenerateSubmit()" class="space-y-4">
            
            <!-- Date Range -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  From Date *
                </label>
                <input 
                  type="date" 
                  formControlName="startDate"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 bg-white"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  To Date *
                </label>
                <input 
                  type="date" 
                  formControlName="endDate"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 bg-white"
                />
              </div>
            </div>

            <!-- Shift Hours -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Daily Shift Start *
                </label>
                <input 
                  type="time" 
                  formControlName="dailyStartTime"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 bg-white"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Daily Shift End *
                </label>
                <input 
                  type="time" 
                  formControlName="dailyEndTime"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 bg-white"
                />
              </div>
            </div>

            <!-- Slot Duration -->
            <div>
              <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Consultation Duration per Slot
              </label>
              <div class="grid grid-cols-4 gap-2">
                <button 
                  *ngFor="let d of [15, 30, 45, 60]" 
                  type="button"
                  (click)="generateForm.patchValue({ slotDurationMinutes: d })"
                  [class]="generateForm.get('slotDurationMinutes')?.value === d 
                    ? 'bg-emerald-600 text-white font-bold shadow-sm ring-2 ring-emerald-400' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'"
                  class="py-2 text-xs rounded-xl border border-slate-200 transition-all text-center cursor-pointer"
                >
                  {{ d }} mins
                </button>
              </div>
            </div>

            <!-- Skip Weekends Checkbox -->
            <div class="flex items-center gap-2 pt-1">
              <input 
                type="checkbox" 
                id="skipWeekends" 
                formControlName="skipWeekends"
                class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
              />
              <label for="skipWeekends" class="text-xs text-slate-700 font-medium cursor-pointer">
                Skip weekends (Monday through Friday only)
              </label>
            </div>

            <div class="pt-2">
              <button 
                type="submit" 
                [disabled]="generateForm.invalid || isLoading()"
                class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                <span *ngIf="isLoading()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>{{ isLoading() ? 'Publishing Availability...' : 'Publish Working Hours & Slots' }}</span>
              </button>
            </div>
          </form>
        </div>

        <!-- Tab 2: Clear Unbooked Slots (Time Off) -->
        <div *ngIf="activeTab() === 'clear'" class="p-6 overflow-y-auto space-y-4 flex-1">
          <div class="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
            <span class="text-amber-600 text-base">⚠️</span>
            <div class="text-xs text-amber-900 leading-relaxed">
              <strong class="font-bold">Clinical Protection Rule:</strong> Only open, unbooked slots will be cleared. Any existing patient bookings will remain strictly safe and intact.
            </div>
          </div>

          <form [formGroup]="clearForm" (ngSubmit)="onClearSubmit()" class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Start Date *
                </label>
                <input 
                  type="date" 
                  formControlName="startDate"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 bg-white"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  End Date *
                </label>
                <input 
                  type="date" 
                  formControlName="endDate"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 bg-white"
                />
              </div>
            </div>

            <div class="pt-2">
              <button 
                type="submit" 
                [disabled]="clearForm.invalid || isLoading()"
                class="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                <span *ngIf="isLoading()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>{{ isLoading() ? 'Clearing Slots...' : 'Clear Open Slots (Time Off)' }}</span>
              </button>
            </div>
          </form>
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
export class ManageAvailabilityModalComponent implements OnInit {
  @Input() doctor: Doctor | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() availabilityChanged = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private schedulingService = inject(SchedulingService);

  public activeTab = signal<'generate' | 'clear'>('generate');
  public isLoading = signal<boolean>(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  public generateForm!: FormGroup;
  public clearForm!: FormGroup;

  ngOnInit(): void {
    const today = new Date();
    const nextWeek = new Date(Date.now() + 86400000 * 7);

    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    this.generateForm = this.fb.group({
      startDate: [todayStr, [Validators.required]],
      endDate: [nextWeekStr, [Validators.required]],
      dailyStartTime: ['09:00', [Validators.required]],
      dailyEndTime: ['17:00', [Validators.required]],
      slotDurationMinutes: [30, [Validators.required]],
      skipWeekends: [true]
    });

    this.clearForm = this.fb.group({
      startDate: [todayStr, [Validators.required]],
      endDate: [nextWeekStr, [Validators.required]]
    });
  }

  public onGenerateSubmit(): void {
    if (!this.doctor || this.generateForm.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const val = this.generateForm.value;
    const payload = {
      startDate: val.startDate,
      endDate: val.endDate,
      dailyStartTime: val.dailyStartTime.length === 5 ? `${val.dailyStartTime}:00` : val.dailyStartTime,
      dailyEndTime: val.dailyEndTime.length === 5 ? `${val.dailyEndTime}:00` : val.dailyEndTime,
      slotDurationMinutes: Number(val.slotDurationMinutes),
      skipWeekends: !!val.skipWeekends
    };

    this.schedulingService.configureAvailability(this.doctor.id, payload).subscribe({
      next: (slots) => {
        this.isLoading.set(false);
        this.successMessage.set(`Successfully published availability (${slots.length} total slots in range).`);
        this.availabilityChanged.emit();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to configure availability.');
      }
    });
  }

  public onClearSubmit(): void {
    if (!this.doctor || this.clearForm.invalid || this.isLoading()) return;

    if (!confirm(`Are you sure you want to clear unbooked slots between ${this.clearForm.value.startDate} and ${this.clearForm.value.endDate}? Booked appointments will remain safe.`)) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const val = this.clearForm.value;
    const startIso = new Date(`${val.startDate}T00:00:00Z`).toISOString();
    const endIso = new Date(`${val.endDate}T23:59:59Z`).toISOString();

    this.schedulingService.clearUnbookedSlots(this.doctor.id, startIso, endIso).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.successMessage.set(`Successfully cleared ${res.clearedSlotsCount} unbooked slots.`);
        this.availabilityChanged.emit();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to clear unbooked slots.');
      }
    });
  }

  public onClose(): void {
    this.close.emit();
  }
}

