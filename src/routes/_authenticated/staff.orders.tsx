import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, LogOut, RefreshCw, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listStaffOrders, orderStatuses, updateOrderStatus } from "@/lib/orders.functions";

const labels = {
  dine_in: "Dine-in", pickup: "Pickup", delivery: "Delivery", kerbside_pickup: "Kerbside pickup",
  pending: "Pending", confirmed: "Confirmed", preparing: "Preparing", ready: "Ready",
  out_for_delivery: "Out for delivery", completed: "Completed", cancelled: "Cancelled",
};

export const Route = createFileRoute("/_authenticated/staff/orders")({
  head: () => ({ meta: [
    { title: "Order Management | Blue Ocean" },
    { name: "description", content: "Blue Ocean staff order management." },
    { property: "og:title", content: "Blue Ocean Order Management" },
    { property: "og:description", content: "Private Blue Ocean staff order management." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: StaffOrders,
});

function StaffOrders() {
  const fetchOrders = useServerFn(listStaffOrders);
  const saveStatus = useServerFn(updateOrderStatus);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const orders = useQuery({ queryKey: ["staff-orders"], queryFn: () => fetchOrders(), retry: false });
  const update = useMutation({
    mutationFn: (data: { id: string; status: typeof orderStatuses[number]; staffNote: string }) => saveStatus({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-orders"] }),
  });

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/auth" });
  }

  const visible = orders.data?.filter((order) => filter === "all" || order.status === filter) ?? [];

  return <main className="min-h-screen bg-surface-strong">
    <header className="border-b border-border bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Link to="/" className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-primary-foreground text-primary"><UtensilsCrossed className="size-4" /></span><span className="font-display text-xl font-bold">Blue Ocean</span></Link>
        <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={signOut}><LogOut className="size-4" /> Sign out</Button>
      </div>
    </header>
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="eyebrow text-primary">Staff panel</p><h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Orders</h1><p className="mt-2 text-muted-foreground">Confirm, prepare, complete, or cancel customer orders.</p></div>
        <Button variant="outline" onClick={() => orders.refetch()} disabled={orders.isFetching}><RefreshCw className={`size-4 ${orders.isFetching ? "animate-spin" : ""}`} /> Refresh</Button>
      </div>
      <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
        {["all", ...orderStatuses].map((status) => <Button key={status} size="sm" variant={filter === status ? "primary" : "outline"} onClick={() => setFilter(status)}>{status === "all" ? "All" : labels[status]}</Button>)}
      </div>
      {orders.isLoading && <p className="mt-10 text-muted-foreground">Loading orders…</p>}
      {orders.error && <div role="alert" className="mt-10 border border-destructive/30 bg-background p-6"><h2 className="font-semibold">Orders unavailable</h2><p className="mt-2 text-sm text-muted-foreground">{orders.error.message}</p></div>}
      {!orders.isLoading && !orders.error && visible.length === 0 && <div className="mt-10 flex flex-col items-center bg-background px-6 py-16 text-center"><ClipboardList className="size-10 text-muted-foreground"/><h2 className="mt-4 font-display text-2xl font-bold">No orders here</h2><p className="mt-2 text-sm text-muted-foreground">New customer orders will appear in this panel.</p></div>}
      <div className="mt-8 grid gap-4">
        {visible.map((order) => <article key={order.id} className="bg-background p-5 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div><p className="font-mono text-sm font-bold text-primary">{order.order_number}</p><h2 className="mt-1 text-xl font-bold">{order.customer_name}</h2><p className="text-sm text-muted-foreground">{order.customer_phone} · {labels[order.order_type]}</p></div>
            <div className="sm:text-right"><span className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{labels[order.status]}</span><p className="mt-2 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p></div>
          </div>
          <p className="mt-5 whitespace-pre-wrap border-l-2 border-primary pl-4 leading-7">{order.order_details}</p>
          {order.delivery_address && <p className="mt-4 text-sm"><strong>Address:</strong> {order.delivery_address}</p>}
          {order.notes && <p className="mt-2 text-sm"><strong>Customer note:</strong> {order.notes}</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-[220px_1fr_auto]">
            <select aria-label={`Status for ${order.order_number}`} defaultValue={order.status} id={`status-${order.id}`} className="form-control">
              {orderStatuses.map((status) => <option key={status} value={status}>{labels[status]}</option>)}
            </select>
            <input aria-label={`Staff note for ${order.order_number}`} id={`note-${order.id}`} defaultValue={order.staff_note ?? ""} maxLength={300} placeholder="Note visible to customer" className="form-control" />
            <Button disabled={update.isPending} onClick={() => {
              const statusEl = document.getElementById(`status-${order.id}`) as HTMLSelectElement | null;
              const noteEl = document.getElementById(`note-${order.id}`) as HTMLInputElement | null;
              if (!statusEl || !noteEl) return;
              update.mutate({ id: order.id, status: statusEl.value as typeof orderStatuses[number], staffNote: noteEl.value });
            }}>Save</Button>
          </div>
        </article>)}
      </div>
    </section>
  </main>;
}