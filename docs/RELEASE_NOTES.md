# ApexTrace Release Notes

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

- HotkeyReminder가 데스크톤 / 인게임 단축키를 구분해 표시합니다.
- 데스크톱 창 위치를 유지합니다 (`keep_window_location`).
- 하드웨어 가속을 비활성화해 일부 환경에서의 렌더링 문제를 줄였습니다.
- UI 전반을 CSS 테마 변수 기반으로 정리했습니다.
- 플레이어 검색·상대 시간 표시에 "방금" 문구를 추가했습니다.
- Supabase 마이그레이션: `daily_rank_snapshots`, `matches` (v2 스키마) 테이블 추가.

### 알려진 이슈

- **GEP 게임 모드 미표시** — Overwolf GEP에서 `game_mode` 정보가 내려오지 않는 문제가 있습니다. Overwolf 측 수정 대기 중이며, 앱에서는 가능한 fallback(매치 정보·Store)으로 보완해 두었습니다.

---

## v0.0.3

- Revive GEP 기능 등록
- 부활 후 이동 경로가 맵에 올바르게 기록·표시되도록 per-life-segment 경로 필터링 수정

## v0.0.2

- 언어 코드 BCP 47 형식으로 마이그레이션
