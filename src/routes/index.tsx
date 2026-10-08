import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  ShoppingBag,
  Star,
  Search,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { createOrder, trackOrder } from "@/lib/orders.functions";
import heroImage from "@/assets/blue-ocean-hero.jpg";
import pizzaImage from "@/assets/menu-pizza.jpg";
import snacksImage from "@/assets/menu-snacks.jpg";

const PHONE_DISPLAY = "098775 09435";
const PHONE_LINK = "+919877509435";
const WHATSAPP_NUMBER = "919877509435";
const DIRECTIONS_URL =
  "https://www.google.com/maps/search/?api=1&query=Blue+Ocean+Umra+Nangal+Baba+Bakala+Punjab+143112";

const orderSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your name.").max(80),
    phone: z.string().trim().regex(/^[+\d][\d\s-]{7,15}$/, "Please enter a valid phone number."),
    order: z.string().trim().min(3, "Please tell us what you would like.").max(800),
    fulfilment: z.enum(["Dine-in", "Pickup", "Delivery", "Kerbside pickup"]),
    address: z.string().trim().max(300),
    notes: z.string().trim().max(300),
  })
  .refine((data) => data.fulfilment !== "Delivery" || data.address.length >= 5, {
    path: ["address"],
    message: "Please enter a delivery address.",
  });

