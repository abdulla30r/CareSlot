import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Doctor, Slot, BookSlotRequest } from '../../models/schedule.models';
import { SchedulingService } from '../../services/scheduling.service';
import { SignalRService } from '../../services/signalr.service';
import { BookingModalComponent } from '../booking-modal/booking-modal.component';
import { AuditDrawerComponent } from '../audit-drawer/audit-drawer.component';
import { AuthService } from '../../services/auth.service';

interface DayGroup {
  date: Date;
  slots: Slot[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, BookingModalComponent, AuditDrawerComponent],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Top Navigation Bar -->
      <header class="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div class="flex items-center gap-3">
            <span class="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <h1 class="text-2xl font-bold text-slate-900 tracking-tight">CareSlot Clinical Portal</h1>
              <p class="text-xs text-slate-500 font-medium">HIPAA-Aware Real-Time Slot Booking & Concurrency System</p>
            </div>
          </div>
        </div>

        <!-- Real-Time SignalR Connection Status & Audit Log Button -->
        <div class="flex items-center gap-3">
          <!-- Audit Trail visible ONLY to Admin -->
          <button 
            *ngIf="auth.canViewAuditLogs()"
            (click)="isAuditDrawerOpen.set(true)"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all"
          >
            <span>🛡️</span>
            <span>HIPAA Audit Trail (Admin)</span>
          </button>

          <div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
               [ngClass]="signalR.isConnected() ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'">
            <span class="relative flex h-2 w-2">
              <span *ngIf="signalR.isConnected()" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2" [ngClass]="signalR.isConnected() ? 'bg-emerald-500' : 'bg-rose-500'"></span>
            </span>
            <span>{{ signalR.isConnected() ? 'Real-Time Sync Active' : 'Connecting to Server...' }}</span>
          </div>
        </div>
      </header>

      <!-- RBAC Persona Quick-Switcher Banner -->
      <div class="mb-6 bg-slate-900 text-white p-4 rounded-2xl shadow-lg border border-slate-800">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Active Role & Persona:</span>
              <span class="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">
                {{ auth.currentPersona()?.role || 'Guest' }}
              </span>
            </div>
            <p class="text-[11px] text-slate-400 mt-1">
              {{ auth.currentPersona()?.description }}
            </p>
          </div>

          <!-- 4 Roles: Customer, Receptionist, Doctor, Admin -->
          <div class="flex flex-wrap items-center gap-2">
            <button 
              *ngFor="let p of auth.personas()" 
              (click)="auth.switchPersona(p.id)"
              [ngClass]="auth.currentPersona()?.id === p.id 
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400 font-bold' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium'"
              class="px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5"
            >
              <span class="w-5 h-5 rounded-full bg-black/30 flex items-center justify-center text-[10px] font-bold">
                {{ p.avatarInitials }}
              </span>
              <span>{{ p.name }} ({{ p.role }})</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Doctor Selection Tabs -->
      <div class="mb-8 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 py-1 mb-1">Select Clinician:</div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button 
            *ngFor="let doc of doctors()" 
            (click)="selectDoctor(doc)"
            [ngClass]="selectedDoctor()?.id === doc.id 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
              : 'text-slate-700 hover:bg-slate-100'"
            class="px-4 py-3 rounded-xl text-left transition-all flex flex-col justify-center"
          >
            <span class="font-bold text-sm">{{ doc.name }}</span>
            <span class="text-xs opacity-80">{{ doc.specialty }}</span>
          </button>
        </div>
      </div>

      <!-- Main Schedule Area -->
      <main *ngIf="selectedDoctor() as doctor">
        <!-- Calendar Action Header -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-lg font-bold text-slate-800">Weekly Schedule — {{ doctor.name }}</h2>
            <p class="text-xs text-slate-500">Slots are locked for 2 minutes upon selection to prevent double-booking.</p>
          </div>

          <!-- Helper: Generate slots if empty (Doctor & Admin only) -->
          <div *ngIf="slots().length === 0 && !isLoading() && auth.canGenerateSlots()" class="flex items-center gap-2">
            <button 
              (click)="generateSlots()"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Populate Demo Slots for this Week
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading()" class="py-20 flex flex-col items-center justify-center text-slate-400">
          <div class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p class="text-xs font-medium">Loading clinical schedule...</p>
        </div>

        <!-- 5-Day Weekly Grid (Monday to Friday) -->
        <div *ngIf="!isLoading()" class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div *ngFor="let day of groupedDays()" class="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 flex flex-col">
            <!-- Day Header -->
            <div class="text-center pb-3 mb-3 border-b border-slate-100">
              <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                {{ day.date | date:'EEE' }}
              </span>
              <span class="text-sm font-extrabold text-slate-800">
                {{ day.date | date:'MMM d' }}
              </span>
            </div>

