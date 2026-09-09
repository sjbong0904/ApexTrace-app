# ApexTrace Release Notes

## Unreleased

---

## v0.0.15 — 2026-09-10

Statistics 탭 레이아웃/시각 정리, 모드 라벨 정비, 무기 실루엣 톤 통일. 상세 기준: [WEAPON-STATS.md](WEAPON-STATS.md). GitHub `v0.0.15`.

### 개선

- **대시보드 모드 라벨** — 내부 `BR` 로직은 유지하고, 표시만 **ALL**로 변경. 10개 언어 시드와 language pack version 15 동기화.
- **좁은 폭 대응** — Statistics Overview / Maps / Legends / Weapons 상단 스탯 스트립을 한 줄 유지 + 중앙 정렬로 정리하고, 레이더 + Best 3 카드도 4열 고정으로 2단 밀림을 방지.
- **무기 드롭다운 시각 통일** — 무기 선택 드롭다운 이미지를 로드아웃 타임라인과 같은 **white silhouette** 스타일로 변경하고, 확대 비율은 기존 대비 10% 축소.
- **무기 표 아이콘** — 레전드/무기 관련 표의 무기 썸네일을 탄종 색상 tinted silhouette로 통일. CARE PACKAGE는 `#D73055` mythic 톤 사용, Elite는 골드 대신 실제 탄종 색 사용.

### 수정

- **드롭다운 윤곽선 가림** — 확대된 무기 이미지가 셀 윤곽선을 덮던 문제를 오버레이 outline으로 수정.
- **레전드 초상화 프레임 제거** — 각종 표의 원형 레전드 초상화 바깥 네모 슬롯 제거로 밀도 개선.
- **케어패키지 색 통일** — mythic/care package 색상을 `#D73055`로 통일하고 관련 강조색을 HEX 기준으로 정리.

### 문서

- [RELEASE_NOTES.md](RELEASE_NOTES.md) — `v0.0.15` 릴리즈 내역 추가.
- [WEAPON-STATS.md](WEAPON-STATS.md) — 기준 버전 `v0.0.15`로 갱신.

---

## v0.0.14 — 2026-09-09

무기 통계·Weapons 탭 개편. 상세 기준: [WEAPON-STATS.md](WEAPON-STATS.md). GitHub `v0.0.14`.

### 개선

- **킬 귀속** — 무기 통계 kill은 확킬 피드가 아니라 **녹다운 무기 우선** (`resolveKillCreditWeapon`). 클라이언트·background·프록시 동기화.
- **데스 귀속** — 로컬 데스마다 1.0을 생존 구간의 **유효 총기 홀드 시간 비율**로 분배. mid-match “킬만 있으면 deaths=1” 보정 제거. deaths=0이면 무기 **K/D·KA/D = N/A**.
- **Top Threats** — 나를 죽인/녹다운한 적 무기 집계 (`weaponThreats`). finalize 시 저장. 시즌 fetch 시 프록시 backfill.
- **Weapons 탭 UI** — Legends와 유사 레이아웃: Top Weapons / Top Threats → 피커 → 선택 무기 요약(매치·승률·평균순위·K/D·KA/D) → Paired weapons / Weapon legends 카드·표. Usage → **Matches**. 기본 선택 = 카탈로그 첫 무기.
- **매치 수** — 무기 사용 매치는 **정수 1/매치**로 통일 (소수 매치 폐기).
- **표시명** — `getWeaponDisplayName` / SHORT 이름 우선, i18n raw 키 노출 완화. `languages_cache_v4`. `statistics.common.na`.
- **팀메이트 표** — 최대 30명, UID 없는 닉은 집계에는 포함·목록에서 제외.

### 수정

- **레전드 피커 리사이즈 쏠림** — 최대화↔복원 시 선택창이 왼쪽으로 압축되던 레이아웃.
- **C.A.R. 이미지** — 로드아웃 id ↔ 카탈로그/이미지 매칭.
- **K/D raw 표기** — `calculateStats`가 deaths=0일 때 킬 정수를 그대로 넣던 문제, `parseFloat`로 trailing zero가 사라지던 표시를 `toFixed(2)` / N/A로 통일.
- **Weapons 표 이름 줄바꿈** — 무기·레전드명 한 줄 + ellipsis.