type OrderData = z.infer<typeof orderSchema>;
type FormErrors = Partial<Record<keyof OrderData, string>>;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blue Ocean Restaurant | Umra Nangal, Baba Bakala" },
      {
        name: "description",
        content:
          "Visit Blue Ocean restaurant in Umra Nangal, Baba Bakala. Explore menu highlights, call, get directions, or send an order request on WhatsApp.",
      },
      { property: "og:title", content: "Blue Ocean Restaurant | Umra Nangal" },
      {
        property: "og:description",
        content: "Fresh flavours, friendly service, and easy WhatsApp ordering in Baba Bakala, Punjab.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function OrderPanel({ children }: { children: React.ReactNode }) {
  const saveOrder = useServerFn(createOrder);
  const [open, setOpen] = useState(false);
  const [fulfilment, setFulfilment] = useState<OrderData["fulfilment"]>("Pickup");
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [savedOrder, setSavedOrder] = useState<{ orderNumber: string; whatsappUrl: string } | null>(null);

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = orderSchema.safeParse({
      name: form.get("name"),
      phone: form.get("phone"),
      order: form.get("order"),
      fulfilment,
      address: form.get("address") ?? "",
      notes: form.get("notes") ?? "",
    });

    if (!result.success) {
      const nextErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof OrderData;
        if (!nextErrors[field]) nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({}); setSubmitError(""); setBusy(true);
    const data = result.data;
    const lines = [
      "Hello Blue Ocean! I’d like to request an order:",
      "",
      `Name: ${data.name}`,
      `Phone: ${data.phone}`,
      `Order: ${data.order}`,
      `Service: ${data.fulfilment}`,
      ...(data.fulfilment === "Delivery" ? [`Address: ${data.address}`] : []),
      ...(data.notes ? [`Notes: ${data.notes}`] : []),
      "",
      "Please confirm availability, total price, and timing. Thank you!",
    ];
    try {
      const saved = await saveOrder({ data: {
        customerName: data.name,
        customerPhone: data.phone,
        orderDetails: data.order,
        orderType: ({ "Dine-in": "dine_in", Pickup: "pickup", Delivery: "delivery", "Kerbside pickup": "kerbside_pickup" } as const)[data.fulfilment],
        deliveryAddress: data.address,
        notes: data.notes,
      } });
      lines.splice(1, 0, `Order number: ${saved.order_number}`);
      setSavedOrder({ orderNumber: saved.order_number, whatsappUrl: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}` });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "We could not save your order. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-background shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right">
          <div className="flex items-start justify-between border-b border-border px-6 py-5 sm:px-8">
            <div>
              <p className="eyebrow text-whatsapp">WhatsApp order</p>
              <Dialog.Title className="mt-1 font-display text-3xl font-bold text-foreground">What can we prepare?</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                Build your request, then review and send it in WhatsApp.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close order panel">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          {savedOrder ? <div className="flex flex-1 flex-col items-center justify-center px-7 py-12 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-accent text-whatsapp"><Check className="size-8" /></span>
            <h2 className="mt-5 font-display text-3xl font-bold">Order request saved</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Keep this order number to check confirmation or cancellation status.</p>
            <p className="mt-5 rounded-md bg-surface-strong px-5 py-3 font-mono text-xl font-bold text-primary">{savedOrder.orderNumber}</p>
            <Button asChild variant="whatsapp" className="mt-7 h-12 w-full"><a href={savedOrder.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle className="size-5" /> Send details on WhatsApp</a></Button>
            <Dialog.Close asChild><Button variant="ghost" className="mt-3">Close</Button></Dialog.Close>
          </div> : <form onSubmit={submitOrder} className="flex flex-1 flex-col overflow-y-auto">
            <div className="space-y-5 px-6 py-6 sm:px-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Your name" name="name" error={errors.name} placeholder="Your name" maxLength={80} />
                <FormField label="Phone number" name="phone" error={errors.phone} placeholder="e.g. 98765 43210" maxLength={16} inputMode="tel" />
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-foreground">How would you like it?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["Dine-in", "Pickup", "Delivery", "Kerbside pickup"] as const).map((option) => (
                    <Button
                      key={option}
                      variant={fulfilment === option ? "primary" : "outline"}
                      onClick={() => setFulfilment(option)}
                      aria-pressed={fulfilment === option}
                      className="w-full"
                    >
                      {fulfilment === option && <Check className="size-4" />}
                      {option}
                    </Button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="order" className="mb-2 block text-sm font-semibold text-foreground">Your order</label>
                <textarea id="order" name="order" rows={5} maxLength={800} placeholder="Tell us the items and quantities you’d like…" className="form-control resize-none" aria-invalid={Boolean(errors.order)} />
                {errors.order && <p className="mt-1 text-sm text-destructive">{errors.order}</p>}
                <p className="mt-2 text-xs text-muted-foreground">Menu availability and prices will be confirmed by the restaurant.</p>
              </div>
              {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}

              {fulfilment === "Delivery" && (
                <div>
                  <label htmlFor="address" className="mb-2 block text-sm font-semibold text-foreground">Delivery address</label>
                  <textarea id="address" name="address" rows={3} maxLength={300} placeholder="House, street, village and a nearby landmark" className="form-control resize-none" aria-invalid={Boolean(errors.address)} />
                  {errors.address && <p className="mt-1 text-sm text-destructive">{errors.address}</p>}
                </div>
              )}

              <div>
                <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-foreground">Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
                <textarea id="notes" name="notes" rows={2} maxLength={300} placeholder="Any preferences or questions?" className="form-control resize-none" />
              </div>
            </div>

            <div className="sticky bottom-0 mt-auto border-t border-border bg-background px-6 py-5 sm:px-8">
              <Button type="submit" variant="whatsapp" className="h-12 w-full text-base" disabled={busy}>
                <MessageCircle className="size-5" /> {busy ? "Saving order…" : "Place order request"}
              </Button>
              <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">This sends a request, not a confirmed order. Blue Ocean will confirm price and timing.</p>
            </div>
          </form>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TrackOrderPanel({ children }: { children: React.ReactNode }) {
  const lookup = useServerFn(trackOrder);
  const [order, setOrder] = useState<Awaited<ReturnType<typeof trackOrder>> | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage(""); setOrder(null);
    try {
      const result = await lookup({ data: { orderNumber: String(form.get("orderNumber") ?? "").trim().toUpperCase(), phone: String(form.get("phone") ?? "").trim() } });
      if (!result) setMessage("No matching order was found. Check the order number and phone."); else setOrder(result);
    } catch { setMessage("Please enter a valid order number and phone."); }
    finally { setBusy(false); }
  }
  const labels: Record<string, string> = { pending: "Pending", confirmed: "Confirmed", preparing: "Preparing", ready: "Ready", out_for_delivery: "Out for delivery", completed: "Completed", cancelled: "Cancelled", dine_in: "Dine-in", pickup: "Pickup", delivery: "Delivery", kerbside_pickup: "Kerbside pickup" };
  return <Dialog.Root><Dialog.Trigger asChild>{children}</Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/55 backdrop-blur-sm"/><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 bg-background p-7 shadow-2xl sm:p-9"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-primary">Order status</p><Dialog.Title className="mt-2 font-display text-3xl font-bold">Track your order</Dialog.Title></div><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close tracking panel"><X className="size-5"/></Button></Dialog.Close></div><Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">Enter the order number and phone used when ordering.</Dialog.Description><form onSubmit={submit} className="mt-7 space-y-4"><FormField label="Order number" name="orderNumber" placeholder="BO-1234ABCD" maxLength={11}/><FormField label="Phone number" name="phone" placeholder="98775 09435" maxLength={20} inputMode="tel"/><Button type="submit" className="w-full" disabled={busy}><Search className="size-4"/>{busy ? "Checking…" : "Check status"}</Button></form>{message && <p role="alert" className="mt-5 text-sm text-destructive">{message}</p>}{order && <div className="mt-6 border-t border-border pt-6"><div className="flex items-center justify-between gap-4"><span className="font-mono font-bold text-primary">{order.order_number}</span><span className={`rounded-full px-3 py-1 text-sm font-bold ${order.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}>{labels[order.status]}</span></div><p className="mt-4 text-sm text-muted-foreground">{labels[order.order_type]} · Updated {new Date(order.updated_at).toLocaleString()}</p>{order.staff_note && <p className="mt-4 rounded-md bg-surface-strong p-4 text-sm leading-6"><strong>Restaurant note:</strong> {order.staff_note}</p>}</div>}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function FormField({ label, name, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: keyof OrderData; error?: string | undefined }) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-semibold text-foreground">{label}</label>
      <input id={name} name={name} className="form-control" aria-invalid={Boolean(error)} {...props} />
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-primary-foreground/15 bg-primary/90 text-primary-foreground backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Blue Ocean home">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary-foreground text-primary">
              <UtensilsCrossed className="size-5" />
            </span>
            <span className="font-display text-xl font-bold">Blue Ocean</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold md:flex" aria-label="Main navigation">
            <a href="#about" className="hover:text-highlight">About</a>
            <a href="#menu" className="hover:text-highlight">Menu</a>
            <a href="#reviews" className="hover:text-highlight">Why visit</a>
            <a href="#visit" className="hover:text-highlight">Visit</a>
            <OrderPanel><Button variant="whatsapp" size="sm"><MessageCircle className="size-4" /> Order now</Button></OrderPanel>
          </nav>
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" aria-expanded={menuOpen}>
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
        {menuOpen && (
          <nav className="border-t border-primary-foreground/15 bg-primary px-5 py-4 md:hidden" aria-label="Mobile navigation">
            <div className="mx-auto grid max-w-7xl gap-1">
              {[['About', '#about'], ['Menu', '#menu'], ['Why visit', '#reviews'], ['Visit', '#visit']].map(([label, href]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center justify-between py-3 font-semibold">{label}<ChevronRight className="size-4" /></a>
              ))}
              <TrackOrderPanel><Button variant="outline" className="mt-2 w-full">Track order</Button></TrackOrderPanel>
            </div>
          </nav>
        )}
      </header>

      <section id="top" className="relative flex min-h-[90svh] items-end overflow-hidden pt-18">
        <img src={heroImage} alt="Representative spread of pizza, fries and sandwiches" width={1920} height={1088} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-14 pt-32 text-primary-foreground sm:pb-20 lg:px-8 lg:pt-44">
          <div className="max-w-2xl">
            <p className="eyebrow text-highlight">Umra Nangal · Baba Bakala</p>
            <h1 className="mt-4 font-display text-5xl font-bold leading-[1.02] sm:text-7xl">Blue Ocean</h1>
            <p className="mt-5 max-w-xl text-xl font-medium leading-8 sm:text-2xl">Fresh flavours. Friendly faces. A meal worth sharing.</p>
            <p className="mt-4 max-w-xl text-base leading-7 text-primary-foreground/80">A welcoming local restaurant for relaxed meals, quick pickup, and easy delivery requests.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#menu"><Button className="bg-highlight text-highlight-foreground hover:bg-highlight/90"><UtensilsCrossed className="size-4" /> View menu</Button></a>
              <OrderPanel><Button variant="whatsapp"><MessageCircle className="size-4" /> Order on WhatsApp</Button></OrderPanel>
              <TrackOrderPanel><Button variant="outline" className="border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"><Search className="size-4" /> Track order</Button></TrackOrderPanel>
              <Button asChild variant="outline" className="border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"><a href={`tel:${PHONE_LINK}`}><Phone className="size-4" /> Call now</a></Button>
              <Button asChild variant="outline" className="border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"><a href={DIRECTIONS_URL} target="_blank" rel="noreferrer"><MapPin className="size-4" /> Directions</a></Button>
            </div>
          </div>
          <p className="mt-12 text-xs text-primary-foreground/65">Representative food photography — please ask about today’s menu.</p>
        </div>
      </section>

      <section className="border-b border-border bg-surface-strong">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-border px-5 py-6 sm:grid-cols-4 lg:px-8">
          <Fact icon={<Star className="size-5 fill-highlight text-highlight" />} value="4.9 / 5" label="35 Google reviews" />
          <Fact icon={<ShoppingBag className="size-5" />} value="₹200–₹400" label="Estimated per person" />
          <Fact icon={<Clock3 className="size-5" />} value="7 am–10 pm" label="Listed hours · verify daily" />
          <Fact icon={<MapPin className="size-5" />} value="Umra Nangal" label="Baba Bakala, Punjab" />
        </div>
      </section>

      <section id="about" className="section-space scroll-mt-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div><p className="eyebrow text-primary">Your local table</p><h2 className="section-title mt-3">Good food, made for good company.</h2></div>
          <div className="grid gap-7 text-lg leading-8 text-muted-foreground sm:grid-cols-2">
            <p>Blue Ocean is a local restaurant in Umra Nangal known in customer feedback for flavourful food, friendly service, and a pleasant ambience.</p>
            <p>Visitors frequently mention pizzas, crispy fries, and sandwiches — ideal for a casual meal, a quick pickup, or an easy delivery request.</p>
          </div>
        </div>
      </section>

      <section id="menu" className="section-space scroll-mt-20 bg-surface-strong">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><p className="eyebrow text-primary">Popular mentions</p><h2 className="section-title mt-3">A taste of the menu</h2></div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">Specific items and prices are awaiting confirmation. Call or message us for today’s available menu.</p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <MenuCard image={pizzaImage} title="Pizzas" description="A customer favourite, with today’s varieties and sizes available by phone." />
            <MenuCard image={snacksImage} title="Fries & sandwiches" description="Crispy fries and satisfying sandwiches are frequently mentioned by visitors." />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <OrderPanel><Button variant="whatsapp"><MessageCircle className="size-4" /> Ask on WhatsApp</Button></OrderPanel>
            <Button asChild variant="outline"><a href={`tel:${PHONE_LINK}`}><Phone className="size-4" /> Call for today’s menu</a></Button>
          </div>
        </div>
      </section>

      <section id="reviews" className="section-space scroll-mt-20 bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <div className="flex gap-1 text-highlight" aria-label="4.9 out of 5 stars">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-5 fill-current" />)}</div>
            <p className="mt-5 font-display text-7xl font-bold">4.9</p>
            <p className="mt-2 text-primary-foreground/70">Based on 35 Google reviews</p>
          </div>
          <div>
            <p className="eyebrow text-highlight">Why guests visit</p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">Warm service, enjoyable flavours, and value that feels right.</h2>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Fresh & flavourful", "Friendly staff", "Pleasant ambience", "Reasonable prices"].map((tag) => <span key={tag} className="rounded-full border border-primary-foreground/20 px-4 py-2 text-sm font-semibold">{tag}</span>)}
            </div>
            <p className="mt-6 text-sm text-primary-foreground/65">Highlights summarise themes reported in customer feedback.</p>
          </div>
        </div>
      </section>

      <section id="visit" className="section-space scroll-mt-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="eyebrow text-primary">Visit Blue Ocean</p>
            <h2 className="section-title mt-3">Come by, pick up, or order in.</h2>
            <div className="mt-8 space-y-6">
              <ContactRow icon={<MapPin />} label="Address" value="Umra Nangal, Baba Bakala, Punjab 143112" />
              <ContactRow icon={<Phone />} label="Phone" value={PHONE_DISPLAY} />
              <ContactRow icon={<Clock3 />} label="Listed hours" value="7:00 am–10:00 pm · Weekly schedule to be confirmed" />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild><a href={DIRECTIONS_URL} target="_blank" rel="noreferrer"><MapPin className="size-4" /> Get directions</a></Button>
              <Button asChild variant="outline"><a href={`tel:${PHONE_LINK}`}><Phone className="size-4" /> {PHONE_DISPLAY}</a></Button>
            </div>
          </div>
          <div className="bg-surface-strong p-7 sm:p-10">
            <p className="eyebrow text-primary">Available services</p>
            <div className="mt-7 space-y-4">
              {["Dine-in", "Kerbside pickup", "No-contact delivery"].map((service) => <div key={service} className="flex items-center gap-4 border-b border-border pb-4 text-lg font-semibold last:border-0"><span className="flex size-9 items-center justify-center rounded-full bg-accent text-primary"><Check className="size-4" /></span>{service}</div>)}
            </div>
            <OrderPanel><Button variant="whatsapp" className="mt-7 w-full"><MessageCircle className="size-5" /> Start an order request <ArrowRight className="ml-auto size-4" /></Button></OrderPanel>
          </div>
        </div>
      </section>

      <footer className="bg-footer py-10 text-footer-foreground">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-5 sm:flex-row sm:items-end lg:px-8">
          <div><p className="font-display text-2xl font-bold">Blue Ocean</p><p className="mt-2 text-sm text-footer-foreground/65">Umra Nangal, Baba Bakala, Punjab 143112</p></div>
          <div className="flex flex-col items-start gap-3 sm:items-end"><TrackOrderPanel><Button variant="outline" className="border-footer-foreground/30 bg-transparent text-footer-foreground hover:bg-footer-foreground/10"><Search className="size-4"/> Track order</Button></TrackOrderPanel><Link to="/auth" className="text-xs text-footer-foreground/55 hover:text-footer-foreground">Staff sign in</Link><p className="text-sm text-footer-foreground/55">Please confirm menu, prices, and daily hours directly with the restaurant.</p></div>
        </div>
      </footer>

      <div className="fixed bottom-5 right-5 z-40">
        <OrderPanel>
          <Button variant="whatsapp" className="h-13 rounded-full px-5 shadow-xl" aria-label="Open WhatsApp order panel"><MessageCircle className="size-5" /><span>Order</span></Button>
        </OrderPanel>
      </div>
    </main>
  );
}

function Fact({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="flex min-h-24 flex-col justify-center px-3 text-center sm:px-5"><span className="mx-auto text-primary">{icon}</span><strong className="mt-2 text-sm sm:text-base">{value}</strong><span className="mt-1 text-xs text-muted-foreground">{label}</span></div>;
}

function MenuCard({ image, title, description }: { image: string; title: string; description: string }) {
  return <article className="group overflow-hidden bg-background shadow-sm"><div className="aspect-[4/3] overflow-hidden"><img src={image} alt={`Representative ${title.toLowerCase()} photography`} width={928} height={720} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /></div><div className="p-6 sm:p-7"><div className="flex items-center justify-between gap-4"><h3 className="font-display text-2xl font-bold">{title}</h3><span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">Price on request</span></div><p className="mt-3 leading-7 text-muted-foreground">{description}</p><p className="mt-4 text-xs text-muted-foreground">Representative image · actual dishes may vary</p></div></article>;
}

function ContactRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex gap-4"><span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">{icon}</span><div><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-1 font-semibold leading-6">{value}</p></div></div>;
}