import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStorageService } from '../services/token-storage.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStorageService);
  const token = tokens.getToken();
  const url = req.url;
  const isAuthRoute = url.includes('/api/auth/login') || url.includes('/api/auth/register');
  if (token && !isAuthRoute) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }
  return next(req);
};