### 서버 (trace-proxy-server, 별도 레포)

- `weaponCombat` 데스 분배·킬 크레딧 동기화.
- 시즌 stats 경로에서 비어 있는 `weaponThreats` events 기반 backfill + persist.

### 문서

- [WEAPON-STATS.md](WEAPON-STATS.md) — 지표·킬/데스 모델·배포 메모.

---

## v0.0.13 — 2026-09-06

등수 폴링 복구, 주소록 504/트래픽 절감, 매치 스키마를 컬럼 전용으로 정리. GitHub `v0.0.13`.

### 수정

- **프로필 로드 가림막 빈틈** — 오버레이가 스크롤 영역 padding 안에 있어 위·아래로 내용이 비침. 스크롤 패널 전체를 덮는 레이어로 옮김.
- **match_end 이후 GEP 재조회가 무시됨** — `overwolf.games.events.getInfo`는 `{ success, res }`로 응답하는데 `applyInfoToMatch`가 `.info`/root만 읽어 폴링 결과(특히 `match_summary`)가 조용히 버려졌음. `.res`도 읽도록 수정. 같은 판에서 클라이언트마다 등수가 갈리던 사례 중 라이브 `match_summary`를 놓친 쪽이 폴링으로 복구되도록. `[MatchAudit] match_summary applied` WARN 로그 추가.
- **주소록 갱신 504** — 매 매치 후 로스터(~60명) 전체를 한 번의 `POST /address-book`으로 보내 Vercel 10초 제한을 넘김. 클라이언트는 20명씩 순차 전송, 서버(`trace-proxy-server`)는 닉이 바뀐 UID만 alias 동기화하고 5개 병렬 처리.
- **로스터 주소록 재전송** — 매치 중 로스터가 커질 때마다 전체 ~60명을 다시 보내지 않고, 세션 동안 처음 보이거나 name/hw가 바뀐 UID만 4초 debounce 후 전송. 프로필 로드 시 값이 같으면 `address-book` POST를 건너뜀.
- **프록시 캐시 버스터 제거** — `t=Date.now()`를 빼서 `/api/seasons`, `/api/search-candidates`, `/api/apex-stats`, `/api/history` GET의 엣지 캐시가 동작하도록.

### 서버 (trace-proxy-server)

- 매치를 정규화 컬럼만으로 저장. `legacy_match` / `schema_version` / `dataQuality` / `confidence` 제거. `player_name`, `missing_signals` 컬럼으로 불완전 배지 툴팁 유지.
- 주소록 POST는 기존 행과 name/hw/platform 등이 같으면 upsert를 건너뜀.
- GET 읽기 엔드포인트에 짧은 엣지 캐시 (`history` 30s, `search-candidates` 60s, `seasons` 1h, `apex-stats` 180s).

---

## v0.0.12 — 2026-09-05

Overwolf 스토어 QA 피드백 반영, 등수·좌표 보정, 프로필 로드 가림막. GitHub `v0.0.12`.

### 수정

- **스토어 QA (2026-09)** — [STORE-QA.md](STORE-QA.md)
  - 광고 링크: `manifest` `force_browser: "user"` (시스템 기본 브라우저)
  - in-game minimize가 2nd-screen 광고를 죽이던 `onStateChanged` 창 필터 누락
  - `openUrlInDefaultBrowser` 2인자 호출 → 로그 Uncaught Error (Settings/tray Discord)
  - FTUE / coach marks 중 창 드래그 (타이틀바 z-index, empty 영역, tutorial capture)
  - 광고 슬롯 흰 배경 완화 (다크 플레이트 + OwAd 자식 transparent)
