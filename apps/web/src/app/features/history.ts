import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { RouterLink } from '@angular/router';
import { Api, Notice, errorMessage } from '../core/api';
import type { Activity, ActivityPage, Category } from '../core/models';
import { DurationPipe } from '../shared/format';
@Component({
  imports: [FormsModule, RouterLink, DurationPipe, CdkTrapFocus],
  template: `<div class="page-heading">
      <div>
        <div class="eyebrow">YOUR JOURNEY, RECORDED</div>
        <h1>Activity history<span class="heading-dot">.</span></h1>
        <p>Look back at the time you’ve made for yourself.</p>
      </div>
      <a class="button primary" routerLink="/activities/new">＋ Log activity</a>
    </div>
    <section class="card">
      <form class="history-filters" (ngSubmit)="page = 1; load()">
        <label
          >Search<input
            [(ngModel)]="search"
            name="search"
            placeholder="Find an activity…"
            maxlength="120" /></label
        ><label>From<input type="date" [(ngModel)]="from" name="from" /></label
        ><label>To<input type="date" [(ngModel)]="to" name="to" /></label
        ><label
          >Category<select [(ngModel)]="categoryId" name="category">
            <option value="">All categories</option>
            @for (c of categories(); track c.id) {
              <option [value]="c.id">{{ c.name }}{{ c.isArchived ? ' (archived)' : '' }}</option>
            }
          </select></label
        ><button class="secondary">Apply filters</button>
      </form>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (loading()) {
        <div class="skeleton" role="status">Loading activities…</div>
      } @else if (data(); as d) {
        <div class="history-summary">
          <strong>{{ d.total }} activities</strong
          ><span>{{ d.totalMinutes | duration }} across these filters</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Category</th>
                <th>Date</th>
                <th>Duration</th>
                <th><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (a of d.items; track a.id) {
                <tr>
                  <td>
                    <strong>{{ a.title }}</strong>
                    @if (a.description) {
                      <small class="description">{{ a.description }}</small>
                    }
                  </td>
                  <td>
                    <span class="category-badge"
                      ><i [style.background]="a.category.color"></i>{{ a.category.name }}</span
                    >
                  </td>
                  <td>{{ a.activityDate }}</td>
                  <td>{{ a.durationMinutes | duration }}</td>
                  <td class="row-actions">
                    <a [routerLink]="['/activities', a.id, 'edit']">Edit</a
                    ><button class="text-button danger" (click)="deleting.set(a)">Delete</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    <div class="empty">
                      <h3>No activities found</h3>
                      <p>Try different filters or start with a new entry.</p>
                      <a routerLink="/activities/new">Log an activity →</a>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <span>Page {{ page }} of {{ d.totalPages || 1 }}</span>
          <div>
            <button class="secondary" [disabled]="page <= 1" (click)="page = page - 1; load()">
              ← Previous</button
            ><button
              class="secondary"
              [disabled]="page >= d.totalPages"
              (click)="page = page + 1; load()"
            >
              Next →
            </button>
          </div>
        </div>
      }
    </section>
    @if (deleting(); as a) {
      <div class="modal-backdrop">
        <section
          class="card modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (keydown.escape)="deleting.set(null)"
        >
          <h2 id="delete-title">Delete this activity?</h2>
          <p>
            “{{ a.title }}” will be removed. Your totals and goal progress will be recalculated.
          </p>
          <div class="form-actions">
            <button class="secondary" (click)="deleting.set(null)" [disabled]="busy()">
              Keep activity</button
            ><button class="danger-button" (click)="remove(a)" [disabled]="busy()">
              {{ busy() ? 'Deleting…' : 'Delete activity' }}
            </button>
          </div>
        </section>
      </div>
    }`,
})
export class HistoryPage {
  api = inject(Api);
  notice = inject(Notice);
  data = signal<ActivityPage | null>(null);
  categories = signal<Category[]>([]);
  deleting = signal<Activity | null>(null);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  page = 1;
  search = '';
  from = '';
  to = '';
  categoryId = '';
  constructor() {
    void this.api
      .get<Category[]>('categories?includeArchived=true')
      .then((c) => this.categories.set(c))
      .catch((e) => this.error.set(errorMessage(e)));
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    const q = new URLSearchParams({ page: String(this.page), limit: '20' });
    for (const [k, v] of Object.entries({
      search: this.search,
      from: this.from,
      to: this.to,
      categoryId: this.categoryId,
    }))
      if (v) q.set(k, v);
    try {
      this.data.set(await this.api.get<ActivityPage>('activities?' + q));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async remove(a: Activity) {
    this.busy.set(true);
    try {
      await this.api.send('DELETE', 'activities/' + a.id);
      this.deleting.set(null);
      this.notice.show('Activity deleted');
      if (this.data()?.items.length === 1 && this.page > 1) this.page--;
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
      this.deleting.set(null);
    } finally {
      this.busy.set(false);
    }
  }
}
