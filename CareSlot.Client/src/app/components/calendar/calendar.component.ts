import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Doctor, Slot, BookSlotRequest, AppointmentDetails } from '../../models/schedule.models';
import { SchedulingService } from '../../services/scheduling.service';
import { SignalRService } from '../../services/signalr.service';
import { BookingModalComponent } from '../booking-modal/booking-modal.component';
import { AuditDrawerComponent } from '../audit-drawer/audit-drawer.component';
import { AppointmentDetailsModalComponent } from '../appointment-details-modal/appointment-details-modal.component';
import { ManageDoctorsModalComponent } from '../manage-doctors-modal/manage-doctors-modal.component';
import { ManageAvailabilityModalComponent } from '../manage-availability-modal/manage-availability-modal.component';
import { AuthService } from '../../services/auth.service';

interface DayGroup {
  date: Date;
  slots: Slot[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule, 
    BookingModalComponent, 
    AuditDrawerComponent, 
    AppointmentDetailsModalComponent,
    ManageDoctorsModalComponent,
    ManageAvailabilityModalComponent
  ],
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
          <!-- Manage Doctors visible ONLY to Admin -->
          <button 
            *ngIf="auth.isAdmin()"
            (click)="isManageDoctorsOpen.set(true)"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
          >
            <span>👨‍⚕️</span>
            <span>Manage Doctors</span>
          </button>

          <!-- Audit Trail visible ONLY to Admin -->
          <button 
            *ngIf="auth.canViewAuditLogs()"
            (click)="isAuditDrawerOpen.set(true)"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all cursor-pointer"
          >
            <span>🛡️</span>
            <span>HIPAA Audit Trail</span>
          </button>

          <div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
               [ngClass]="signalR.isConnected() ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'">
            <span class="relative flex h-2 w-2">
              <span *ngIf="signalR.isConnected()" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2" [ngClass]="signalR.isConnected() ? 'bg-emerald-500' : 'bg-rose-500'"></span>
            </span>
            <span>{{ signalR.isConnected() ? 'Real-Time Sync Active' : 'Connecting to Server...' }}</span>
          </div>

