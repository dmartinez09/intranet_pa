import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BudgetEntry {
  zona: string;
  rc: string;
  year: number;
  month: number;
  monto_usd: number;
}

export interface BudgetFile {
  budgets: {
    [year: string]: BudgetEntry[];
  };
  uploaded_at: { [year: string]: string };
}

export interface BudgetSummary {
  total: number;
  by_month: { month: number; total: number }[];
  by_zona: { zona: string; total: number }[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(__dirname, '../../data');
const BUDGETS_FILE = path.join(DATA_DIR, 'budgets.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readFile(): BudgetFile {
  ensureDataDir();
  if (!fs.existsSync(BUDGETS_FILE)) {
    const empty: BudgetFile = { budgets: {}, uploaded_at: {} };
    fs.writeFileSync(BUDGETS_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
  const raw = fs.readFileSync(BUDGETS_FILE, 'utf-8');
  return JSON.parse(raw) as BudgetFile;
}

function writeFile(data: BudgetFile): void {
  ensureDataDir();
  fs.writeFileSync(BUDGETS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class BudgetService {
  /**
   * Returns all budget entries for a given year.
   */
  getBudgetByYear(year: number): BudgetEntry[] {
    const data = readFile();
    return data.budgets[String(year)] || [];
  }

  /**
   * Returns budget entries for a specific year + month.
   */
  getBudgetByMonth(year: number, month: number): BudgetEntry[] {
    const entries = this.getBudgetByYear(year);
    return entries.filter((e) => e.month === month);
  }

  /**
   * Saves (replaces) the full budget for a given year.
   */
  saveBudget(year: number, entries: BudgetEntry[]): void {
    const data = readFile();

    // Ensure every entry has the correct year field
    const normalized = entries.map((e) => ({ ...e, year }));
    data.budgets[String(year)] = normalized;
    data.uploaded_at[String(year)] = new Date().toISOString();

    writeFile(data);
  }

  /**
   * Deletes the budget data for a given year.
   */
  deleteBudget(year: number): boolean {
    const data = readFile();
    const key = String(year);
    if (!data.budgets[key]) {
      return false;
    }
    delete data.budgets[key];
    delete data.uploaded_at[key];
    writeFile(data);
    return true;
  }

  /**
   * Returns an aggregated summary for a year: grand total, totals by month,
   * and totals by zona.
   */
  getBudgetSummary(year: number): BudgetSummary {
    const entries = this.getBudgetByYear(year);

    const total = entries.reduce((sum, e) => sum + e.monto_usd, 0);

    // --- by month ---
    const monthMap = new Map<number, number>();
    for (const e of entries) {
      monthMap.set(e.month, (monthMap.get(e.month) || 0) + e.monto_usd);
    }
    const by_month = Array.from(monthMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([month, total]) => ({ month, total }));

    // --- by zona ---
    const zonaMap = new Map<string, number>();
    for (const e of entries) {
      zonaMap.set(e.zona, (zonaMap.get(e.zona) || 0) + e.monto_usd);
    }
    const by_zona = Array.from(zonaMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([zona, total]) => ({ zona, total }));

    return { total, by_month, by_zona };
  }

  /**
   * Returns the list of years that have budget data.
   */
  getBudgetYears(): number[] {
    const data = readFile();
    return Object.keys(data.budgets)
      .map(Number)
      .sort((a, b) => a - b);
  }

  /**
   * Returns the ISO date string of the last upload for a year, or null.
   */
  getUploadDate(year: number): string | null {
    const data = readFile();
    return data.uploaded_at[String(year)] || null;
  }
}

export const budgetService = new BudgetService();
