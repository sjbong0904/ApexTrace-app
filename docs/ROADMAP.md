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

#### 1. 매치 히스토리 지도 — 라운드별 링 위치 표시

매치 상세 지도에 **라운드별 링(circle) 위치**를 표시한다.  
(`ring_rounds` / GEP 제공 여부에 의존; UI에서 라운드 단위로 가시화.)

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

### 예정 (QA 통과 후 · Premium 업서트)

Free QA / 스토어 통과 뒤 Premium 버전 업서트에 **바로 포함**.

#### 5. 매치 플레이스타일 서사화

매치 상세 플레이스타일 칸을 집계 스탯 룰트리에서 **「아, 그때 이랬지」** 한 단어 기억 장치로 확장.  
`playstyleKey` 저장 · GEP/버퍼 기반 아크·버스트·고난이도/긍정·부정 스탯 분류.  
설계·키 목록·Phase A/B: [PLAYSTYLE.md](./PLAYSTYLE.md).  
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