- **사망 시점 등수 고정** (QA §5.2 이슈 A) — 등수 추정을 `Utils.applyPlacementEstimate` 하나로 통일. 생존 팀원이 있으면 추정 안 함, 로스터 없는 로컬 사망은 provisional로 `tabs.teams` 최솟값을 따라가고, 전멸 신호·팀원 전원 death에서 freeze. 먼저 나간 경우(lobby fallback / 팀원 생존 중 summary)는 `placement_estimated` 플래그.
- **이전 매치 사망 위치가 다음 매치 첫 좌표로 기록** (QA §5.2 이슈 B) — pre-match phase 좌표 무시, 이전 세션 마지막 GEP 좌표(`Store.lastSessionEndPos`)와 같은 첫 좌표 거절, 좌표가 움직인 뒤에만 첫 포인트 채택. `startPos`/`endPos`는 채택 포인트에서만 갱신.
- **Free 고정 복원** — `isPremium = false` (스토어 QA 빌드).
- **프로필 로드 가림막** (2026-09-05) — `ProfileLoadingOverlay`가 스크롤 컨테이너에서 `absolute; inset: 0`이라 첫 화면만 덮고, 아래로 스크롤하면 매치/통계가 그대로 보였음. 프로필 로드는 `sticky`로 보이는 영역에 붙이고 로딩 중 메인 스크롤을 잠금. 아카이브 동기화 오버레이는 리스트 전체 `absolute` 커버 유지.

### 개선

- **닉네임 검색** — case-insensitive **exact**만 사용. 현닉(`global_profiles.name`) → 이전닉(`profile_name_aliases`, UID당 3·30일) → ALS. GEP/ALS/keep-alive 닉 변경 시 alias 동기화. 후보 모달에 former-name 표시.
- **keep-alive** — `updated_at` 오래된 순, 회당 12명·순차 5초. **목표**는 분당 1회(출시 후에도 동일). **현재 Hobby**는 Vercel cron 하루 1회만; Pro 후 `* * * * *`로 전환 ([NICKNAME-SEARCH](NICKNAME-SEARCH.md) §5, [LAUNCH](LAUNCH.md) §1.2.1).

### 문서

- [NICKNAME-SEARCH.md](NICKNAME-SEARCH.md) — 설계·Hobby/Pro cron·운영 체크
- QA §닉네임 · LAUNCH §1.2.1 keep-alive cron
- [STORE-QA.md](STORE-QA.md) — Overwolf 스토어 QA 피드백 (2026-09) 기록

---

## v0.0.10 — 2026-08-06

전투 집계·고스트 매치 방어와 문서 정리. GEP 로케일 finish / tabs 미발송 실기 로그 반영.

### 수정

- **팀메이트 킬 누락** — `출혈`·`링` 등 로케일 finish를 팀메이트에도 knock→opaque 페어링으로 집계 (언어 사전 없음). 로컬 `_pendingKnocks`와 분리된 `_squadCombatPairs` 사용.
- **20등 / 0킬·0딜 고스트** — tabs·로드아웃·동선이 비고 등수만 기본 20인 세션은 버림. 다만 **완성된 형제 세션이 있을 때만** 버려서, 한 판이 둘로 쪼개진 경우 전투로그 백필 기회를 남김.
- **전투로그 → tabs 백필** — 버릴 수 없는 hollow 절반에 대해 local kill/assist/knock을 이벤트에서 복구.

### 개선

- **매치 경계·업로드** — live/post-elim `legendSelect` 분할, keeper sibling 메타(`hadStats`/`completed`) 기록.
- **맵** — World's Edge Season 30 에셋 (`worlds_edge_s30.png`).
- **UI / 로케일** — 통계·사이드바·맵 시각화·시드 카피 소규모 갱신 (10개 언어 동기화).

### 문서

- [GEP-BUGS.md](GEP-BUGS.md) — 실기 관측 이슈 목록.
- Docs hub — [ARCHITECTURE](ARCHITECTURE.md) / [QA](QA.md) / [LAUNCH](LAUNCH.md) / [ROADMAP](ROADMAP.md) (구 `docs/launch/`, `match-data-architecture-v3` 통합).
- README — 버전 `0.0.10`, 문서 링크 갱신.

---

## v0.0.9 — 2026-07-27

매치 경계(capture) 로직을 **이상적 GEP 계약** 기준으로 재정리. Overwolf 측에 연속 큐 시 `match_start`/`pseudo`/`legendSelect` 누락 이슈도 제보함.

### 개선

