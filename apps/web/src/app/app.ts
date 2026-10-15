import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth, Notice } from './core/api';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (auth.user(); as user) {
      <a class="skip" href="#content">Skip to content</a>
      <button
        class="mobile-menu icon-button"
        (click)="menu.set(!menu())"
        aria-label="Toggle navigation"
        [attr.aria-expanded]="menu()"
      >
        ☰
      </button>
      <aside [class.open]="menu()" [class.collapsed]="collapsed()">
        <a routerLink="/dashboard" class="brand"
          ><span class="brand-mark">↗</span> Growth<span>OS</span></a
        >
        <p class="nav-label">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          @for (item of links; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              (click)="menu.set(false)"
              [attr.aria-label]="item.label"
              [title]="item.label"
              ><span aria-hidden="true">{{ item.icon }}</span
              >{{ item.label }}</a
            >
          }
        </nav>
        <div class="sidebar-note">
          <span class="spark">✦</span><strong>A little, every day.</strong>
          <p>Make space for the things<br />you want to grow.</p>
        </div>
        <div class="profile">
          <span class="avatar">{{ user.displayName.slice(0, 2).toUpperCase() }}</span>
          <div>
            <strong>{{ user.displayName }}</strong
            ><small>Your personal workspace</small>
          </div>
          <button class="icon-button" aria-label="Sign out" (click)="auth.logout()">↪</button>
        </div>
      </aside>
      <div class="workspace" [class.sidebar-collapsed]="collapsed()">
        <header class="topbar">
          <button
            class="icon-button desktop-collapse"
            (click)="collapsed.set(!collapsed())"
            [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
            [attr.aria-expanded]="!collapsed()"
          >
            ☰
          </button>
          <span>Personal growth <span class="muted">/ Your journey</span></span
          ><span class="live-dot">A little progress counts</span>
        </header>
        <main id="content"><router-outlet /></main>
        <footer>GrowthOS <span>Time invested. Progress you can see.</span></footer>
      </div>
    } @else {
      <router-outlet />
    }
    @if (notice.message()) {
      <div class="toast" role="status">✓ {{ notice.message() }}</div>
    }
  `,
})
export class App {
  auth = inject(Auth);
  notice = inject(Notice);
  menu = signal(false);
  collapsed = signal(false);
  links = [
    { path: '/dashboard', label: 'Overview', icon: '◫' },
    { path: '/activities/new', label: 'Log activity', icon: '＋' },
    { path: '/activities', label: 'Activity history', icon: '◷' },
    { path: '/categories', label: 'Categories', icon: '▦' },
    { path: '/settings', label: 'Settings', icon: '⚙' },
  ];
}
