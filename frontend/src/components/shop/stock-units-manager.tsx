import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  Search,
  Filter,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { stockUnits as stockUnitsApi, getErrorMessage, type StockUnit } from "@/lib/api";
import { ImeiBulkInput } from "./imei-bulk-input";

const fmt = (n: number | string | undefined | null) => {
  const num = typeof n === "number" ? n : Number(n ?? 0);
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

function StatusBadge({ status }: { status: string }) {
  let cls = "status status-neutral";
  let label = status;
  if (status === "IN_STOCK") {
    cls = "status status-success";
    label = "In Stock";
  } else if (status === "SOLD") {
    cls = "status status-neutral";
    label = "Sold";
  } else if (status === "DAMAGED") {
    cls = "status status-danger";
    label = "Damaged";
  } else if (status === "RETURNED_TO_SUPPLIER") {
    cls = "status status-warning";
    label = "Returned";
  }
  return (
    <span className={cls}>
      <span />
      {label}
    </span>
  );
}

interface StockUnitsManagerProps {
  productId: string;
  productName: string;
  defaultPurchaseCost?: number;
  defaultSellingPrice?: number;
}

export function StockUnitsManager({
  productId,
  productName,
  defaultPurchaseCost = 0,
  defaultSellingPrice,
}: StockUnitsManagerProps) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [confirmDeleteUnit, setConfirmDeleteUnit] = useState<StockUnit | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["stock-units", productId, statusFilter, search],
    queryFn: () =>
      stockUnitsApi.list({
        productId,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: search.trim() || undefined,
        limit: 100,
      }),
  });

  const units = data?.units ?? [];

  const updateStatusMutation = useMutation({
    mutationFn: ({ unitId, status, notes }: { unitId: string; status: string; notes?: string }) =>
      stockUnitsApi.updateStatus(unitId, { status, notes }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["stock-units"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(`Unit status updated to ${vars.status}.`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (unitId: string) => stockUnitsApi.delete(unitId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-units"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Stock unit deleted.");
      setConfirmDeleteUnit(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      {/* Top action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search by IMEI or Serial…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs font-mono"
            />
          </div>
          <div className="flex items-center gap-1">
            {(["ALL", "IN_STOCK", "SOLD", "DAMAGED", "RETURNED_TO_SUPPLIER"] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`filter-chip ${statusFilter === st ? "filter-chip-active" : ""}`}
                style={{ fontSize: "11px", padding: "3px 8px" }}
                onClick={() => setStatusFilter(st)}
              >
                {st === "ALL" ? "All" : st === "IN_STOCK" ? "In Stock" : st === "SOLD" ? "Sold" : st === "DAMAGED" ? "Damaged" : "Returned"}
              </button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          onClick={() => setReceiveDialogOpen(true)}
        >
          <Plus size={14} className="mr-1" /> Receive More Units
        </Button>
      </div>

      {/* Table of units */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
          Loading stock units…
        </div>
      ) : units.length === 0 ? (
        <div className="p-8 text-center rounded-lg border border-dashed text-xs text-muted-foreground">
          No stock units found for this filter.
        </div>
      ) : (
        <div className="table-scroll desktop-table rounded-lg border">
          <table>
            <thead>
              <tr>
                <th>IMEI 1 / Serial</th>
                <th>IMEI 2</th>
                <th>Status</th>
                <th>Purchase Cost</th>
                <th>Selling Price</th>
                <th>Supplier / Ref</th>
                <th>Received</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono text-xs font-semibold">{u.imei1}</td>
                  <td className="font-mono text-xs text-muted-foreground">{u.imei2 ?? "—"}</td>
                  <td>
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="text-xs">{fmt(u.purchaseCost)}</td>
                  <td className="text-xs font-medium">
                    {u.sellingPrice != null ? fmt(u.sellingPrice) : "Default"}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {[u.supplier, u.purchaseRef].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {new Date(u.receivedAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {u.status === "IN_STOCK" && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
                            onClick={() =>
                              updateStatusMutation.mutate({ unitId: u.id, status: "DAMAGED" })
                            }
                            title="Mark as damaged"
                          >
                            Damaged
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-slate-600 hover:text-slate-800"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                unitId: u.id,
                                status: "RETURNED_TO_SUPPLIER",
                              })
                            }
                            title="Return to supplier"
                          >
                            Return
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDeleteUnit(u)}
                            title="Delete unsold unit"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </>
                      )}
                      {(u.status === "DAMAGED" || u.status === "RETURNED_TO_SUPPLIER") && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-50"
                          onClick={() =>
                            updateStatusMutation.mutate({ unitId: u.id, status: "IN_STOCK" })
                          }
                        >
                          <RotateCcw size={12} className="mr-1" /> Restore
                        </Button>
                      )}
                      {u.status === "SOLD" && (
                        <span className="text-xs text-muted-foreground italic">Sold</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog for Receiving More Units */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Receive Stock Units — {productName}</DialogTitle>
          <DialogDescription>
            Enter or scan IMEI numbers to add serialized inventory for this product model.
          </DialogDescription>
          <div className="pt-2">
            <ImeiBulkInput
              productId={productId}
              productName={productName}
              defaultPurchaseCost={defaultPurchaseCost}
              defaultSellingPrice={defaultSellingPrice}
              onSuccess={() => {
                setReceiveDialogOpen(false);
                refetch();
              }}
              onCancel={() => setReceiveDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Unit Dialog */}
      <Dialog open={!!confirmDeleteUnit} onOpenChange={(o) => !o && setConfirmDeleteUnit(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={18} /> Delete Stock Unit?
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete unit with IMEI{" "}
            <span className="font-mono font-bold text-foreground">
              {confirmDeleteUnit?.imei1}
            </span>
            ? This will decrease stock count by 1.
          </DialogDescription>
          <div className="dialog-actions mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteUnit(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => confirmDeleteUnit && deleteMutation.mutate(confirmDeleteUnit.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Confirm Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
