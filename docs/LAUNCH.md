# 런칭 — US / JP Phase 1

순서: **infra → store listing → free+OwAd 출시 → organic 포스트 → week-2 review.**

| 섹션 | 용도 |
|------|------|
| [§1 Infra](#1-infra-vercel--supabase-pro) | 트래픽 전 Pro 업그레이드 |
| [§2 Store listing](#2-store-listing-en--ja) | Overwolf 스토어 카피 + 스크린샷 (붙여넣기용 EN/JA 유지) |
| [§3 Organic kit](#3-organic-us--jp-kit) | 포스트·크리에이터 DM·2주 캘린더 |
| [§4 Week-2 review](#4-week-2-review) | 지표 → 선택적 단일 지역 paid UA |

관련: [QA.md](./QA.md) · [ROADMAP.md](./ROADMAP.md) (Premium / OW API)

---

## 1. Infra: Vercel + Supabase Pro

Overwolf 스토어 푸시·US/JP organic 포스트 **전에** 완료. Free/Hobby는 DAU ~100+ (Active CPU / DB 크기)를 버티기 어렵다.

월 고정비 목표: **약 $45** (Vercel Pro $20 + Supabase Pro $25), 초과 사용분 별도.

### 1.1 Supabase → Pro

Org: **ApexTrace** (`jlmhqhxtafbzgqknmjjd`) · Project: `ureuzkxyyozzzluzawwr` (ap-northeast-2)

1. [Supabase Dashboard → Organization → Billing](https://supabase.com/dashboard/org/jlmhqhxtafbzgqknmjjd/billing) 열기.
2. 조직을 **Pro**로 업그레이드.
3. Free의 500 MB read-only / 5 GB egress / 1주 pause 대상이 아닌지 확인.
4. **Spend Cap** (Phase 1 권장): week-2 사용량 검토 전까지 유지, 또는 월 ~$80 soft alert.
5. 선택: Database → daily backups (Pro 포함).

확인: Organization plan이 `pro` (not `free`).

### 1.2 Vercel → Pro

Team: **sjbong0904's projects** (`team_EQvDqmkdML1FqjiSykFO79Cn`)

| Project | 역할 |
|---|---|
| `trace-proxy-server` | 엔드유저 API 전체 |
| `admin` | 내부용 (저트래픽) |
| `apex-trace` | 레거시/정적 (있을 경우) |

1. [Vercel → Team Settings → Billing](https://vercel.com/sjbong0904s-projects/~/settings/billing) 열기.
2. 팀을 **Pro**로 업그레이드 ($20/mo + $20 usage credit).
3. **Spend Management**
   - on-demand spend alert **$30**, **$50**.
   - Phase 1 soft launch용 pause-on-limit 선택 (DAU 안정 후 해제).
4. `trace-proxy-server` Usage에 Fluid Compute / function 사용이 보이는지 확인.

확인: Team plan = Pro; Hobby CPU 4h 하드캡 해제.

### 1.2.1 keep-alive cron (닉 주소록)

Hobby는 cron이 **하루 1회**만 가능해, 지금은 `trace-proxy-server/vercel.json`에 `0 0 * * *`만 둔 상태다.  
목표 페이스(분당 12명 · 순차 5초)는 [NICKNAME-SEARCH.md](./NICKNAME-SEARCH.md) 참고.

Pro 업그레이드 직후:

1. `vercel.json` cron schedule을 `* * * * *` 로 변경.
2. `npx vercel deploy --prod` (`trace-proxy-server`).
3. Vercel → Project → Crons 에서 매분 `/api/keep-alive` 확인.

### 1.3 업그레이드 후 스모크

- [ ] `GET https://trace-proxy-server.vercel.app/api/seasons` → 200
- [ ] `GET https://trace-proxy-server.vercel.app/api/search-candidates?query=<knownExactNick>` → 해당 프로필
- [ ] Overwolf 클라이언트에서 매치 1판 저장 → `matches`에 행 생성
- [ ] Supabase Table Editor 쓰기 가능 (read-only 아님)
- [ ] 클라이언트 세션 후 Vercel Usage에 invocations 표시
- [ ] (Pro 후) keep-alive가 분 단위로 도는지 Crons/로그 확인

### 1.4 감시 지표 (첫 14일)

| 지표 | 위치 | Soft alert |
|---|---|---|
| Active CPU / invocations | Vercel Usage | credit 소진 쪽으로 상승 |
| DB size | Supabase Reports → Database | 포함량 8 GB의 절반(4 GB) 근접 |
| Egress | Supabase Usage | 초기에 월 50 GB 초과 |
| OwAd 예상 수익 | Overwolf Dev Dashboard | infra 바닥 ~$45 대비 |

완료 시: `infra-pro: done YYYY-MM-DD`.

---

## 2. Store listing (EN + JA)

아래 본문은 Overwolf Developer Console에 **그대로 붙여넣기**. Phase 1에서 KR/기타 언어 스토어 카피에 투자하지 않음 (UI는 이미 10로케일).

**스토어 URL (게시 후 기입):** `https://www.overwolf.com/app/...`

**manifest.json 짧은 tagline:** 아래 EN subtitle과 맞춤 (이미 반영됨).

### English (primary — US)

#### Title
ApexTrace

#### Short subtitle (≤80 chars)
Track every Apex match — path, loadout timeline, and season stats.

#### Full description

ApexTrace is an Overwolf companion for Apex Legends that records what actually happened in your games — not just the scoreboard.

**What you get**
- **Movement path** — see where you rotated, died, and respawned on the map
- **Loadout timeline** — weapon swaps across the match, not a single end-of-game snapshot
- **Match history & combat log** — kills, knocks, deaths, and squad events in one place
- **Season statistics** — overview radar plus deeper map / legend / weapon / teammate breakdowns
- **Second screen + in-game overlay** — keep stats on a second monitor or peek in-game with hotkeys

**Free vs Premium**
- Free: match tracking, history, overview stats, and supported by light ads on the desktop window
- Premium (coming soon): unlock detailed analytics tabs (Maps, Legends, Weapons, Teammates)

**Tips**
- Leave ApexTrace running in the background while you play so matches are saved
- Open the GEP status indicator if something looks missing — some game events depend on Overwolf’s Apex plugin health

Built for competitive players who care about *how* a fight went, not only the final damage number.

#### Tags / keywords
`Apex Legends`, `tracker`, `stats`, `overlay`, `match history`, `loadout`, `path`, `ranked`

#### Screenshot shot list (EN UI에서 촬영)
1. Desktop dashboard — match list + map path expanded  
2. Loadout timeline for one match  
3. Statistics Overview (radar + RP trend)  
4. Premium blur tease on Maps/Weapons (shows value of unlock)  
5. In-game overlay peek (optional 5th)

워터마크: 우하단에 작은 `ApexTrace` 워드마크; 스티커류 금지.

### 日本語 (JA — Japan)

#### タイトル
ApexTrace

#### 短いサブタイトル
Apexの試合を記録 — 移動ルート・ロードアウト年表・シーズン統計。

#### 説明文

ApexTrace は Overwolf 向けの Apex Legends コンパニオンアプリです。スコアボードだけでなく、「その試合で何が起きたか」を残します。

**できること**
- **移動ルート** — ローテ・撃破・リスポーン地点をマップで確認
- **ロードアウト年表** — 試合終了時の1枚ではなく、途中の武器切り替えを時系列で表示
- **マッチ履歴 & 戦闘ログ** — キル / ノック / デス / スクワッドイベント
- **シーズン統計** — オーバービューのレーダーに加え、マップ / レジェンド / 武器 / チームメイト分析
- **セカンドスクリーン & ゲーム内オーバーレイ** — 別モニタ常駐やホットキー表示

**Free / Premium**
- Free: 試合記録・履歴・オーバービュー統計。デスクトップ窓の軽量広告で運営を支えます
- Premium（近日公開）: Maps / Legends / Weapons / Teammates の詳細分析を解放

**ヒント**
- 試合を確実に残すには、プレイ中も ApexTrace をバックグラウンドで起動したままにしてください
- 記録が欠けているときは GEP ステータス表示を確認してください（Overwolf の Apex プラグイン状態に依存します）

「最終ダメージ」だけでなく、戦いの過程を振り返たいプレイヤー向けです。

#### タグ
`Apex Legends`, `トラッカー`, `統計`, `オーバーレイ`, `マッチ履歴`, `ロードアウト`, `ランク`

#### スクリーンショット
EN と同じ 5 カットを **UI 言語 = 日本語** で再撮影。文言だけ差し替えた静止画でも可。

### Console 체크리스트

- [ ] EN title + subtitle + description 붙여넣기  
- [ ] JA description 붙여넣기 (콘솔 로케일 필드 지원 시 해당 필드)  
- [ ] 스크린샷 4–5장 (EN 우선; JA 변형 가능하면 추가)  
- [ ] Age rating / permissions가 `manifest.json`과 일치  
- [ ] 스토어 링크를 아래 §3 `STORE_URL`에 기입

---

## 3. Organic US / JP kit

**범위:** organic만. [§4 week-2 review](#4-week-2-review) 전까지 Meta/Google/Twitch paid UA 없음.

**스토어 링크:** _게시 후 붙여넣기_ → `STORE_URL`

**Discord (제품):** https://discord.gg/vwGVAFEYyj

**핵심 메시지 (US·JP 동일):**  
match path · loadout timeline · season stats — 스코어보드 전용 트래커가 아님.

### Day 0 전 준비 에셋

| 에셋 | 스펙 | 메모 |
|---|---|---|
| Clip A | 15–25초, 나레이션 없음 | 맵 path 리플레이 + 매치 펼침 |
| Clip B | 15–25초 | Loadout timeline scrub |
| Clip C | 10–15초 | Stats overview → Premium 탭 blur tease |
| Still | 1920×1080 | Discord/Reddit용 대시보드 히어로 |
| One-pager | 이 문서 + 스토어 URL | 크리에이터 5–10명용 |

파일명 예: `apextrace_us_path.mp4`, `apextrace_jp_loadout.mp4`.

### 포스팅 캘린더 (Pro infra + 스토어 라이브 이후)

| Day | 채널 | 액션 |
|---|---|---|
| **D0** | Overwolf store | Listing live (EN+JA). Discord `#announcements` soft 공지 |
| **D0** | X / Twitter (JP) | 포스트 1 + Clip A 또는 B. `#ApexLegends` `#オーバーウルフ` |
| **D1** | JP Apex / OW Discords | 기능 데모 (설치 스팸 금지). 필요 시 모드 승인 |
| **D2** | Reddit r/apexlegends | 데모 우선 포스트 (템플릿). 서브룰·플레어 준수 |
| **D3** | US Apex Discords | 동일 키트, EN |
| **D5–D7** | Creators (US+JP 5–10) | DM 키트만 — Phase 1 유료 스폰서십 없음 |
| **D14** | Internal | [§4 Week-2 review](#4-week-2-review) 실행 |

KR/글로벌 paid blast 금지. 다른 지역은 OW discovery로 organic 유입 가능.

### 카피 템플릿 (게시용 — 원문 유지)

#### Reddit / Discord (EN)

```
I built ApexTrace (Overwolf) — records movement path, loadout timeline, and season stats for Apex.

Not another damage-only overlay: you can scrub weapon swaps and see rotations on the map after the match.

Free on desktop (light ads). Deeper analytics tabs are Premium (coming soon).

Store: STORE_URL
Short demo: [clip]
Feedback welcome — especially US players on ranked review habits.
```

#### X / Discord (JA)

```
ApexTrace（Overwolf）を公開しました。
試合の移動ルート・ロードアウト年表・シーズン統計を残せます。

スコアボードだけじゃない振り返り用です。デスクトップはFree（軽量広告あり）。詳細分析タブはPremium予定。

ストア: STORE_URL
デモ: [clip]
日本のランク勢の使い方フィードバック歓迎です。
```

#### Creator DM (EN)

```
Hey — shipping a small Overwolf Apex companion (path + loadout timeline + season stats).
Would you be open to trying it / a 20s clip if it fits your content? No paid ask — just feedback.
STORE_URL · Discord: https://discord.gg/vwGVAFEYyj
```

#### Creator DM (JA)

```
突然失礼します。Overwolf向けApexコンパニオン「ApexTrace」を公開しました（移動ルート・ロードアウト年表・シーズン統計）。
短尺クリップや試用フィードバックをいただけると嬉しいです。案件ではなく製品フィードバック目的です。
STORE_URL
```

### 채널 숏리스트 (가입하며 수정)

**Japan**
- [ ] 본인 X 계정 포스트
- [ ] 제품 Discord JP 스레드
- [ ] JP Apex 커뮤니티 Discord 1–2 (모드 승인)
- [ ] JP 마이크로 크리에이터 3–5 (클립 / 랭크 VOD)

**United States**
- [ ] r/apexlegends (룰 준수)
- [ ] EN Apex Discord 1–2
- [ ] EN 마이크로 크리에이터 / 코치 3–5

### Guardrails

- Phase 1에서 커뮤니티당 프로모 포스트 **최대 1회**; 재포스팅 대신 피드백 답글
- install-for-giveaway 금지
- 광고는 **데스크톱 창 전용** 오른쪽 레일 (CurseForge식) — 접히는 프로필 드로어 안 금지
- 숨김/오프스크린 프로필 드로어에 OwAd를 마운트한 채 두지 않음
- DAU가 infra 감당을 넘으면 크리에이터 DM 중단 → Vercel/Supabase 사용량 먼저 확인

---

## 4. Week-2 review

**D0 기준 14일 후** (스토어 라이브 + 첫 US/JP 포스트). **한 지역만** 소규모 paid UA 테스트 여부를 결정.

### 스냅샷 (기입)

| 지표 | Phase 1 목표 | 실측 | 출처 |
|---|---|---|---|
| 대략 DAU (7일 평균) | 100–500 | | OW analytics / proxy 로그 / 매치 POST unique UID |
| 활성 유저 중 US 비중 | JP와 함께 다수 | | `en` 세션, OW geo, Discord 폴 |
| JP 비중 | | | `ja` / OW geo |
| 기타 지역 | organic 유입 | | |
| Vercel $ (당월) | ~$20–40 | | Vercel Billing |
| Supabase $ (당월) | ~$25–40 | | Supabase Billing |
| DB size | ≪ 8 GB | | Supabase Database |
| OwAd 예상 수익 | ~$45 floor 대비 | | Overwolf Dev Dashboard |
| 크래시 / GEP 불만 | 낮음 | | Discord + OW 리뷰 |

### 정성

- 가장 호평받은 기능: _______________
- 가장 큰 불만: _______________
- 스토어 전환 (impressions → installs, OW 제공 시): _______________
- 크리에이터 회신 (유용 Y/N): _______________

### 의사결정 트리

```
DAU < 100 이고 infra 건강?
  → organic 2주 더; 스토어 스크린샷/클립 개선. paid UA 없음.

DAU 100–500, US 또는 JP가 뚜렷히 강하고, OwAd·예산 OK?
  → 선택: 강한 지역만 $50–150 테스트 (채널 1개).
     7일 후 CPI / 설치 품질로 재평가.

DAU > 500 또는 infra $ 급등?
  → 프로모 일시 중단. spend alert 상향. UA 확대 전 매치 JSON 크기·캐싱 검토.

Premium waitlist 관심 높음?
  → Phase 1.5 결제 연동 일정; blur CTA는 waitlist로 유지.
```

**Phase 1 규칙:** 첫 테스트에서 US + JP paid 캠페인을 **동시에** 돌리지 않음.

### Paid UA 테스트 브리프 (위 승인 시에만)

| 항목 | 값 |
|---|---|
| Region | US **또는** JP (하나 선택) |
| Channel | _______________ |
| Budget | $_______ (상한 $150) |
| Creative | organic 키트 Clip A/B |
| Landing | Overwolf 스토어 URL |
| Success | 48시간 내 매치 ≥1판 POST한 설치 |
| Stop | 예산 소진 또는 CPI junk / 매치 POST 없음 |

### Sign-off

- 날짜: ________  
- 결정: `stay_organic` / `paid_test_US` / `paid_test_JP` / `pause_growth`  
- Owner: ________  
