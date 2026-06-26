# ApexTrace Release Notes

## v0.0.5b — 2026-06-26

### 새 기능

- **프리미엄 통계 블러 미리보기** — Maps / Legends / Weapons / Teammates 탭은 잠금 상태에서도 실제 UI를 블러 처리해 미리보기로 표시하고, 업그레이드 CTA를 제공합니다. **Overview**는 무료 사용자에게 전체 공개(맛보기)입니다.
- **설정: 앱 데이터 초기화** — 로컬 캐시(IndexedDB, localStorage)를 삭제하고 앱을 재시작합니다. 고정 프로필·즐겨찾기 등 로컬 데이터가 제거됩니다.
- **전투기록 아이콘** — Supabase Storage `images/events/` PNG 아이콘 사용 (kill, knockdown, death1, revive, respawn). 화살표 제거, 툴팁 첫 글자 대문자.

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
