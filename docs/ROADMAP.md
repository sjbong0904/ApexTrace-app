# ApexTrace 향후 계획 (Roadmap)

테스트·개발 중 정리한 로드맵.  
수동 QA·제출 체크는 [QA.md](./QA.md)만 보면 되고, 여기 항목을 고친다고 QA 필수 통과가 바뀌지는 않음.

**상태**

| 라벨 | 의미 |
|------|------|
| `예정` | 구현 방향 확정 |
| `검토중` | 설계/정책 미정 |
| `삭제 예정` | 제거 방향 |
| `후보` / `낮음` / `보류` | Overwolf API 쪽 (아래 §B) |

---

## A. 제품

### 예정

#### 1. 매치 히스토리 지도 — 링 + (Premium) 맵 플레이어

매치 상세 `MapVisualizer`에 GEP `ring` 반영. Free는 정적 링 오버레이, Premium은 path+ring 타임라인 재생.  
**구현은 QA 통과 후 다음 패치 §4c.** 요청·패킷: [GEP-REQUESTS.md](./GEP-REQUESTS.md) Ring.

#### 2. Private mode 스위치

- **위치:** 시즌 드롭다운 옆
- **동작:** 켜면 매치 기록을 **로컬에만** 저장하고 클라우드(`/history`)에는 올리지 않음

#### 3. WeaponsDB / Weapons UI 삭제

네비 **무기 레퍼런스 탭은 이미 제거**됨 (`NavTabId`에 `WEAPONS` 없음, 옛 `mainTab === 'WEAPONS'`는 DASHBOARD로 리다이렉트). Statistics → Weapons(통계)는 유지.

남은 작업: 미사용 `src/components/weaponsTab.tsx`, `seed:weapons`, `public.weapons` / 어드민 무기 편집을 정리할지 결정.

#### 4. 개별 매치 카드 (공유용)

매치 상세에서 **한 장짜리 요약 카드**를 생성한다.  
결과·맵·레전드·핵심 스탯·(가능하면) 동선 요약을 카드로 묶어 저장/클립보드·Discord 등으로 공유.  
기존 티어표 캡처 인프라를 재사용하되, UX/카피는 “스크린샷”보다 **매치 카드**로 통일.  
Private mode와 충돌 시: 로컬-only 매치는 공유 제한 또는 경고.

### 예정 (QA 통과 후 · 다음 패치)

Free QA / 스토어 통과 직후 버그픽스 + GEP 312 활용. QA 중에는 코드 변경하지 않음.

#### 4b. stale `match_summary` 거절 (등수 오판)

GEP가 전멸 직후 **직전 판과 동일**한 `match_summary` JSON을 재주입하면 앱이 그걸 최종 등수로 저장함 (예: 실제 ~13등인데 2등).  
관측·수정 방향: [GEP-BUGS.md](./GEP-BUGS.md) §전멸 직후 직전 판 `match_summary` 재주입.  
`(1)` fingerprint 거절 `(2)` `rank + 1 < _minTeamsAlive` 거절 → estimate 폴백.

#### 4c. `ring` — 파싱·저장 · MapVisualizer (§A.1)

구독 `'ring'` ✅. `next_ring` / `active_ring` 파싱 → `ringRounds` 저장.  
패킷: [GEP-REQUESTS.md](./GEP-REQUESTS.md) Ring · [gep-next-ring-event-example.json](./gep-next-ring-event-example.json).

**MapVisualizer**

| 티어 | 동작 |
|------|------|
| Free (`isPremium === false`) | 기존 이동 동선 유지 + 그 위에 링을 **정적**으로 겹침 (플레이어 애니 없음) |
| Premium | 하단 **재생 바**: 왼쪽 네모 버튼 = 재생/일시정지, 그 옆 사이클 버튼 = 배속(경기 ~20분 → 사용자 선택). 프로그레스 바로 시간 시크. 전체화면에서도 동일하되 재생 바는 가로로 과도하게 늘어나지 않게 **중앙 하단** 배치 |

