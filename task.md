# ShopeeAI AutoChat Build Task

## Status: IN PROGRESS

## Done
- [x] app_init
- [x] design.md
- [x] DB schema (tenants, tenantSettings, knowledgeBase, chatLogs, escalations)
- [x] auth.ts (better-auth + autumn plugin)
- [x] auth middleware
- [x] AI engine (engine.ts) - Gemini Gem integration
- [x] Shopee service (chat API + order API)
- [x] Slack notification service
- [x] Webhook route (POST /webhook/shopee/:tenantId)
- [x] Tenants route (GET/PUT settings, webhook-url)
- [x] Logs route (GET logs, analytics, escalations)

## TODO
- [ ] Knowledge base route
- [ ] API index.ts (wire all routes + auth)
- [ ] autumn.config.ts (Free=20, Starter=100/$20, Pro=unlimited/$55)
- [ ] Generate auth schema + db:push
- [ ] Web frontend:
  - [ ] Landing page (/)
  - [ ] Sign-in/sign-up
  - [ ] Dashboard (KPI + charts)
  - [ ] Chat logs page
  - [ ] Knowledge base page
  - [ ] Settings page
  - [ ] Pricing page
  - [ ] Layout/sidebar
- [ ] Web lib files (auth.ts, api.ts)
- [ ] Mobile (Expo): dashboard, escalation notifications
- [ ] Build check

## Key Decisions
- Gemini Gem ID stored in tenantSettings.geminiGemId
- Confidence threshold: 0.7 (configurable per tenant)
- Webhook URL: /api/webhook/shopee/{tenantId}
- Plans: Free=20, Starter=100/$20, Pro=unlimited/$55
- Language auto-detect from message text
