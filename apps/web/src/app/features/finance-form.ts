import { TranslatePipe } from '../core/language';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, Notice, errorMessage } from '../core/api';
import { localDate } from '../shared/format';
import { moneyInput, parseMoney } from '../shared/money';
import type {
  BudgetPlan,
  FinanceCategory,
  LedgerEntry,
} from '../../../../api/src/common/finance-contracts';
@Component({
  imports: [TranslatePipe, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">{{ 'MAKE EVERY RIYAL VISIBLE' | t }}</div>
        <h1>{{ (id ? 'Edit transaction' : 'Add expense') | t }}</h1>
        <p>{{ 'Record an expense, received income, or an actual savings transfer.' | t }}</p>
      </div>
      <a routerLink="/finance/transactions" class="button secondary">{{
        'View transactions →' | t
      }}</a>
    </div>
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <div class="card skeleton" role="status">{{ 'Loading transaction…' | t }}</div>
    } @else {
      <div class="form-layout">
        <section class="card form-card">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="form-grid">
              <label
                >{{ 'Transaction type' | t
                }}<select formControlName="type" (change)="changeType()">
                  <option value="expense">{{ 'Normal expense' | t }}</option>
                  <option value="recurring">{{ 'Recurring expense (actual payment)' | t }}</option>
                  <option value="transfer">{{ 'Savings / emergency transfer' | t }}</option>
                  <option value="income">{{ 'Received income' | t }}</option>
                </select></label
              ><label
                >{{ 'Amount (SAR)' | t
                }}<input inputmode="decimal" formControlName="amount" placeholder="500.00"
              /></label>
            </div>
            <div class="form-grid">
              <label
                >{{ 'Date' | t
                }}<input
                  type="date"
                  min="2000-01-01"
                  [max]="today"
                  formControlName="date"
                  (change)="loadBudget()" /></label
              ><label
                >{{ 'Time (optional, Riyadh)' | t }}<input type="time" formControlName="time"
              /></label>
            </div>
            @if (
              form.controls.type.value === 'expense' || form.controls.type.value === 'recurring'
            ) {
              <label
                >{{ 'Category' | t
                }}<select
                  [attr.aria-label]="'Category' | t"
                  formControlName="categoryId"
                  (change)="chooseCategory()"
                >
                  <option value="">{{ 'Choose category' | t }}</option>
                  @for (c of categories(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select></label
              >
            }
            @if (form.controls.type.value !== 'income') {
              <label
                >{{ 'Budget envelope' | t
                }}<select [attr.aria-label]="'Budget envelope' | t" formControlName="envelopeId">
                  <option value="">{{ 'Choose envelope' | t }}</option>
                  @for (e of budget()?.envelopes; track e.id) {
                    @if ((form.controls.type.value === 'transfer') === (e.kind !== 'expense')) {
                      <option [value]="e.id">{{ e.name }}</option>
                    }
                  }</select
                ><small>{{
                  'Category defaults are suggested. Choosing a different envelope intentionally overrides that mapping.'
                    | t
                }}</small></label
              >
            }
            <label
              >{{ 'Description' | t
              }}<input
                formControlName="description"
                maxlength="160"
                placeholder="What was this transaction for?"
            /></label>
            <div class="form-grid">
              <label
                >{{ 'Merchant (optional)' | t }}<input formControlName="merchant" maxlength="100"
              /></label>
              @if (form.controls.type.value === 'recurring') {
                <label
                  >{{ 'Frequency' | t
                  }}<select formControlName="frequency">
                    <option value="monthly">{{ 'Monthly' | t }}</option>
                    <option value="weekly">{{ 'Weekly' | t }}</option>
                    <option value="yearly">{{ 'Yearly' | t }}</option>
                  </select></label
                >
              }
            </div>
            <label
              >{{ 'Notes (optional)' | t
              }}<textarea rows="3" formControlName="notes" maxlength="2000"></textarea>
            </label>
            @if (form.touched && form.invalid) {
              <p class="field-error" role="alert">
                {{
                  'Enter an amount above zero with up to two decimals, a valid date, and a description.'
                    | t
                }}
              </p>
            }
            <div class="form-actions">
              <a class="button secondary" routerLink="/finance">{{ 'Cancel' | t }}</a
              ><button class="primary" [disabled]="busy() || budgetLoading() || form.invalid">
                {{ (busy() ? 'Saving…' : 'Save transaction') | t }}
              </button>
            </div>
          </form>
        </section>
        <section class="card form-aside">
          <span class="eyebrow">{{ 'CLEAR ACCOUNTING' | t }}</span>
          <h2>{{ 'Plans aren’t payments.' | t }}</h2>
          <p>
            {{
              'Expenses reduce a spending envelope. Transfers record money moved to savings or your emergency fund. Income records money actually received.'
                | t
            }}
          </p>
          <hr />
          <p>
            {{
              'Recurring frequency labels an actual payment. It never automatically creates another expense.'
                | t
            }}
          </p>
          <small>{{
            'All dates use Asia/Riyadh. Your dashboard recalculates from saved records.' | t
          }}</small>
        </section>
      </div>
    }
  `,
})
export class FinanceFormPage {
  api = inject(Api);
  router = inject(Router);
  notice = inject(Notice);
  id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  today = localDate('Asia/Riyadh');
  loading = signal(true);
  busy = signal(false);
  budgetLoading = signal(false);
  error = signal('');
  categories = signal<FinanceCategory[]>([]);
  budget = signal<BudgetPlan | null>(null);
  private seq = 0;
  form = inject(FormBuilder).nonNullable.group({
    type: ['expense'],
    amount: [
      '',
      [Validators.required, Validators.pattern(/^(?!0+(\.0{1,2})?$)\d{1,8}(\.\d{1,2})?$/)],
    ],
    date: [this.today, Validators.required],
    time: [''],
    categoryId: [''],
    envelopeId: [''],
    description: ['', [Validators.required, Validators.maxLength(160)]],
    notes: [''],
    merchant: [''],
    frequency: ['monthly'],
  });
  constructor() {
    void this.init();
  }
  async init() {
    try {
      this.categories.set(await this.api.get<FinanceCategory[]>('finance/categories'));
      if (this.id) {
        const e = await this.api.get<LedgerEntry>('finance/transactions/' + this.id);
        this.form.patchValue({
          type: e.kind === 'expense' && e.frequency ? 'recurring' : e.kind,
          amount: moneyInput(e.amountHalalas),
          date: e.date,
          time: e.time || '',
          categoryId: e.categoryId || '',
          envelopeId: e.envelopeId || '',
          description: e.description,
          notes: e.notes || '',
          merchant: e.merchant || '',
          frequency: e.frequency || 'monthly',
        });
      }
      await this.loadBudget(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async loadBudget(preserve = false) {
    const seq = ++this.seq;
    this.budgetLoading.set(true);
    if (!preserve) this.form.controls.envelopeId.setValue('');
    try {
      const month = this.form.controls.date.value.slice(0, 7);
      if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return;
      const b = await this.api.get<BudgetPlan>('finance/budget?month=' + month);
      if (seq !== this.seq) return;
      this.budget.set(b);
      if (!preserve) this.chooseCategory();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      if (seq === this.seq) this.budgetLoading.set(false);
    }
  }
  chooseCategory() {
    const rule = this.budget()?.categoryRules.find(
      (r) => r.categoryId === this.form.controls.categoryId.value,
    );
    this.form.controls.envelopeId.setValue(
      this.budget()?.envelopes.find((e) => e.key === rule?.envelopeKey)?.id || '',
    );
  }
  changeType() {
    this.form.controls.categoryId.setValue('');
    this.form.controls.envelopeId.setValue('');
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy() || this.budgetLoading()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue(),
        kind = v.type === 'recurring' ? 'expense' : v.type;
      const amountHalalas = parseMoney(v.amount);
      if (!amountHalalas) throw new Error('Enter an amount above zero');
      if (kind !== 'income' && !v.envelopeId) throw new Error('Choose a budget envelope');
      if (kind === 'expense' && !v.categoryId) throw new Error('Choose a category');
      await this.api.send(
        this.id ? 'PUT' : 'POST',
        'finance/transactions' + (this.id ? '/' + this.id : ''),
        {
          kind,
          amountHalalas,
          date: v.date,
          description: v.description,
          ...(v.time ? { time: v.time } : {}),
          ...(v.notes ? { notes: v.notes } : {}),
          ...(v.merchant ? { merchant: v.merchant } : {}),
          ...(kind !== 'income' ? { envelopeId: v.envelopeId } : {}),
          ...(kind === 'expense' ? { categoryId: v.categoryId } : {}),
          ...(v.type === 'recurring' ? { frequency: v.frequency } : {}),
        },
      );
      this.notice.show('Transaction saved. Your finances have been updated.');
      await this.router.navigateByUrl('/finance');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
