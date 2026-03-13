# Costdoq App — Launch Testing Plan

**Target Launch: March 8, 2026**
**Testing Window: March 4–7 (4 days)**

---

## Day 1 (March 4) — Critical Path & Blockers

### Auth & Account Flows
- [ ] Email signup → email validation → login → dashboard
- [ ] Google OAuth full flow (callback, user creation/linking)
- [ ] 2FA setup → verify → disable
- [ ] Password reset flow (verify generic success for security)
- [ ] Invalid/expired JWT tokens rejected (401/403)
- [ ] Rate limiting on auth endpoints (100/15min)
- [ ] Signup disabled mode → waitlist page shown

### Billing & Payments
- [ ] Free trial (14-day) starts on signup
- [ ] Dodo Payments checkout → payment → subscription active
- [ ] Webhook signature verification (Dodo)
- [ ] Upgrade/downgrade between Starter ↔ Pro
- [ ] Cancel subscription flow
- [ ] Billing portal access
- [ ] Feature limits enforced per plan tier

### Run Existing Tests
```bash
cd server && npm test -- --coverage
```
- [ ] All unit tests pass
- [ ] All integration tests pass (auth, costData, pagination)
- [ ] All E2E tests pass (userFlows, security)
- [ ] Coverage meets 50% threshold

---

## Day 2 (March 5) — Core Features & Integrations

### Cloud Provider Connections
- [ ] AWS: CloudFormation flow → callback → credentials stored
- [ ] Azure: Service principal auth working
- [ ] GCP: Service account JSON upload working
- [ ] DigitalOcean / IBM / MongoDB / Vultr / Linode: Token-based auth
- [ ] Remove provider flow
- [ ] Provider credentials encrypted at rest

### Cost Data Pipeline
- [ ] Cost sync triggers and completes
- [ ] CUR file ingestion (Parquet) working
- [ ] Dashboard shows correct totals (watch for `numeric` → `parseFloat` issues)
- [ ] Currency switching updates all values correctly (10 currencies)
- [ ] Month-rollover: verify no zeros on 1st of month
- [ ] Cost trending/historical data renders
- [ ] Redis caching working (cache hit reduces latency)
- [ ] Anomaly detection triggers correctly

### Advanced Features Smoke Test
- [ ] Budgets: create, view, alerts
- [ ] Reports: create, schedule
- [ ] Recommendations page renders
- [ ] Savings plans page renders
- [ ] Forecasting page renders
- [ ] Kubernetes cost page renders
- [ ] Custom dashboards: create, view, edit
- [ ] AI chat demo functional (if Anthropic key set)

---

## Day 3 (March 6) — Security, Performance & UX

### Security Audit
- [ ] HTTPS enforced (HTTP → HTTPS redirect)
- [ ] TLS 1.2+ only
- [ ] Security headers present: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- [ ] CORS restricts to allowed origins only
- [ ] No credentials/PII in logs
- [ ] SQL injection blocked (parameterized queries)
- [ ] XSS blocked (input sanitization + CSP)
- [ ] User data isolation (can't access other users' costs)
- [ ] Admin endpoints require admin role
- [ ] API keys hashed (SHA256), not stored plaintext
- [ ] JWT_SECRET ≥ 32 chars validated on startup

### Performance
- [ ] Frontend: FCP < 2s, LCP < 3s, CLS < 0.1
- [ ] Code splitting working (vendor-react, vendor-charts, vendor-motion chunks)
- [ ] Asset caching: hashed assets 1yr immutable, index.html no-cache
- [ ] Backend: dashboard API < 2s, cost query < 500ms
- [ ] DB connection pool (5–20) not exhausted under load
- [ ] Cloudflare CDN caching working correctly

### Cross-Browser & Responsive
- [ ] Chrome, Firefox, Safari, Edge (latest 2 versions)
- [ ] Desktop (1920×1080), Tablet (768px), Mobile (375px)
- [ ] Sidebar collapse/expand works on all sizes
- [ ] Forms and modals usable on mobile
- [ ] Charts scrollable on small screens

---

## Day 4 (March 7) — SEO, Infrastructure & Final Checks

### SEO & Public Pages
- [ ] `robots.txt` disallows auth/api/admin/debug routes
- [ ] Sitemap.xml valid and references all public pages
- [ ] Meta tags (title, description, OG tags) on all public pages
- [ ] Blog pages render markdown correctly
- [ ] Privacy policy, Terms of Service, Contact pages load
- [ ] 404 page displays for invalid routes

### Infrastructure & Deployment
- [ ] `docker compose up -d` — all 5 services healthy
- [ ] Health checks passing: backend `/api/health`, frontend wget, redis ping
- [ ] Services restart on failure (restart policies)
- [ ] SSL certificates valid (Let's Encrypt)
- [ ] Certbot renewal working
- [ ] Prometheus metrics endpoint protected (token auth)
- [ ] Winston logs rotating daily
- [ ] Sentry receiving errors

### Email & Notifications
- [ ] Password reset emails deliver
- [ ] Subscription confirmation emails deliver
- [ ] Email preferences respected (opt-in/out)
- [ ] Slack webhook integration (if configured)

### Final Go/No-Go
- [ ] All tests green
- [ ] No critical security vulnerabilities in direct dependencies
- [ ] TypeScript build succeeds: `docker run --rm -v "$(pwd)":/app -w /app node:20-slim npx tsc --noEmit --skipLibCheck`
- [ ] Frontend build succeeds: `docker compose build --no-cache costdoq-frontend`
- [ ] Production environment variables all set (JWT_SECRET, DATABASE_URL, payment keys, OAuth, Sentry)
- [ ] Backup strategy tested (PostgreSQL backup + restore)
- [ ] Purge Cloudflare cache after final deploy
- [ ] Incident response plan documented

---

## Known Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| No frontend automated tests | UI bugs may slip through | Manual testing on all pages across browsers |
| PostgreSQL numeric columns returned as strings | NaN values in UI | Always `parseFloat()`, watch for regressions |
| Cloudflare cache staleness | Users see old version | Purge cache after every deploy |
| Month boundary edge case | Dashboard zeros on 1st | Verify with date-shifted testing |
| DigitalOcean SDK transitive vulnerabilities | Low (not directly exploitable) | Monitor for package updates |
