import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, Notice, errorMessage } from '../core/api';
import type { Category } from '../core/models';
@Component({
  imports: [ReactiveFormsModule],
  template: `<div class="page-heading">
      <div>
        <div class="eyebrow">MAKE IT YOUR OWN</div>
        <h1>Your categories<span class="heading-dot">.</span></h1>
        <p>A little structure for the many ways you grow.</p>
      </div>
    </div>
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    <div class="form-layout">
      <section class="card">
        <h2>Your focus areas</h2>
        @if (loading()) {
          <p role="status">Loading categories…</p>
        }
        @for (c of categories(); track c.id) {
          <div class="category-row">
            <span class="category-swatch" [style.background]="c.color"></span>
            <div>
              <strong>{{ c.name }}</strong
              ><small>{{
                c.isArchived ? 'Archived · kept in your history' : 'Active category'
              }}</small>
            </div>
            <button class="text-button" (click)="edit(c)" [disabled]="busy()">Edit</button
            ><button class="text-button" (click)="archive(c)" [disabled]="busy()">
              {{ c.isArchived ? 'Restore' : 'Archive' }}
            </button>
          </div>
        }
        <p class="formula-note">
          Archiving hides a category from new entries. Existing activities and analytics stay
          intact.
        </p>
      </section>
      <section class="card form-card">
        <h2>{{ editing() ? 'Edit category' : 'Create a category' }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <label
            >Name<input
              formControlName="name"
              maxlength="60"
              placeholder="e.g. Language learning" /></label
          ><label>Color<input type="color" formControlName="color" /></label
          ><label
            >Icon<select formControlName="icon">
              <option value="star">✦ Personal</option>
              <option value="cloud">☁ Cloud</option>
              <option value="code">⌘ Code</option>
              <option value="book">▤ Reading</option>
              <option value="fitness">ϟ Fitness</option>
              <option value="briefcase">▣ Career</option>
            </select></label
          >
          @if (form.touched && form.invalid) {
            <p class="field-error">Enter a category name (1–60 characters).</p>
          }
          <div class="form-actions">
            @if (editing()) {
              <button type="button" class="secondary" (click)="reset()">Cancel</button>
            }
            <button class="primary" [disabled]="busy()">
              {{ busy() ? 'Saving…' : editing() ? 'Save changes' : '＋ Add category' }}
            </button>
          </div>
        </form>
      </section>
    </div>`,
})
export class CategoriesPage {
  api = inject(Api);
  notice = inject(Notice);
  fb = inject(FormBuilder);
  categories = signal<Category[]>([]);
  editing = signal<string | null>(null);
  busy = signal(false);
  loading = signal(true);
  error = signal('');
  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    color: ['#8B5CF6', [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    icon: ['star'],
  });
  constructor() {
    void this.load();
  }
  async load() {
    try {
      this.categories.set(await this.api.get<Category[]>('categories?includeArchived=true'));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  edit(c: Category) {
    this.editing.set(c.id);
    this.form.setValue({ name: c.name, color: c.color, icon: c.icon || 'star' });
  }
  reset() {
    this.editing.set(null);
    this.form.reset({ name: '', color: '#8B5CF6', icon: 'star' });
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.send(
        this.editing() ? 'PATCH' : 'POST',
        this.editing() ? 'categories/' + this.editing() : 'categories',
        this.form.getRawValue(),
      );
      this.reset();
      await this.load();
      this.notice.show('Category saved');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async archive(c: Category) {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.send('PATCH', 'categories/' + c.id, { isArchived: !c.isArchived });
      await this.load();
      this.notice.show(c.isArchived ? 'Category restored' : 'Category archived');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
