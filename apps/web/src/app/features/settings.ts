import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, Auth, Notice, errorMessage } from '../core/api';
import type { User } from '../core/models';
@Component({
  imports: [ReactiveFormsModule],
  template: `<div class="page-heading">
      <div>
        <div class="eyebrow">YOUR WORKSPACE, YOUR WAY</div>
        <h1>Settings<span class="heading-dot">.</span></h1>
        <p>Set a pace that works for you.</p>
      </div>
    </div>
    <section class="card form-card settings-card">
      <form [formGroup]="form" (ngSubmit)="save()">
        <h2>Your profile</h2>
        <label
          >Display name<input
            formControlName="displayName"
            maxlength="80"
            autocomplete="name" /></label
        ><label>Email<input [value]="auth.user()?.email" disabled /></label>
        <hr />
        <h2>Your daily investment</h2>
        <label
          >Daily goal in minutes<input
            type="number"
            formControlName="dailyGoalMinutes"
            min="1"
            max="1440"
            step="1"
        /></label>
        <div class="info-note">
          Changing your goal recalculates historical goal percentages using this current setting.
          Your logged time stays the same.
        </div>
        <label
          >Timezone<input
            formControlName="timezone"
            list="timezones"
            placeholder="Asia/Riyadh"
          /><datalist id="timezones">
            @for (zone of zones; track zone) {
              <option [value]="zone"></option>
            }</datalist
          ><small>Your timezone determines today and streak boundaries.</small></label
        ><label
          >Week starts on<select disabled>
            <option>Monday</option>
          </select></label
        >
        @if (form.touched && form.invalid) {
          <p class="field-error">Enter your name, timezone, and a daily goal of 1–1440 minutes.</p>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <div class="form-actions">
          <button type="button" class="secondary" (click)="auth.logout()">Sign out</button
          ><button class="primary" [disabled]="busy()">
            {{ busy() ? 'Saving…' : 'Save settings' }}
          </button>
        </div>
      </form>
    </section>`,
})
export class SettingsPage {
  api = inject(Api);
  auth = inject(Auth);
  notice = inject(Notice);
  fb = inject(FormBuilder);
  busy = signal(false);
  error = signal('');
  zones = Intl.supportedValuesOf('timeZone');
  form = this.fb.nonNullable.group({
    displayName: [this.auth.user()!.displayName, [Validators.required, Validators.maxLength(80)]],
    dailyGoalMinutes: [
      this.auth.user()!.settings.dailyGoalMinutes,
      [Validators.required, Validators.min(1), Validators.max(1440)],
    ],
    timezone: [this.auth.user()!.settings.timezone, Validators.required],
  });
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.send('PATCH', 'users/me/settings', this.form.getRawValue());
      this.auth.user.set(await this.api.get<User>('auth/me'));
      this.notice.show('Settings saved');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
