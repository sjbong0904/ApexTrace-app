# Week-2 review — DAU, geo, ads, infra → paid UA?

Run **14 days after D0** (store live + first US/JP posts). Decide whether to start a **small** paid UA test on **one** region only.

---

## Snapshot (fill in)

| Metric | Target (Phase 1) | Actual | Source |
|---|---|---|---|
| Approx DAU (7-day avg) | 100–500 | | OW analytics / proxy logs / unique UIDs posting matches |
| US share of active users | majority with JP | | language `en` sessions, OW geo if available, Discord poll |
| JP share | | | language `ja` / OW geo |
| Other regions | follow organically | | |
| Vercel $ (month-to-date) | ~$20–40 | | Vercel Billing |
| Supabase $ (month-to-date) | ~$25–40 | | Supabase Billing |
| DB size | ≪ 8 GB | | Supabase Database |
| OwAd est. revenue | vs ~$45 floor | | Overwolf Dev Dashboard |
| Crash / GEP complaints | low | | Discord + OW reviews |

---

## Qualitative

- Top praised feature: _______________
- Top complaint: _______________
- Store conversion notes (impressions → installs if OW shows): _______________
- Creator replies (Y/N useful): _______________

---

## Decision tree

```
DAU < 100 and infra healthy?
  → Stay organic another 2 weeks; improve store screenshots / clips. No paid UA.

DAU 100–500, US or JP clearly stronger, OwAd + budget OK?
  → Optional: $50–150 test on the stronger region only (one channel).
     Reassess after 7 days on CPI / install quality.

DAU > 500 or infra $ climbing fast?
  → Pause promo. Raise spend alerts. Consider match JSON size / caching before more UA.

Premium waitlist interest high?
  → Schedule Phase 1.5 payment integration; keep blur CTA as waitlist.
```

**Phase 1 rule:** never run US + JP paid campaigns at the same time on the first test.

---

## Paid UA test brief (only if approved above)

| Field | Value |
|---|---|
| Region | US **or** JP (circle one) |
| Channel | _______________ |
| Budget | $_______ (cap $150) |
| Creative | Clip A/B from organic kit |
| Landing | Overwolf store URL |
| Success | Installs that post ≥1 match within 48h |
| Stop | Budget hit or CPI junk / no match posts |

---

## Sign-off

- Date: ________  
- Decision: `stay_organic` / `paid_test_US` / `paid_test_JP` / `pause_growth`  
- Owner: ________  