Premium 재생(1x = 인게임 실시간): path를 따라 마커가 이동하며 지나온 동선이 그려지고, 같은 시점의 ring으로 미니맵처럼 링 표시·축소. 인게임 미니맵 재구성 + 동선 오버레이.

**실기 체크 (구현 전)**

- 사망 중에도 GEP가 `ring`을 주는지  
  - 주면: 사망 마커에서 path 끊김 → 부활까지 **링만** 움직임이 정상  
  - 전멸이 아닌데 사망 중 ring이 없으면: 사망 마커 후 ~3초 텀 → 부활 시점 정보부터 재개  
- `path` / `ring`에 시각이 찍히는지, 두 시계를 같이 쓸 수 있는지 → 맵 플레이어 재구성 가능 여부

**미래 (Premium 통계 후보):** 맵별 ring 구역 비율, 인서클/아웃서클 플레이 비율 등 Statistics 탭.

#### 4d. `player_stats` — 프로필·요약·통계 오버뷰

구독 `'player_stats'` ✅. lobby/매치마다 career·시즌 ranked/unranked 스냅샷 파싱.  
상세 키·실기 확인(필드·발송 시점): [GEP-REQUESTS.md](./GEP-REQUESTS.md) §player_stats.  
**실기 결과 요약:** `br_ranked_latest.rank_score`가 ALS RP와 일치 → 로컬 유저는 **RP까지 GEP로** 갱신·판 델타 계산 가능. `level`은 프레스티지 포함 총 레벨. `season`은 스플릿 구분 없음. `ranked_latest`는 `match_end` 후 최대 ~80s 늦게 옴. 로컬 플레이어 것만 옴.

**구현 상태 (2026-11-15):** 마이그레이션 `20261114184658_player_account_stats.sql` **적용됨**, 프록시 `api/account-stats.js`·`lib/accountStats.js`(+ `/history` pending RP 적용) **배포됨**(`45a72bf`). 클라이언트(미배포): 백그라운드 `AccountStatsSync`(events.js)·레벨 정규화(main.js), 공용 훅 `useAccountStats`. UI — Free: XP 바(Sidebar), 계정 시즌 카드(Statistics Overview, ALL/RANKED), 매치 카드 RP 증감(`rpProcessed` 랭크 판, `historySync`가 병합 시 서버 RP 유지). Premium: 사이드바 `최근 20 ↔ 시즌 ↔ 전체` 토글(SidebarStats, 계정 뷰는 평균 순위 대신 Top 5%), 계정 카드의 트래킹 커버리지(시즌에 스플릿 1개일 때만)·이전 랭크 시즌 표. 배포 순서: 마이그레이션(MCP `apply_migration` — 원격 버전명이 로컬 파일명과 달라 `supabase db push` 금지) → 프록시(중첩 repo `main` push = Vercel Git 배포) → 클라이언트. 레벨 오염 행은 정식 출시 전 DB 초기화로 정리 예정이라 `repair_double_counted_levels.sql`은 선택(초기화 전 테스트용). 남은 것: 레벨/XP 일별 추이(Premium, `daily_rank_snapshots.total_xp` 필요), `keep-alive` ALS 축소(아래 — `rank_name`은 아직 ALS 소유라 보류), 원격 `languages` 테이블에 새 i18n 키 반영 — `favorites.xpProgress`, `statistics.overview.{accountSeasonTitle, accountSeasonHint, accountTop5, accountCoverage, accountCoverageValue, accountSeasonHistory, accountSeasonCol}`, `sidebarStats.{scopeRecent, scopeSeason, scopeCareer, accountSeasonGames, accountCareerGames, top5Rate}` (en/ko 시드에는 있음, 코드에 영어 defaultValue).

**Free / Premium**

기준: GEP 값 그대로 표시 = Free, 가공·비교·누적 기록 = Premium.