            <!-- Day Slots List -->
            <div class="space-y-2.5 flex-1">
              <div *ngIf="day.slots.length === 0" class="text-center py-6 text-xs text-slate-400 italic">
                No slots
              </div>

              <!-- Individual Slot Card -->
              <div 
                *ngFor="let slot of day.slots"
                (click)="onSlotClick(slot)"
                [ngClass]="getSlotCardClasses(slot)"
                class="p-3 rounded-xl border text-left transition-all select-none"
              >
                <!-- Time Range -->
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-bold font-mono">
                    {{ slot.startTime | date:'shortTime' }}
                  </span>
                  <!-- Status Pill -->
                  <span [ngClass]="getSlotBadgeClasses(slot)" class="text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {{ getSlotStatusLabel(slot) }}
                  </span>
                </div>

                <!-- Footer / Patient Info -->
                <div class="text-[11px] truncate">
                  <ng-container [ngSwitch]="slot.status">
                    <span *ngSwitchCase="'Available'" class="text-emerald-700 font-medium">Click to hold</span>
                    <span *ngSwitchCase="'Held'" class="text-amber-800 font-medium flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                      {{ isHeldByMe(slot) ? 'Held by you' : 'In progress...' }}
                    </span>
                    <span *ngSwitchCase="'Booked'" class="text-slate-500 font-medium">
                      {{ slot.patientName ? 'Patient: ' + slot.patientName : 'Reserved' }}
                    </span>
                  </ng-container>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Booking Dialog Modal -->
      <app-booking-modal 
        *ngIf="activeHoldingSlot() as currentSlot"
        [slot]="currentSlot"
        [errorMessage]="bookingError()"
        [isSubmitting]="isBookingSubmitting()"
        (book)="confirmBooking($event)"
        (cancel)="cancelHold()"
      ></app-booking-modal>

