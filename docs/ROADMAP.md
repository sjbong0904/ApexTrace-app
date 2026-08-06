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

에이펙스 게임 내 관련 기능으로 앱 쪽 무기 레퍼런스 필요성 소멸 → 시드·탭·관련 코드 제거 예정.

### 예정 (런칭 스케일)

#### 4. ALS 전역 게이트 (닉검색 Phase 2)

검색 미스·프로필 새로고침용 전역 스로틀·singleflight·TTL.  
닉/alias/keep-alive Phase 1은 [NICKNAME-SEARCH.md](./NICKNAME-SEARCH.md) 참고.

### 검토중

#### 5. 비-BR 모드 기록 정책 (Other)

와일드카드, 건런, 팀 데스매치 등을 `other`로 묶을지 / 모드별 분리 / 미기록 — 미정.  
결정 후 `matchMode`·필터 탭·시즌 통계 집계 범위를 맞춤.

---

## B. Overwolf API / 플랫폼 (QA 범위 밖)

제출·현재 QA 밖. 제품 단계에서 붙일 수 있는 **미구현** API/플로우.

### Premium / 구독 (가능성 높음 — Phase 1.5+)

| 항목 | API / 문서 | 비고 |
|------|------------|------|
| OW 활성 플랜 조회 | `overwolf.profile.subscriptions.getActivePlans` / `getDetailedActivePlans` | 광고·탭 언락과 연동 |
| 구독 변경 이벤트 | `onSubscriptionChanged` | 캐시/UI 갱신 |
| 인앱 구독 모달 | `subscriptions.inapp.show/hide` + `Subscription` 권한 | 테마 Dark/Light |
| Tebex Checkout | `subscriptions-api.overwolf.com/checkout/...` | 브라우저로 열기, `uuid` = `getCurrentUser` |
| 구독/패키지 목록 | `/subscriptions`, `/packages`, `/categories` | Bearer = `generateUserSessionToken()` |
| 업/다운그레이드 | `PUT /subscriptions/...` | 카테고리·티어 패키지 필요 |
| Checkout deeplink | `protocol_override_domains` + `?result=success\|cancel` | `onAppLaunchTriggered` origin `urlscheme` |
| 결제 이력 안내 | Tebex payment-history 링크 | 문서 권장 버튼 |
| 스토어 구독 페이지 | `overwolf.utils.openStore({ page: SubscriptionPage })` | 보조 진입점 |

현재: Free 고정 + 스토어 “coming soon” 게이트만 존재 (로컬 Premium override 제거됨).

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

### 해당 없음 (의도적 미사용)

캡처 전용 `overwolf.media`, Logitech, 로컬 `overwolf.web` 서버/WebSocket, simple-io 플러그인(현 `io`로 충분), crypto, crossapp.
