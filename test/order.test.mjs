import test from "node:test"; import assert from "node:assert/strict";
import { handle, validate, orderId } from "../netlify/functions/order.mjs";
const base = { key: "abcdefgh-1234", qty: "10", name: "Jānis Bērziņš", phone: "+371 20000000", city: "Ventspils", address: "Tirgus 1", notes: "", website: "" };
const req = b => new Request("https://x/api/order", { method: "POST", headers: { "content-type": "application/json", "x-nf-client-connection-ip": String(Math.random()) }, body: JSON.stringify(b) });
const env = (o = {}) => ({ ORDERS_MODE: "test", ORDER_SECRET: "s", ...o });
test("default mode is test and never calls Make", async () => { let n=0; const r = await handle(req(base), {}, async()=>{n++;return {ok:true}}); assert.equal(r.status, 200); assert.equal((await r.json()).test, true); assert.equal(n, 0); });
test("off mode refuses (503)", async () => assert.equal((await handle(req(base), {ORDERS_MODE:"off"})).status, 503));
for (const q of ["10","15","20","25","30","35","40","45","50"]) test("price "+q, async () => {
  const j = await (await handle(req({ ...base, qty: q }), env())).json(); assert.equal(j.payload.total_eur, Number(q)*40); });
test("ignores client price", async () => { const j = await (await handle(req({ ...base, total: 1, price: 1 }), env())).json(); assert.equal(j.payload.total_eur, 400); });
for (const q of ["5","12","55","0","-10","abc","10.5","", null]) test("rejects qty "+q, async () => assert.equal((await handle(req({ ...base, qty: q }), env())).status, 400));
test("custom >50 has no price", async () => { const j = await (await handle(req({ ...base, qty: "custom" }), env())).json(); assert.equal(j.payload.total_eur, null); });
test("rejects bad phone/city/name/address", async () => {
  for (const p of [{phone:"abc"},{phone:"123"},{city:"Rīga"},{name:"A"},{address:"x"}]) assert.equal((await handle(req({ ...base, ...p }), env())).status, 400); });
test("order id deterministic per key, differs between keys", () => {
  const d = new Date("2026-10-27"); assert.equal(orderId("k1xxxxxx","s",d), orderId("k1xxxxxx","s",d));
  assert.notEqual(orderId("k1xxxxxx","s",d), orderId("k2xxxxxx","s",d)); assert.match(orderId("k1xxxxxx","s",d), /^RK-261027-[A-Z2-9]{6}$/); });
test("honeypot never calls Make", async () => { let called = 0;
  const r = await handle(req({ ...base, website: "spam" }), env({ ORDERS_MODE: "live", MAKE_WEBHOOK_URL: "https://m" }), async () => { called++; return { ok: true }; });
  assert.equal(r.status, 200); assert.equal(called, 0); });
test("test mode never calls Make", async () => { let called = 0;
  await handle(req(base), env(), async () => { called++; return { ok: true }; }); assert.equal(called, 0); });
test("live: one Make call with api key and exact fields", async () => { let c; 
  const r = await handle(req(base), env({ ORDERS_MODE: "live", MAKE_WEBHOOK_URL: "https://m", MAKE_API_KEY: "k" }), async (u, o) => { c = { u, o }; return { ok: true }; });
  assert.equal(r.status, 200); assert.equal(c.o.headers["x-make-apikey"], "k");
  const p = JSON.parse(c.o.body); assert.deepEqual(Object.keys(p).slice(0,6), ["order_id","name","phone","city","address","amount"]); assert.equal(p.amount, "10 ber. m³ (€400)"); });
test("live: Make failure -> 502, not success", async () => {
  const r = await handle(req(base), env({ ORDERS_MODE: "live", MAKE_WEBHOOK_URL: "https://m" }), async () => ({ ok: false, status: 500 })); assert.equal(r.status, 502); });
test("rate limit", async () => { const h = { "content-type": "application/json", "x-nf-client-connection-ip": "1.1.1.1" }; let last;
  for (let i = 0; i < 9; i++) last = await handle(new Request("https://x", { method: "POST", headers: h, body: JSON.stringify(base) }), env()); assert.equal(last.status, 429); });
