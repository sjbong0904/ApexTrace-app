# Overwolf QA checklist — ApexTrace

이번 라운드에서 고친 항목 기준 수동 테스트 목록입니다.  
환경: Overwolf 클라이언트 + unpacked/`dist` 빌드, Apex Legends(ID `21566`).

체크: `[ ]` → 통과 시 `[x]`

**검증 구분**
- `[x]` + `코드` = 에이전트 검증 (2026-08-08): 빌드·소스·manifest·dist 에셋·원격 HEAD. Overwolf/Apex 런타임은 아님.
- `[ ]` = 아직 **런타임 수동** 필요 (OW 클라이언트 / 게임 / 실제 클릭).

이번 라운드는 **Free**만. Premium 정식 출시 작업 목록: [ROADMAP.md §B Premium](./ROADMAP.md#premium--구독--free-qa-통과-후-정식-출시-체크리스트). 기타 API 후보: [ROADMAP §B](./ROADMAP.md#b-overwolf-api--플랫폼-qa-범위-밖).

---

## 0. 사전 준비

- [x] `npm run build` 성공 `코드` (tsc + vite, 2026-08-08)
- [x] Overwolf에 최신 `dist` (또는 unpacked) 로드
- [x] Free 티어 기본 (광고 레일 표시, Premium 미리보기 토글 없음) `코드` (`isPremium = false`, Settings Premium 토글 없음)
- [x] 스키마: `manifest.json` valid (ajv) `코드` (community-gists schema + `ajv-cli` → `manifest.json valid`, 2026-08-08)

---

## 1. Manifest / 패키지 구성요소

### 1.1 Store meta
- [x] 독에 앱 이름 **ApexTrace** (`dock_button_title`) 표시 `코드` (manifest/`dist` = `ApexTrace`) — 독 UI 픽셀은 런타임 확인
- [x] 독 아이콘 컬러/그레이 (`IconMouseOver` / `IconMouseNormal`) 정상 `코드` (`dist/icons` 존재)
- [x] 바탕화면 바로가기 / 런처 아이콘 (`launcher_icon.ico`) 정상 `코드` (`dist/icons/launcher_icon.ico`)
- [x] 작업표시줄 아이콘 (`window_icon`) 정상 `코드` (manifest → `IconMouseOver.png`, dist 존재)

### 1.2 Permissions
- [x] Hotkeys / GameInfo / FileSystem / Tray / Extensions / Streaming / **DesktopStreaming** / Profile 관련 기능 정상 `코드` (permissions 배열 포함)
- [x] `DesktopStreaming`은 세컨드 스크린용 `getMonitorsList`에 필요 (광고용 `Streaming`과 별개) `코드`
- [ ] 로그에 `getMonitorsList requires the |DesktopStreaming| permission` WARN 없음

### 1.3 Externally connectable
- [x] 매치 기록·프로필 로드 (Vercel proxy) 동작
- [ ] Supabase 이미지·설정 동기화 동작
- [ ] Worker OCR/스크립트 (jsDelivr) 필요 시 로드 실패 없음
- [x] OwAd SDK (`content.overwolf.com`) 로드 (콘솔에 SDK 로드 실패 없음) `코드` (`index.html` 로드 + CDN HEAD 200; OW 콘솔 확인은 런타임)
- [x] GEP 상태 도메인 allowlist `코드` (`game-events-status.overwolf.com` in `externally_connectable` + `GameStatusIndicator`) — 패널 UI는 런타임
- [ ] GEP 상태 패널 클릭 시 Unknown/fetchFailed만 뜨지 않음

### 1.4 Desktop window flags
- [x] 데스크톱 창: 리사이즈 / 최소화 / 최대화 / 위치 유지 `코드` (`resizable`, `keep_window_location`, `native_window`, min/default size) — 실제 드래그는 런타임
- [x] 인게임 창만 exclusive (`ReleaseOnHidden` + 핫키 안내) — 데스크톱은 exclusive 아님 `코드`
- [x] 광고 창(`desktop`) Advertisement flags: `block_top_window_navigation` / `popup_blocker` / `mute` = true `코드`
- [x] 광고·링크 기본 브라우저: `data.force_browser: "user"` `코드` (STORE-QA #1)
- [x] 광고 클릭 시 **로컬(시스템) 브라우저**로 열림 (2026-09-03 실기)

### 1.5 Uninstall window
- [x] 앱 제거 시 **앱 안 UI 없이** 기본 브라우저에 설문(Google Form)만 열림 `코드` (`uninstall.js` → `openUrlInDefaultBrowser` only)
- [x] uninstall이 과도하게 길지 않음 (`required_runtime` 5초) `코드`

---

## 2. 광고 (OwAd)

### 2.1 레이아웃
- [x] 데스크톱 Free: 오른쪽 레일에 광고 2슬롯 `코드`
  - 상단 **400×60** (`at_400x60_d_top`)
  - 하단 **400×600** (`at_400x600_d_bot`, flex gap으로 중간 여백)
- [x] 인게임 창에는 광고 레일 없음 `코드` (`showDesktopAds = !isPremium && isDesktopWindow`)
- [x] 데스크톱에 광고 레일 표시 (Premium 우회 경로 없음) `코드`

### 2.2 정책 준수
- [x] SETTINGS 탭: 광고 슬롯 `display:none` (게재 중단), 레일 자리는 유지돼도 광고는 안 보임 `코드` (`adsPaused` ← `mainTab === 'SETTINGS'`)
- [x] SETTINGS 탭에서 광고/광고 배경 안 보임 (2026-09-03 실기)
- [x] 플레이어 검색 모달 열림: 광고 pause `코드` (`showSearchModal`)
- [x] 종료 확인 다이얼로그 열림: 광고 pause `코드` (`apex-ads-cover` / `AppDialog`)
- [x] 창 minimize: 광고 pause / restore 후 다시 표시 `코드` (`isWindowMinimized`, **현재 창 `window_id`만** — STORE-QA #2)
- [x] 세컨드 스크린 광고 재생 중 인게임 창을 띄운 뒤 다시 최소화해도 광고 유지 (2026-09-03 실기)
- [x] 탭(DASHBOARD ↔ STATISTICS 등) 이동 시 광고 컨테이너가 매번 새로고침되지 않음 `코드` (AdsRail 탭 밖 마운트 유지)
- [x] 최소 창 크기(1080×780)에서 두 슬롯이 **잘리거나 스크롤로 화면 밖**으로 나가지 않음 `코드` (레일 433px + 60/600 슬롯·minHeight 산술; 실기 확인 권장)

### 2.3 SDK lifecycle
- [x] `OwAd.shutdown` unmount cleanup 존재 `코드` — DevTools 무에러는 런타임
- [ ] DevTools/로그: `OwAd.shutdown` 관련 에러 없이 창 종료 가능
- [x] SDK 미로드 시에도 앱 크래시 없이 동작 `코드` (`waitForOwAd` catch → warn only)

---

## 3. 앱 실행 / `onAppLaunchTriggered`

### 3.1 GameLaunch (`gamelaunchevent`)
- [x] Apex 실행 → 앱 자동 기동 `코드` (`launch_events` GameLaunch `21566`, `start_minimized: false`)
- [ ] 데스크톱(세컨드 스크린) 창이 **열린 채로 유지** (열자마자 토글로 닫히지 않음)

### 3.2 Dock / Tray
- [ ] 앱 실행 중 독 클릭 → 창 **토글** (보이기 ↔ 숨기기)
- [ ] 트레이 아이콘 클릭/메뉴로 동일하게 토글·복귀 가능

### 3.3 Hotkeys
- [x] 기본 핫키 manifest: `Ctrl+Shift+=` / `Ctrl+Shift+-` `코드`
- [ ] `Ctrl+Shift+=` (또는 설정한 데스크톱 핫키): 데스크톱 창 토글
- [ ] `Ctrl+Shift+-` (인게임 핫키): 인게임 창 토글
- [ ] 핫키 사용 시 launch 이벤트와 **이중 토글**되지 않음

### 3.4 기타 실행 경로 (가능하면)
- [ ] 스토어/커맨드라인에서 재실행 시 창이 닫히지 않고 **열리거나 포커스**
- [x] 설정 화면에 앱 버전 표시 (`getManifest`) `코드` (`SettingsTab` → `v{appVersion} Beta`)

---

## 4. 오버레이 훅 / Obituaries 안내

### 4.1 Overlay input hook failure
- [x] `overlayInputHookError` / hook 시 상단 배너 컴포넌트 존재 `코드` (`OverlayHealthBanner`)
- [x] 배너 문구: PC 재시작 후 Apex·Overwolf 재실행 안내, 데스크톱 추적은 계속됨 `코드` (i18n defaultValue)
- [ ] (재현 가능할 때) 배너 실제 표시
- [ ] Apex 종료 후 배너 사라짐
- [ ] 배경 로그: `[Overlay] hookError` / `inputFailure` (DevTools)

### 4.2 Obituaries tip
- [x] 헤더 GEP 상태 패널에 Obituaries=On 안내 문구 표시 `코드` (`gameStatus.panel.obituariesTip`)
- [ ] (수동) Apex에서 Obituaries Off면 킬피드/전투로그 빈약 → On 후 정상

---

## 5. 닉네임 검색 (alias)

설계·운영: [NICKNAME-SEARCH.md](./NICKNAME-SEARCH.md). 검색은 **exact · 대소문자 무시**만.

- [ ] 최신 `dist` 로드 후, DB에 있는 **현닉** exact 검색 → 프로필 로드
- [ ] (가능 시) 닉변 유저 **옛 닉** exact → 후보/로드, 다수면 모달에 **Former name** 표시
- [ ] 부분 문자열·오타성 짧은 쿼리는 결과 없음(또는 ALS만) — contains 자동완성 아님
- [ ] DB에 없는 닉 → ALS 폴백 후 재검색 시 DB에서 잡힘
- [ ] 매치 중 로스터에 나온 상대가 이후 현닉으로 검색됨 (GEP → address-book)

---

## 5.1 Incomplete match (tabs / combat mismatch) — v0.0.12

- [x] tabs/combat mismatch 시 매치 폐기 대신 incomplete 저장 로직 `코드` (`utils.js` / `matchService.js`) — placement/kills/assists/damage/knocks를 null, `missingSignals`에 `tabs_combat_mismatch`
- [x] Partial 배지·null combat UI 분기 `코드` (`App.tsx` badge tooltip = `missingSignals`, `hasUsableMatchStats` / Sidebar / Statistics 제외)
- [x] incomplete 매치는 사이드바 / Statistics 평균에 **미포함** `코드` (`hasUsableMatchStats`: placement null 또는 combat 전부 null. `dataQuality` 필드 없음)
- [ ] (재현 시) 실제 매치로 저장·배지·회귀 확인
- [ ] 정상 매치는 숫자·등수 색·배지 없음으로 회귀

---

## 5.2 매치 종료·재시작 관련 QA 보류 이슈

스토어 QA 라운드 이후 **이슈 A·B는 코드 반영** (2026-09-03). 이슈 C는 UID가 늦게 잡히며 정상 병합되어 **수정 불필요**로 종결. 아래 원문은 추정 원인·방향 기록으로 유지하고, 각 이슈 상단에 실제 반영 내용을 적었다.

### 이슈 A — 사용자의 사망 시점 등수가 최종등수로 저장됨

**반영 (코드)** — `Utils.applyPlacementEstimate` (utils.js) 단일 게이트로 통일. `matchService` `TEAMS_ALIVE` / `events.js` `applyTabsToMatch` · `applyPlacementEstimate` 모두 여기로 위임.

- 사용자 사망 ≠ 스쿼드 전멸. **생존(업) 팀원이 있으면 추정 안 함.**
- 로컬 사망 + 로스터 비어 있음(추정만) → **provisional**: `tabs.teams` 최솟값을 계속 따라 내려감 (팀원이 계속 플레이 중).
- 로컬 사망 + 팀원 전원 **`knocked_out`만** (death 미도착) → 역시 provisional로 min teams 추적. `hasLivingTeammate`는 `knocked_out`을 생존으로 보지 않음 (2026-09-07 Crypto 20등 오판 수정).
- `_squadEliminated`(GEP 신호) 또는 **알려진 팀원 전부 death** → **frozen** (`_placementEstimateFrozen`). 관전 중 teams가 더 줄어도 등수 안 좋아짐.
- finalize 시 summary가 없으면 `_minTeamsAlive` 기반 추정을 기본 20보다 우선 (`resolveFinalPlacement`).
- 로스터가 stale(death→alive 갱신)이면 unfreeze 후 provisional 유지, 전멸 시 재계산.
- lobby/loading 120초 fallback으로 끝낼 때 팀원이 살아 있으면(=먼저 나감) 현재 teams 추정을 **`placement_estimated` 플래그와 함께** 저장 (`applyLeftEarlyPlacement`). 맨 20등 대신.
- 팀원이 살아 있는데 `match_summary`가 오면(먼저 나가서 본 요약) rank는 쓰되 `_summaryWhileSquadAlive` → `placement_estimated`. 이후 전멸 신호가 오면 플래그 해제.

**런타임 확인 포인트**: 로그 `Placement estimate refreshed (squad still active)` / `Left match while squad alive` / `match_summary while squad still alive`.

---

**현상**

- 사용자가 먼저 사망하고 팀원이 계속 생존한 경우, 팀 순위가 이후 변경되어도 사용자의 사망 시점 등수가 최종등수처럼 저장될 수 있음.

**추정 원인**

- 사용자 사망(`SET_DEAD`)은 본인 사망 및 경로 기록 중지만 처리하며, 팀 전멸까지 매치를 유지한다는 별도 상태를 만들지 않음.
- `teammate_*` 이벤트가 전달될 때만 `teamStats[].state`가 갱신되므로, 팀원 상태의 실시간 반영이 지연되거나 일부 종료 경로에서 사용되지 않을 수 있음.
- `phase`가 `loading` 또는 `lobby`일 때 매치 시간이 120초를 초과하면 팀원 생존 여부와 무관하게 `endMatch()`가 실행되는 fallback이 있음.
- 조기 종료 시 그 시점의 `placement` 또는 `_minTeamsAlive` 기반 추정값이 저장되고, 이후 팀원이 생존하여 순위가 변해도 이미 종료된 매치 객체는 갱신되지 않음.

**수정 방향**

- 사용자 사망과 팀 전멸을 분리한다. 사용자만 사망한 경우에는 `squadEliminated` 또는 최종 결과가 확인될 때까지 매치 기록을 유지한다.
- `loading/lobby` timeout은 팀원 생존 확인을 우회하지 않도록 `shouldAcceptMatchBoundaryEnd()`와 연동한다.
- `teamStats`가 비어 있거나 팀원 상태가 미확인인 것을 사망으로 간주하지 않는다. `alive / dead / unknown` 상태를 구분한다.
- 사용자 사망 시점에는 등수를 확정하지 않고, 팀 전멸 상태 또는 최종 `match_summary` 수신 이후에만 최종등수를 결정한다.

**QA 확인 포인트**

- 사용자 사망 직후 팀원이 생존한 상태에서 `Ending session`이 발생하지 않는지 확인
- 팀원이 생존하여 `tabs.teams` 값이 계속 변한 뒤 최종등수가 마지막 결과로 저장되는지 확인
- `match_summary`가 늦게 도착하는 경우 추정등수가 summary 등수로 교정되는지 확인

### 이슈 B — 이전 매치 사망 위치가 다음 매치 시작 위치로 기록됨

**반영 (코드)** — `matchService` `PATH` 첫 포인트 게이트 + `Store.lastSessionEndPos`.

- `GameStatePoller`가 같은 스냅샷의 `game_info.phase`를 `LOCATION_UPDATE`에 함께 전달. `lobby` / `legend_selection` / `loading` 위치는 기록 안 함.
- 세션 종료(`endMatch` / `finalizeMatchSession`) 시 마지막 GEP 좌표(`_lastSeenLoc`, 사망 후 값 포함)를 `Store.lastSessionEndPos`에 저장. 다음 세션 첫 좌표가 이와 ±1 이내면 stale로 거절 (로그 `Rejected stale first location`).
- 첫 포인트는 **좌표가 한 번 바뀐 뒤**에만 채택 (`_firstLocationSample`). 드롭십은 항상 움직이므로 비용은 1폴(2초).
- `startPos` / `endPos`는 채택된 포인트에서만 갱신 (`_isJunkMatch` displacement가 stale 좌표에 오염되지 않음).

---

**현상**

- 이전 매치의 사망 위치가 다음 매치의 첫 위치로 표시되어 동선이 순간이동한 것처럼 보임.

**추정 원인**

- 새 매치는 `path: []`로 생성되므로 이전 매치의 경로 배열을 직접 재사용하는 문제는 아님.
- 새 세션이 너무 일찍 시작되면 `GameStatePoller`가 GEP의 `gameInfo.location`을 즉시 읽음.
- 새 매치 위치가 아직 갱신되지 않은 동안 GEP가 이전 매치의 마지막 위치를 반환할 수 있음.
- `LOCATION_UPDATE`는 좌표의 신선도, 새 매치 시작 이후 수신 여부, 게임 phase를 검증하지 않고 첫 좌표를 경로에 기록함.

**수정 방향**

- 새 매치 시작 직후 일정 시간 또는 실제 플레이 phase가 확인되기 전까지 위치 기록을 보류한다.
- GEP 위치 데이터에 매치 경계·timestamp 검증을 추가하여 이전 세션의 stale 좌표를 제외한다.
- 새 매치 첫 좌표가 이전 매치 마지막 좌표와 동일하거나 비정상적으로 오래된 경우 첫 포인트로 사용하지 않는다.
- 실제 새 매치 위치가 확인된 뒤에만 `startPos`와 첫 `path` 포인트를 확정한다.

**QA 확인 포인트**

- 새 매치 생성 시 첫 `path` 포인트의 timestamp와 `startTime`을 비교
- 새 매치 첫 좌표가 이전 매치 마지막 좌표와 동일한지 확인
- 조기 매치 종료가 발생한 케이스와 위치 순간이동 케이스의 발생 시점이 일치하는지 확인

---

### 이슈 C — 닉네임 변경 팀원이 통계에서 서로 다른 팀원으로 분리됨

**종결 (수정 불필요)** — 런타임 확인 결과 UID가 나중에 잡히면서 정상적으로 하나로 병합됨 (2026-09-03). 아래는 당시 추정 기록.

**현상**

- 같은 팀원이 닉네임을 변경한 뒤, 팀메이트 통계에서 이전 닉네임과 새 닉네임이 서로 다른 사람처럼 집계됨.
- 그 결과 해당 팀원의 게임 수, 승률, K/D, K/A/D, 평균 등수, 평균 피해량 등이 두 항목으로 나뉠 수 있음.

**추정 원인**

- `StatisticsTab`의 팀메이트 집계는 동일한 UID 또는 `isSamePlayer()`로 정규화된 동일 닉네임일 때만 같은 항목으로 병합함.
- 닉네임이 바뀌면 기존 매치의 `name:old` 키와 새 매치의 `name:new` 또는 `uid:new` 키가 달라져 `resolveTeammateKey()`가 별도 항목을 생성함.
- 기존 매치에 UID가 기록되어 있어도 새 닉네임으로 기록된 매치의 UID가 누락되었거나 다른 값이면, 닉네임이 같지 않은 이상 기존 UID를 통해 동일 인물로 역추적하지 못함.
- Origin/플랫폼 UID가 혼용되어 서로 다른 값으로 저장되는 경우에도 같은 문제가 발생할 수 있음.
- 프로필 검색용 `profile_name_aliases`는 검색에는 사용되지만, 기존 `teamStats`를 통계 집계 전에 canonical UID로 변환하는 과정에는 연결되어 있지 않음.

**수정 방향**

- 팀메이트 통계의 기준 키를 가능한 경우 안정적인 canonical UID로 통일한다.
- UID가 없는 과거 `teamStats`는 주소록·프로필 alias를 사용해 UID를 보정한 뒤 집계한다.
- UID가 없는 경우에만 정규화 닉네임을 fallback으로 사용하고, 닉네임 변경 이력은 alias 매핑으로 연결한다.
- 기존 저장 이력에 대해서도 집계 시점에 canonicalization하거나, 필요하면 과거 `teamStats`를 보정하는 migration을 제공한다.
- Origin UID와 플랫폼 UID가 혼용될 수 있으므로 UID 출처를 확인하고 동일 계정의 canonical ID로 변환한다.

**QA 확인 포인트**

- 닉네임 변경 전후 매치에 동일 UID가 기록되어 있으면 팀메이트가 하나로 집계되는지 확인
- 이전 매치 또는 새 매치 중 한쪽 UID가 없고 닉네임만 변경된 경우 alias/주소록 보정 후 하나로 합쳐지는지 확인
- 실제로 다른 두 플레이어가 같은 닉네임을 사용한 경우에는 하나로 잘못 합쳐지지 않는지 확인

---

## 6. 회귀 스모크 (핵심 플로우)

- [ ] Apex 로비/매치에서 GEP 상태 표시·매치 기록 수집
- [ ] 데스크톱에서 매치 히스토리 / 통계 / 무기 / 티어표 탭 전환
- [ ] 플레이어 검색 모달 열기·닫기
- [x] 설정: Discord / 로그 폴더 / 핫키 UI / 리셋 확인 = `AppDialog` (native alert 없음) `코드`
- [x] Settings Discord 버튼 클릭 시 콘솔 에러 없음 (2026-09-03 실기, STORE-QA #5)
- [x] 창 닫기 확인 다이얼로그 존재 (숨기기 vs 종료) `코드` (`CloseConfirmDialog`) — 실클릭은 런타임
- [ ] 창 닫기 확인(숨기기 vs 종료) 동작

---

## 7. 드롭 (QA 위해 건드리지 않음)

제출·수동 QA에 이득이 없거나, 수정 리스크만 큰 항목. **수정 후보 스택에서 제외.**

| 항목 | 이유 |
|------|------|
| `getRunningGameInfo2` 마이그레이션 | 현행 API로 동작 중. 언랩 실수 시 게임 감지 깨짐 |
| coexistence / 전체화면 최적화 UX | 선택 UX. 핵심 플로우·제출 차단 아님 |
| `allow_local_file_access` | 스크린샷은 picker/download로 충분. FS 표면만 넓힘 |
| `minimum-gep-version` | 없어도 QA·스토어에 보통 무관 |
| 수동 업데이트 UX (`checkForExtensionUpdate`) | OW 자동 업데이트 의존 |
| `overwolf.cryptography` | 민감 토큰 localStorage 없음 |
| crossapp / sharedData | 미사용 |
| 로그 폴더 `fileExists` 선검사 | Explorer 실패 시 이미 path dialog |
| desktop `bringToFront(grabFocus:true)` while fullscreen | 보류 — 게임 최소화 UX, 세컨드스크린 정책 정해지면 재검토 |

### 이미 반영됨 (스택 종료)
광고 shutdown/레이아웃/권한·pause, launch source, GEP status 도메인, overlay 훅 배너, Obituaries tip, native alert→AppDialog

### 현재 열린 수정 후보
스토어 QA 라운드 (2026-09): [STORE-QA.md](./STORE-QA.md) — **#1–#5 코드 반영**. Discord RP(R1)만 보류.

| # | 항목 | Severity | 상태 |
|---|------|----------|------|
| 1 | `force_browser: "user"` | Critical | **실기 Pass** (2026-09-03) |
| 2 | in-game minimize → 2nd screen ads pause | Critical | **실기 Pass** (2026-09-03) |
| 3 | ad container white background | Medium | **실기 Pass** (2026-09-04) | `color-scheme: light` on ad slot/iframe + parent `transparent` |
| 4 | FTUE / coach marks undraggable | Medium | 재수정 — 튜토리얼 중 타이틀바 드래그 시 투어 종료 |
| 5 | `openUrlInDefaultBrowser` 2-arg log error | Low | **실기 Pass** (2026-09-03) |

추가 (스토어 목록 외, 2026-09-03):
- Statistics 프리미엄 언락 카드가 긴 콘텐츠 한가운데라 스크롤해야 보임 → sticky로 가시 영역에 유지하도록 수정
- 인게임 창 테스트는 **미실시**

추가 (2026-09-05):
- 프로필 로드 중 스크롤하면 로딩 가림막이 벗겨지고 내용이 보임 → 가림막을 스크롤 영역 **바깥** 전체 커버로 옮김 (padding 위·아래 빈틈 포함). **실기 재확인**

추가 (2026-09-06):
- `getInfo` 폴링이 `{ success, res }`인데 `.info`만 읽어 `match_summary`가 무시됨 → `applyInfoToMatch`가 `.res`도 읽음. **같은 판을 같이 뛴 뒤 등수가 맞는지** 실기
- 로스터 `POST /address-book` 504 → 변경 UID만 + 4초 debounce + 서버 no-op skip. 백그라운드 로그에 504가 반복되지 않는지
- 불완전 배지 툴팁이 목록(summary)에서도 뜨는지 (`missing_signals` 컬럼)

---

## 결과 메모

| 날짜 | 테스터 | 결과 | 이슈 |
|------|--------|------|------|
| 2026-08-08 | Agent (코드/빌드) | Partial — 런타임 미실시 | ajv: `manifest.json valid` (community-gists schema). OwAd CDN HEAD 200 |
| 2026-09-02 | OW QA | Fail — Critical 2건 | [STORE-QA.md](./STORE-QA.md) — ads browser / minimize ads / FTUE drag / logs |
| 2026-09-03 | 수동 OW (데스크톱) | Partial | #1 #2 #5 Pass. #3 흰 배경 Fail. #4 튜토리얼 타이틀바 드래그 Fail. Settings 광고 숨김 Pass. 빈 프로필 점선 드래그로 창 이동 OK. 인게임 미실시. 언락 카드 스크롤 이슈. |
| 2026-09-04 | 수동 OW (데스크톱) | #3 Pass | 광고 슬롯/레터박스 배경 투명 확인 (`color-scheme: light` + parent `transparent`). CurseForge와 동일 패턴. |
| 2026-09-05 | Agent (코드) | 반영 | 프로필 로드 가림막이 스크롤과 함께 벗겨지던 문제 — sticky + 로딩 중 스크롤 잠금. 실기 미확인. |
| 2026-09-06 | Agent (코드) | 반영 | match_end `getInfo` `.res` 파싱, 주소록 diff/debounce/no-op skip, `legacy_match`/`dataQuality`/`schema_version` 제거. 런타임 미실시. |

실패·미확인 항목은 이슈 번호·재현 절차를 아래에 적기:

```
- STORE-QA #4 (2026-09-03): 튜토리얼 중 타이틀바 드래그 시 투어 종료 — 재수정 후 재확인 필요
- Statistics 프리미엄 언락 카드 sticky (2026-09-03) — 재확인 권장
- 프로필 로드 가림막 (2026-09-05) — 코드 반영, 검색 로딩 중 스크롤해도 덮인 채 유지되는지 실기 확인
- 인게임 QA 미실시
```