- **1차 경계** — `match_start` / `match_end`를 주 시작·종료 신호로 사용.
- **2차 경계** — `pseudo_match_id` 부여·클리어·교체, 스쿼드 `legendSelect_*` 채움·null 클리어로 start/end 누락 보정.
- **3차** — `legend_selection` phase / stats_reset / orphan 타이머.
- **세션 vs 업로드 분리** — `MatchLifecycle`(핸드오프)과 `MatchUploadQueue`(POST)를 분리해, 이전 판 업로드가 다음 판 캡처를 막지 않음.
- **시작/종료 레이스 방어** — pending `match_end` 타이머를 rotate 시 취소, 1차 end 대기 중 2차 end/start 보류, 세션 종료 후 `match_start` 15초 가드 완화.

### 문서

- README — 레거시 `match-storage-v2` 링크 정리, 버전 `0.0.9`.

---

## v0.0.8 — 2026-07-23

Overwolf Free 티어 QA 제출용 빌드. 데스크톱 광고 + Free 게이트 고정 (Premium 미리보기 제거).

### 새 기능

- **OwAd 데스크톱 광고 레일** — 오른쪽 `AdsRail`: 상단 **400×60**, 하단 **400×600**. `OwAd.shutdown()` / `containerId` / SDK ready 대기. SETTINGS·검색 모달·종료 다이얼로그·minimize·GEP 드롭다운 시 `display:none` pause.
- **인라인 프로필 헤더** — 대시보드에 프로필 카드 + 스탯 카드 나란히 (`InlineProfileSection`).
- **오버레이 입력 실패 배너** — `overlayInputHookError` / `inputFailure` 시 PC 재시작 안내 (`OverlayHealthBanner`).
- **GEP Obituaries 안내** — 헤더 GEP 상태 패널에 Apex Obituaries On 권장 팁.

### Manifest / 패키지

- `dock_button_title`, 잘못된 `disable_hardware_acceleration` 제거.
- 권한: `Extensions` / `Streaming` / `Profile` / `DesktopStreaming` (`getMonitorsList`).
- `externally_connectable` 확장 (Supabase, proxy, OwAd SDK, GEP status, jsDelivr).
- 데스크톱 기본/최소 크기 조정, 데스크톱에서 `focus_game_takeover` 제거.
- 제거(uninstall) 시 앱 UI 없이 브라우저 설문만 오픈.

### 개선

- **Free 고정** — 설정 Premium 미리보기 토글·localStorage override 제거. `isPremium=false` (광고 ON + 분석 탭 잠금). 구독 연동 시 같은 플래그로 광고/게이트 일괄 전환.
- **창 실행** — 독/트레이 토글, Discord 초대 `skip_in_game_notification`, 트레이 destroy 시 리스너 정리, 게임 종료 시 desktop restore가 `_isWindowOpen` 동기화.
- **광고·UI 안전** — 리사이즈 핸들 z-index/광고 레일 inset, 인게임에서 광고 미마운트, 네트워크·오버레이 배너 스택, `tryLoadSeasons` 취소·재시도 상한, AdUnit OwAd 대기 abort.
- **최소 높이** — 창 높이 ≤800일 때 프로필 태그 최대 3개로 프로필/스탯 카드 높이 맞춤.
- **무기 데이터** — fallback/타입 분리, `seed:weapons` 스크립트.

### 문서

- Docs — [QA.md](QA.md), [LAUNCH.md](LAUNCH.md), [ROADMAP.md](ROADMAP.md) (구 `docs/launch/` 통합).

---

## v0.0.7 — 2026-06-28

### 새 기능

- **Match Data V3 (클라이언트)** — Statistics 탭이 `player_season_stats` 서버 집계를 우선 사용. 매치 목록은 summary-only 동기화, 펼침 시 detail lazy fetch + prefetch. `public.seasons` SSOT 기반 시즌 필터.
- **팀원별 내 기록** — TOP3 카드(팀원 픽 포디움), 2단 헤더 표(팀원/내 기록), 표 첫 줄에 **나의 시즌 평균** baseline, 5판 이상 함께한 팀원은 **▲/▼** 시즌 평균 대비 표시, 긴 닉네임 marquee.
- **닫기 확인** — 데스크톱 창 X / Alt+F4 시 종료·백그라운드 유지 확인 다이얼로그 + “다시 묻지 않기” (`CloseConfirmDialog`, `is_alt_f4_blocked`).
- **Supabase 마이그레이션** — `seasons`, `matches.season_id`, `player_season_stats`, `matches.weapon_combat`, `matches.deaths` 스키마 추가.
- **개발용 시드** — `npm run seed:teammate-test` / `:clean` (가짜 팀원 매치 삽입·삭제).

