import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface UserPersona {
  id: string;
  name: string;
  role: 'Customer' | 'Receptionist' | 'Doctor' | 'Admin';
  description: string;
  avatarInitials: string;
}

export interface TokenResponse {
  token: string;
  userId: string;
  name: string;
  role: 'Customer' | 'Receptionist' | 'Doctor' | 'Admin';
  expiresAtUtc: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  public personas = signal<UserPersona[]>([]);
  public currentPersona = signal<UserPersona | null>(null);
  public token = signal<string | null>(null);

  public role = computed(() => this.currentPersona()?.role ?? null);
  public isCustomer = computed(() => this.role() === 'Customer');
  public isReceptionist = computed(() => this.role() === 'Receptionist');
  public isDoctor = computed(() => this.role() === 'Doctor');
  public isAdmin = computed(() => this.role() === 'Admin');

  public canBook = computed(() => this.isCustomer() || this.isReceptionist() || this.isAdmin());
  public canGenerateSlots = computed(() => this.isDoctor() || this.isAdmin());
  public canViewAuditLogs = computed(() => this.isAdmin());

  constructor() {
    this.loadPersonas();
  }

  public loadPersonas(): void {
    this.http.get<UserPersona[]>('/api/auth/personas').subscribe({
      next: (list) => {
        this.personas.set(list);
        // Default to Receptionist for clinical workflow demonstration
        const defaultPersona = list.find(p => p.role === 'Receptionist') || list[0];
        if (defaultPersona) {
          this.switchPersona(defaultPersona.id);
        }
      },
      error: (err) => console.error('Failed to load RBAC personas:', err)
    });
  }

  public switchPersona(personaId: string): void {
    this.http.post<TokenResponse>(`/api/auth/token?personaId=${personaId}`, {}).subscribe({
      next: (res) => {
        this.token.set(res.token);
        const persona = this.personas().find(p => p.id === res.userId || p.role === res.role);
        if (persona) {
          this.currentPersona.set(persona);
        }
      },
      error: (err) => console.error('Failed to authenticate persona:', err)
    });
  }
}

