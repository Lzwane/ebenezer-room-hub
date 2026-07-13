// ---------- src/routes/history.tsx ----------
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  TOTAL_ROOMS,
  useRentalStore,
  getHistoricalMonths,
  paymentStatusForMonth,
  formatZAR,
} from "@/lib/rental-store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TableProperties } from "lucide-react";

export const Route = createFileRoute("/history")({
  component: HistorySpreadsheet,
});

function HistorySpreadsheet() {
  const { tenants, payments, hydrated } = useRentalStore();

  const roomNumbers = Array.from({ length: TOTAL_ROOMS }, (_, i) => i + 1);
  const pastMonths = getHistoricalMonths(tenants);

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading spreadsheet records…</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6 pb-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-6">
            <div className="flex flex-col gap-1">
              <CardTitle className="font-display text-2xl font-semibold flex items-center gap-2">
                <TableProperties className="h-6 w-6 text-primary" />
                Historical Monthly Spreadsheet
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Tracks rent status histories. Reaching the 29th automatically creates space for the next month's billing spreadsheet.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[180px] border-r font-medium text-foreground">Billing Month</TableHead>
                  {roomNumbers.map((room) => (
                    <TableHead key={room} className="text-center min-w-[150px] font-medium text-foreground">Room {room}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastMonths.map((monthKey) => (
                  <TableRow key={monthKey} className="hover:bg-transparent">
                    <TableCell className="font-medium border-r bg-muted/10 text-sm text-foreground">{formatMonthLabel(monthKey)}</TableCell>
                    
                    {roomNumbers.map((roomNumber) => {
                      const currentTenant = tenants.find((t) => t.roomNumber === roomNumber && !t.vacatedMonths?.includes(monthKey));
                      const status = paymentStatusForMonth(currentTenant, payments, monthKey);
                      const specificPayment = payments.find(p => p.month === monthKey && p.tenantId === currentTenant?.id);

                      if (status.label === "Vacant" || !currentTenant) {
                        return (
                          <TableCell key={roomNumber} className="text-center text-muted-foreground/50 italic text-xs bg-muted/5 p-4 border-b border-r border-dashed select-none">
                            room not occupied
                          </TableCell>
                        );
                      }

                      const badgeToneMap: Record<string, string> = {
                        Paid: "bg-success/15 text-success border-success/20",
                        Partial: "bg-warning/25 text-warning-foreground border-warning/30",
                        Unpaid: "bg-danger/15 text-danger border-danger/20",
                        Due: "bg-muted text-muted-foreground",
                      };

                      return (
                        <TableCell key={roomNumber} className="text-center p-4 border-r border-b">
                          <div className="truncate font-semibold text-sm text-foreground max-w-[135px] mx-auto">{currentTenant.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{formatZAR(status.paid)}</div>
                          
                          {specificPayment && (
                            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                              Paid: {formatDateLabel(specificPayment.date)}
                            </div>
                          )}

                          <div className="mt-2">
                            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded font-medium shadow-none tracking-wide ${badgeToneMap[status.label] || ""}`}>
                              {status.label}
                            </Badge>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}