### 개선

- **동기화·레이스** — 검색 후 Statistics 탭 점프 방지, 프로필 로드 generation guard, 수동 새로고침만 원격 sync (60s 폴링 제거).
- **네트워크** — `fetchPlayerStats` 클라이언트 캐시, i18n `languages_cache_v3` + 버전 게이트, 타인 프로필 lazy archive (page 2+).
- **로케일** — 팀원 탭/표 copy 개선, `{{variables}}` 미번역 버그 수정 (seed version 5), 10개 언어 동기화.
- **매치 상세** — `matchDetail` 유틸, `matchPanelStyles` 공유, `ProfileTagIcon` 사이드바 태그.
- **배경** — summary/detail API 분리, `apiService` stats 엔드포인트, repository lazy history.
- **무기별 킬/어시·통계 재설계** — 소지 시간(`hh:mm`), 이벤트 킬, 사망 시점 슬롯 데스(+중간 킬 보정 1), 승률/평균 순위는 최종 로드아웃·킬·전투 시점 양 슬롯 qualifying. KA/D 숨김. 매치 `weaponCombat` 요약 저장.
- **K/D 데스** — 전체/레전드/팀원도 컴뱃로그 사망 횟수 기준(한 판 2회 사망 = 2데스). 레거시 매치는 기존 패배=1 폴백.
- **Top Legends / Weapons** — 하이브리드 순위 `sqrt(사용량) × K/D` (레전드=판수, 무기=소지 분). Overview 메인 픽도 동일.
- **통계 오버뷰 카드** — 맵/레전드 오버뷰 카드에서 무기 승률·팀원 레전드 픽률 제거(표는 유지). Weapons 탭 포디움 승률은 유지하며 ≥10%면 초록 표시.
- **스탯 색 티어** — 승률·K/D·KA/D·평균 딜·평균 순위를 회색(낮음)/흰색(보통)/초록(높음)/금색(매우 높음) 4단계로 통일.

### 수정

- **컴뱃로그 킬 누락** — GEP가 출혈/링 등 finish를 로케일 `action`으로 보낼 때, 내가 넉다운한 victim이면 locale 무관하게 kill로 승격. `tabs.kills`와 컴뱃로그 불일치 완화.

### 문서

- [ARCHITECTURE.md](ARCHITECTURE.md) — V3 아키텍처 (Shipped 상태; 구 `match-data-architecture-v3.md`).
- README — V3 마이그레이션·스크립트·기능 목록 갱신.

---

## v0.0.6 — 2026-06-28

### 새 기능

- **티어표 (Tier Table)** — 레전드/무기 티어표 탭 추가. 드래그 앤 드롭으로 티어 배치, 행 순서 변경, 로컬 저장. `html2canvas`로 캡처·미리보기·워터마크 오버레이 지원.
- **매치 상세 레이아웃** — 중복 로드아웃 패널 제거, 전투기록(Combat Log) 영역 확대.
- **로드아웃 타임라인** — Before/After 슬롯에 무기 이름 대신 Supabase Storage 무기 PNG 표시.
- **지도 마커 호버** — 시작/끝은 각각 독립 호버, 점프(사망↔리스폰) 마커는 쌍으로 함께 강조. 툴팁 없음.

### 개선

- **Match Data V3** — `matches` 단일 소스, summary/detail 분리 로드, `public.seasons` SSOT, `player_season_stats` 서버 통계, 통계탭은 `/player-stats` 전용. 매치 펼침 시 detail lazy fetch + prefetch.
- **지도 마커 크기** — 모든 마커 반지름 통일, 전체화면에서는 초기 크기 50% 축소.
- **전투기록 아이콘** — `eventIcons.ts`로 Combat Log 아이콘 URL 공유.
- **통계 탭** — Statistics UI/차트 개선.
- 10개 언어 — 티어표·네비 등 번역 추가 (`npm run seed:languages`로 Supabase 반영).

