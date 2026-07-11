import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EBENEZAR Room Rental — Owner Dashboard" },
      {
        name: "description",
        content:
          "Manage 16 rooms, tenants and rent payments for EBENEZAR Room Rental. Track paid, partial and unpaid rooms at a glance.",
      },
      { property: "og:title", content: "EBENEZAR Room Rental — Owner Dashboard" },
      {
        property: "og:description",
        content: "A warm, simple dashboard for the boss to oversee every room and payment.",
      },
      { property: "og:type", content: "website" },
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

  const [tenantDialog, setTenantDialog] = useState<{
    open: boolean;
    form: TenantFormState;
    mode: "add" | "edit";
  }>({ open: false, form: emptyForm(1), mode: "add" });

  const [payDialog, setPayDialog] = useState<{
    open: boolean;
    tenant: Tenant | null;
    amount: string;
  }>({ open: false, tenant: null, amount: "" });

  const month = currentMonthKey();

  const byRoom = useMemo(() => {
    const map = new Map<number, Tenant>();
    tenants.forEach((t) => map.set(t.roomNumber, t));
    return map;
  }, [tenants]);

  const summary = useMemo(() => {
    let paid = 0,
      partial = 0,
      unpaid = 0,
      due = 0,
      expected = 0,
      collected = 0;
    tenants.forEach((t) => {
      const s = paymentStatusForMonth(t, payments, month);
      expected += s.due;
      collected += s.paid;
      if (s.label === "Paid") paid++;
      else if (s.label === "Partial") partial++;
      else if (s.label === "Unpaid") unpaid++;
      else due++;
    });
    const available = TOTAL_ROOMS - tenants.length;
    return { paid, partial, unpaid, due, available, expected, collected };
  }, [tenants, payments, month]);

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
    const status = paymentStatusForMonth(t, payments, month);
    setPayDialog({
      open: true,
      tenant: t,
      amount: String(status.balance || status.due),
    });
  }

  function submitPay() {
    const t = payDialog.tenant;
    const n = Number(payDialog.amount);
    if (!t || !n || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    recordPayment(t.id, n, month);
    toast.success(`Recorded ${formatZAR(n)} for ${t.name}`);
    setPayDialog({ open: false, tenant: null, amount: "" });
  }

  const prettyMonth = new Date().toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-right" />
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold leading-tight">
                  EBENEZAR Room Rental
                </h1>
                <p className="text-sm text-muted-foreground">
                  Owner dashboard · {prettyMonth}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-accent/60 px-3 py-1 font-medium text-accent-foreground">
              Rent {formatZAR(MONTHLY_RENT)} · due by 4th
            </span>
          </div>
        </div>
      </header>

      {/* Summary */}
      <section className="mx-auto max-w-7xl px-6 pt-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            icon={<Home className="h-4 w-4" />}
            label="Occupied"
            value={`${tenants.length}/${TOTAL_ROOMS}`}
            tone="primary"
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Paid"
            value={String(summary.paid)}
            tone="success"
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Partial"
            value={String(summary.partial)}
            tone="warning"
          />
          <StatCard
            icon={<XCircle className="h-4 w-4" />}
            label="Unpaid"
            value={String(summary.unpaid)}
            tone="danger"
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Available"
            value={String(summary.available)}
            tone="available"
          />
          <StatCard
            icon={<Wallet className="h-4 w-4" />}
            label="Collected"
            value={formatZAR(summary.collected)}
            hint={`of ${formatZAR(summary.expected)}`}
            tone="muted"
          />
        </div>
      </section>

      {/* Rooms grid */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Rooms</h2>
          <p className="text-xs text-muted-foreground">
            {hydrated ? "Tap a room to manage" : "Loading…"}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: TOTAL_ROOMS }, (_, i) => i + 1).map((room) => {
            const tenant = byRoom.get(room);
            return tenant ? (
              <TenantCard
                key={room}
                tenant={tenant}
                status={paymentStatusForMonth(tenant, payments, month)}
                onEdit={() => openEdit(tenant)}
                onRemove={() => {
                  if (confirm(`Remove ${tenant.name} from Room ${room}?`)) {
                    removeTenant(tenant.id);
                    toast.success(`Room ${room} is now available`);
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
      <Dialog
        open={tenantDialog.open}
        onOpenChange={(o) => setTenantDialog((s) => ({ ...s, open: o }))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {tenantDialog.mode === "add"
                ? `Add tenant — Room ${tenantDialog.form.roomNumber}`
                : `Edit tenant — Room ${tenantDialog.form.roomNumber}`}
            </DialogTitle>
            <DialogDescription>
              First-month rent is calculated pro-rata from the move-in date.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                value={tenantDialog.form.name}
                onChange={(e) =>
                  setTenantDialog((s) => ({
                    ...s,
                    form: { ...s.form, name: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Phone">
              <Input
                type="tel"
                value={tenantDialog.form.phone}
                onChange={(e) =>
                  setTenantDialog((s) => ({
                    ...s,
                    form: { ...s.form, phone: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Next of kin name">
              <Input
                value={tenantDialog.form.kinName}
                onChange={(e) =>
                  setTenantDialog((s) => ({
                    ...s,
                    form: { ...s.form, kinName: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Next of kin phone">
              <Input
                type="tel"
                value={tenantDialog.form.kinPhone}
                onChange={(e) =>
                  setTenantDialog((s) => ({
                    ...s,
                    form: { ...s.form, kinPhone: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Move-in date">
              <Input
                type="date"
                value={tenantDialog.form.moveInDate}
                onChange={(e) =>
                  setTenantDialog((s) => ({
                    ...s,
                    form: { ...s.form, moveInDate: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Room number">
              <Input
                type="number"
                min={1}
                max={TOTAL_ROOMS}
                value={tenantDialog.form.roomNumber}
                onChange={(e) =>
                  setTenantDialog((s) => ({
                    ...s,
                    form: {
                      ...s.form,
                      roomNumber: Math.max(
                        1,
                        Math.min(TOTAL_ROOMS, Number(e.target.value) || 1),
                      ),
                    },
                  }))
                }
                disabled={tenantDialog.mode === "edit"}
              />
            </Field>
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">First month rent (pro-rata): </span>
            <span className="font-semibold text-foreground">
              {formatZAR(proRataForMoveIn(tenantDialog.form.moveInDate))}
            </span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTenantDialog((s) => ({ ...s, open: false }))}
            >
              Cancel
            </Button>
            <Button onClick={submitTenant}>
              {tenantDialog.mode === "add" ? "Add tenant" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog
        open={payDialog.open}
        onOpenChange={(o) => setPayDialog((s) => ({ ...s, open: o }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Record payment</DialogTitle>
            <DialogDescription>
              {payDialog.tenant
                ? `${payDialog.tenant.name} · Room ${payDialog.tenant.roomNumber} · ${prettyMonth}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {payDialog.tenant && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due this month</span>
                  <span className="font-medium">
                    {formatZAR(rentDueForMonth(payDialog.tenant, month))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already paid</span>
                  <span className="font-medium">
                    {formatZAR(
                      paymentStatusForMonth(payDialog.tenant, payments, month).paid,
                    )}
                  </span>
                </div>
              </div>
              <Field label="Amount received (R)">
                <Input
                  type="number"
                  min={1}
                  value={payDialog.amount}
                  onChange={(e) =>
                    setPayDialog((s) => ({ ...s, amount: e.target.value }))
                  }
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayDialog({ open: false, tenant: null, amount: "" })}
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

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: "primary" | "success" | "warning" | "danger" | "available" | "muted";
}) {
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
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneMap[tone]}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold text-foreground">
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function TenantCard({
  tenant,
  status,
  onEdit,
  onRemove,
  onPay,
}: {
  tenant: Tenant;
  status: ReturnType<typeof paymentStatusForMonth>;
  onEdit: () => void;
  onRemove: () => void;
  onPay: () => void;
}) {
  const toneBar: Record<string, string> = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    muted: "bg-muted-foreground/40",
  };
  const toneBadge: Record<string, string> = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/25 text-warning-foreground",
    danger: "bg-danger/15 text-danger",
    muted: "bg-muted text-muted-foreground",
  };
  const badgeText =
    status.label === "Partial"
      ? `Owes ${formatZAR(status.balance)}`
      : status.label === "Paid"
        ? "Paid in full"
        : status.label === "Unpaid"
          ? `Unpaid · ${formatZAR(status.balance)}`
          : `Due ${formatZAR(status.balance)}`;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`h-1 w-full ${toneBar[status.tone]}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Room {tenant.roomNumber}
            </div>
            <h3 className="font-display text-lg font-semibold leading-tight text-foreground">
              {tenant.name}
            </h3>
            <div className="mt-0.5 text-sm text-muted-foreground">{tenant.phone}</div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${toneBadge[status.tone]}`}
          >
            {badgeText}
          </span>
        </div>

        <div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Next of kin</div>
          <div className="mt-0.5">
            {tenant.kinName || "—"}
            {tenant.kinPhone ? ` · ${tenant.kinPhone}` : ""}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            href={`tel:${normalizePhone(tenant.phone)}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Phone className="h-4 w-4" /> Call
          </a>
          <a
            href={`https://wa.me/${normalizePhone(tenant.phone).replace(/^\+/, "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-medium text-success-foreground transition hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPay}
            className="col-span-1"
            disabled={status.balance === 0}
          >
            <Wallet className="mr-1 h-4 w-4" /> Pay
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-danger hover:text-danger"
          >
            <UserMinus className="mr-1 h-4 w-4" /> Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyRoomCard({ room, onAdd }: { room: number; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="group flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card/40 p-5 text-center transition hover:border-primary hover:bg-card"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-available/15 text-available transition group-hover:scale-110">
        <Plus className="h-6 w-6" />
      </div>
      <div className="font-display text-lg font-semibold text-foreground">
        Room {room}
      </div>
      <div className="text-xs font-medium uppercase tracking-wider text-available">
        Available
      </div>
      <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <UserPlus className="h-3.5 w-3.5" /> Add tenant
      </div>
    </button>
  );
}
