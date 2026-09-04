import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserPersona } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <!-- Top Brand Header -->
      <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div class="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/20 mb-3">
          <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 class="text-3xl font-extrabold text-white tracking-tight">CareSlot Portal</h2>
        <p class="mt-1 text-xs text-slate-400 font-medium">HIPAA-Aware Clinical Slot-Booking & Audit System</p>

        <!-- HIPAA Security Pill -->
        <div class="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>HIPAA Minimum Necessary & Concurrency Protected</span>
        </div>
      </div>

      <!-- Main Login Card -->
      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-200">
          <h3 class="text-base font-bold text-slate-900 mb-5">Sign In to Your Account</h3>

          <!-- Error Alert -->
          <div *ngIf="errorMessage()" class="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3.5 flex items-center gap-2">
            <svg class="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ errorMessage() }}</span>
          </div>

          <!-- Credentials Form -->
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Clinical Email / ID
              </label>
              <input 
                type="email" 
                formControlName="email"
                placeholder="e.g. receptionist@careslot.local"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
              />
              <p *ngIf="loginForm.get('email')?.invalid && loginForm.get('email')?.touched" class="text-xs text-rose-600 mt-1">
                Valid email is required.
              </p>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <input 
                type="password" 
                formControlName="password"
                placeholder="••••••••"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
              />
              <p *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched" class="text-xs text-rose-600 mt-1">
                Password is required.
              </p>
            </div>

            <button 
              type="submit" 
              [disabled]="loginForm.invalid || isLoading()"
              class="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span *ngIf="isLoading()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>{{ isLoading() ? 'Signing in...' : 'Sign In' }}</span>
            </button>
          </form>

          <!-- Divider -->
          <div class="mt-6 relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-slate-200"></div>
            </div>
            <div class="relative flex justify-center text-xs uppercase">
              <span class="bg-white px-2 text-slate-400 font-bold tracking-wider">
                Or Quick 1-Click Demo Login
              </span>
            </div>
          </div>

          <!-- Quick 1-Click Demo Personas -->
          <div class="mt-6 grid grid-cols-2 gap-2.5">
            <!-- 1. Customer -->
            <button 
              type="button" 
              (click)="quickLogin('patient@careslot.local', 'Patient123!')"
              [disabled]="isLoading()"
              class="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-left transition-all"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-extrabold flex items-center justify-center">
                  JD
                </span>
                <span class="text-xs font-bold text-slate-800">Customer</span>
              </div>
              <p class="text-[10px] text-slate-500 truncate">John Doe</p>
            </button>

            <!-- 2. Receptionist -->
            <button 
              type="button" 
              (click)="quickLogin('receptionist@careslot.local', 'Clinic123!')"
              [disabled]="isLoading()"
              class="p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 hover:border-blue-300 text-left transition-all"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center">
                  EV
                </span>
                <span class="text-xs font-bold text-blue-900">Receptionist</span>
              </div>
              <p class="text-[10px] text-blue-700 truncate">Elena Vance</p>
            </button>

            <!-- 3. Doctor -->
            <button 
              type="button" 
              (click)="quickLogin('doctor@careslot.local', 'Doctor123!')"
              [disabled]="isLoading()"
              class="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 hover:border-emerald-300 text-left transition-all"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center">
                  SJ
                </span>
                <span class="text-xs font-bold text-emerald-900">Doctor</span>
              </div>
              <p class="text-[10px] text-emerald-700 truncate">Dr. Sarah Jenkins</p>
            </button>

            <!-- 4. Admin -->
            <button 
              type="button" 
              (click)="quickLogin('admin@careslot.local', 'Admin123!')"
              [disabled]="isLoading()"
              class="p-2.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-left transition-all"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">
                  MB
                </span>
                <span class="text-xs font-bold text-slate-900">Admin</span>
              </div>
              <p class="text-[10px] text-slate-600 truncate">Marcus Brody (HIPAA)</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  public isLoading = signal<boolean>(false);
  public errorMessage = signal<string | null>(null);

  public loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  public onSubmit(): void {
    if (this.loginForm.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.value;

    this.auth.login(email, password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Invalid credentials or login failure.');
      }
    });
  }

  public quickLogin(email: string, pass: string): void {
    this.loginForm.setValue({ email, password: pass });
    this.onSubmit();
  }
}