### 정리

- dev 매치 프리뷰, `LoadoutDisplay`, `App.css`, `game_constants.json`, 미사용 `BackgroundController` 제거.
- locale 시드에서 사용하지 않는 top-level `loadout.*` 키 정리.

---

## v0.0.5b — 2026-06-26

### 새 기능

- **프리미엄 통계 블러 미리보기** — Maps / Legends / Weapons / Teammates 탭은 잠금 상태에서도 실제 UI를 블러 처리해 미리보기로 표시하고, 업그레이드 CTA를 제공합니다. **Overview**는 무료 사용자에게 전체 공개(맛보기)입니다.
- **설정: 앱 데이터 초기화** — 로컬 캐시(IndexedDB, localStorage)를 삭제하고 앱을 재시작합니다. 고정 프로필·즐겨찾기 등 로컬 데이터가 제거됩니다.
- **전투기록 아이콘** — Supabase Storage `images/events/` PNG 아이콘 사용 (kill, knockdown, death1, revive, respawn). 화살표 제거, 툴팁 첫 글자 대문자.

### 버그 수정

- **전투기록 death 누락** — 녹다운 후 확킬 없이 스쿼드 전멸 시 `kill_feed` death가 오지 않아 combat log에 death가 빠지던 문제를 수정합니다. `your_squad_is_eliminated` 및 매치 저장 직전에 knockdown 기준으로 death를 보충 기록합니다 (부활 케이스는 제외).

### 개선

- **매치 저장 즉시 UI 반영** — 같은 UID 조회 중 새 매치가 저장되면 background → UI 메시지로 동기화하고, 원격 히스토리 로드 시 로컬 매치가 지워지지 않도록 병합합니다.
- **Recharts 차트** — `ChartContainer`로 컨테이너 크기 0일 때 렌더 지연, `width(-1) height(-1)` 경고 제거.
- **튜토리얼** — 2단계(플레이어 검색) 툴팁이 검색창을 정확히 가리키도록 `#search-bar` 앵커 및 정렬 수정.
- **단축키 안내** — HotkeyReminder UI 정리.
- **IndexedDB** — `LocalDB.clearAll()`이 트랜잭션 완료까지 대기하도록 수정 (초기화 안정성).
- 10개 언어 — 설정 초기화·데이터 섹션 번역 추가 (`npm run seed:languages`로 Supabase 반영).

### 알려진 이슈

- **GEP `task_weapon` 크래시** — 매치 착지 직후 Overwolf Apex 플러그인이 `crashed_on_task_task_weapon`으로 종료되면 `me.weapons`가 `unknown`으로 고정되어 로드아웃 타임라인이 비어 있을 수 있습니다. GEP 측 이슈입니다.
- **GEP 게임 모드 미표시** — v0.0.5 fallback 및 상태 패널로 영향 범위를 안내합니다.

---

## v0.0.5 — 2026-06-25

### 새 기능

