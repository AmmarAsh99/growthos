import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth, errorMessage } from '../core/api';
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `<div class="auth-layout">
    <section class="auth-story">
      <a class="brand" routerLink="/"><span class="brand-mark">↗</span> GrowthOS</a>
      <div>
        <span class="eyebrow">SMALL STEPS. MEANINGFUL PROGRESS.</span>
        <h1>Your time.<br />Your growth.<br /><span>Your own pace.</span></h1>
        <p>
          A thoughtful space to track what you do,<br />understand your habits, and keep showing up.
        </p>
        <div class="auth-art" aria-hidden="true">
          <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
        </div>
      </div>
      <small>Build a little momentum, every day.</small>
    </section>
    <section class="auth-form">
      <div>
        <span class="eyebrow">WELCOME TO GROWTHOS</span>
        <h2>{{ register ? 'Start your journey' : 'Welcome back' }}</h2>
        <p class="muted">
          {{
            register
              ? 'A fresh start for the things that matter to you.'
              : 'A little time for yourself goes a long way.'
          }}
        </p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          @if (register) {
            <label
              >Display name<input
                formControlName="displayName"
                autocomplete="name"
                maxlength="80"
                placeholder="What should we call you?"
            /></label>
          }
          <label
            >Email address<input
              type="email"
              formControlName="email"
              autocomplete="email"
              placeholder="you@example.com"
              maxlength="254" /></label
          ><label
            >Password<input
              type="password"
              formControlName="password"
              [autocomplete]="register ? 'new-password' : 'current-password'"
              minlength="12"
              maxlength="128"
              placeholder="At least 12 characters"
          /></label>
          @if (form.touched && form.invalid) {
            <p class="field-error">
              Enter a valid email, a password of 12–128 characters{{
                register ? ', and your name' : ''
              }}.
            </p>
          }
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <button class="primary full" [disabled]="busy()">
            {{ busy() ? 'Please wait…' : register ? 'Create your account →' : 'Sign in →' }}
          </button>
        </form>
        <p class="auth-switch">
          {{ register ? 'Already have an account?' : 'New to GrowthOS?' }}
          <a [routerLink]="register ? '/login' : '/register'">{{
            register ? 'Sign in' : 'Create an account'
          }}</a>
        </p>
        <p class="fine-print">Your workspace is private. Your progress is yours.</p>
      </div>
    </section>
  </div>`,
})
export class AuthPage {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private router = inject(Router);
  register = this.router.url === '/register';
  busy = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group({
    displayName: ['', this.register ? [Validators.required, Validators.maxLength(80)] : []],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
  });
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { displayName, ...login } = this.form.getRawValue();
      await this.auth.authenticate(
        this.register,
        this.register ? { ...login, displayName } : login,
      );
      await this.router.navigateByUrl('/dashboard');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
