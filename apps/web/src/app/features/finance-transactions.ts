import { TranslatePipe } from '../core/language';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Api, Notice, errorMessage } from '../core/api';
import { SarPipe } from '../shared/money';
import { localDate } from '../shared/format';
import type {
  BudgetPlan,
  FinanceCategory,
  LedgerEntry,
  TransactionPage,
} from '../../../../api/src/common/finance-contracts';
@Component({
  imports: [TranslatePipe, FormsModule, RouterLink, SarPipe, CdkTrapFocus],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">{{ 'YOUR FINANCIAL LEDGER' | t }}</div>
        <h1>{{ 'Transactions' | t }}</h1>
        <p>{{ 'Every recorded expense, income payment and transfer.' | t }}</p>
      </div>
      <a class="button primary" routerLink="/finance/new">{{ '＋ Add transaction' | t }}</a>
    </div>
    <section class="card">
      <form class="history-filters" (ngSubmit)="page = 1; load()">
        <label
          >{{ 'Search' | t
          }}<input
            name="search"
            [(ngModel)]="search"
            maxlength="160"
            placeholder="Description or merchant" /></label
        ><label>{{ 'From' | t }}<input name="from" type="date" [(ngModel)]="from" /></label
        ><label>{{ 'To' | t }}<input name="to" type="date" [(ngModel)]="to" /></label
        ><label
          >{{ 'Category' | t
          }}<select name="category" [(ngModel)]="categoryId">
            <option value="">{{ 'All categories' | t }}</option>
            @for (c of categories(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select></label
        ><label
          >{{ 'Envelope month' | t
          }}<input name="month" type="month" [(ngModel)]="month" (change)="loadBudget()" /></label
        ><label
          >{{ 'Envelope' | t
          }}<select name="envelope" [(ngModel)]="envelopeId">
            <option value="">{{ 'All envelopes' | t }}</option>
            @for (e of budget()?.envelopes; track e.id) {
              <option [value]="e.id">{{ e.name }}</option>
            }
          </select></label
        ><label
          >{{ 'Type' | t
          }}<select name="kind" [(ngModel)]="kind">
            <option value="">{{ 'All types' | t }}</option>
            <option value="expense">{{ 'Expenses' | t }}</option>
            <option value="income">{{ 'Income' | t }}</option>
            <option value="transfer">{{ 'Transfers' | t }}</option>
          </select></label
        ><label
          >{{ 'Sort' | t
          }}<select name="sort" [(ngModel)]="sort">
            <option value="date">{{ 'Date' | t }}</option>
            <option value="amountHalalas">{{ 'Amount' | t }}</option>
          </select></label
        ><label
          >{{ 'Order' | t
          }}<select name="order" [(ngModel)]="order">
            <option value="desc">{{ 'Descending' | t }}</option>
            <option value="asc">{{ 'Ascending' | t }}</option>
          </select></label
        ><button class="secondary">{{ 'Apply filters' | t }}</button>
      </form>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (loading()) {
        <div class="skeleton" role="status">{{ 'Loading transactions…' | t }}</div>
      } @else if (data(); as d) {
        <div class="history-summary">
          <strong>{{ d.total }} records</strong
          ><span
            >Filtered expenses {{ d.totalSpentHalalas | sar }} · Income
            {{ d.totalIncomeHalalas | sar }} · Transfers {{ d.totalTransferredHalalas | sar }}</span
          >
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ 'Description' | t }}</th>
                <th>{{ 'Date' | t }}</th>
                <th>{{ 'Category / envelope' | t }}</th>
                <th>{{ 'Type' | t }}</th>
                <th>{{ 'Amount' | t }}</th>
                <th>{{ 'Actions' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (t of d.items; track t.id) {
                <tr>
                  <td>
                    <strong>{{ t.description }}</strong
                    ><small class="description">{{ t.merchant }} {{ t.notes }}</small>
                  </td>
                  <td>
                    {{ t.date }}<small class="description">{{ t.time }}</small>
                  </td>
                  <td>
                    {{ t.category?.name || '—'
                    }}<small class="description">{{ t.envelope?.name || 'Income' | t }}</small>
                  </td>
                  <td>
                    {{ t.kind }}<small class="description">{{ t.frequency }}</small>
                  </td>
                  <td>{{ t.amountHalalas | sar }}</td>
                  <td class="row-actions">
                    <a [routerLink]="['/finance/transactions', t.id, 'edit']">{{ 'Edit' | t }}</a
                    ><button class="text-button danger" (click)="deleting.set(t)">
                      {{ 'Delete' | t }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <div class="empty">
                      <h3>{{ 'No matching transactions' | t }}</h3>
                      <p>{{ 'Adjust your filters or record your first transaction.' | t }}</p>
                      <a routerLink="/finance/new">{{ 'Add transaction →' | t }}</a>
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
              {{ 'Previous' | t }}</button
            ><button
              class="secondary"
              [disabled]="page >= d.totalPages"
              (click)="page = page + 1; load()"
            >
              {{ 'Next' | t }}
            </button>
          </div>
        </div>
      }
    </section>
    @if (deleting(); as t) {
      <div class="modal-backdrop">
        <section
          class="card modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-finance"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (keydown.escape)="deleting.set(null)"
        >
          <h2 id="delete-finance">{{ 'Delete transaction?' | t }}</h2>
          <p>
            {{ t.description }} · {{ t.amountHalalas | sar }} will be removed. Reports and balances
            will recalculate.
          </p>
          <div class="form-actions">
            <button class="secondary" [disabled]="busy()" (click)="deleting.set(null)">
              {{ 'Keep transaction' | t }}</button
            ><button class="danger-button" [disabled]="busy()" (click)="remove(t)">
              {{ 'Delete transaction' | t }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
})
export class FinanceTransactionsPage {
  api = inject(Api);
  notice = inject(Notice);
  data = signal<TransactionPage | null>(null);
  categories = signal<FinanceCategory[]>([]);
  budget = signal<BudgetPlan | null>(null);
  loading = signal(true);
  error = signal('');
  busy = signal(false);
  deleting = signal<LedgerEntry | null>(null);
  page = 1;
  search = '';
  from = '';
  to = '';
  categoryId = '';
  envelopeId = '';
  kind = '';
  sort = 'date';
  order = 'desc';
  month = localDate('Asia/Riyadh').slice(0, 7);
  private seq = 0;
  constructor() {
    void this.init();
  }
  async init() {
    try {
      this.categories.set(await this.api.get<FinanceCategory[]>('finance/categories'));
      await this.loadBudget();
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
      this.loading.set(false);
    }
  }
  async loadBudget() {
    this.envelopeId = '';
    try {
      this.budget.set(await this.api.get<BudgetPlan>('finance/budget?month=' + this.month));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
  async load() {
    const seq = ++this.seq;
    this.loading.set(true);
    this.error.set('');
    try {
      const q = new URLSearchParams({
        page: String(this.page),
        sort: this.sort,
        order: this.order,
      });
      for (const [k, v] of Object.entries({
        search: this.search,
        from: this.from,
        to: this.to,
        categoryId: this.categoryId,
        envelopeId: this.envelopeId,
        kind: this.kind,
      }))
        if (v) q.set(k, v);
      const d = await this.api.get<TransactionPage>('finance/transactions?' + q);
      if (seq === this.seq) this.data.set(d);
    } catch (e) {
      if (seq === this.seq) this.error.set(errorMessage(e));
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }
  async remove(t: LedgerEntry) {
    this.busy.set(true);
    try {
      await this.api.send('DELETE', 'finance/transactions/' + t.id);
      this.deleting.set(null);
      this.page = 1;
      this.notice.show('Transaction deleted. Balances recalculated.');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
      this.deleting.set(null);
    } finally {
      this.busy.set(false);
    }
  }
}
