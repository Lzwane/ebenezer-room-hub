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
};

export type Payment = {
  id: string;
  tenantId: string;
  month: string; // yyyy-mm
  amount: number;
  date: string; // ISO
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
    const tenant: Tenant = { ...t, id: crypto.randomUUID() };
    save({ ...cur, tenants: [...cur.tenants, tenant] });
  }, []);

  const updateTenant = useCallback((id: string, patch: Partial<Tenant>) => {
    const cur = load();
    save({
      ...cur,
      tenants: cur.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  }, []);

  const removeTenant = useCallback((id: string) => {
    const cur = load();
    save({
      tenants: cur.tenants.filter((t) => t.id !== id),
      payments: cur.payments.filter((p) => p.tenantId !== id),
    });
  }, []);

  const recordPayment = useCallback(
    (tenantId: string, amount: number, month: string) => {
      const cur = load();
      const payment: Payment = {
        id: crypto.randomUUID(),
        tenantId,
        month,
        amount,
        date: new Date().toISOString(),
      };
      save({ ...cur, payments: [...cur.payments, payment] });
    },
    [],
  );

  return { ...store, hydrated, addTenant, updateTenant, removeTenant, recordPayment };
}

// ---------- helpers ----------

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Pro-rata for the tenant's move-in month: days remaining (inclusive of move-in day) */
export function proRataForMoveIn(moveInISO: string): number {
  const d = new Date(moveInISO);
  const dim = daysInMonth(d.getFullYear(), d.getMonth());
  const daysRemaining = dim - d.getDate() + 1;
  return Math.round((MONTHLY_RENT / dim) * daysRemaining);
}

/** Amount owed for a given month for this tenant. */
export function rentDueForMonth(tenant: Tenant, monthKey: string): number {
  const moveIn = new Date(tenant.moveInDate);
  const tenantMonthKey = currentMonthKey(moveIn);
  if (monthKey < tenantMonthKey) return 0;
  if (monthKey === tenantMonthKey) return proRataForMoveIn(tenant.moveInDate);
  return MONTHLY_RENT;
}

export type PaymentStatus = {
  label: "Paid" | "Partial" | "Unpaid" | "Due";
  tone: "success" | "warning" | "danger" | "muted";
  paid: number;
  due: number;
  balance: number;
  overdue: boolean;
};

export function paymentStatusForMonth(
  tenant: Tenant,
  payments: Payment[],
  monthKey = currentMonthKey(),
  today = new Date(),
): PaymentStatus {
  const due = rentDueForMonth(tenant, monthKey);
  const paid = payments
    .filter((p) => p.tenantId === tenant.id && p.month === monthKey)
    .reduce((a, b) => a + b.amount, 0);
  const balance = Math.max(0, due - paid);
  const [y, m] = monthKey.split("-").map(Number);
  const isCurrent = today.getFullYear() === y && today.getMonth() + 1 === m;
  const overdue = isCurrent && today.getDate() > DUE_DAY && balance > 0;

  if (due === 0) {
    return { label: "Paid", tone: "success", paid, due, balance: 0, overdue: false };
  }
  if (balance === 0) return { label: "Paid", tone: "success", paid, due, balance, overdue: false };
  if (overdue && paid === 0)
    return { label: "Unpaid", tone: "danger", paid, due, balance, overdue };
  if (paid > 0) return { label: "Partial", tone: "warning", paid, due, balance, overdue };
  if (overdue) return { label: "Unpaid", tone: "danger", paid, due, balance, overdue };
  return { label: "Due", tone: "muted", paid, due, balance, overdue: false };
}

export function formatZAR(n: number) {
  return `R${n.toLocaleString("en-ZA")}`;
}

export function normalizePhone(p: string) {
  return p.replace(/[^\d+]/g, "");
}