| 기능 | 티어 |
|------|------|
| 프로필 카드 XP 바 (레벨↔랭크 사이, 현재/필요 XP) | Free |
| 레벨·RP·레전드 자동 갱신 (파이프라인) | Free |
| Overview(Ranked) 최상단 시즌 계정 요약 (games, wins, K/D, 평균 딜, top 5) — 앱 미기동 판 포함 | Free |
| 매치 상세 판 RP 델타 (GEP `rank_score` 차) · 판 XP | Free |
| 사이드바 `20게임 ↔ 계정 시즌/올타임` 토글 | Premium |
| 트래킹 커버리지 (계정 판수 − 앱 기록 판수), 앱 기록 vs 계정 전체 비교 | Premium |
| 시즌별 추이 (`br_*_history`, `*_history` 구독 추가 필요) | Premium |
| 레벨/XP 일별 추이 | Premium |

**Supabase**

- `global_profiles` 컬럼: `current_xp int`, `needed_xp int`, `total_xp bigint`, `gep_synced_at timestamptz`. 카드가 이미 `address-book GET select *`로 읽으므로 조인 불필요.
- 신규 `player_account_stats` (uid PK → `global_profiles` FK cascade): `career`, `br_ranked_latest`, `br_unranked_latest`, `br_ranked_history`, `br_unranked_history` (jsonb), `gep_season int`, `captured_at`, `updated_at`. RLS on, anon/authenticated grant 없음 (프록시 service role만). jsonb를 `global_profiles`(6.8만 행, 대부분 로스터 학습)에 넣지 않는 이유: 검색·로스터 `select *` 비용.
- 선택: `daily_rank_snapshots.total_xp` + `source='gep'` (XP 추이), `matches.xp_gained`.

**파이프라인**

- 신규 `POST /account-stats`: 로비에서 스냅샷 변경 시 디바운스 업로드 (매치 업로드와 분리 — `ranked_latest`가 늦게 오므로). `global_profiles` 레벨(총 레벨 → `level`/`prestige` 분리 저장)·RP·XP·`gep_synced_at`, `player_account_stats` upsert, 직전 매치 레전드를 `legend`로.
- 판 RP 델타: `ranked_latest` 도착 시 직전 `rank_score`와 차 → 직전 매치 `rank_score`/`rp_change`/`rp_processed` 갱신 (`correctPreviousMatchRP` 대체; 현재 최근 매치 전부 null).
- `keep-alive.js`: 최근 `gep_synced_at` 행은 ALS 대상에서 후순위/제외. `apex-stats.js` 캐시 판단도 `gep_synced_at` 반영. ALS는 DB에 없거나 앱 미사용 플레이어용.
- 보안: `/history`·`address-book` POST 무인증 → 타 uid 스탯 위조 가능 (기존과 동일 위험). 새 엔드포인트 설계 시 결정.

**같이 고칠 기존 버그 — 레벨 이중 가산**

`mapSearchCandidate`(`public/background/main.js`)가 `level`에 `level + prestige*500`을 넣고, 이 값이 address-book으로 DB `level`에 다시 쓰임 → 사이드바가 `prestige*500`을 또 더함. 실례: uid `1009381116634` DB `level=1457, prestige=2` (ALS 스냅샷 `457/2`) → 2457로 표시. GEP 총 레벨 저장 규칙 정할 때 같이 정리 + 오염 행 수정.

#### 4e. `kill_feed.action2` — `resolveCombatImpact`

특수 능력명은 `action`, 표준 outcome은 `action2`(`knockdown`/`kill`).  
`resolveCombatImpact`가 지금은 `impact` → `action`만 봄 → **`action2`를 `action`보다 먼저**(또는 `impact` 다음) 보게 변경.  
로케일 출혈/링 finish는 `action2`가 영어 표준일 때만 이득.  
상세: [GEP-REQUESTS.md](./GEP-REQUESTS.md) §kill_feed.action2 · [GEP-BUGS.md](./GEP-BUGS.md) finish `action` 로케일.

