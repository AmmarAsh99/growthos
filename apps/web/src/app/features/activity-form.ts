import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, Auth, Notice, errorMessage } from '../core/api';
import type { Activity, Category } from '../core/models';
import { localDate, validDuration } from '../shared/format';
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `<div class="page-heading">
      <div>
        <div class="eyebrow">MAKE YOUR TIME COUNT</div>
        <h1>{{ id ? 'Edit activity' : 'Log an activity' }}<span class="heading-dot">.</span></h1>
        <p>A small investment in yourself, worth remembering.</p>
      </div>
      <a routerLink="/activities" class="button secondary">← Activity history</a>
    </div>
    <div class="form-layout">
      <section class="card form-card">
        @if (loading()) {
          <p role="status">Loading your activity…</p>
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()">
            <h2>The details</h2>
            <div class="form-grid">
              <label
                >Activity date<input
                  type="date"
                  formControlName="activityDate"
                  [max]="today" /></label
              ><label
                >Category<select formControlName="categoryId" aria-label="Category">
                  <option value="">Choose a category</option>
                  @for (c of categories(); track c.id) {
                    <option [value]="c.id" [disabled]="c.isArchived && c.id !== originalCategory">
                      {{ c.name }}{{ c.isArchived ? ' (archived)' : '' }}
                    </option>
                  }</select
                ><a routerLink="/categories" class="field-link">Manage categories ↗</a></label
              >
            </div>
            <label
              >What did you work on?<input
                formControlName="title"
                placeholder="e.g. ArgoCD fundamentals"
                minlength="2"
                maxlength="120"
            /></label>
            <fieldset>
              <legend>Time invested</legend>
              <div class="duration-fields">
                <label
                  >Hours<input
                    type="number"
                    formControlName="hours"
                    min="0"
                    max="24"
                    step="1" /></label
                ><span>:</span
                ><label
                  >Minutes<input type="number" formControlName="minutes" min="0" max="59" step="1"
                /></label>
              </div>
              <small>Between 1 minute and 24 hours. Use whole numbers.</small>
            </fieldset>
            <label
              >Notes <span class="muted">(optional)</span
              ><textarea
                formControlName="description"
                rows="5"
                maxlength="2000"
                placeholder="What did you explore, practice, or learn?"
              ></textarea>
            </label>
            @if (form.touched && form.invalid) {
              <p class="field-error" role="alert">
                Choose a date and category, enter a title (2–120 characters), and a duration from 1
                minute to 24 hours.
              </p>
            }
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
            <div class="form-actions">
              <a class="button secondary" routerLink="/dashboard">Cancel</a
              ><button class="primary" [disabled]="busy()">
                {{ busy() ? 'Saving…' : id ? 'Save changes' : '✓ Save activity' }}
              </button>
            </div>
          </form>
        }
      </section>
      <aside class="card form-aside">
        <span class="spark">✦</span>
        <h2>It all adds up.</h2>
        <p>Reading a chapter. Practicing a skill. Making time to move.</p>
        <p>There’s no perfect entry. Just an honest record of the time you invested.</p>
        <hr />
        <small
          >Your entries shape your charts and goal progress. You can always edit them later.</small
        >
      </aside>
    </div>`,
})
export class ActivityFormPage {
  api = inject(Api);
  auth = inject(Auth);
  notice = inject(Notice);
  router = inject(Router);
  route = inject(ActivatedRoute);
  fb = inject(FormBuilder);
  id = this.route.snapshot.paramMap.get('id');
  today = localDate(this.auth.user()!.settings.timezone);
  originalCategory = '';
  categories = signal<Category[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group(
    {
      activityDate: [this.today, Validators.required],
      title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      categoryId: ['', Validators.required],
      hours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
      minutes: [30, [Validators.required, Validators.min(0), Validators.max(59)]],
      description: ['', Validators.maxLength(2000)],
    },
    {
      validators: (c: AbstractControl) =>
        validDuration(c.value.hours, c.value.minutes) ? null : { duration: true },
    },
  );
  constructor() {
    void this.load();
  }
  async load() {
    try {
      this.categories.set(await this.api.get<Category[]>('categories?includeArchived=true'));
      if (this.id) {
        const a = await this.api.get<Activity>('activities/' + this.id);
        this.originalCategory = a.categoryId;
        this.form.patchValue({
          ...a,
          description: a.description || '',
          hours: Math.floor(a.durationMinutes / 60),
          minutes: a.durationMinutes % 60,
        });
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { hours, minutes, ...fields } = this.form.getRawValue();
      await this.api.send(
        this.id ? 'PATCH' : 'POST',
        this.id ? 'activities/' + this.id : 'activities',
        { ...fields, durationMinutes: hours * 60 + minutes },
      );
      this.notice.show(this.id ? 'Activity updated' : 'Activity logged');
      await this.router.navigateByUrl('/dashboard');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