      <!-- HIPAA Audit Log Drawer -->
      <app-audit-drawer 
        *ngIf="isAuditDrawerOpen()"
        (close)="isAuditDrawerOpen.set(false)"
      ></app-audit-drawer>
    </div>
  `
})
export class CalendarComponent implements OnInit, OnDestroy {
  public schedulingService = inject(SchedulingService);
  public signalR = inject(SignalRService);
  public auth = inject(AuthService);

  public doctors = signal<Doctor[]>([]);
  public selectedDoctor = signal<Doctor | null>(null);
  public slots = signal<Slot[]>([]);
  public isLoading = signal<boolean>(false);

  public activeHoldingSlot = signal<Slot | null>(null);
  public bookingError = signal<string | null>(null);
  public isBookingSubmitting = signal<boolean>(false);
  public isAuditDrawerOpen = signal<boolean>(false);

  private signalRSub?: Subscription;

  async ngOnInit(): Promise<void> {
    // 1. Connect SignalR WebSocket
    await this.signalR.startConnection();

    // 2. Listen for real-time slot broadcasts (SlotHeld, SlotReleased, SlotBooked)
    this.signalRSub = this.signalR.slotUpdated$.subscribe((updatedSlot: Slot) => {
      this.handleRealtimeSlotUpdate(updatedSlot);
    });

    // 3. Load Doctors list
    this.loadDoctors();
  }

  ngOnDestroy(): void {
    this.signalRSub?.unsubscribe();
  }

  public loadDoctors(): void {
    this.schedulingService.getDoctors().subscribe({
      next: (docs) => {
        this.doctors.set(docs);
        if (docs.length > 0 && !this.selectedDoctor()) {
          this.selectDoctor(docs[0]);
        }
      },
      error: (err) => console.error('Failed to load doctors:', err)
    });
  }

  public selectDoctor(doctor: Doctor): void {
    const previous = this.selectedDoctor();
    if (previous) {
      this.signalR.leaveDoctor(previous.id);
    }

    this.selectedDoctor.set(doctor);
    this.signalR.joinDoctor(doctor.id);
    this.loadSlots(doctor.id);
  }

  public loadSlots(doctorId: string): void {
    this.isLoading.set(true);
    this.schedulingService.getSlots(doctorId).subscribe({
      next: (slotList) => {
        this.slots.set(slotList);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load slots:', err);
        this.isLoading.set(false);
      }
    });
  }

  public generateSlots(): void {
    const doc = this.selectedDoctor();
    if (!doc) return;

    this.isLoading.set(true);
    this.schedulingService.generateWeeklySlots(doc.id).subscribe({
      next: (slotList) => {
        this.slots.set(slotList);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to generate slots:', err);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Groups slots into Monday through Friday columns.
   */
  public groupedDays(): DayGroup[] {
    const allSlots = this.slots();
    const map = new Map<string, Slot[]>();

    for (const slot of allSlots) {
      const dateKey = slot.startTime.substring(0, 10); // YYYY-MM-DD
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(slot);
    }

    const groups: DayGroup[] = [];
    map.forEach((daySlots, key) => {
      groups.push({
        date: new Date(key + 'T00:00:00Z'),
        slots: daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime))
      });
    });

    return groups.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * User clicks a slot:
   * - If Available: Locks the slot (holds for 2 min) and opens modal.
   * - If Held by this user: Reopens the modal.
   */
  public onSlotClick(slot: Slot): void {
    if (slot.status === 'Booked') return;

    // RBAC: Only Customer, Receptionist, and Admin can hold/book
    if (!this.auth.canBook()) {
      alert(`The '${this.auth.role()}' role is in read-only schedule view. Switch persona to Customer or Receptionist to hold and book appointments.`);
      return;
    }

    // If held by another user, cannot interact
    if (slot.status === 'Held' && !this.isHeldByMe(slot)) return;

    // If already held by me, open modal directly
    if (slot.status === 'Held' && this.isHeldByMe(slot)) {
      this.bookingError.set(null);
      this.activeHoldingSlot.set(slot);
      return;
    }

    // Call API to hold slot
    this.schedulingService.holdSlot(slot.id, slot.rowVersion).subscribe({
      next: (heldSlot) => {
        this.updateLocalSlot(heldSlot);
        this.bookingError.set(null);
        this.activeHoldingSlot.set(heldSlot);
      },
      error: (err) => {
        const msg = err.error?.message || 'Could not hold slot. Please refresh.';
        alert(msg);
      }
    });
  }

  public confirmBooking(request: BookSlotRequest): void {
    const current = this.activeHoldingSlot();
    if (!current) return;

    this.isBookingSubmitting.set(true);
    this.bookingError.set(null);

    this.schedulingService.bookSlot(current.id, request).subscribe({
      next: (bookedSlot) => {
        this.updateLocalSlot(bookedSlot);
        this.isBookingSubmitting.set(false);
        this.activeHoldingSlot.set(null);
      },
      error: (err) => {
        this.isBookingSubmitting.set(false);
        this.bookingError.set(err.error?.message || 'Booking failed. Another user may have modified this slot.');
      }
    });
  }

  public cancelHold(): void {
    const current = this.activeHoldingSlot();
    if (!current) return;

    const slotId = current.id;
    this.activeHoldingSlot.set(null);

    this.schedulingService.releaseSlot(slotId).subscribe({
      next: (releasedSlot) => {
        this.updateLocalSlot(releasedSlot);
      },
      error: (err) => console.error('Failed to release slot:', err)
    });
  }

  private handleRealtimeSlotUpdate(updatedSlot: Slot): void {
    this.updateLocalSlot(updatedSlot);

    // If the slot currently open in the modal was booked or taken by someone else:
    const current = this.activeHoldingSlot();
    if (current && current.id === updatedSlot.id) {
      if (updatedSlot.status === 'Booked' || (updatedSlot.status === 'Held' && !this.isHeldByMe(updatedSlot))) {
        this.bookingError.set('Alert: This slot was just booked or locked by another receptionist!');
      }
    }
  }

  private updateLocalSlot(slot: Slot): void {
    const list = [...this.slots()];
    const index = list.findIndex(s => s.id === slot.id);
    if (index !== -1) {
      list[index] = slot;
      this.slots.set(list);
    }
  }

  public isHeldByMe(slot: Slot): boolean {
    return slot.status === 'Held' && slot.heldBy === this.signalR.connectionId();
  }

  public getSlotStatusLabel(slot: Slot): string {
    if (slot.status === 'Available') return 'Available';
    if (slot.status === 'Held') return this.isHeldByMe(slot) ? 'Your Hold' : 'Held';
    return 'Booked';
  }

  public getSlotCardClasses(slot: Slot): string {
    switch (slot.status) {
      case 'Available':
        return 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200 text-emerald-900 cursor-pointer hover:shadow-md hover:border-emerald-300';
      case 'Held':
        return this.isHeldByMe(slot)
          ? 'bg-amber-50 border-amber-300 text-amber-900 cursor-pointer shadow-sm ring-2 ring-amber-400/50'
          : 'bg-amber-50/30 border-amber-200/60 text-amber-600/70 cursor-not-allowed opacity-75';
      case 'Booked':
        return 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed';
    }
  }

  public getSlotBadgeClasses(slot: Slot): string {
    switch (slot.status) {
      case 'Available':
        return 'bg-emerald-100 text-emerald-800';
      case 'Held':
        return this.isHeldByMe(slot) ? 'bg-amber-200 text-amber-900' : 'bg-amber-100 text-amber-700';
      case 'Booked':
        return 'bg-slate-200 text-slate-600';
    }
  }
}