- **GEP 이벤트 상태 패널** — 상단 상태 점(인디케이터)을 클릭하면 Overwolf [game-events-status API](https://game-events-status.overwolf.com/21566_prod.json) 기준으로 어떤 기록이 영향받는지 확인할 수 있습니다.
  - **Game Mode** — `game_mode`
  - **Combat Logs** — `kill`, `kill_feed`, `knockdown`, `tabs` 등
  - **Placement (등수)** — `victory`, `match_summary`
  - **Movement Path (동선 기록)** — `phase`, `location`
  - Loadout, Team Info, Legend, Ultimate 등 추가 그룹
- **Statistics Overview 개편** — 5축 레이더(교전·화력·매크로·팀·피크), 시즌·모드 필터, 맵/레전드/무기/팀원 서브탭 분석
- **일별 RP 추이 차트** — Supabase `daily_rank_snapshots` 기반, Statistics Overview(All·Ranked)에 표시
  - 랭크 티어별 색상, 승강 시점부터 색 전환
  - 시즌 초 0 RP·배치 급등 구간 제외, RP > 0 없으면 차트 숨김
- **사이드바 최근 20경기 요약** — 승률, 평균 등수, 평균 킬/대미지/어시스트, 최다 픽 레전드 (2×3 카드)
- **점진적 매치 동기화** — 최초 100경기 UI 표시 후 백그라운드 전체 동기화, 탭·페이지·필터 변경 시 flush
- 10개 언어 번역 (en, ko, ja, zh-CN, zh-TW, fr, es-ES, es-MX, pt-BR, pt-PT) — Supabase `languages` 테이블 반영

### 개선

- **GEP 게임 모드 fallback** — GEP에서 `game_mode`가 오지 않아도, 맵·팀원·플레이 흔적이 있는 매치는 `BR`로 저장합니다.
- **BR 탭 전용 표시** — fallback `BR` 매치는 Ranked / Trio / Duo 탭에 노출되지 않고 **BR 탭에만** 표시됩니다.
- **매치 폐기 기준 완화** — 이동 경로, 무기 교체, 사망 등 실제 매치 증거가 있으면 킬/대미지 0·2분 미만만으로 junk 세션을 폐기하지 않습니다.
- **전투 로그** — 부활/리스폰 이벤트 표시 개선(공격자 공란, 피해자 닉네임, 지원 이벤트 녹색 강조), 스크롤 클리핑 수정
- **맵 전체화면** — `Esc`로 전체화면 해제
- **Overview 레이더·점수** — 교전 축 곡선 조정, 대미지/피크 200 dmg/kill 기준 통일
- **한국어** — UI 전반 `데미지` → `대미지`, K/D 라벨 정리
- **랭크 티어 색상** — `getRankTierColor` 공통 유틸 (플레이어 검색·RP 차트)
- 통계 탭·웹 프리뷰에도 동일한 모드 필터 규칙을 적용했습니다.

### 알려진 이슈

- **GEP 게임 모드 미표시** — Overwolf GEP 측 이슈입니다. v0.0.5에서 fallback 저장과 상태 패널로 영향 범위를 안내합니다.

---

## v0.0.4 — 2026-06-24

### 새 기능

- **테마 시스템** — 설정에서 다크 / 라이트 모드를 선택할 수 있습니다.
- **단축키 분리** — 데스크톱(세컨드 스크린)과 인게임 오버레이 단축키를 각각 설정합니다.
  - 데스크톱: `Ctrl+Shift+=` (기본값)
  - 인게임: `Ctrl+Shift+-` (기본값)
- **앱 내 단축키 설정** — Overwolf 설정으로 이동하지 않고 설정 탭에서 단축키를 변경할 수 있습니다.
- **매치 상세 탭** — Stats / Loadout Timeline 탭으로 매치 정보를 구분해 볼 수 있습니다.
- **로드아웃 타임라인** — 매치 중 감지된 무기 변경 이력을 시간순으로 표시합니다.
- **Match Storage V2** — Supabase `matches` 테이블에 매치를 정규화해 저장합니다 (레거시 `match_archives`와 병행).
- **웹 프리뷰 모드** — Overwolf 환경이 아닌 브라우저에서도 UI를 확인할 수 있습니다.
- **Executioner 홉업** — 무기 탭에 Executioner 홉업 정보를 추가했습니다.

### 개선

- HotkeyReminder가 데스크톱 / 인게임 단축키를 구분해 표시합니다.
- 데스크톱 창 위치를 유지합니다 (`keep_window_location`).
- 하드웨어 가속을 비활성화해 일부 환경에서의 렌더링 문제를 줄였습니다.
- UI 전반을 CSS 테마 변수 기반으로 정리했습니다.
- 플레이어 검색·상대 시간 표시에 "방금" 문구를 추가했습니다.
- Supabase 마이그레이션: `daily_rank_snapshots`, `matches` (v2 스키마) 테이블 추가.

---

## v0.0.3

- Revive GEP 기능 등록
- 부활 후 이동 경로가 맵에 올바르게 기록·표시되도록 per-life-segment 경로 필터링 수정

## v0.0.2

- 언어 코드 BCP 47 형식으로 마이그레이션
