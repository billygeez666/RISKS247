# INFRA — RISKS247
- Domain: risks247.com (registrar Name.com; DNS currently Netlify DNS; DNS NOT changed)
- Preview host: Netlify site `mellifluous-cassata-562cd8` (rename pending)
- Source: this repo (main). Deploy: Netlify link to this repo pending; until then manual upload.
- Orders: POST /api/order (Netlify Function). ORDERS_MODE defaults to `test` (never calls Make). Live requires explicit owner approval.
- Backend: Make scenario "risks" (SMS to owner). Secrets only in Netlify env vars: ORDERS_MODE, MAKE_WEBHOOK_URL, MAKE_API_KEY, ORDER_SECRET.
- Last verified: 2026-10-27.
- Auto-deploy: GitHub main -> Netlify linked 2026-10-27.
