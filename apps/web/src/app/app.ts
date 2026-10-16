import { TranslatePipe, Language } from './core/language';
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth, Notice } from './core/api';
import { Theme } from './core/theme';
@Component({
  selector: 'app-root',
  imports: [TranslatePipe, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (auth.user(); as user) {
      <a class="skip" href="#content">{{ 'Skip to content' | t }}</a>
      <button
        class="mobile-menu icon-button"
        (click)="menu.set(!menu())"
        [attr.aria-label]="'Toggle navigation' | t"
        [attr.aria-expanded]="menu()"
      >
        ☰
      </button>
      <aside [class.open]="menu()" [class.collapsed]="collapsed()">
        <a routerLink="/dashboard" class="brand"
          ><span class="brand-mark">↗</span> Growth<span>OS</span></a
        >
        <p class="nav-label">{{ 'YOUR WORKSPACE' | t }}</p>
        <nav [attr.aria-label]="'Main navigation' | t">
          @for (item of links; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              (click)="menu.set(false)"
              [attr.aria-label]="item.label | t"
              [title]="item.label | t"
              ><span aria-hidden="true">{{ item.icon }}</span
              >{{ item.label | t }}</a
            >
          }
        </nav>
        <div class="sidebar-note">
          <span class="spark">✦</span><strong>{{ 'A little, every day.' | t }}</strong>
          <p>{{ 'Make space for the things' | t }}<br />{{ 'you want to grow.' | t }}</p>
        </div>
        <div class="profile">
          <span class="avatar">{{ user.displayName.slice(0, 2).toUpperCase() }}</span>
          <div>
            <strong>{{ user.displayName }}</strong
            ><small>{{ 'Your personal workspace' | t }}</small>
          </div>
          <button class="icon-button" [attr.aria-label]="'Sign out' | t" (click)="auth.logout()">
            ↪
          </button>
        </div>
      </aside>
      <div class="workspace" [class.sidebar-collapsed]="collapsed()">
        <header class="topbar">
          <button
            class="icon-button desktop-collapse"
            (click)="collapsed.set(!collapsed())"
            [attr.aria-label]="(collapsed() ? 'Expand sidebar' : 'Collapse sidebar') | t"
            [attr.aria-expanded]="!collapsed()"
          >
            ☰
          </button>
          <span class="workspace-title"
            >{{ 'Your workspace' | t }}<span class="muted">/ GrowthOS</span></span
          >
          <label class="language-control"
            ><span class="sr-only">Language / اللغة</span
            ><select
              aria-label="Language / اللغة"
              [value]="language.current()"
              (change)="language.set($any($event.target).value)"
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select></label
          >
          <label class="theme-control"
            ><span class="sr-only">{{ 'Color theme' | t }}</span
            ><select
              [attr.aria-label]="'Color theme' | t"
              [value]="theme.mode()"
              (change)="theme.set($any($event.target).value)"
            >
              <option value="light">{{ 'Light' | t }}</option>
              <option value="dark">{{ 'Dark' | t }}</option>
              <option value="system">{{ 'System' | t }}</option>
            </select></label
          >
          <details class="profile-menu">
            <summary [attr.aria-label]="'Profile: ' + user.displayName">
              <span class="avatar">{{ user.displayName.slice(0, 2).toUpperCase() }}</span>
            </summary>
            <div class="card">
              <strong>{{ user.displayName }}</strong
              ><a routerLink="/settings">{{ 'Settings' | t }}</a
              ><button class="text-button" (click)="auth.logout()">{{ 'Sign out' | t }}</button>
            </div>
          </details>
        </header>
        <main id="content"><router-outlet /></main>
        <footer>
          GrowthOS <span>{{ 'Time invested. Progress you can see.' | t }}</span>
        </footer>
      </div>
    } @else {
      <div class="auth-language">
        <label class="language-control"
          ><span class="sr-only">Language / اللغة</span
          ><select
            aria-label="Language / اللغة"
            [value]="language.current()"
            (change)="language.set($any($event.target).value)"
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select></label
        >
      </div>
      <router-outlet />
    }
    @if (notice.message()) {
      <div class="toast" role="status">✓ {{ notice.message() }}</div>
    }
  `,
})
export class App {
  language = inject(Language);
  theme = inject(Theme);
  auth = inject(Auth);
  notice = inject(Notice);
  menu = signal(false);
  collapsed = signal(false);
  links = [
    { path: '/dashboard', label: 'Overview', icon: '◫' },
    { path: '/activities/new', label: 'Add Activity', icon: '＋' },
    { path: '/activities', label: 'Activity history', icon: '◷' },
    { path: '/categories', label: 'Categories', icon: '▦' },
    { path: '/finance', label: 'Finance Dashboard', icon: '◈' },
    { path: '/finance/new', label: 'Add Expense', icon: '＋' },
    { path: '/finance/transactions', label: 'Transactions', icon: '⇄' },
    { path: '/finance/budgets', label: 'Budgets', icon: '▤' },
    { path: '/finance/reports', label: 'Monthly Reports', icon: '▥' },
    { path: '/settings', label: 'Settings', icon: '⚙' },
  ];
}
