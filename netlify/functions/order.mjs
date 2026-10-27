// POST /api/order  - validates the order, prices it SERVER-SIDE, creates the order ID, forwards to Make.
// Env: ORDERS_MODE = off (default) | test | live ; MAKE_WEBHOOK_URL ; MAKE_API_KEY (optional) ; ORDER_SECRET
import { createHmac } from "node:crypto";

export const PRICE_PER_M3 = 40, MIN = 10, MAX = 50, STEP = 5;
const CITIES = ["Ventspils", "Kuldīga", "Talsi", "Liepāja", "Cita vieta"];
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const hits = new Map(); // best-effort per-instance rate limit

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export function orderId(key, secret, now = new Date()) {
  const h = createHmac("sha256", secret).update(key).digest();
  let s = ""; for (let i = 0; i < 6; i++) s += ALPHABET[h[i] % ALPHABET.length];
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");
  return `RK-${d}-${s}`;
}

export function validate(b) {
  if (!b || typeof b !== "object") return { error: "Nederīgs pieprasījums." };
  const key = clean(b.key, 80);
  if (key.length < 8) return { error: "Nederīgs pieprasījums." };
  const custom = b.qty === "custom";
  let qty = null;
  if (!custom) {
    qty = Number(b.qty);
    if (!Number.isInteger(qty) || qty < MIN || qty > MAX || qty % STEP) return { error: "Nederīgs daudzums." };
  }
  const name = clean(b.name, 80), phone = clean(b.phone, 30), city = clean(b.city, 40),
    address = clean(b.address, 160), notes = clean(b.notes, 300);
  if (name.length < 3) return { error: "Ievadiet vārdu un uzvārdu." };
  if (!/^[+0-9 ()\-]+$/.test(phone) || phone.replace(/\D/g, "").length < 8 || phone.replace(/\D/g, "").length > 15)
    return { error: "Ievadiet derīgu tālruņa numuru." };
  if (!CITIES.includes(city)) return { error: "Izvēlieties pilsētu vai piegādes vietu." };
  if (address.length < 4) return { error: "Ievadiet piegādes adresi." };
  return { key, custom, qty, name, phone, city, address, notes,
    total: custom ? null : qty * PRICE_PER_M3 }; // client-sent prices are never read
}

export async function handle(req, env = process.env, fetchImpl = fetch) {
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });
  const mode = env.ORDERS_MODE || "off";
  if (mode === "off") return json(503, { ok: false, error: "Ordering is paused." });
  const ip = (req.headers.get("x-nf-client-connection-ip") || "unknown");
  const t = Date.now(), arr = (hits.get(ip) || []).filter(x => t - x < 600000);
  if (arr.length >= 8) return json(429, { ok: false, error: "Pārāk daudz mēģinājumu. Lūdzu, mēģiniet vēlāk." });
  arr.push(t); hits.set(ip, arr);
  if (Number(req.headers.get("content-length") || 0) > 5000) return json(413, { ok: false, error: "Nederīgs pieprasījums." });
  let b; try { b = await req.json(); } catch { return json(400, { ok: false, error: "Nederīgs pieprasījums." }); }
  if (b && b.website) return json(200, { ok: true, orderId: "RK-000000-XXXXXX", message: "Paldies!" }); // honeypot: silent drop
  const v = validate(b);
  if (v.error) return json(400, { ok: false, error: v.error });
  const secret = env.ORDER_SECRET || "dev-secret";
  const id = orderId(v.key, secret);
  const amount = v.custom ? "Virs 50 ber. m³ (pieprasīts individuāls piedāvājums)" : `${v.qty} ber. m³ (€${v.total})`;
  const message = (v.custom || v.city === "Cita vieta")
    ? "Pieprasījums saņemts. Pārbaudīsim piegādes iespēju un sazināsimies ar jums."
    : "Pasūtījums saņemts. Sazināsimies ar jums, lai apstiprinātu piegādes laiku.";
  const payload = { order_id: id, name: v.name, phone: v.phone, city: v.city, address: v.address,
    amount, quantity_m3: v.qty, total_eur: v.total, notes: v.notes };
  if (mode === "test") return json(200, { ok: true, orderId: id, message, test: true, payload }); // never calls Make
  if (mode !== "live" || !env.MAKE_WEBHOOK_URL) return json(503, { ok: false, error: "Ordering is not configured." });
  try {
    const headers = { "content-type": "application/json" };
    if (env.MAKE_API_KEY) headers["x-make-apikey"] = env.MAKE_API_KEY;
    const r = await fetchImpl(env.MAKE_WEBHOOK_URL, { method: "POST", headers, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error("make " + r.status);
  } catch { return json(502, { ok: false, error: "Neizdevās nosūtīt pasūtījumu. Lūdzu, mēģiniet vēlreiz." }); }
  return json(200, { ok: true, orderId: id, message });
}

export default (req) => handle(req);
export const config = { path: "/api/order" };
