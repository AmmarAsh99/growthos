import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Auth } from './core/api';
const signedIn: CanActivateFn = () =>
  inject(Auth).user() ? true : inject(Router).createUrlTree(['/login']);
const signedOut: CanActivateFn = () =>
  !inject(Auth).user() ? true : inject(Router).createUrlTree(['/dashboard']);
export const routes: Routes = [
  {
    path: 'finance',
    canActivate: [signedIn],
    loadComponent: () => import('./features/finance-dashboard').then((m) => m.FinanceDashboardPage),
  },
  {
    path: 'finance/new',
    canActivate: [signedIn],
    loadComponent: () => import('./features/finance-form').then((m) => m.FinanceFormPage),
  },
  {
    path: 'finance/transactions/:id/edit',
    canActivate: [signedIn],
    loadComponent: () => import('./features/finance-form').then((m) => m.FinanceFormPage),
  },
  {
    path: 'finance/transactions',
    canActivate: [signedIn],
    loadComponent: () =>
      import('./features/finance-transactions').then((m) => m.FinanceTransactionsPage),
  },
  {
    path: 'finance/budgets',
    canActivate: [signedIn],
    loadComponent: () => import('./features/finance-budgets').then((m) => m.FinanceBudgetsPage),
  },
  {
    path: 'finance/reports',
    data: { report: true },
    canActivate: [signedIn],
    loadComponent: () => import('./features/finance-dashboard').then((m) => m.FinanceDashboardPage),
  },
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
