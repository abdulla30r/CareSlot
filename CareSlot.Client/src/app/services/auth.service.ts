import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface UserPersona {
  id: string;
  name: string;
  email: string;
  role: 'Customer' | 'Doctor' | 'Admin';
  description: string;
  avatarInitials: string;
  defaultPassword?: string;
}

export interface TokenResponse {
  token: string;
  userId: string;
  name: string;
  role: 'Customer' | 'Doctor' | 'Admin';
  expiresAtUtc: string;
}

const TOKEN_STORAGE_KEY = 'careslot_jwt_token';
const PERSONA_STORAGE_KEY = 'careslot_active_persona';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  public personas = signal<UserPersona[]>([]);
  public currentPersona = signal<UserPersona | null>(null);
  public token = signal<string | null>(null);

  public isAuthenticated = computed(() => !!this.token());
  public role = computed(() => this.currentPersona()?.role ?? null);
  public isCustomer = computed(() => this.role() === 'Customer');
  public isDoctor = computed(() => this.role() === 'Doctor');
  public isAdmin = computed(() => this.role() === 'Admin');

  public canBook = computed(() => this.isCustomer() || this.isAdmin());
  public canGenerateSlots = computed(() => this.isDoctor() || this.isAdmin());
  public canViewAuditLogs = computed(() => this.isAdmin());

  constructor() {
    this.restoreSession();
    this.loadPersonas();
  }

  private restoreSession(): void {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const savedPersona = localStorage.getItem(PERSONA_STORAGE_KEY);

    if (savedToken && savedPersona) {
      try {
        this.token.set(savedToken);
        this.currentPersona.set(JSON.parse(savedPersona));
      } catch {
        this.clearSession();
      }
    }
  }

  public loadPersonas(): void {
    this.http.get<UserPersona[]>('/api/auth/personas').subscribe({
      next: (list) => {
        this.personas.set(list);
        // If current persona was cached, sync with fresh persona details
        const current = this.currentPersona();
        if (current) {
          const fresh = list.find(p => p.id === current.id || p.email === current.email);
          if (fresh) {
            this.currentPersona.set(fresh);
            localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(fresh));
          }
        }
      },
      error: (err) => console.error('Failed to load RBAC personas:', err)
    });
  }

  public login(email: string, password: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>('/api/auth/login', { email, password }).pipe(
      tap((res) => {
        this.token.set(res.token);
        localStorage.setItem(TOKEN_STORAGE_KEY, res.token);

        const matched = this.personas().find(p => p.id === res.userId || p.role === res.role) 
          || {
            id: res.userId,
            name: res.name,
            email: email,
            role: res.role,
            description: 'Authenticated User',
            avatarInitials: res.name.substring(0, 2).toUpperCase()
          };

        this.currentPersona.set(matched);
        localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(matched));
      })
    );
  }

  public register(name: string, email: string, password: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>('/api/auth/register', { name, email, password }).pipe(
      tap((res) => {
        this.token.set(res.token);
        localStorage.setItem(TOKEN_STORAGE_KEY, res.token);

        const nameParts = res.name.trim().split(' ');
        const initials = nameParts.length === 1 
          ? nameParts[0].substring(0, 2).toUpperCase() 
          : (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();

        const newPersona: UserPersona = {
          id: res.userId,
          name: res.name,
          email: email,
          role: 'Customer',
          description: 'Self-registered patient account',
          avatarInitials: initials
        };

        this.currentPersona.set(newPersona);
        localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(newPersona));
        this.loadPersonas();
      })
    );
  }

  public switchPersona(personaId: string): void {
    this.http.post<TokenResponse>(`/api/auth/token?personaId=${personaId}`, {}).subscribe({
      next: (res) => {
        this.token.set(res.token);
        localStorage.setItem(TOKEN_STORAGE_KEY, res.token);

        const persona = this.personas().find(p => p.id === res.userId || p.role === res.role);
        if (persona) {
          this.currentPersona.set(persona);
          localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(persona));
        }
      },
      error: (err) => console.error('Failed to authenticate persona:', err)
    });
  }

  public logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private clearSession(): void {
    this.token.set(null);
    this.currentPersona.set(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(PERSONA_STORAGE_KEY);
  }
}