#### 4f. 시즌/스플릿 테이블 개편

**현재 (임시 구조).** `seasons` 행 = 스플릿 1개. 시즌 단위 드롭다운 · Split 1 / Split 2 / 전체 시즌 버튼은 **클라이언트가 이름("Season 28 : Split 2")을 정규식으로 파싱해 묶는** 방식(`src/utils/seasonGroups.ts`).  
전체 시즌 통계는 스플릿별 `player_season_stats` 행을 각각 받아 클라이언트에서 병합 → 스플릿 수만큼 요청.  
문제: 이름 형식이 곧 스키마(운영자가 이름을 바꾸면 묶음이 깨짐), `/seasons` 응답에 `endTime` 없음(다음 행 시작일로 추정), 전체 시즌 요청 N배.

**개편안**

1. **`seasons` 컬럼 추가** — `season_number int`, `split_number int` (+ `unique (season_number, split_number)`).  
   기존 이름에서 백필 → `not null` 전환. `name`은 표시용으로만 유지. `id`·FK(`matches.season_id`, `player_season_stats.season_id`)는 그대로라 데이터 이전 없음.  
   (대안: 부모 `competitive_seasons` 테이블 + `seasons.parent_id` — 시즌 단위 메타데이터가 생기면 그때 검토.)
2. **`/seasons` 응답 확장** — `toClientSeasons`에 `endTime`, `seasonNumber`, `splitNumber` 포함.
3. **전체 시즌 통계 서버 병합** — `/player-stats?season_number=28&mode=…`가 스플릿 행을 서버에서 합쳐 1회 응답. 새 테이블 없음(필요해지면 시즌 단위 캐시 행 검토).
4. **클라이언트** — `seasonGroups.ts`를 필드 기준으로 전환, 필드 없는 응답(구버전 캐시·폴백 시즌)만 정규식 폴백. 기간 계산은 `endTime` 우선.
5. **어드민 Seasons 페이지** — 시즌/스플릿 번호 입력 + 중복 검증.

**순서 · 호환성:** 컬럼 nullable 추가 → 백필 → proxy 배포(필드 추가만, 기존 필드 유지) → 클라이언트 → `not null`. 구버전 클라이언트는 `name`만 쓰므로 영향 없음.  
**확인할 것:** 이름에 "Season N"이 없는 행, `start_time = 0`인 최초 행(Season 27 Split 2), 백그라운드 `window.SEASONS` 매핑(`public/background/main.js`), `daily_rank_snapshots`는 날짜 범위라 무관.

### 예정 (QA 통과 후 · Premium 업서트)

Free QA / 스토어 통과 뒤 Premium 버전 업서트에 **바로 포함**.

#### 5. 매치 플레이스타일 서사화

매치 상세 플레이스타일 칸을 집계 스탯 룰트리에서 **「아, 그때 이랬지」** 한 단어 기억 장치로 확장.  
v2 구현·언어 팩 v24 반영됨(`headhunter`/`bomber` 남음): 리스폰·부활·이벤트 시각·무기·링 신호로 복귀 아크·버스트·생존 서사 추가, 렌더 시 계산(저장 안 함).  
실제 매치 1,692판 분포 기준으로 상위 3개 쏠림 72% → 32%.  
설계·키 목록·시뮬레이션: [PLAYSTYLE.md](./PLAYSTYLE.md).  
(QA 중에는 구현하지 않음.)

### 예정 (런칭 스케일)

#### 6. ALS 전역 게이트 (닉검색 Phase 2)

검색 미스·프로필 새로고침용 전역 스로틀·singleflight·TTL.  
닉/alias/keep-alive Phase 1은 [NICKNAME-SEARCH.md](./NICKNAME-SEARCH.md) 참고.

### 검토중

#### 7. 비-BR 모드 기록 정책 (Other)

와일드카드, 건런, 팀 데스매치 등을 `other`로 묶을지 / 모드별 분리 / 미기록 — 미정.  
결정 후 `matchMode`·필터 탭·시즌 통계 집계 범위를 맞춤.

