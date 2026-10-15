import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Auth } from './core/api';
const signedIn: CanActivateFn = () =>
  inject(Auth).user() ? true : inject(Router).createUrlTree(['/login']);
const signedOut: CanActivateFn = () =>
  !inject(Auth).user() ? true : inject(Router).createUrlTree(['/dashboard']);
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [signedOut],
    loadComponent: () => import('./features/auth').then((m) => m.AuthPage),
  },
  {
    path: 'register',
    canActivate: [signedOut],
    loadComponent: () => import('./features/auth').then((m) => m.AuthPage),
  },
  {
    path: 'dashboard',
    canActivate: [signedIn],
    loadComponent: () => import('./features/dashboard').then((m) => m.DashboardPage),
  },
  {
    path: 'activities/new',
    canActivate: [signedIn],
    loadComponent: () => import('./features/activity-form').then((m) => m.ActivityFormPage),
  },
  {
    path: 'activities/:id/edit',
    canActivate: [signedIn],
    loadComponent: () => import('./features/activity-form').then((m) => m.ActivityFormPage),
  },
  {
    path: 'activities',
    canActivate: [signedIn],
    loadComponent: () => import('./features/history').then((m) => m.HistoryPage),
  },
  {
    path: 'categories',
    canActivate: [signedIn],
    loadComponent: () => import('./features/categories').then((m) => m.CategoriesPage),
  },
  {
    path: 'settings',
    canActivate: [signedIn],
    loadComponent: () => import('./features/settings').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'dashboard' },
];
