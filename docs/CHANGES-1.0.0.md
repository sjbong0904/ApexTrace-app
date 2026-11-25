# v1.0.0 변경 전수조사 (v0.0.15 → v1.0.0)

기준: `f67c67c`(v0.0.15 제출본 `c68b2ce` + 문서 정리) 대비 작업 트리 전체. 2026-11-25 조사.
변경 87개 파일(+7,815 / −2,122줄), 새 파일 70여 개. 0.0.16은 태그·배포 없이 이번 버전에 합쳐졌고, 변경량이 커서 1.0.0으로 올림.

기능 단위 요약은 [RELEASE_NOTES.md › v1.0.0](./RELEASE_NOTES.md#v100--2026-11-25). 이 문서는 **어떤 파일이 왜 바뀌었는지**를 빠짐없이 적은 목록이다.

> **주의:** 작업 트리의 `src/App.tsx` `const isPremium = true;`는 로컬 미리보기 값이다. 스토어 빌드 전에 `false`로 되돌려야 한다(직접 관리).

---

## 1. 패키지·설정

| 파일 | 변경 |
| --- | --- |
| `manifest.json` | 버전 0.0.15 → **1.0.0**. 데스크톱 창 `disable_hardware_acceleration: true`, `min_size` 1080×780 → **1080×720**. `externally_connectable`에서 `localhost:3000`·`127.0.0.1:3000` 제거 |
| `package.json` / `package-lock.json` | 버전 1.0.0. 스크립트 `test`·`test:watch`·`test:update`·`test:coverage`·`metrics`. devDeps `vitest`·`@vitest/coverage-v8`·`playwright-core`(측정용, 브라우저 다운로드 없음) |
| `index.html` | JS 없이 그려지는 부트 셸(타이틀바·최소화·닫기·로딩 표시) |
| `background.html`·`worker.html` | jsDelivr supabase-js `@2` → `@2.91.1` 고정, 미사용 `tesseract.js@5` 제거(worker) |
| `eslint.config.js` | `no-unused-vars`에 `ignoreRestSiblings`, `^_` 무시 패턴 |
| `.gitignore` | `coverage/`, `scripts/loadbench/fixtures/`(녹화 네트워크·개인 uid), `__pycache__/`·`*.pyc` |
| `vitest.config.ts` (새) | node 환경, `src/**/*.test.ts`, `src/utils` 커버리지(v8) |

## 2. 백그라운드 (`public/background/`)

| 파일 | 변경 |
| --- | --- |
| `events.js` | GEP `ring` 처리(`handleRingUpdate`). GEP `player_stats` 처리: 최신 스냅샷 보관, 진행 중 매치에 복사, 바뀐 키만 `POST /account-stats`로 디바운스 업로드, 로컬 플레이어 프로필 실시간 반영(총 레벨 → prestige/level 분리), 랭크 RP 델타를 같은 스플릿·직전 1경기 조건으로 종료된 랭크 매치에 즉시 고정. stale `match_summary`(직전 판 등수 재전송) 무시. GEP 원본·위치 로그 분리 |
| `main.js` | 모니터 식별에서 너비·높이 무시, 크기·위치가 실제로 바뀔 때만 `changeSize`/`changePosition`(네이티브 창 흰 화면 깜박임 방지), 화면 밖으로 나간 창만 구조. 게임 모니터가 바뀔 때만 데스크톱 창 이동. GEP 구독 목록을 코드가 소유(`GEP_BASE_FEATURES`), 원격은 `gep_features_disabled`(버전 범위 지원)로 끄기만, 설정 변경 시 재구독, 누락 시 WARN. `normalizeLevelPair`(레벨 이중 합산 버그 수정). GEP RP 30분 우선 규칙, 원격 `rpApplied` 원장(`onRemoteRpApplied`·`_withLedgerRp`). `{uid,name}`만 있는 클릭은 ALS 재조회. `fetchAccountStats`, 주소록 DB 행 조회. 링·스탯 검증 요약 로그 |
| `repository.js` | `/account-stats` save·fetch(프록시 미배포 시 404 → null), 업로드 후 `pending_rp` 반영 |
| `services/apiService.js` | `/apex-stats` 같은 type+query 동시 요청 하나로 합침 |
| `services/matchService.js` | `recordRing`: `next_ring`/`active_ring` 저장(`ringRounds`, `activeSamples`), GEP `next_ring` 중심 쓰레기 값 무시 후 수축 종료 시 active 중심으로 채움, 단위 = 위치 m × 100. `headshots`·`grenadeDamage`·`damageHits` 수집. `ultimate_cooldown` JSON 문자열 파싱 수정. 이 세션에서 PHASE 이벤트를 받은 뒤에만 phase 신뢰 |
| `utils.js` | 디버그 로그 플래그(`__APEX_DEBUG__`, `_MATCH__` 기본 on, `_LOCATION__` 기본 off), `gepLog`·`ringLog`·`playerStatsLog`·`locationLog`, 위치 분리 로깅. base64 닉네임 디코드가 출력 불가 문자면 거절(“HiRo” 등 오디코딩), `stripNameDecorations`. 케어패키지 Mozambique(`mp_weapon_shotgun_pistol_crate`). `isImpossibleSummaryRank`. 피해자 쪽 넉다운 행의 적 무기를 내 무기로 귀속하던 오류 수정 |

## 3. 앱 진입·셸

| 파일 | 변경 |
| --- | --- |
| `src/main.tsx` | `initBootShell()`, 시작 실패 시 `showBootError()` |
| `src/bootShell.ts` (새) | 부트 셸 드래그·최소화·닫기(닫기 설정 따름), 오프라인 안내 + 다시 시도 + 온라인 복귀 시 자동 재시도 |
| `src/App.tsx` | 시즌 선택(스플릿/시즌 전체, 기록 있는 시즌만), 주소록 행으로 먼저 그리기, 30초 폴링 시 같은 객체 재사용, 매치 열면 행 전체 스크롤, 첫 기록 매치 축하·자동 열기, 데모 샘플 프로필(Premium 보기 해제, 계정 감지 시 자동 전환), 최근 경기 비교 계산, 스크롤 레이어 재래스터 방지, 공유·Premium 다이얼로그 마운트, 백그라운드 데이터 타입 정리 |
| `src/vite-env.d.ts` | 전역 타입 `BgProfile`·`SelectableProfile`·`StoredProfileRow`·`BgProfileResult`·`BgSearchResult`, `Window.overwolf?`·`APIService`·`SEASONS`·`BG_MAP_DATA` |
| `src/types.ts` | `RingRound`·링 샘플, `damageHits`·`ringUnitsPerMeter`·상세 버전, `PlayerCandidate`, 계정 스탯(`AccountStats`, BR 시즌 블록), 플랫폼 id, nullable 필드 |
| `src/index.css` | 매치 아코디언 전환(접힌 상태 opacity 없음), 카드 앵커 |
| `src/theme/*` | 보조 텍스트 대비 ≥ 4.5:1 / 3.5:1, `useTheme`를 `useTheme.ts`로 분리(Fast Refresh) |
| `src/hooks/useApexRunning.ts` (새) | App에서 분리 |
| `src/hooks/useWindowAutoResize.ts` | 최대화·숨김 창은 `changeSize` 안 함(흰 화면) |
| `src/lib/loadLanguages.ts` | 언어 캐시 키 `v4` → `v5`(새 키가 있는 팩을 다시 받음) |

## 4. 화면 컴포넌트

| 파일 | 변경 |
| --- | --- |
| `AdsRail.tsx` | 번들 webp 배경(14.5MB 원격 PNG 대신), Overwolf 440×670 배치: 간격 10px 하나, 상하 여백 10px, 레일 441px, 400×600은 `margin-top:auto`. 레일의 Premium 버튼 제거 |
| `AdUnit.tsx` | OwAd 타입 |
| `MapVisualizer.tsx` | 보기 순환(경로 → 경로+정적 링 → 리플레이). Free 정적 링 오버레이, Premium 리플레이(이동 마커·실시간 링·배속·재생 바, Free 하루 1회), 전투 로그·로드아웃 행에서 시점 이동, 지도 로딩 표시, 링 클립, 30fps 리드로우 |
| `MatchAccordion.tsx` (새) | 접힌 행은 상세를 마운트하지 않음, 열림 애니메이션 후 무거운 지도 마운트 |
| `MatchDetailBody.tsx` (새) | 지도 중심 상세 레이아웃(넓으면 옆, 좁으면 위) |
| `MatchDetailTabs.tsx` | 전투 로그 탭 이름은 `combatLog.tabTitle`, 데스크톱 4탭(Overview/Details/Combat log/Loadout), 탭 바 오른쪽 공유 버튼, 리플레이 시점 이동 전달 |
| `MatchStats.tsx` | overview/detail 분리, DETAILS 지표 5줄 재구성(미수집은 `-`), 최근 경기 대비 막대(중앙 = 평균, 양끝 = 최저·최고), 최다 킬 무기 |
| `CombatLog.tsx` | 킬피드형 고정 열(공격자·무기 실루엣·아이콘·피해자), 행 클릭 시 리플레이 이동·강조 |
| `LoadoutTimeline.tsx` | 행 클릭 시 리플레이 이동 |
| `MatchShareActions.tsx`·`MatchShareCard.tsx` (새), `hooks/useMatchShare.tsx` (새) | 매치 공유 이미지: 화면 밖 카드 렌더 → PNG(워터마크) → 클립보드 복사(실패 시 저장). 팀원 이름 제외 |
| `FirstRunPanel.tsx` (새) | 내 계정·매치 0개: 설치 진행 단계 + 첫 매치 미리보기 |
| `DemoBanner.tsx` (새) | 샘플 프로필 안내, 해 볼 것 3가지 체크, 가이드 투어 |
| `PremiumDialog.tsx` (새) | Free vs Premium 비교 시트, 출시 알림 토글(열리면 광고 정지) |
| `PremiumBlurGate.tsx` | 탭별 가치 문구·구체 항목, 내 데이터 1행 미리보기 |
| `ProfileRecordView.tsx` (새), `hooks/useAccountStats.ts` (새) | GEP 계정 기록(앱 없이 한 경기 포함) 보기 |
| `SeasonPicker.tsx` (새) | 시즌 드롭다운 + Split 1 / Split 2 / Season 버튼 |
| `Navigation.tsx` | 데스크톱 Matches + Statistics를 "Records" 하나로 통합, 아이콘 라벨, Free 금색 Premium 항목, 구분선 |
| `Sidebar.tsx` | 이름 옆 수동 새로고침, Premium 프로필 ↔ 계정 기록 전환, 배지 반짝임 1회(무한 애니메이션이 유휴 중 초당 ~270프레임·흰 깜박임 유발) |
| `SidebarStats.tsx` | 실제 RP 차트(티어 색·하한선·RP 축), 최근 20경기 배치 블록, 요약 |
| `InlineProfileSection.tsx` | LAST 20 카드 데이터, 새로고침, 계정 범위 |
| `StatisticsTab.tsx` | 공통 블록(StatsCard·히어로 헤더·BreakdownPanel·2열 그리드)으로 재구성, 탭 간 이동, 계정 시즌 카드, 공백 있는 이미지 경로 `url()` 따옴표 |
| `weaponsTab.tsx` | 기본 무기 변경 시 표준 변형(렌더 중 조정), CAR 쉴드 모드 기본 |
| `SettingsTab.tsx` | 인게임 창 외부 링크 확인 다이얼로그, 핫키 effect 정리 |
| `SearchBar.tsx`·`RankProgressChart.tsx`·`ProfileTagIcon.tsx`·`ChartContainer.tsx`·`GameStatusIndicator.tsx`·`TierTableTab.tsx`·`TierTableCaptureView.tsx`·`PlayerSelectionModal.tsx`·`WindowControls.tsx`·`ResizeHandle.tsx`·`matchPanelStyles.ts` | 훅 규칙(effect 안 setState → 렌더 중 조정), 타입. 티어표 모드 전환 저장 순서 수정, 프로필 태그 아이콘 깜박임 수정 |
| `src/web/SimpleWebApp.tsx`·`web/api.ts` | 웹 셸에도 시즌 선택, 펼친 목록 접기 버튼 고정 |

## 5. 유틸 (`src/utils/`)

| 파일 | 변경 |
| --- | --- |
| `ringOverlay.ts`·`mapReplay.ts` (새) | 링 좌표 변환(÷100), 라운드별 닫힌 링·부분 링, 리플레이 타임라인 |
| `groundPath.ts` (새) | 지상 경로 필터: phase가 없거나 이전 판 값이면 속도로 드롭쉽 구간 제거 |
| `matchDetailStats.ts` (새) | DETAILS 지표 계산(헤드샷 비율·녹다운당 대미지·수류탄·링 밖 시간 등, 미수집은 null) |
| `matchComparison.ts` (새) | 이 경기 vs 이전 최대 20경기 |
| `matchShare.ts` (새) | 카드 → PNG, 클립보드 |
| `demoMode.ts` (새), `assets/demo/demoMatches.json` (새) | 익명화한 실제 경기 23개로 만든 샘플 프로필 |
| `premium.ts` (새) | Premium 시트 열기, 출시 알림·Free 하루 1회 리플레이(기기별 localStorage) |
| `accountRecord.ts` (새) | 계정 BR 블록 판정 |
| `seasonGroups.ts`·`seasonAvailability.ts` (새) | 스플릿 행을 시즌으로 묶기, 기록 있는 시즌만 |
| `imageSource.ts` (새) | 이미지를 Overwolf 앱 데이터에 내려받아 재사용, 누락 시 투명 gif |
| `matchDetail.ts` | 상세 버전 v2(`ring_rounds`) — 오래된 캐시는 한 번 재요청 |
| `LocalDB.ts` | 같은 `matchId` 중복 저장 시 병합 손실 수정(배치 내 중복 제거, 한 트랜잭션), 상세 보존 병합 |
| `historySync.ts` | 상세 버전 우선, 랭크 RP 이월, 폴링 결과 객체 재사용 |
| `statsAggregation.ts`·`statsScoring.ts` | 넉 지표(`avgKnocks`·`knockToKillRate`), squadKills 없는 경기 제외(킬 관여율 100% 고정 수정) |
| `helpers.ts` | 랭크 티어 하한 RP(S28–S31)·티어 이름·색, 타입 확장 |
| `tierTableData.ts`·`weaponTheme.ts`·`weaponFallbackRows.ts` | 게임 HUD 흰색 무기 실루엣 + 탄약색 타일, 크기 배율 1× |
| `constants.ts`·`match.ts`·`matchNormalizer.ts`·`eventIcons.ts`·`gameData.ts`·`statsCatalogSelection.ts`·`tierTableScreenshot.ts`·`tutorial.ts` | `MapConfig` 타입, nullable 필드, 데모 투어(tutorial), 소소한 정리 |
| `assets/worlds-edge-decor.webp` (새) | 1024px 장식 지도(76KB) |

## 6. 테스트·측정

| 파일 | 변경 |
| --- | --- |
| `src/utils/__tests__/*` (새) | 84개 테스트: helpers·scoring·seasons·matchMode·replay·appState + 골든 스냅샷(데모 23경기) |
| `scripts/metrics.mjs` (새) | 버전 지표 측정·기록(`--ref`, `--skip`, `--compare`, `--record-load`) |
| `scripts/loadbench/run.mjs`·`overwolf-stub.js` (새) | 헤드리스 Edge 시작 벤치마크(녹화 네트워크 재생) |
| `metrics/` (새) | `HISTORY.md`, `history/v0.0.13~16.json`, `diffs/*` |

## 7. 서버·DB (Supabase, 프록시는 별도 레포)

| 파일 | 내용 | 적용 (상태는 RELEASE_NOTES 서버·DB 표) |
| --- | --- | --- |
| `migrations/20261020090000_fix_global_profiles_write_rls.sql` | `global_profiles` 쓰기 RLS가 PUBLIC에 열려 있던 것 수정 | 보안 — 우선 |
| `migrations/20261020090100_revoke_global_profiles_extra_client_grants.sql` | 클라이언트 불필요 권한 회수 | 위와 함께 |
| `migrations/20261114184658_player_account_stats.sql` | XP·`gep_synced_at` 컬럼, 계정 스냅샷 | 프록시 `/account-stats` 배포 전 |
| `migrations/20261116120000_drop_matches_is_kill_leader.sql` | 킬리더 컬럼 삭제 | 프록시 배포 후 |
| `migrations/20261116130000_add_matches_damage_hits.sql` | `damage_hits` | 2026-11-25 적용. 프록시 매핑 `6f89fb6` 배포 |
| `migrations/20261117090000_global_profiles_als_synced_at.sql` | ALS 동기 시각(캐시 판단) | 프록시 배포 전 |
| `manual/fix_seasons_from_game_data.sql` | 시즌 표를 게임 일정에 맞춤 | 수동 |
| `manual/repair_double_counted_levels.sql` | 레벨 이중 합산 행 복구 | 수동(미리보기 쿼리 포함) |
| `manual/repair_mangled_profile_names.sql` | base64 오디코딩 닉네임 복구 | 수동 |

언어 팩: `scripts/locale-seeds/*.json` 10개 언어(영어·한국어는 약 200줄, 나머지 25줄 내외 추가) → **version 22**(2026-11-25 시딩 완료). 0.0.15가 쓰는 키 739개 전부 유지·보간 변수 동일, `combatLog.title`은 0.0.15 문구 그대로 두고 1.0.0 탭용 `combatLog.tabTitle` 추가. `seed-teammate-test-data.ts`는 `is_kill_leader` 제거.

## 8. 개발 도구 스크립트 (새)

| 파일 | 용도 |
| --- | --- |
| `scripts/build-demo-matches.mjs` | Supabase 실제 경기 → 이름·uid 익명화 → 데모 데이터 |
| `scripts/fetch-local-images.mjs`·`make-image-previews.py` | 로컬 이미지 받기·축소본 생성(개발용) |
| `scripts/game-icons/*.py` | 설치된 게임에서 아이콘·시즌 일정 추출, Supabase 업로드 |

## 9. 문서

- 새 문서: `METRICS.md`, `SEASON-ROLLOVER.md`, `DB-OPTIMIZATION.md`(미구현 계획), `RING-HEATMAP.md`(미구현 설계), `GEP-REQUESTS.md`, `gep-*-event-example.json`, 이 문서.
- 수정: `RELEASE_NOTES.md`(v1.0.0, 버전별 측정), `ROADMAP.md`(링·player_stats·시즌 개편·디버그 로그), `GEP-BUGS.md`(링 중심 쓰레기 값·단위·수축 중 종료), `NICKNAME-SEARCH.md`(apex-stats DB 캐시), `ARCHITECTURE.md`, `QA.md`(광고 최소 크기), `README.md`·`docs/README.md`.

## 10. 커밋에서 뺀 것

- `plans.txt` — 개인 작업 메모(추적 안 함).
- `.claude/launch.json` — 로컬 개발 서버 설정.
- `scripts/game-icons/__pycache__/` — 파이썬 캐시(`.gitignore` 추가).
- `scripts/loadbench/fixtures/` — 녹화 네트워크·개인 uid(`.gitignore`).
