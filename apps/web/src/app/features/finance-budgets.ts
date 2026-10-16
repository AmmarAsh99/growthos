import { TranslatePipe } from '../core/language';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, Notice, errorMessage } from '../core/api';
import { money, moneyInput, parseMoney } from '../shared/money';
import { localDate } from '../shared/format';
import type {
  Allocation,
  BudgetPlan,
  FinanceCategory,
} from '../../../../api/src/common/finance-contracts';
@Component({
  imports: [TranslatePipe, ReactiveFormsModule],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">{{ 'GIVE YOUR SALARY A PLAN' | t }}</div>
        <h1>{{ 'Budgets' | t }}</h1>
        <p>{{ 'Allocate your salary once. Track expenses and transfers separately.' | t }}</p>
      </div>
      <label
        >{{ 'Budget month' | t
        }}<input
          type="month"
          min="2000-01"
          max="2099-12"
          [value]="month"
          (change)="month = $any($event.target).value; load()"
      /></label>
    </div>
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <div class="card skeleton" role="status">{{ 'Loading budget…' | t }}</div>
    } @else {
      <p class="info-note">
        {{
          closed()
            ? 'This historical budget is preserved and cannot be changed.'
            : 'Edits affect only this selected month. New unsaved months inherit the latest earlier snapshot; already saved months stay unchanged.'
        }}
        Category limits sit inside envelopes and do not add to your salary allocation.
      </p>
      <form [formGroup]="form" (ngSubmit)="save()">
        <section class="card form-card">
          <div class="form-grid">
            <label
              >{{ 'Monthly salary plan (SAR)' | t
              }}<input inputmode="decimal" formControlName="salary" /></label
            ><label
              >{{ 'Usage warning threshold (%)' | t
              }}<input type="number" min="1" max="100" formControlName="warning"
            /></label>
          </div>
          <div class="history-summary">
            <strong>{{ 'Allocation check' | t }}</strong
            ><span [class.danger]="difference() !== 'Fully allocated'">{{ difference() }}</span>
          </div>
          <div formArrayName="envelopes" class="budget-editor">
            @for (e of form.controls.envelopes.controls; track e; let i = $index) {
              <div [formGroupName]="i" class="allocation-row">
                <label>{{ 'Name' | t }}<input formControlName="name" maxlength="60" /></label
                ><label
                  >{{ 'Allocation type' | t
                  }}<select formControlName="kind">
                    <option value="expense">{{ 'Expense' | t }}</option>
                    <option value="savings">{{ 'Savings transfer' | t }}</option>
                    <option value="emergency">{{ 'Emergency transfer' | t }}</option>
                  </select></label
                ><label
                  >{{ 'Monthly SAR' | t
                  }}<input inputmode="decimal" formControlName="amount" /></label
                ><label class="check-label"
                  ><input type="checkbox" formControlName="discretionary" />{{
                    'Discretionary' | t
                  }}</label
                ><button
                  type="button"
                  class="text-button danger"
                  [disabled]="closed()"
                  (click)="form.controls.envelopes.removeAt(i)"
                  [attr.aria-label]="'Remove ' + e.controls.name.value"
                >
                  {{ 'Remove' | t }}
                </button>
              </div>
            }
          </div>
          <button type="button" class="secondary" [disabled]="closed()" (click)="addEnvelope()">
            {{ '＋ Add envelope' | t }}
          </button>
        </section>
        <section class="card section-space">
          <h2>{{ 'Category defaults & sublimits' | t }}</h2>
          <p class="muted">
            {{
              'Food defaults to Healthy food. A sublimit of 0 means no separate category limit.' | t
            }}
          </p>
          <div formArrayName="rules">
            @for (r of form.controls.rules.controls; track r; let i = $index) {
              <div [formGroupName]="i" class="allocation-row">
                <strong>{{ categoryName(r.controls.categoryId.value) }}</strong
                ><label
                  >{{ 'Default envelope' | t
                  }}<select formControlName="envelopeKey">
                    @for (e of form.controls.envelopes.controls; track e) {
                      @if (e.controls.kind.value === 'expense') {
                        <option [value]="e.controls.key.value">{{ e.controls.name.value }}</option>
                      }
                    }
                  </select></label
                ><label
                  >{{ 'Category sublimit (SAR)' | t
                  }}<input inputmode="decimal" formControlName="limit"
                /></label>
              </div>
            }
          </div>
          <div class="form-actions">
            <button
              class="primary"
              [disabled]="closed() || busy() || form.invalid || difference() !== 'Fully allocated'"
            >
              {{ (busy() ? 'Saving…' : 'Save monthly budget') | t }}
            </button>
          </div>
        </section>
      </form>
    }
  `,
})
export class FinanceBudgetsPage {
  api = inject(Api);
  notice = inject(Notice);
  fb = inject(FormBuilder).nonNullable;
  month = localDate('Asia/Riyadh').slice(0, 7);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  categories = signal<FinanceCategory[]>([]);
  private seq = 0;
  private allocation(e: Allocation) {
    return this.fb.group({
      key: [e.key],
      name: [e.name, [Validators.required, Validators.maxLength(60)]],
      kind: [e.kind],
      discretionary: [e.discretionary],
      amount: [moneyInput(e.amountHalalas), Validators.required],
    });
  }
  form = this.fb.group({
    salary: ['13200.00', Validators.required],
    warning: [80, [Validators.required, Validators.min(1), Validators.max(100)]],
    envelopes: this.fb.array<ReturnType<typeof this.allocation>>([]),
    rules: this.fb.array<ReturnType<typeof this.rule>>([]),
  });
  private rule(categoryId: string, envelopeKey: string, limit: number) {
    return this.fb.group({
      categoryId: [categoryId],
      envelopeKey: [envelopeKey, Validators.required],
      limit: [moneyInput(limit), Validators.required],
    });
  }
  constructor() {
    void this.load();
  }
  closed() {
    return this.month < localDate('Asia/Riyadh').slice(0, 7);
  }
  categoryName(id: string) {
    return this.categories().find((c) => c.id === id)?.name || 'Category';
  }
  difference() {
    try {
      const v = this.form.getRawValue();
      const sum = v.envelopes.reduce((a, e) => a + parseMoney(e.amount), 0),
        delta = parseMoney(v.salary) - sum;
      return delta === 0
        ? 'Fully allocated'
        : delta > 0
          ? `${money(delta)} left to allocate`
          : `${money(-delta)} over salary`;
    } catch {
      return 'Enter valid amounts (up to two decimals)';
    }
  }
  addEnvelope() {
    this.form.controls.envelopes.push(
      this.allocation({
        key: 'custom-' + Date.now().toString(36) + '-' + this.form.controls.envelopes.length,
        name: 'New envelope',
        kind: 'expense',
        discretionary: true,
        amountHalalas: 0,
      }),
    );
  }
  async load() {
    const seq = ++this.seq;
    this.loading.set(true);
    this.error.set('');
    try {
      const [plan, cats] = await Promise.all([
        this.api.get<BudgetPlan>('finance/budget?month=' + this.month),
        this.api.get<FinanceCategory[]>('finance/categories'),
      ]);
      if (seq !== this.seq) return;
      this.categories.set(cats);
      this.form.enable();
      this.form.controls.salary.setValue(moneyInput(plan.salaryHalalas));
      this.form.controls.warning.setValue(plan.warningPercent);
      this.form.controls.envelopes.clear();
      plan.envelopes.forEach((e) => this.form.controls.envelopes.push(this.allocation(e)));
      this.form.controls.rules.clear();
      plan.categoryRules.forEach((r) =>
        this.form.controls.rules.push(this.rule(r.categoryId, r.envelopeKey, r.limitHalalas)),
      );
      if (this.closed()) this.form.disable();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }
  async save() {
    if (this.closed() || this.busy() || this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue();
      await this.api.send('PUT', 'finance/budget?month=' + this.month, {
        salaryHalalas: parseMoney(v.salary),
        warningPercent: v.warning,
        envelopes: v.envelopes.map(({ amount, ...e }) => ({
          ...e,
          amountHalalas: parseMoney(amount),
        })),
        categoryRules: v.rules.map(({ limit, ...r }) => ({
          ...r,
          limitHalalas: parseMoney(limit),
        })),
      });
      this.notice.show('Monthly budget saved. Historical snapshots preserved.');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
