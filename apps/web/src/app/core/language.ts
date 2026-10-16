import { Injectable, Pipe, effect, inject, signal } from '@angular/core';
import { translate } from './translations';

@Injectable({ providedIn: 'root' })
export class Language {
  current = signal<'en' | 'ar'>('en');
  constructor() {
    try {
      if (localStorage.getItem('growthos-language') === 'ar') this.current.set('ar');
    } catch {}
    effect(() => {
      const language = this.current();
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      try {
        localStorage.setItem('growthos-language', language);
      } catch {}
    });
  }
  set(value: string) {
    if (value === 'en' || value === 'ar') this.current.set(value);
  }
}

@Pipe({ name: 't', pure: false })
export class TranslatePipe {
  private language = inject(Language);
  transform(value: string): string {
    return translate(value, this.language.current());
  }
}
