# Overwolf Store QA 피드백

스토어 제출 후 OW QA 라운드에서 받은 이슈. 추정만 있는 항목은 “추정”으로 표시.

관련 체크리스트: [QA.md](./QA.md)

---

## 라운드: Free 재제출 피드백 (2026-09)

앱 버전 기준 QA 시점: 최신 Free 빌드 (로그 `desktop.html.2.log` 등 2026-09-02).

Critical는 승인 차단. High/Medium/Low는 가능한 한 수정.

| # | QA Item | Severity | 상태 | 요약 |
|---|---------|----------|------|------|
| 1 | Ads opened in Overwolf browser | Critical | **실기 Pass** (2026-09-03) | `data.force_browser: "user"` |
| 2 | Minimize in-game terminates 2nd-screen ads | Critical | **실기 Pass** (2026-09-03) | 인게임 창 띄운 뒤 최소화해도 세컨드 스크린 광고 유지 |
| 3 | Ad container background color | Medium | **실기 Pass** (2026-09-04) | `:root color-scheme: dark` ↔ 광고 iframe light 불일치 → 불투명 흰 캔버스. 슬롯/iframe `color-scheme: light` + 부모 `transparent` |
| 4 | Undraggable window on FTUE | Medium | 재수정 | 튜토리얼 중 타이틀바 드래그가 오버레이 클릭으로 종료되던 문제 |
| 5 | Errors in logs | Low | **실기 Pass** (2026-09-03) | Discord 클릭 시 콘솔 에러 없음 |
| R1 | Discord Rich Presence | Low (추천) | 보류 | 필수 아님 · ROADMAP 후보 |

---

### 1. Ads opened in Overwolf browser — Critical

광고 클릭 시 Overwolf 내장 브라우저로 열림. 시스템 기본 브라우저로 열려야 함.

