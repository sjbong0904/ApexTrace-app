# Infra: Vercel Pro + Supabase Pro (pre-launch)

Complete this **before** Overwolf store push or US/JP organic posts. Free/Hobby cannot absorb ~100+ DAU (Active CPU / DB size).

Target monthly floor: **~$45** (Vercel Pro $20 + Supabase Pro $25), before usage overages.

---

## 1. Supabase → Pro

Org: **ApexTrace** (`jlmhqhxtafbzgqknmjjd`) · Project: `ureuzkxyyozzzluzawwr` (ap-northeast-2)

1. Open [Supabase Dashboard → Organization → Billing](https://supabase.com/dashboard/org/jlmhqhxtafbzgqknmjjd/billing).
2. Upgrade organization to **Pro**.
3. Confirm project is no longer subject to Free 500 MB read-only / 5 GB egress / 1-week pause.
4. **Spend Cap** (recommended for Phase 1): keep enabled until you review week-2 usage, or set a soft budget alert at ~$80/mo.
5. Optional: Database → enable daily backups (included on Pro).

Verify: Organization plan shows `pro` (not `free`).

---

## 2. Vercel → Pro

Team: **sjbong0904's projects** (`team_EQvDqmkdML1FqjiSykFO79Cn`)

Projects that matter for launch traffic:

| Project | Role |
|---|---|
| `trace-proxy-server` | All end-user API traffic |
| `admin` | Internal only (low traffic) |
| `apex-trace` | Legacy/static if any |

1. Open [Vercel → Team Settings → Billing](https://vercel.com/sjbong0904s-projects/~/settings/billing).
2. Upgrade team to **Pro** ($20/mo + $20 usage credit).
3. **Spend Management**
   - Set on-demand spend alert at **$30** and **$50**.
   - Optionally enable pause-on-limit for Phase 1 soft launch (turn off once DAU is stable).
4. Confirm Fluid Compute / function usage appears under Usage for `trace-proxy-server`.

Verify: Team plan is Pro; Hobby CPU 4h cap no longer applies as a hard stop.

---

## 3. Post-upgrade smoke checks

- [ ] `GET https://trace-proxy-server.vercel.app/api/seasons` returns 200
- [ ] Save one match from the Overwolf client → row appears in `matches`
- [ ] Supabase Table Editor still writable (not read-only)
- [ ] Vercel Usage dashboard shows invocations after a client session

---

## 4. Watch metrics (first 14 days)

| Metric | Where | Soft alert |
|---|---|---|
| Active CPU / invocations | Vercel Usage | Rising toward credit burn |
| DB size | Supabase Reports → Database | Approaching 4 GB (half of 8 GB included) |
| Egress | Supabase Usage | > 50 GB/mo early |
| OwAd revenue | Overwolf Dev Dashboard | vs ~$45 infra floor |

When done, tick this checklist in the launch channel / PR description: `infra-pro: done YYYY-MM-DD`.
