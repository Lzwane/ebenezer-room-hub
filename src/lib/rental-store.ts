import { useEffect, useState, useCallback } from "react";

export const MONTHLY_RENT = 2600;
export const DUE_DAY = 4;
export const TOTAL_ROOMS = 16;

export type Tenant = {
  id: string;
  roomNumber: number;
  name: string;
  phone: string;
  kinName: string;
  kinPhone: string;
  moveInDate: string; // ISO yyyy-mm-dd
  vacatedMonths?: string[]; // Array of month keys ("yyyy-mm") where this room was vacated
};

export type Payment = {
  id: string;
  tenantId: string;
  month: string; // yyyy-mm
  amount: number;
  date: string; // yyyy-mm-dd (The exact day they made the payment)
};

type Store = { tenants: Tenant[]; payments: Payment[] };

const KEY = "ebenezar-rental-v1";

function load(): Store {
  if (typeof window === "undefined") return { tenants: [], payments: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { tenants: [], payments: [] };
    return JSON.parse(raw);
  } catch {
    return { tenants: [], payments: [] };
  }
}

function save(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("rental-store-update"));
}

export function useRentalStore() {
  const [store, setStore] = useState<Store>({ tenants: [], payments: [] });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStore(load());
    setHydrated(true);
    const handler = () => setStore(load());
    window.addEventListener("rental-store-update", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("rental-store-update", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const addTenant = useCallback((t: Omit<Tenant, "id">) => {
    const cur = load();
    const tenant: Tenant = { ...t, id: crypto.randomUUID(), vacatedMonths: [] };
    save({ ...cur, tenants: [...cur.tenants, tenant] });
  }, []);

  const updateTenant = useCallback((id: string, patch: Partial<Tenant>) => {
    const cur = load();
    save({
      ...cur,
      tenants: cur.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  }, []);

  // Soft-remove: Marks the room as vacant ONLY for the specified target month
  const removeTenantForMonth = useCallback((id: string, monthKey: string) => {
    const cur = load();
    save({
      ...cur,
      tenants: cur.tenants.map((t) => {
        if (t.id === id) {
          const vacated = t.vacatedMonths || [];
          if (!vacated.includes(monthKey)) {
            return { ...t, vacatedMonths: [...vacated, monthKey] };
          }
        }
        return t;
      }),
    });
  }, []);

  const recordPayment = useCallback(
    (tenantId: string, amount: number, month: string, paymentDate: string) => {
      const cur = load();
      const payment: Payment = {
        id: crypto.randomUUID(),
        tenantId,
        month,
        amount,
        date: paymentDate,
      };
      save({ ...cur, payments: [...cur.payments, payment] });
    },
    [],
  );

  return { ...store, hydrated, addTenant, updateTenant, removeTenant: removeTenantForMonth, recordPayment };
}

// ---------- helpers ----------

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Automatically shifts the system target key to the upcoming month on the 29th
export function currentMonthKey(d = new Date()) {
  const targetDate = new Date(d.getTime());
  if (targetDate.getDate() >= 29) {
    targetDate.setMonth(targetDate.getMonth() + 1);
  }
  return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
}

export function proRataForMoveIn(moveInISO: string): number {
  const d = new Date(moveInISO);
  const dim = daysInMonth(d.getFullYear(), d.getMonth());
  const daysRemaining = dim - d.getDate() + 1;
  return Math.round((MONTHLY_RENT / dim) * daysRemaining);
}

export function rentDueForMonth(tenant: Tenant, monthKey: string): number {
  if (tenant.vacatedMonths?.includes(monthKey)) return 0;

  const moveIn = new Date(tenant.moveInDate);
  const moveInMonthKey = `${moveIn.getFullYear()}-${String(moveIn.getMonth() + 1).padStart(2, "0")}`;
  
  if (monthKey < moveInMonthKey) return 0;
  if (monthKey === moveInMonthKey) return proRataForMoveIn(tenant.moveInDate);
  return MONTHLY_RENT;
}

export type PaymentStatus = {
  label: "Paid" | "Partial" | "Unpaid" | "Due" | "Vacant";
  tone: "success" | "warning" | "danger" | "muted";
  paid: number;
  due: number;
  balance: number;
  overdue: boolean;
};

export function paymentStatusForMonth(
  tenant: Tenant | undefined,
  payments: Payment[],
  monthKey = currentMonthKey(),
  today = new Date(),
): PaymentStatus {

  if (!tenant || tenant.vacatedMonths?.includes(monthKey)) {
    return { label: "Vacant", tone: "muted", paid: 0, due: 0, balance: 0, overdue: false };
  }

  const due = rentDueForMonth(tenant, monthKey);
  const paid = payments
    .filter((p) => p.tenantId === tenant.id && p.month === monthKey)
    .reduce((a, b) => a + b.amount, 0);
  const balance = Math.max(0, due - paid);
  
  const [y, m] = monthKey.split("-").map(Number);
  const sysCurrentKey = currentMonthKey(today);
  const isTargetActiveMonth = monthKey === sysCurrentKey;
  const overdue = isTargetActiveMonth && today.getDate() > DUE_DAY && balance > 0;

  if (due === 0) {
    return { label: "Paid", tone: "success", paid, due, balance: 0, overdue: false };
  }
  if (balance === 0) return { label: "Paid", tone: "success", paid, due, balance, overdue: false };
  
  if (balance > 0 && paid === 0) {
    return { label: "Unpaid", tone: "danger", paid, due, balance, overdue: true };
  }
  if (paid > 0) return { label: "Partial", tone: "warning", paid, due, balance, overdue };
  return { label: "Due", tone: "muted", paid, due, balance, overdue: false };
}

// Dynamically structures previous month timelines, adding new space on the spreadsheet as soon as the 29th cutoff hits
export function getHistoricalMonths(tenants: Tenant[], today = new Date()): string[] {
  const months = ["2026-06", "2026-07"]; 
  
  // If today hits or crosses the 29th of July, force push August row space into the tracking matrix
  if (today.getDate() >= 29 && today.getMonth() === 6 && today.getFullYear() === 2026) {
    if (!months.includes("2026-08")) months.push("2026-08");
  }

  // Handle systemic layout expansion if time progresses past 2026
  const iterDate = new Date(2026, 7, 1);
  while (iterDate <= today) {
    const key = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, "0")}`;
    if (!months.includes(key)) months.push(key);
    iterDate.setMonth(iterDate.getMonth() + 1);
  }

  return months.sort().reverse();
}

export function formatZAR(n: number) {
  return `R${n.toLocaleString("en-ZA")}`;
}

export function normalizePhone(p: string) {
  return p.replace(/[^\d+]/g, "");
}