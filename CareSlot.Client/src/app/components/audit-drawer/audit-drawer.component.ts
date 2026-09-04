import { Component, EventEmitter, Input, Output, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditLog } from '../../models/schedule.models';
import { SchedulingService } from '../../services/scheduling.service';

@Component({
  selector: 'app-audit-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-fade-in">
      <div class="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-slide-in">
        <!-- Drawer Header -->
        <div class="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <div>
              <h2 class="text-base font-bold">HIPAA Security Audit Trail</h2>
              <p class="text-xs text-slate-400">Immutable Access & Forensics Log (§ 164.312(b))</p>
            </div>
          </div>
          <button 
            (click)="close.emit()"
            class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Compliance Sub-banner -->
        <div class="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between text-xs text-slate-600">
          <span>Displaying 50 most recent immutable logs</span>
          <button 
            (click)="loadAuditLogs()"
            class="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        <!-- Audit Logs List -->
        <div class="flex-1 overflow-y-auto p-5 space-y-3">
          <div *ngIf="isLoading()" class="py-12 text-center text-slate-400 text-xs">
            <div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading audit records from SQL Server...
          </div>

          <div *ngIf="!isLoading() && logs().length === 0" class="py-12 text-center text-slate-400 text-xs italic">
            No audit logs recorded yet. Book or hold a slot to see real-time compliance events!
          </div>

          <!-- Log Card -->
          <div 
            *ngFor="let log of logs()"
            class="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white shadow-2xs transition-all space-y-2 text-xs"
          >
            <div class="flex items-center justify-between">
              <span [ngClass]="getActionBadgeClasses(log.action)" class="px-2 py-0.5 rounded-md font-mono font-bold text-[10px]">
                {{ log.action }}
              </span>
              <span class="text-slate-400 text-[11px] font-mono">
                {{ log.timestampUtc | date:'medium' }}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-slate-100">
              <div>
                <span class="text-[10px] uppercase font-bold text-slate-400 block">User / Actor</span>
                <span class="font-medium truncate block">{{ log.userId }}</span>
              </div>
              <div>
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Client IP</span>
                <span class="font-mono text-slate-500 block">{{ log.ipAddress }}</span>
              </div>
            </div>

            <div class="text-[10px] text-slate-400 font-mono truncate">
              Resource: {{ log.resourceName }} &bull; ID: {{ log.resourceId }}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500">
          Protected by <code class="text-blue-600 font-mono">CareSlotDbContext.SaveChangesAsync</code> Immutability Rules
        </div>
      </div>
    </div>
  `
})
export class AuditDrawerComponent implements OnInit {
  private schedulingService = inject(SchedulingService);

  @Output() close = new EventEmitter<void>();

  public logs = signal<AuditLog[]>([]);
  public isLoading = signal<boolean>(false);

  ngOnInit(): void {
    this.loadAuditLogs();
  }

  public loadAuditLogs(): void {
    this.isLoading.set(true);
    this.schedulingService.getAuditLogs(50).subscribe({
      next: (data) => {
        this.logs.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load audit logs:', err);
        this.isLoading.set(false);
      }
    });
  }

  public getActionBadgeClasses(action: string): string {
    switch (action) {
      case 'APPOINTMENT_BOOKED':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'SLOT_HELD':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'SLOT_RELEASED':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      default:
        return 'bg-blue-100 text-blue-800 border border-blue-200';
    }
  }
}

