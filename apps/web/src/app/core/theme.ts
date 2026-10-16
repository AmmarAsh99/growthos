import { Injectable, computed, effect, signal } from '@angular/core';
export type ThemeMode = 'light' | 'dark' | 'system';
@Injectable({ providedIn: 'root' })
export class Theme {
  mode = signal<ThemeMode>('system');
  private media = matchMedia('(prefers-color-scheme: dark)');
  private systemDark = signal(this.media.matches);
  dark = computed(() => this.mode() === 'dark' || (this.mode() === 'system' && this.systemDark()));
  constructor() {
    try {
      const stored = localStorage.getItem('growthos-theme');
      if (stored === 'light' || stored === 'dark' || stored === 'system') this.mode.set(stored);
    } catch {}
    this.media.addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => {
      document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light';
      try {
        localStorage.setItem('growthos-theme', this.mode());
      } catch {}
    });
  }
  set(value: string) {
    if (value === 'light' || value === 'dark' || value === 'system') this.mode.set(value);
  }
}
