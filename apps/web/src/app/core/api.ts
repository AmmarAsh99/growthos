import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, from, switchMap, throwError } from 'rxjs';
import type { Envelope, User } from './models';
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  async get<T>(path: string) {
    return (await firstValueFrom(this.http.get<Envelope<T>>('/api/v1/' + path))).data;
  }
  async send<T>(method: string, path: string, body: unknown = {}) {
    return (
      await firstValueFrom(
        this.http.request<Envelope<T>>(method, '/api/v1/' + path, {
          body,
          withCredentials: path.startsWith('auth/'),
        }),
      )
    )?.data;
  }
}
@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  private router = inject(Router);
  user = signal<User | null>(null);
  token: string | null = null;
  private pending: Promise<boolean> | null = null;
  async authenticate(register: boolean, body: unknown) {
    const result = await this.api.send<{ user: User; accessToken: string }>(
      'POST',
      register ? 'auth/register' : 'auth/login',
      body,
    );
    this.user.set(result.user);
    this.token = result.accessToken;
  }
  refresh(): Promise<boolean> {
    if (this.pending) return this.pending;
    this.pending = this.api
      .send<{ user: User; accessToken: string }>('POST', 'auth/refresh')
      .then((result) => {
        this.user.set(result.user);
        this.token = result.accessToken;
        return true;
      })
      .catch(() => {
        this.user.set(null);
        this.token = null;
        return false;
      })
      .finally(() => (this.pending = null));
    return this.pending;
  }
  async logout() {
    try {
      await this.api.send('POST', 'auth/logout');
    } finally {
      this.token = null;
      this.user.set(null);
      await this.router.navigateByUrl('/login');
    }
  }
}
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth),
    router = inject(Router);
  const isAuth = /\/auth\/(login|register|refresh|logout)$/.test(req.url);
  const outgoing =
    auth.token && !isAuth
      ? req.clone({ setHeaders: { Authorization: `Bearer ${auth.token}` } })
      : req;
  return next(outgoing).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isAuth) return throwError(() => error);
      return from(auth.refresh()).pipe(
        switchMap((ok) => {
          if (!ok) {
            void router.navigateByUrl('/login');
            return throwError(() => error);
          }
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${auth.token}` } }));
        }),
      );
    }),
  );
};
export function errorMessage(error: unknown) {
  if (error instanceof HttpErrorResponse) {
    const e = error.error?.error;
    return (
      e?.details?.map((d: { message: string }) => d.message).join(' · ') ||
      e?.message ||
      (error.status === 0
        ? 'Cannot reach GrowthOS. Check your connection and try again.'
        : 'Something went wrong. Please try again.')
    );
  }
  return 'Something went wrong. Please try again.';
}
@Injectable({ providedIn: 'root' })
export class Notice {
  message = signal('');
  private timer?: ReturnType<typeof setTimeout>;
  show(message: string) {
    this.message.set(message);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.message.set(''), 5000);
  }
}
