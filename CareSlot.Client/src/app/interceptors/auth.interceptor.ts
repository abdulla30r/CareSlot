import { HttpInterceptorFn } from '@angular/common/http';

export const TOKEN_STORAGE_KEY = 'careslot_jwt_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Avoid NG0200 circular DI dependency (HttpClient -> authInterceptor -> AuthService -> HttpClient)
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;

  if (token) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }

  return next(req);
};