---

## B. Overwolf API / 플랫폼 (QA 범위 밖)

제출·현재 QA 밖. 제품 단계에서 붙일 수 있는 **미구현** API/플로우.

### Premium / 구독 — Free QA 통과 후 정식 출시 체크리스트

**지금(Free 제출):** `isPremium = false` 고정, 데스크톱 OwAd ON, Statistics 상세 탭 `PremiumBlurGate` + Coming Soon CTA. 구독 API·Tebex·OIDC·`Subscription` 권한 **없음** (의도적).

아래는 **Free QA / 스토어 통과 뒤** Premium을 켤 때 처리한다. 문서: [profile](https://dev.overwolf.com/ow-native/reference/profile/ow-profile) · [subscriptions](https://dev.overwolf.com/ow-native/reference/profile/subscriptions) · [inapp](https://dev.overwolf.com/ow-native/reference/profile/subscriptions-inapp) · [Subscriptions API](https://dev.overwolf.com/ow-native/reference/subscriptions-api) · [OIDC](https://dev.overwolf.com/ow-native/reference/overwolf-oidc/ow-oidc) · [OwAd](https://dev.overwolf.com/ow-native/reference/ads/owad).

#### 1. 클라이언트 게이트 (코드)

- [ ] `App.tsx`의 `isPremium` 하드코딩 제거 → 단일 소스(예: 훅/모듈)로 교체
- [ ] 활성 플랜이 있으면 `isPremium === true` → `showDesktopAds` OFF + Statistics Maps/Legends/Weapons/Teammates 언락 (기존 `!isPremium` 분기 재사용)
- [ ] 플랜 없음/만료 → Free와 동일 (광고 ON + blur 게이트)
- [ ] `PremiumBlurGate` CTA: Coming Soon → 실제 구독/결제 진입 (checkout 또는 inapp modal)
- [ ] Settings(또는 프로필)에 구독 상태·관리·해지 안내 UI
- [ ] 로케일: `premium.comingSoon` / `statistics.premiumLock.comingSoonCta` / `ads.railFooter` 등 Coming Soon 카피 갱신 (전 언어 시드 + `seed:languages`)

#### 2. Overwolf Profile / Subscriptions (클라이언트 API)

- [ ] `overwolf.profile.getCurrentUser` — checkout용 `uuid` (미로그인 시 로그인 유도)
- [ ] `overwolf.profile.openLoginDialog` / `onLoginStateChanged` — OW 계정 필요 시
- [ ] `overwolf.profile.generateUserSessionToken` — Subscriptions REST Bearer
- [ ] `overwolf.profile.subscriptions.getActivePlans` 또는 `getDetailedActivePlans` — 부팅·포커스 시 Premium 판정
- [ ] `onSubscriptionChanged` — 구독 변경 시 광고/탭 즉시 갱신
- [ ] (선택) `subscriptions.inapp.show/hide` — 인앱 구독 모달; manifest에 **`Subscription`** 권한 추가
- [ ] (선택) `overwolf.utils.openStore({ page: SubscriptionPage })` — 보조 진입

#### 3. Tebex / Subscriptions REST + deeplink

- [ ] Tebex 스토어·패키지(플랜) 생성; 필요 시 Categories + upgrade/downgrade용 패키지
- [ ] Checkout: `GET subscriptions-api.overwolf.com/checkout/{STORE}/{PACKAGE}?extensionId&userId(=uuid)` → `openUrlInDefaultBrowser`
- [ ] 상태 조회: `/subscriptions`, `/packages`, `/categories` (Bearer = session token)
- [ ] (선택) upgrade/downgrade `PUT /subscriptions/...`
- [ ] 결제 이력: 설정에 `https://checkout.tebex.io/payment-history` 링크
- [ ] manifest `protocol_override_domains` + checkout 복귀 deeplink (`?result=success|cancel`)
- [ ] `onAppLaunchTriggered` origin `urlscheme`에서 success/cancel 처리 후 플랜 재조회

#### 4. Manifest / 패키지 / 정책

- [ ] 권한: 기존 `Profile` 유지; inapp 쓰면 `Subscription` 추가
- [ ] Advertisement flags(`desktop`)·OwAd 슬롯은 Free 경로에 유지; Premium일 때만 레일 마운트 안 함
- [ ] 스토어 리스팅·LAUNCH 카피: Free / Premium 혜택·가격 문구 갱신 (EN/JA 등)
- [ ] 버전 bump + `docs/QA.md`에 **Premium QA** 섹션으로 재제출 스모크
- [ ] (선택) OIDC — 웹/백엔드에 OW 계정 SSO가 필요할 때만 ([OIDC](https://dev.overwolf.com/ow-native/reference/overwolf-oidc/ow-oidc))

#### 5. Premium QA 스모크 (재제출 전)

- [ ] 미구독: 광고 2슬롯 + 상세 탭 잠금 + CTA가 결제/모달로 연결
- [ ] 구독 성공(deeplink success): 광고 사라짐 + 상세 탭 사용 가능
- [ ] 구독 취소/만료 후: Free UX 복귀
- [ ] SETTINGS/모달/minimize 시 Free 경로 광고 pause 회귀
- [ ] OW 미로그인 사용자 구독 시도 시 로그인 유도

API 요약 (구현 시 참고):

| 항목 | API / 문서 |
|------|------------|
| 활성 플랜 | `getActivePlans` / `getDetailedActivePlans` |
| 구독 변경 | `onSubscriptionChanged` |
| 인앱 모달 | `subscriptions.inapp` + `Subscription` 권한 |
| Checkout / 목록 | [Subscriptions API](https://dev.overwolf.com/ow-native/reference/subscriptions-api) |
| 세션 토큰 | `generateUserSessionToken` |
| Deeplink | `protocol_override_domains` + `urlscheme` |

### UX / 오버레이 (후보 · 낮음)

| 항목 | API / 문서 | 비고 |
|------|------------|------|
| 풀스크린 시 desktop `grabFocus` | `bringToFront(id, grabFocus)` | **보류** — 게임 최소화 UX. 세컨드스크린 정책 후 재검토 |
| Apex 오버레이 OFF 안내 | `settings.games.getOverlayEnabled` / `onOverlayEnablementChanged` / `enableOverlay` | 인게임 창 안 뜰 때 |
| 게임별 오토런치 토글 | `get/setAutoLaunchEnabled` | 설정 UI |
| OW 클라이언트 언어 동기화 | `settings.language.get` / `onLanguageChanged` | 첫 실행 기본값만 쓸지 결정 |
| Toast 알림 | `notifications.showToastNotification` | unpacked에서 미동작 주의 |
| coexistence / 전체화면 최적화 안내 | `overlayInfo` | 이전에 QA용으로 드롭 |

### 유지보수 / 지원 (낮음)

| 항목 | API / 문서 | 비고 |
|------|------------|------|
| `getRunningGameInfo2` | `overwolf.games` | deprecated 교체. 언랩 실수 리스크 |
| 클라이언트 업데이트 안내 | `utils.checkForClientUpdates` | OW 자동 업데이트와 중복 가능 |
| 로그 zip / 업로드 | `createLogsZip` / `uploadClientLogs` | Discord 지원용 |
| Discord 미디어 공유 | `social.discord.share*` | 지금은 invite 링크만 |
| Discord Rich Presence | Discord RPC / Activity | 스토어 QA 추천(R1). Free 통과 후 검토 ([STORE-QA](./STORE-QA.md)) |

### 해당 없음 (의도적 미사용)

캡처 전용 `overwolf.media`, Logitech, 로컬 `overwolf.web` 서버/WebSocket, simple-io 플러그인(현 `io`로 충분), crypto, crossapp.
