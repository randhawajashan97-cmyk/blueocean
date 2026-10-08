import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const orderTypes = ["dine_in", "pickup", "delivery", "kerbside_pickup"] as const;
export const orderStatuses = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"] as const;

const createOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().regex(/^[+\d][\d\s-]{7,19}$/),
  orderDetails: z.string().trim().min(3).max(800),
  orderType: z.enum(orderTypes),
  deliveryAddress: z.string().trim().max(300),
  notes: z.string().trim().max(300),
}).refine((value) => value.orderType !== "delivery" || value.deliveryAddress.length >= 5, {
  path: ["deliveryAddress"],
  message: "Delivery address is required",
});

const trackOrderSchema = z.object({
  orderNumber: z.string().trim().regex(/^BO-[A-Z0-9]{8}$/),
  phone: z.string().trim().min(8).max(20),
});

const updateOrderSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(orderStatuses),
  staffNote: z.string().trim().max(300),
});

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => createOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedPhone = normalizePhone(data.customerPhone);
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_phone", normalizedPhone)
      .gte("created_at", cutoff);
    if (countError) throw new Error("We could not save your order. Please call the restaurant.");
    if ((count ?? 0) >= 5) throw new Error("Too many recent requests. Please call the restaurant for help.");
    const orderNumber = `BO-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_name: data.customerName,
        customer_phone: normalizedPhone,
        order_details: data.orderDetails,
        order_type: data.orderType,
        delivery_address: data.orderType === "delivery" ? data.deliveryAddress : null,
        notes: data.notes || null,
      })
      .select("order_number,status,created_at")
      .single();
    if (error || !order) throw new Error("We could not save your order. Please call the restaurant.");
    return order;
  });

export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => trackOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("order_number,order_type,status,staff_note,created_at,updated_at")
      .eq("order_number", data.orderNumber.toUpperCase())
      .eq("customer_phone", normalizePhone(data.phone))
      .maybeSingle();
    if (error) throw new Error("Status is temporarily unavailable.");
    return order;
  });

export const listStaffOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" });
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!allowed && !admin) throw new Error("Staff access is required.");
    const { data, error } = await context.supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Orders could not be loaded.");
    return data;
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" });
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!allowed && !admin) throw new Error("Staff access is required.");
    const { data: order, error } = await context.supabase
      .from("orders")
      .update({ status: data.status, staff_note: data.staffNote || null })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error("Order status could not be updated.");
    return order;
  });