import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Phone,
  MessageCircle,
  Plus,
  UserPlus,
  UserMinus,
  Wallet,
  Home,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Pencil,
  CalendarX,
  History,
  ChevronDown,
} from "lucide-react";
import {
  TOTAL_ROOMS,
  MONTHLY_RENT,
  currentMonthKey,
  formatZAR,
  normalizePhone,
  paymentStatusForMonth,
  proRataForMoveIn,
  rentDueForMonth,
  useRentalStore,
  getHistoricalMonths,
  type Tenant,
} from "@/lib/rental-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EBENEZAR Room Rental — Owner Dashboard" },
      {
        name: "description",
        content: "Manage rooms, tenants and rent payments for EBENEZAR Room Rental.",
      },
    ],
  }),
  component: Dashboard,
});

type TenantFormState = Omit<Tenant, "id"> & { id?: string };

function emptyForm(roomNumber: number): TenantFormState {
  return {
    roomNumber,
    name: "",
    phone: "",
    kinName: "",
    kinPhone: "",
    moveInDate: new Date().toISOString().slice(0, 10),
  };
}

function Dashboard() {
  const store = useRentalStore();
  const {
    tenants,
    payments,
    hydrated,
    addTenant,
    updateTenant,
    removeTenant,
    recordPayment,
  } = store;

  // Track selected month, defaulting automatically to the current month when the app loads
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey());

  const [tenantDialog, setTenantDialog] = useState<{
    open: boolean;
    form: TenantFormState;
    mode: "add" | "edit";
  }>({ open: false, form: emptyForm(1), mode: "add" });

  const [payDialog, setPayDialog] = useState<{
    open: boolean;
    tenant: Tenant | null;
    amount: string;
    date: string; // <-- Add the type declaration here
  }>({ 
    open: false, 
    tenant: null, 
    amount: "", 
    date: new Date().toISOString().slice(0, 10) // <-- Set the default day here
  });

  // 29th Rule Detection Check for the selected viewing cycle
  const isPast29th = useMemo(() => {
    const today = new Date();
    return today.getDate() >= 29 && selectedMonth === currentMonthKey();
  }, [selectedMonth]);

  const availableMonths = useMemo(() => getHistoricalMonths(tenants), [tenants]);

  // Update this block in src/routes/index.tsx
  const byRoom = useMemo(() => {
    const map = new Map<number, Tenant>();
    tenants.forEach((t) => {
      // If the tenant has been removed/vacated for this specific month, do not map them
      if (t.vacatedMonths?.includes(selectedMonth)) {
        return;
      }
      map.set(t.roomNumber, t);
    });
    return map;
  }, [tenants, selectedMonth]);

  const summary = useMemo(() => {
    let paid = 0,
      partial = 0,
      unpaid = 0,
      due = 0,
      expected = 0,
      collected = 0;
      
    tenants.forEach((t) => {
      const s = paymentStatusForMonth(t, payments, selectedMonth);
      expected += s.due;
      collected += s.paid;
      
      if (isPast29th) {
        unpaid++;
      } else {
        if (s.label === "Paid") paid++;
        else if (s.label === "Partial") partial++;
        else if (s.label === "Unpaid") unpaid++;
        else due++;
      }
    });
    
    if (isPast29th) {
      paid = 0;
      partial = 0;
      due = 0;
    }

    const available = TOTAL_ROOMS - tenants.length;
    return { paid, partial, unpaid, due, available, expected, collected };
  }, [tenants, payments, selectedMonth, isPast29th]);

  function openAdd(roomNumber: number) {
    setTenantDialog({ open: true, form: emptyForm(roomNumber), mode: "add" });
  }
  function openEdit(t: Tenant) {
    setTenantDialog({ open: true, form: { ...t }, mode: "edit" });
  }

  function submitTenant() {
    const f = tenantDialog.form;
    if (!f.name.trim() || !f.phone.trim()) {
      toast.error("Tenant name and phone are required");
      return;
    }
    if (
      tenantDialog.mode === "add" &&
      tenants.some((t) => t.roomNumber === f.roomNumber)
    ) {
      toast.error(`Room ${f.roomNumber} is already occupied`);
      return;
    }
    if (tenantDialog.mode === "add") {
      addTenant(f);
      toast.success(`${f.name} added to Room ${f.roomNumber}`);
    } else if (f.id) {
      updateTenant(f.id, f);
      toast.success("Tenant updated");
    }
    setTenantDialog((s) => ({ ...s, open: false }));
  }

  function openPay(t: Tenant) {
  const status = paymentStatusForMonth(t, payments, selectedMonth);
  setPayDialog({
    open: true,
    tenant: t,
    amount: String(status.balance || status.due),
    // Sets it to the first day of the month you are editing, ready for you to pick the exact day
    date: `${selectedMonth}-01`, 
  });
}

  function submitPay() {
    const t = payDialog.tenant;
    const n = Number(payDialog.amount);
    if (!t || !n || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    recordPayment(t.id, n, selectedMonth, payDialog.date);
      toast.success(`Recorded ${formatZAR(n)} for ${t.name}`);
      setPayDialog({ 
        open: false, 
        tenant: null, 
        amount: "", 
        date: new Date().toISOString().slice(0, 10) // <-- Add this line
      });
  }

  const humanReadableMonth = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-ZA", {
      month: "long",
      year: "numeric",
    });
  }, [selectedMonth]);

  return (
    <div className="min-h-screen pb-12">
      <Toaster richColors position="top-right" />
      
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold leading-tight">
                EBENEZAR Room Rental
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-muted-foreground">Viewing Month:</span>
                {/* Dynamic Month Dropdown Selector */}
                <div className="relative inline-block">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="appearance-none bg-muted/60 hover:bg-muted text-foreground px-3 py-1 pr-8 rounded-lg text-sm font-medium focus:outline-none cursor-pointer border border-border/40"
                  >
                    {availableMonths.map((mKey) => {
                      const [y, m] = mKey.split("-").map(Number);
                      const label = new Date(y, m - 1, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
                      return (
                        <option key={mKey} value={mKey}>
                          {label} {mKey === currentMonthKey() ? "(Current)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/history"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground"
            >
              <History className="h-4 w-4" />
              View History Spreadsheet
            </Link>
          </div>
        </div>
      </header>

      {/* 29th Cutoff Alert Banner */}
      {isPast29th && (
        <section className="mx-auto max-w-7xl px-6 pt-6">
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5 text-destructive">
            <CalendarX className="h-4 w-4" />
            <AlertTitle className="font-semibold tracking-wide">Attention: End of Month Cycle</AlertTitle>
            <AlertDescription className="text-xs opacity-90">
              It is past the 29th of the month. Dashboard views are preparing billing sequences for next month.
            </AlertDescription>
          </Alert>
        </section>
      )}

      {/* Summary Metrics Cards Grid */}
      <section className="mx-auto max-w-7xl px-6 pt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={<Home className="h-4 w-4" />} label="Occupied" value={`${tenants.length}/${TOTAL_ROOMS}`} tone="primary" />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Paid" value={String(summary.paid)} tone="success" />
          <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Partial" value={String(summary.partial)} tone="warning" />
          <StatCard icon={<XCircle className="h-4 w-4" />} label="Unpaid" value={String(summary.unpaid)} tone="danger" />
          <StatCard icon={<Clock className="h-4 w-4" />} label="Available" value={String(summary.available)} tone="available" />
          <StatCard icon={<Wallet className="h-4 w-4" />} label="Collected" value={formatZAR(summary.collected)} hint={`of ${formatZAR(summary.expected)}`} tone="muted" />
        </div>
      </section>

      {/* Rooms Grid */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Rooms ({humanReadableMonth})</h2>
          <p className="text-xs text-muted-foreground">
            {hydrated ? "Click a room to modify data fields" : "Loading store items…"}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: TOTAL_ROOMS }, (_, i) => i + 1).map((room) => {
            const tenant = byRoom.get(room);
            return tenant ? (
              <TenantCard
                key={room}
                tenant={tenant}
                status={paymentStatusForMonth(tenant, payments, selectedMonth)}
                isPast29th={isPast29th}
                selectedMonth={selectedMonth}
                onEdit={() => openEdit(tenant)}
                onRemove={() => {
                  if (confirm(`Remove ${tenant.name} from Room ${room}?`)) {
                    removeTenant(tenant.id, selectedMonth);
                    toast.success(`Room ${room} is now vacant`);
                  }
                }}
                onPay={() => openPay(tenant)}
              />
            ) : (
              <EmptyRoomCard key={room} room={room} onAdd={() => openAdd(room)} />
            );
          })}
        </div>
      </main>

      {/* Tenant dialog */}
      <Dialog open={tenantDialog.open} onOpenChange={(o) => setTenantDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {tenantDialog.mode === "add" ? `Add tenant — Room ${tenantDialog.form.roomNumber}` : `Edit tenant — Room ${tenantDialog.form.roomNumber}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name"><Input value={tenantDialog.form.name} onChange={(e) => setTenantDialog((s) => ({ ...s, form: { ...s.form, name: e.target.value } }))} /></Field>
            <Field label="Phone"><Input type="tel" value={tenantDialog.form.phone} onChange={(e) => setTenantDialog((s) => ({ ...s, form: { ...s.form, phone: e.target.value } }))} /></Field>
            <Field label="Next of kin name"><Input value={tenantDialog.form.kinName} onChange={(e) => setTenantDialog((s) => ({ ...s, form: { ...s.form, kinName: e.target.value } }))} /></Field>
            <Field label="Next of kin phone"><Input type="tel" value={tenantDialog.form.kinPhone} onChange={(e) => setTenantDialog((s) => ({ ...s, form: { ...s.form, kinPhone: e.target.value } }))} /></Field>
            <Field label="Move-in date"><Input type="date" value={tenantDialog.form.moveInDate} onChange={(e) => setTenantDialog((s) => ({ ...s, form: { ...s.form, moveInDate: e.target.value } }))} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTenantDialog((s) => ({ ...s, open: false }))}>Cancel</Button>
            <Button onClick={submitTenant}>{tenantDialog.mode === "add" ? "Add tenant" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={payDialog.open} onOpenChange={(o) => setPayDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Record payment</DialogTitle>
            <DialogDescription>
              {payDialog.tenant ? `${payDialog.tenant.name} · Room ${payDialog.tenant.roomNumber} · ${humanReadableMonth}` : ""}
            </DialogDescription>
          </DialogHeader>
          {payDialog.tenant && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due this month</span>
                  <span className="font-medium">{formatZAR(rentDueForMonth(payDialog.tenant, selectedMonth))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already paid</span>
                  <span className="font-medium">{formatZAR(paymentStatusForMonth(payDialog.tenant, payments, selectedMonth).paid)}</span>
                </div>
              </div>
              <Field label="Amount received (R)">
                <Input type="number" min={1} value={payDialog.amount} onChange={(e) => setPayDialog((s) => ({ ...s, amount: e.target.value }))} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setPayDialog({ 
                open: false, 
                tenant: null, 
                amount: "", 
                date: new Date().toISOString().slice(0, 10) // <-- Add this line here
              })}
            >
              Cancel
            </Button>
            <Button onClick={submitPay}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone: "primary" | "success" | "warning" | "danger" | "available" | "muted" }) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-danger/15 text-danger",
    available: "bg-available/15 text-available",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneMap[tone]}`}>{icon}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function TenantCard({ tenant, status, isPast29th, selectedMonth, onEdit, onRemove, onPay }: { tenant: Tenant; status: any; isPast29th: boolean; selectedMonth: string; onEdit: () => void; onRemove: () => void; onPay: () => void }) {
  const toneBar: Record<string, string> = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", muted: "bg-muted-foreground/40" };
  const toneBadge: Record<string, string> = { success: "bg-success/15 text-success", warning: "bg-warning/25 text-warning-foreground", danger: "bg-danger/15 text-danger", muted: "bg-muted text-muted-foreground" };

  const displayTone = isPast29th ? "danger" : status.tone;
  const badgeText = isPast29th
    ? `Unpaid · ${formatZAR(MONTHLY_RENT)}`
    : status.label === "Partial"
      ? `Owes ${formatZAR(status.balance)}`
      : status.label === "Paid"
        ? "Paid in full"
        : status.label === "Unpaid"
          ? `Unpaid · ${formatZAR(status.balance)}`
          : `Due ${formatZAR(status.balance)}`;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`h-1 w-full ${toneBar[displayTone]}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Room {tenant.roomNumber}</div>
            <h3 className="font-display text-lg font-semibold leading-tight text-foreground">{tenant.name}</h3>
            <div className="mt-0.5 text-sm text-muted-foreground">{tenant.phone}</div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${toneBadge[displayTone]}`}>{badgeText}</span>
        </div>

        <div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Next of kin</div>
          <div className="mt-0.5">{tenant.kinName || "—"}{tenant.kinPhone ? ` · ${tenant.kinPhone}` : ""}</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`tel:${normalizePhone(tenant.phone)}`} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"><Phone className="h-4 w-4" /> Call</a>
          <a href={`https://wa.me/${normalizePhone(tenant.phone).replace(/^\+/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-medium text-success-foreground transition hover:opacity-90"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={onPay} disabled={!isPast29th && status.balance === 0} className="col-span-1">
            <Wallet className="mr-1 h-4 w-4" /> Pay
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="mr-1 h-4 w-4" /> Edit</Button>
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-danger hover:text-danger"><UserMinus className="mr-1 h-4 w-4" /> Remove</Button>
        </div>
      </div>
    </div>
  );
}

function EmptyRoomCard({ room, onAdd }: { room: number; onAdd: () => void }) {
  return (
    <button onClick={onAdd} className="group flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card/40 p-5 text-center transition hover:border-primary hover:bg-card">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-available/15 text-available transition group-hover:scale-110"><Plus className="h-6 w-6" /></div>
      <div className="font-display text-lg font-semibold text-foreground">Room {room}</div>
      <div className="text-xs font-medium uppercase tracking-wider text-available">Available</div>
      <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><UserPlus className="h-3.5 w-3.5" /> Add tenant</div>
    </button>
  );
}