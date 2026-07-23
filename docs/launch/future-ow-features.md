# Future Overwolf features (not for current QA)

제출·이번 QA 범위 밖. 나중에 제품 단계에서 붙일 수 있는 **미구현** API/플로우만 정리.

상태: `후보` = 가능성 있음 · `낮음` = 여유 있을 때 · `보류` = 정책 결정 후

---

## Premium / 구독 (가능성 높음 — Phase 1.5+)

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

---

## UX / 오버레이 (후보 · 낮음)

| 항목 | API / 문서 | 비고 |
|------|------------|------|
| 풀스크린 시 desktop `grabFocus` | `bringToFront(id, grabFocus)` | **보류** — 게임 최소화 UX. 세컨드스크린 정책 후 재검토 |
| Apex 오버레이 OFF 안내 | `settings.games.getOverlayEnabled` / `onOverlayEnablementChanged` / `enableOverlay` | 인게임 창 안 뜰 때 |
| 게임별 오토런치 토글 | `get/setAutoLaunchEnabled` | 설정 UI |
| OW 클라이언트 언어 동기화 | `settings.language.get` / `onLanguageChanged` | 첫 실행 기본값만 쓸지 결정 |
| Toast 알림 | `notifications.showToastNotification` | unpacked에서 미동작 주의 |
| coexistence / 전체화면 최적화 안내 | `overlayInfo` | 이전에 QA용으로 드롭 |

---

## 유지보수 / 지원 (낮음)

| 항목 | API / 문서 | 비고 |
|------|------------|------|
| `getRunningGameInfo2` | `overwolf.games` | deprecated 교체. 언랩 실수 리스크 |
| 클라이언트 업데이트 안내 | `utils.checkForClientUpdates` | OW 자동 업데이트와 중복 가능 |
| 로그 zip / 업로드 | `createLogsZip` / `uploadClientLogs` | Discord 지원용 |
| Discord 미디어 공유 | `social.discord.share*` | 지금은 invite 링크만 |

---

## 해당 없음 (의도적 미사용)

캡처 전용 `overwolf.media`, Logitech, 로컬 `overwolf.web` 서버/WebSocket, simple-io 플러그인(현 `io`로 충분), crypto, crossapp.

---

## 현재 QA 체크리스트와의 관계

수동 QA·제출 체크는 [`overwolf-qa-checklist.md`](./overwolf-qa-checklist.md)만 보면 됨.  
이 문서는 **로드맵용**이며, 여기 항목을 고친다고 QA 필수 통과가 바뀌지는 않음.