          <!-- User Profile & Logout -->
          <div *ngIf="auth.currentPersona() as user" class="flex items-center gap-2 pl-3 border-l border-slate-200">
            <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs">
              <span class="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                {{ user.avatarInitials }}
              </span>
              <span class="font-bold text-slate-800 text-xs">{{ user.name }}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                    [ngClass]="{
                      'bg-purple-100 text-purple-800': user.role === 'Customer',
                      'bg-emerald-100 text-emerald-800': user.role === 'Doctor',
                      'bg-slate-900 text-white': user.role === 'Admin'
                    }">
                {{ user.role }}
              </span>
            </div>

            <button 
              (click)="auth.logout()"
              class="px-2.5 py-1.5 rounded-full text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="Sign Out"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <!-- ================================================================= -->
      <!-- 1. DOCTOR VIEW: My Appointments & Button to Manage Availability   -->
      <!-- ================================================================= -->
      <section *ngIf="auth.isDoctor()" class="space-y-6">
        <!-- Doctor Command Banner -->
        <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/50 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-3xl shadow-inner shrink-0">
              👨‍⚕️
            </div>
            <div>
              <div class="flex items-center gap-2 mb-1">
                <h2 class="text-2xl font-extrabold text-white tracking-tight">{{ selectedDoctor()?.name || auth.currentPersona()?.name }}</h2>
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Attending Clinician
                </span>
              </div>
              <p class="text-sm text-slate-300 flex items-center gap-2">
                <span>🩺 {{ selectedDoctor()?.specialty || 'Cardiology' }}</span>
                <span class="text-slate-500">•</span>
                <span class="text-emerald-400 font-medium">HIPAA Protected Records</span>
              </p>
            </div>
          </div>

          <!-- Button to Manage Availability -->
          <div class="flex items-center gap-3">
            <button 
              type="button"
              (click)="isManageAvailabilityOpen.set(true)"
              class="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span class="text-base">📅</span>
              <span>Manage Availability</span>
            </button>
          </div>
        </div>

        <!-- Summary Metric Cards for Doctor -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Booked Visits</span>
              <div class="text-2xl font-black text-slate-900 mt-1">{{ doctorAppointments().length }}</div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
              📋
            </div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Visits</span>
              <div class="text-2xl font-black text-emerald-600 mt-1">{{ todayAppointmentsCount() }}</div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
              🩺
            </div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming Visits</span>
              <div class="text-2xl font-black text-purple-600 mt-1">{{ upcomingAppointmentsCount() }}</div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
              ⏳
            </div>
          </div>
        </div>

        <!-- Appointments Section -->
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
            <div>
              <h3 class="text-lg font-bold text-slate-900">My Appointments</h3>
              <p class="text-xs text-slate-500 mt-0.5">Patient consultations and confidential clinical dossiers.</p>
            </div>

            <!-- Quick Filter -->
            <div class="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
              <button 
                type="button"
                (click)="doctorFilter.set('all')"
                [class]="doctorFilter() === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'"
                class="px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                All ({{ doctorAppointments().length }})
              </button>
              <button 
                type="button"
                (click)="doctorFilter.set('today')"
                [class]="doctorFilter() === 'today' ? 'bg-white text-emerald-700 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'"
                class="px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                Today ({{ todayAppointmentsCount() }})
              </button>
              <button 
                type="button"
                (click)="doctorFilter.set('upcoming')"
                [class]="doctorFilter() === 'upcoming' ? 'bg-white text-purple-700 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'"
                class="px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                Upcoming ({{ upcomingAppointmentsCount() }})
              </button>
            </div>
          </div>

          <!-- Loading State -->
          <div *ngIf="isLoading()" class="py-16 text-center text-slate-400">
            <div class="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p class="text-xs font-medium">Loading clinical appointments...</p>
          </div>

          <!-- Empty State -->
          <div *ngIf="!isLoading() && filteredDoctorAppointments().length === 0" class="py-16 text-center">
            <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
              📅
            </div>
            <h4 class="text-sm font-bold text-slate-800 mb-1">No Appointments Found</h4>
            <p class="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {{ doctorFilter() === 'today' ? 'You have no patient consultations scheduled for today.' : 'There are currently no patient bookings matching this view. Patients will appear here once they reserve an open slot.' }}
            </p>
            <button 
              type="button"
              (click)="isManageAvailabilityOpen.set(true)"
              class="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <span>📅 Manage Working Hours & Slots</span>
            </button>
          </div>

          <!-- Appointments Cards List -->
          <div *ngIf="!isLoading() && filteredDoctorAppointments().length > 0" class="space-y-3">
            <div 
              *ngFor="let appt of filteredDoctorAppointments()"
              class="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div class="flex items-start sm:items-center gap-4">
                <!-- Patient Avatar Initial -->
                <div class="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 font-extrabold text-base flex items-center justify-center shrink-0 border border-blue-200/80 shadow-xs">
                  {{ getPatientInitials(appt.patientName) }}
                </div>
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <h4 class="text-base font-extrabold text-slate-900">{{ appt.patientName || 'Anonymous Patient' }}</h4>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Confirmed
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span class="flex items-center gap-1 font-medium text-slate-700">
                      <span>🗓️</span>
                      <span>{{ appt.startTime | date:'fullDate' }}</span>
                    </span>
                    <span>•</span>
                    <span class="flex items-center gap-1 font-mono font-bold text-blue-700">
                      <span>⏰</span>
                      <span>{{ appt.startTime | date:'shortTime' }} - {{ appt.endTime | date:'shortTime' }}</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Action: Open Clinical Dossier -->
              <div class="flex items-center gap-2 self-end sm:self-center">
                <button 
                  type="button"
                  (click)="openAppointmentDossier(appt)"
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📋</span>
                  <span>View Clinical Dossier</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ========================================================================= -->
      <!-- 2. CUSTOMER & ADMIN VIEW: Weekly Booking Grid & Doctor Selector           -->
      <!-- ========================================================================= -->
      <section *ngIf="!auth.isDoctor()">
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
              class="px-4 py-3 rounded-xl text-left transition-all flex flex-col justify-center cursor-pointer"
            >
              <div class="flex items-center justify-between">
                <span class="font-bold text-sm">{{ doc.name }}</span>
              </div>
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

            <!-- Manage Availability Action (Admin only) -->
            <div *ngIf="auth.isAdmin()" class="flex items-center gap-2">
              <button 
                (click)="isManageAvailabilityOpen.set(true)"
                class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>📅</span>
                <span>Manage Availability</span>
              </button>
            </div>
          </div>

          <!-- Loading State -->
          <div *ngIf="isLoading()" class="py-20 flex flex-col items-center justify-center text-slate-400">
            <div class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="text-xs font-medium">Loading clinical schedule...</p>
          </div>

          <!-- Clinic Schedule Status Bar (Customer & Admin Overview) -->
          <div *ngIf="!isLoading() && slots().length > 0" class="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500">Total Slots</span>
              <span class="text-sm font-extrabold text-slate-800">{{ totalSlotsCount() }}</span>
            </div>
            <div class="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 shadow-sm flex items-center justify-between">
              <span class="text-xs font-semibold text-emerald-700">Available</span>
              <span class="text-sm font-extrabold text-emerald-700">{{ availableSlotsCount() }}</span>
            </div>
            <div class="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 shadow-sm flex items-center justify-between">
              <span class="text-xs font-semibold text-amber-800">Held (In-Progress)</span>
              <span class="text-sm font-extrabold text-amber-800">{{ heldSlotsCount() }}</span>
            </div>
            <div class="bg-slate-100 p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-600">Confirmed Booked</span>
              <span class="text-sm font-extrabold text-slate-800">{{ bookedSlotsCount() }}</span>
            </div>
          </div>

          <!-- Empty State (No Slots Scheduled) -->
          <div *ngIf="!isLoading() && slots().length === 0" class="py-16 px-6 text-center bg-white rounded-3xl border border-dashed border-slate-300 my-4 shadow-sm">
            <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
              📅
            </div>
            <h3 class="text-lg font-bold text-slate-900 mb-1">No Clinical Slots Scheduled</h3>
            <p class="text-xs text-slate-500 max-w-md mx-auto mb-5">
              {{ doctor.name }} currently has no open consultation slots on the calendar for this period.
            </p>
            <button 
              type="button"
              (click)="populateDemoSlots()"
              class="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <span>✨</span>
              <span>Populate Clinical Schedule</span>
            </button>
          </div>

          <!-- 5-Day Weekly Grid (Monday to Friday) -->
          <div *ngIf="!isLoading() && slots().length > 0" class="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                      <span *ngSwitchCase="'Booked'" class="font-medium flex items-center justify-between">
                        <span class="truncate" [ngClass]="isBookedByCurrentCustomer(slot) ? 'text-purple-700 font-bold' : 'text-slate-500'">
                          {{ isBookedByCurrentCustomer(slot) ? '⭐ Your Visit' : (slot.patientName ? 'Patient: ' + slot.patientName : 'Booked') }}
                        </span>
                        <span *ngIf="auth.isAdmin()" class="shrink-0 text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded shadow-xs hover:bg-blue-200 ml-1">
                          Dossier ↗
                        </span>
                      </span>
                    </ng-container>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </section>

      <!-- Booking Dialog Modal -->
      <app-booking-modal 
        *ngIf="activeHoldingSlot() as currentSlot"
        [slot]="currentSlot"
        [defaultPatientName]="auth.isCustomer() ? (auth.currentPersona()?.name ?? '') : ''"
        [errorMessage]="bookingError()"
        [isSubmitting]="isBookingSubmitting()"
        (book)="confirmBooking($event)"
        (cancel)="cancelHold()"
      ></app-booking-modal>

      <!-- Clinical Dossier Modal (Doctor & Admin) -->
      <app-appointment-details-modal
        *ngIf="isAppointmentDetailsOpen()"
        [details]="selectedAppointmentDetails()"
        (close)="isAppointmentDetailsOpen.set(false)"
      ></app-appointment-details-modal>

      <!-- Manage Doctors Modal (Admin Only) -->
      <app-manage-doctors-modal
        *ngIf="isManageDoctorsOpen()"
        [doctors]="doctors()"
        (close)="isManageDoctorsOpen.set(false)"
        (doctorsChanged)="loadDoctors()"
      ></app-manage-doctors-modal>

      <!-- Manage Availability Modal (Doctor & Admin) -->
      <app-manage-availability-modal
        *ngIf="isManageAvailabilityOpen()"
        [doctor]="selectedDoctor()"
        (close)="isManageAvailabilityOpen.set(false)"
        (availabilityChanged)="onAvailabilityUpdated()"
      ></app-manage-availability-modal>

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

  // Admin & Doctor Modals
  public isManageDoctorsOpen = signal<boolean>(false);
  public isManageAvailabilityOpen = signal<boolean>(false);

  // Appointment Clinical Dossier Modal (Doctor & Admin)
  public selectedAppointmentDetails = signal<AppointmentDetails | null>(null);
  public isAppointmentDetailsOpen = signal<boolean>(false);

  // Real-time slot metrics (for Admin & Clinic Overview)
  public totalSlotsCount = computed(() => this.slots().length);
  public availableSlotsCount = computed(() => this.slots().filter(s => s.status === 'Available').length);
  public heldSlotsCount = computed(() => this.slots().filter(s => s.status === 'Held').length);
  public bookedSlotsCount = computed(() => this.slots().filter(s => s.status === 'Booked').length);

  // Doctor Appointments View signals
  public doctorAppointments = signal<Slot[]>([]);
  public doctorFilter = signal<'all' | 'today' | 'upcoming'>('all');

  public todayAppointmentsCount = computed(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    return this.doctorAppointments().filter(a => a.startTime.substring(0, 10) === todayStr).length;
  });

  public upcomingAppointmentsCount = computed(() => {
    const nowIso = new Date().toISOString();
    return this.doctorAppointments().filter(a => a.startTime >= nowIso).length;
  });

  public filteredDoctorAppointments = computed(() => {
    const filter = this.doctorFilter();
    const appts = this.doctorAppointments();
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.substring(0, 10);

    if (filter === 'today') {
      return appts.filter(a => a.startTime.substring(0, 10) === todayStr);
    }
    if (filter === 'upcoming') {
      return appts.filter(a => a.startTime >= nowIso);
    }
    return appts;
  });

  public getPatientInitials(name: string | null | undefined): string {
    if (!name) return 'PT';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  public isDoctorSelf(doc: Doctor | null): boolean {
    if (!doc || !this.auth.isDoctor()) return false;
    const user = this.auth.currentPersona();
    if (!user) return false;
    return (
      user.id.toLowerCase() === doc.id.toLowerCase() ||
      user.name.trim().toLowerCase() === doc.name.trim().toLowerCase()
    );
  }

  public canManageCurrentDoctorAvailability = computed(() => {
    if (this.auth.isAdmin()) return true;
    if (this.auth.isDoctor()) {
      return this.isDoctorSelf(this.selectedDoctor());
    }
    return false;
  });

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
        const current = this.selectedDoctor();
        if (current && docs.some(d => d.id === current.id)) {
          // Current selected doctor still exists
        } else if (this.auth.isDoctor()) {
          // For doctors, default selection directly to their own doctor profile
          const ownDoc = docs.find(d => this.isDoctorSelf(d));
          this.selectDoctor(ownDoc ?? (docs.length > 0 ? docs[0] : null!));
        } else if (docs.length > 0) {
          this.selectDoctor(docs[0]);
        } else {
          this.selectedDoctor.set(null);
          this.slots.set([]);
        }
      },
      error: (err) => console.error('Failed to load doctors:', err)
    });
  }

  public onAvailabilityUpdated(): void {
    const doc = this.selectedDoctor();
    if (doc) {
      this.loadSlots(doc.id);
    }
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
    if (this.auth.isDoctor()) {
      this.schedulingService.getDoctorAppointments(doctorId).subscribe({
        next: (appointments) => {
          this.doctorAppointments.set(appointments);
          this.slots.set(appointments);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load doctor appointments:', err);
          this.isLoading.set(false);
        }
      });
    } else {
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

  public populateDemoSlots(): void {
    this.isLoading.set(true);
    this.schedulingService.populateDemoSlots().subscribe({
      next: (res) => {
        const doc = this.selectedDoctor();
        if (doc) {
          this.loadSlots(doc.id);
        } else {
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        console.error('Failed to populate slots:', err);
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
    if (slot.status === 'Booked') {
      if (this.auth.isDoctor() || this.auth.isAdmin()) {
        this.openAppointmentDossier(slot);
        return;
      }
      if (this.auth.isCustomer() && this.isBookedByCurrentCustomer(slot)) {
        alert(`This is your confirmed appointment with ${this.selectedDoctor()?.name || 'the clinician'}.`);
        return;
      }
      return;
    }

    // Clinicians strictly never book appointments
    if (this.auth.isDoctor()) {
      return;
    }

    // RBAC: Only Customer and Admin can hold/book
    if (!this.auth.canBook()) {
      alert(`The '${this.auth.role()}' role is in clinical schedule management mode. Only Customers and Admins can book appointments.`);
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

    if (this.auth.isDoctor()) {
      const doc = this.selectedDoctor();
      if (doc && updatedSlot.doctorId === doc.id) {
        const appts = [...this.doctorAppointments()];
        const idx = appts.findIndex(a => a.id === updatedSlot.id);
        if (updatedSlot.status === 'Booked') {
          if (idx !== -1) {
            appts[idx] = updatedSlot;
          } else {
            appts.push(updatedSlot);
          }
        } else if (idx !== -1) {
          appts.splice(idx, 1);
        }
        this.doctorAppointments.set(appts.sort((a, b) => a.startTime.localeCompare(b.startTime)));
      }
    }

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

  public isBookedByCurrentCustomer(slot: Slot): boolean {
    return this.auth.isCustomer() && !!slot.patientName && slot.patientName === this.auth.currentPersona()?.name;
  }

  public openAppointmentDossier(slot: Slot): void {
    if (!this.auth.isDoctor() && !this.auth.isAdmin()) return;
    this.selectedAppointmentDetails.set(null);
    this.isAppointmentDetailsOpen.set(true);

    this.schedulingService.getSlotDetails(slot.id).subscribe({
      next: (details) => {
        this.selectedAppointmentDetails.set(details);
      },
      error: (err) => {
        alert(err.error?.message || 'Could not load clinical dossier.');
        this.isAppointmentDetailsOpen.set(false);
      }
    });
  }

  public getSlotCardClasses(slot: Slot): string {
    switch (slot.status) {
      case 'Available':
        if (this.auth.isDoctor()) {
          return 'bg-emerald-50/40 border-emerald-200 text-emerald-900 cursor-default';
        }
        return 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200 text-emerald-900 cursor-pointer hover:shadow-md hover:border-emerald-300';
      case 'Held':
        return this.isHeldByMe(slot)
          ? 'bg-amber-50 border-amber-300 text-amber-900 cursor-pointer shadow-sm ring-2 ring-amber-400/50'
          : 'bg-amber-50/30 border-amber-200/60 text-amber-600/70 cursor-not-allowed opacity-75';
      case 'Booked':
        if (this.auth.isDoctor() || this.auth.isAdmin()) {
          return 'bg-blue-50/60 hover:bg-blue-50 border-blue-200 text-blue-900 cursor-pointer hover:shadow-md hover:border-blue-300';
        }
        if (this.isBookedByCurrentCustomer(slot)) {
          return 'bg-purple-50 border-purple-300 text-purple-950 cursor-pointer shadow-sm ring-2 ring-purple-400/50';
        }
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
        if (this.auth.isDoctor() || this.auth.isAdmin()) {
          return 'bg-blue-100 text-blue-800';
        }
        if (this.isBookedByCurrentCustomer(slot)) {
          return 'bg-purple-100 text-purple-800 font-extrabold';
        }
        return 'bg-slate-200 text-slate-600';
    }
  }
}

