# Overwolf QA checklist — ApexTrace

이번 라운드에서 고친 항목 기준 수동 테스트 목록입니다.  
환경: Overwolf 클라이언트 + unpacked/`dist` 빌드, Apex Legends(ID `21566`).

체크: `[ ]` → 통과 시 `[x]`

---

## 0. 사전 준비

- [ ] `npm run build` 성공
- [ ] Overwolf에 최신 `dist` (또는 unpacked) 로드
- [ ] Free 티어 기본 (광고 레일 표시, Premium 미리보기 토글 없음)
- [ ] 스키마: `manifest.json` valid (이전에 `ajv` 통과함)

---

## 1. Manifest / 패키지 구성요소

### 1.1 Store meta
- [ ] 독에 앱 이름 **ApexTrace** (`dock_button_title`) 표시
- [ ] 독 아이콘 컬러/그레이 (`IconMouseOver` / `IconMouseNormal`) 정상
- [ ] 바탕화면 바로가기 / 런처 아이콘 (`launcher_icon.ico`) 정상
- [ ] 작업표시줄 아이콘 (`window_icon`) 정상

### 1.2 Permissions
- [ ] Hotkeys / GameInfo / FileSystem / Tray / Extensions / Streaming / **DesktopStreaming** / Profile 관련 기능 정상
- [ ] `DesktopStreaming`은 세컨드 스크린용 `getMonitorsList`에 필요 (광고용 `Streaming`과 별개)
- [ ] 로그에 `getMonitorsList requires the |DesktopStreaming| permission` WARN 없음

### 1.3 Externally connectable
- [ ] 매치 기록·프로필 로드 (Vercel proxy) 동작
- [ ] Supabase 이미지·설정 동기화 동작
- [ ] Worker OCR/스크립트 (jsDelivr) 필요 시 로드 실패 없음
- [ ] OwAd SDK (`content.overwolf.com`) 로드 (콘솔에 SDK 로드 실패 없음)
- [ ] GEP 상태 (`game-events-status.overwolf.com`) — 헤더 상태 점 클릭 시 패널 로드 (Unknown/fetchFailed만 뜨지 않음)

### 1.4 Desktop window flags
- [ ] 데스크톱 창: 리사이즈 / 최소화 / 최대화 / 위치 유지
- [ ] 인게임 창만 exclusive (`ReleaseOnHidden` + 핫키 안내) — 데스크톱은 exclusive 아님

### 1.5 Uninstall window
- [ ] 앱 제거 시 **앱 안 UI 없이** 기본 브라우저에 설문(Google Form)만 열림
- [ ] uninstall이 과도하게 길지 않음 (`required_runtime` 5초)

---

## 2. 광고 (OwAd)

### 2.1 레이아웃
- [ ] 데스크톱 Free: 오른쪽 레일에 광고 2슬롯
  - 상단 **400×60**
  - 하단 **400×600** (창 높이 키우면 하단 고정, 중간 여백만 늘어남)
- [ ] 인게임 창에는 광고 레일 없음
- [ ] 데스크톱에 광고 레일 표시 (Premium 우회 경로 없음)

### 2.2 정책 준수
- [ ] SETTINGS 탭: 광고 슬롯 `display:none` (게재 중단), 레일 자리는 유지돼도 광고는 안 보임
- [ ] 플레이어 검색 모달 열림: 광고 pause
- [ ] 종료 확인 다이얼로그 열림: 광고 pause
- [ ] 창 minimize: 광고 pause / restore 후 다시 표시
- [ ] 탭(DASHBOARD ↔ STATISTICS 등) 이동 시 광고 컨테이너가 매번 새로고침되지 않음
- [ ] 최소 창 크기(1080×780)에서 두 슬롯이 **잘리거나 스크롤로 화면 밖**으로 나가지 않음

### 2.3 SDK lifecycle
- [ ] DevTools/로그: `OwAd.shutdown` 관련 에러 없이 창 종료 가능
- [ ] SDK 미로드 시에도 앱 크래시 없이 동작 (네트워크 차단 시 스모크)

---

## 3. 앱 실행 / `onAppLaunchTriggered`

### 3.1 GameLaunch (`gamelaunchevent`)
- [ ] Apex 실행 → 앱 자동 기동
- [ ] 데스크톱(세컨드 스크린) 창이 **열린 채로 유지** (열자마자 토글로 닫히지 않음)

### 3.2 Dock / Tray
- [ ] 앱 실행 중 독 클릭 → 창 **토글** (보이기 ↔ 숨기기)
- [ ] 트레이 아이콘 클릭/메뉴로 동일하게 토글·복귀 가능

### 3.3 Hotkeys
- [ ] `Ctrl+Shift+=` (또는 설정한 데스크톱 핫키): 데스크톱 창 토글
- [ ] `Ctrl+Shift+-` (인게임 핫키): 인게임 창 토글
- [ ] 핫키 사용 시 launch 이벤트와 **이중 토글**되지 않음

### 3.4 기타 실행 경로 (가능하면)
- [ ] 스토어/커맨드라인에서 재실행 시 창이 닫히지 않고 **열리거나 포커스**
- [ ] 설정 화면에 앱 버전 표시 (`getManifest`)

---

## 4. 오버레이 훅 / Obituaries 안내

### 4.1 Overlay input hook failure
- [ ] (재현 가능할 때) `overlayInputHookError` / `inputFailure` 시 상단 **오버레이 입력 실패** 배너 표시
- [ ] 배너 문구: PC 재시작 후 Apex·Overwolf 재실행 안내, 데스크톱 추적은 계속됨
- [ ] Apex 종료 후 배너 사라짐
- [ ] 배경 로그: `[Overlay] hookError` / `inputFailure` (DevTools)

### 4.2 Obituaries tip
- [ ] 헤더 GEP 상태 패널에 Obituaries=On 안내 문구 표시
- [ ] (수동) Apex에서 Obituaries Off면 킬피드/전투로그 빈약 → On 후 정상

---

## 5. 회귀 스모크 (핵심 플로우)

- [ ] Apex 로비/매치에서 GEP 상태 표시·매치 기록 수집
- [ ] 데스크톱에서 매치 히스토리 / 통계 / 무기 / 티어표 탭 전환
- [ ] 플레이어 검색 모달 열기·닫기
- [ ] 설정: 핫키 변경, Discord 링크, 로그 폴더 열기
- [ ] 창 닫기 확인(숨기기 vs 종료) 동작

---

## 6. 드롭 (QA 위해 건드리지 않음)

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
| 로그 폴더 `fileExists` 선검사 | Explorer 실패 시 이미 path prompt |
| desktop `bringToFront(grabFocus:true)` while fullscreen | 보류 — 게임 최소화 UX, 세컨드스크린 정책 정해지면 재검토 |

### 이미 반영됨 (스택 종료)
광고 shutdown/레이아웃/권한·pause, launch source, GEP status 도메인, overlay 훅 배너, Obituaries tip

### 현재 열린 수정 후보
없음. 이후 문서 검토에서 QA 차단급만 다시 쌓기.

향후 구독·언어 동기화 등 로드맵 후보: [`future-ow-features.md`](./future-ow-features.md)

---

## 결과 메모

| 날짜 | 테스터 | 결과 | 이슈 |
|------|--------|------|------|
| | | Pass / Fail | |

실패 항목은 이슈 번호·재현 절차를 아래에 적기:

```
-
```