- OW 안내: [`force_browser`](https://dev.overwolf.com/ow-native/reference/manifest/manifest-json/#top-level-data-properties) — `"user"` | `"overwolf"`
- 현재: `desktop`에 `block_top_window_navigation` / `popup_blocker` / `mute`만 있음. **`data.force_browser` 없음**
- 조치: `manifest.json` → `data.force_browser: "user"` ✅ (반영)

---

### 2. Minimize in-game window terminates ads for 2nd screen — Critical

듀얼 모니터에서 desktop(2nd screen) 광고 재생 중 in-game 창을 minimize하면 desktop 광고가 멈춤.

- 재현 (QA): 앱+게임 → desktop 광고 확인 → in-game 창 → minimize → 2nd screen 광고 중단
- 기대: 2nd screen 광고 유지 / 실제: 해당 창 광고 컨테이너 중단
- 원인 (코드): `App.tsx`의 `overwolf.windows.onStateChanged`가 **모든 창** 이벤트를 받고, 창 ID 필터 없이 `isWindowMinimized` → `adsPaused` → OwAd `display:none`
- 조치: 이벤트 `window_id`가 **현재 창**일 때만 minimized/hidden 반영 ✅ (`App.tsx`, `WindowControls.tsx`)

---

### 3. Ad container background color — Medium

광고 컨테이너가 흰색이라 UX에 거슬림.

- 앱: `AdsRail` / `AdUnit`은 transparent + 슬롯 CSS 이미 적용
- 추정: OwAd iframe/내부 wrapper 기본 배경, 또는 로딩·빈 슬롯
- 조치: 슬롯·레일 쪽 배경을 더 강하게 투명/다크 톤으로 맞추고 실기 재확인 ✅ (코드 반영 · OW 실기 재확인 권장)

**실기 (2026-09-03)** — 로딩 전 흰 배경이 잘 보임. 광고가 슬롯보다 작으면 남는 칸이 흰색.  
재조치: 슬롯을 불투명 `#121820`로 두고 iframe에 `color-scheme: dark` (크로스오리진 크리에이티브 내부 흰 여백은 SDK 한계일 수 있음).

**검토 (2026-09-04)** — 4가지 후보 재검토:
1. manifest `desktop` 창 `transparent: true` — **미적용, 채택 안 함**. 이 플래그는 OS 창 알파 합성이며 iframe 내부 문서와 무관. `in_game`(오버레이, 광고 없음)만 `transparent: true`이고 `desktop`(일반 네이티브 창, 광고 있음)은 `false`가 맞는 조합. 켜면 렌더링 리스크만 커짐.
2. html/body/#root + 컨테이너 배경 강제 — **이미 적용**. `:root`에 다크 `background-color` 고정 + `.apex-owad-slot` 강제 다크.
3. iframe에 CSS 배경 오버라이드 — **이미 적용, 한계 도달**. `content.overwolf.com` iframe은 cross-origin이라 박스 배경만 칠해지고 내부 문서(흰 캔버스)는 못 건드림 — 관찰된 흰색 잔존의 근본 원인.
4. SDK 이벤트 기반 `opacity` 페이드인 — **시도했으나 정책 위반으로 롤백**. Overwolf 공식 문서([Advertising policy](https://github.com/overwolf/overwolf.github.io/blob/source/pages/start/monetize-your-app/advertising/policy.mdx), [Advertising overview](https://dev.overwolf.com/ow-native/monetization/advertising/overview/))에 "Avoid adjusting the opacity of Ads presented to users" / 광고 pause는 **`display:none`만** 허용된다고 명시. `AdUnit.tsx`는 다크 플레이트 + `display:none` pause만 쓰는 이전 상태로 원복.

**근본 원인 발견 (2026-09-04)** — 다른 OW 앱(CurseForge, MetaTFT 등)은 광고 로딩 전/실패 시 **자기 앱의 실제 배경**이 그대로 보임(별도 플레이트 없음). 우리는 [OwAd 레퍼런스](https://dev.overwolf.com/ow-native/reference/ads/owad/)의 `new OwAd(...)` 예제 바로 아래 명시된 필수 요구사항을 어기고 있었음:

> "Ensure the ad container's parent element has `background: transparent` set."

기존 코드는 이 자리에 `#121820` 불투명 플레이트를 넣어서 (a) 스펙 위반 (b) `실제 배경 → 플레이트 → (SDK 흰 iframe) → 광고`로 색 전환 단계가 하나 더 늘어 깜빡임이 더 도드라졌음.

**재조치** — `AdUnit`/`AdsRail`을 문서대로 진짜 `background: transparent`로 원복. 레일의 맵 배경(atmosphere)이 광고 슬롯 뒤로 그대로 비침 → CurseForge/MetaTFT와 동일한 패턴(`실제 배경 → 광고`, 중간 색 단계 없음).

**진짜 원인 확정 (2026-09-04, 스크린샷 비교)** — 같은 크리에이티브·같은 SDK인데 레터박스가 우리는 흰색, CurseForge는 다크. 원인은 **CSS Color Adjust의 iframe 규칙**: iframe 엘리먼트의 used `color-scheme`과 삽입된 문서의 `color-scheme`이 다르면 브라우저가 iframe 캔버스를 **불투명 Canvas 색**(light 문서 → 흰색)으로 칩니다 ([spec 해설](https://fvsch.com/transparent-iframes), [Chromium commit](https://github.com/chromium/chromium/commit/eb80db0c94d06fa6eb2b5e33cfe78b8c4dacf972)).

- 우리: `index.css` `:root { color-scheme: dark }` → 상속되어 OwAd `<iframe>`도 `dark`. 광고 문서는 `normal`(light). **불일치 → 흰 캔버스.** DOM에 없는 컴포지터 페인트라 `background: transparent !important`로 안 잡혔음.
- CurseForge: `color-scheme: dark`를 선언하지 않음 → 일치 → 투명 → 자기 다크 배경이 비침.

**최종 조치** — `.apex-owad-slot`, `.apex-owad-slot iframe`에 `color-scheme: light !important` (+ `AdUnit` 슬롯 inline `colorScheme: 'light'`). 광고 문서와 스킴이 일치해 캔버스가 투명 → 레일 맵 배경이 비침. 이전에 넣었던 `colorScheme: 'dark'`는 정확히 반대 방향이었음(제거됨).

**실기 (2026-09-04): Pass** — 빈 슬롯·레터박스 배경 투명, 맵 atmosphere 비침 확인.

---

### 4. Undraggable window on FTUE — Medium

FTUE 화면 또는 coach marks(`driver.js`) 중 창 드래그 불가.

- 일반: 상단 35px에서 `dragMove`
- 튜토리얼: `tutorial.ts`가 `clientY <= 40`일 때만 capture drag — 오버레이가 타이틀바를 가리거나 콘텐츠 영역 드래그 기대와 불일치
- 조치: FTUE/coach marks 중에도 타이틀바(및 empty FTUE 영역)에서 `dragMove` 되도록 보강 ✅

**실기 (2026-09-03)** — 빈 프로필 점선 영역 드래그는 창이 움직임(의도). 튜토리얼 중 상단 바 드래그는 창이 안 움직이고 튜토리얼이 꺼짐. Next/Close는 정상.  
재조치: 오버레이보다 위 타이틀 스트립 + capture-phase에서 타이틀바 mousedown/click이 투어를 종료하지 않도록 차단.

---

### 5. Errors in logs — Low

경로: `%localappdata%/overwolf/logs/apps/ApexTrace`  
로컬 사본: `Downloads/ApexTrace/desktop.html.2.log`

```
Uncaught Error: The function |overwolf.utils.openUrlInDefaultBrowser| requires 1 mandatory parameters and 0 optional parameters: String url. 2 parameters passed.
```

- 시각: 2026-09-02 16:02 (Settings Discord 클릭으로 추정)
- 원인: `SettingsTab.openDiscord` / tray `tray_discord`가 `(url, { skip_in_game_notification })` 2인자 호출
- 문서에 2인자 오버로드가 있어도, QA/클라에서는 1인자만 허용
- 조치: URL만 전달 ✅ (`SettingsTab`, tray)

---

### R1. Recommendation: Discord Rich Presence — Low

[Discord Rich Presence](https://discord.com/developers/docs/rich-presence/how-to) 연동 권장.

- 스토어 필수 아님
- 현재: Discord 초대 링크만 (`settings` / tray)
- 조치: Free QA 통과 후 ROADMAP 후보로 유지 (이번 라운드 수정 범위 밖)

---

## 수정 순서

1. #1 `force_browser` ✅
2. #2 in-game minimize → ads ✅
3. #5 `openUrlInDefaultBrowser` ✅
4. #4 FTUE drag ✅
5. #3 ad 배경 ✅
6. R1 Discord RP — 보류 (ROADMAP)
