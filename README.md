# RISKS247 site (Netlify + Netlify Function + Make)

- `public/index.html` – site (no Bolt code or branding).
- `netlify/functions/order.mjs` – POST /api/order: validates, prices server-side (€40/m3, 10-50 in steps of 5; >50 = quote request), creates order ID (RK-yymmdd-XXXXXX, deterministic per form-load key so retries do not duplicate), forwards to Make.
- Tests: `npm test` (28 tests).

## Environment variables (Netlify > Site settings > Environment variables; never commit)
| Name | Value |
|---|---|
| ORDERS_MODE | `test` (default: validates, never calls Make) / `off` (refuse) / `test` (validates, never calls Make) / `live` |
| MAKE_WEBHOOK_URL | Make webhook URL (hook 3957587) |
| MAKE_API_KEY | key if hook API-key auth is enabled (header x-make-apikey) |
| ORDER_SECRET | long random string |

## Go-live checklist (needs owner approval at each step)
1. Supplier product + cost confirmed (EUR300/10 m3 incl. delivery?). Legal details supplied for footer.
2. Create private GitHub repo, push; connect to Netlify (free plan).
3. Deploy preview with ORDERS_MODE=test; review on phone.
4. Enable Make hook API-key auth, set MAKE_API_KEY, one controlled live test to owner's phone only.
5. Set ORDERS_MODE=live; only after approval, change DNS for risks247.com.
