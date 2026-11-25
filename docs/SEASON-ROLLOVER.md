# 시즌·스플릿 전환 체크리스트

시즌이나 랭크 스플릿이 바뀔 때마다 하는 작업. 경계 데이터의 원본은 `public.seasons` 하나뿐이고 (설계: [ARCHITECTURE.md §8](./ARCHITECTURE.md)), 나머지는 패치 내용(맵·레전드·무기·랭크 RP 구간)에 따라 달라진다.

**현재 상태 (2026-11-23 DB 확인):** `seasons` 최신 행 = id 7 `Season 31 : Split 2` (2026-12-15 18:00 → **2027-02-09 18:00 UTC**). 미배정(`season_id is null`) 매치 0건.
→ **다음 마감: 2027-02-09 18:00 UTC 전에 S32 Split 1 행 추가.** id 7에 `end_time`이 있어서, 그 뒤로는 다음 행이 없으면 매치가 시즌 없이(`null`) 저장된다.

---

## 1. 왜 미리 해야 하나

- `POST /history`가 저장할 때 `resolveSeasonId(startTime)`로 `season_id`를 정한다 (`trace-proxy-server/lib/seasons.js`). 맞는 행이 없으면 `season_id = null`이 되고, **`player_season_stats` 집계도 건너뛴다.**
- 나중에 고치는 RPC는 **없다.** ARCHITECTURE §8.3의 `reassign_match_seasons` / `recompute_player_season_stats`는 설계만 있고 구현되지 않았다. 사후 수정은 수동 SQL이다 (예: `supabase/manual/fix_seasons_from_game_data.sql`).
- 그래서 **다음 스플릿 행을 시작 전에 미리 넣는다.** 시작 시각 전 행은 UI 드롭다운에서 숨겨진다 (`getSelectableSeasons`). 미리 넣어도 사용자에게 보이지 않는다.

---

## 2. 일정 (스플릿마다)

| 시점 | 작업 | 섹션 |
|------|------|------|
| 패치 노트·게임 빌드 공개 직후 | 게임 데이터에서 일정·RP 구간 추출 | §3 |
| 스플릿 시작 **최소 1주 전** | `seasons` 행 추가, 직전 행 `end_time` 확인 | §4 |
| 새 **시즌** 패치 당일 | 맵·레전드·무기·아이콘 갱신 | §5 |
| 전환 직후 첫 판들 | 저장·집계·RP 검증 | §6 |
| 문제 발견 시 | 수동 SQL로 재배정 | §7 |

스플릿만 바뀌는 경우(시즌 중간)는 보통 §3·§4·§6만 하면 된다. 이때 바뀌는 건 RP 초기화와 맵 로테이션 정도다.

---

## 3. 게임 데이터 추출 (일정 + 랭크 RP 구간)

위키는 패치보다 늦으니 설치된 게임 파일에서 직접 뽑는다.

1. 게임을 **종료**한다 (RSX는 EAC 때문에 게임이 켜져 있으면 실패).
2. 아이콘·데이터 추출: `scripts/game-icons/extract.py`. 출력 위치는 반드시 `D:/apex-extract/run` (C: 용량 부족).
3. 일정·RP 구간 생성:
   ```powershell
   python -I scripts/game-icons/game_data.py --build "D:/apex-extract/run/<build>"
   ```
   → `<build>/seasons.json`이 생긴다. 시즌/스플릿 시작·끝(UTC)과 스플릿별 티어 진입 RP가 들어 있다. 콘솔에 최근 4시즌이 요약되어 나온다.
4. 확인할 것:
   - 다음 스플릿 시작 시각. 한국 기준이 아니라 **UTC**다. 시즌마다 17:00/18:00 UTC로 바뀌기도 한다 (서머타임).
   - 티어 진입 RP가 `RANK_TIER_RP_FLOORS`(`src/utils/helpers.ts`)와 같은지. 현재 S28–S31 값은 Rookie 0 · Bronze 1000 · Silver 3000 · Gold 5500 · Platinum 8500 · Diamond 12000 · Master 16000.

---

## 4. `public.seasons` 갱신 (필수)

### 4.1 규칙

- **스플릿 하나 = 행 하나.** 이름은 반드시 `Season N : Split M` 형식으로 쓴다. 클라이언트가 이름에서 시즌 번호와 스플릿 번호를 정규식으로 뽑아 시즌 단위로 묶는다 (`src/utils/seasonGroups.ts`). 형식이 다르면 시즌 묶음·스플릿 버튼이 깨진다.
- 시각은 **epoch ms (bigint)**, 구간은 `start_time ≤ t < end_time`이다.
- 직전 행의 `end_time` = 새 행의 `start_time`. 틈이 있으면 그 사이 매치가 `null`이 되고, 겹치면 `id` 내림차순으로 먼저 걸리는 행이 이긴다.
- 마지막 행의 `end_time`은 게임 데이터에 끝 시각이 있으면 넣고, 모르면 `null`(열린 끝)로 둔다. `null`이면 다음 행을 늦게 넣어도 매치가 시즌 없이 저장되지는 않는다. 대신 새 스플릿 매치가 이전 스플릿에 들어가므로 §7로 옮겨야 한다.
- `id`는 1씩 늘린다 (현재 최대 7). 매치·집계가 `season_id`로 참조하므로 이미 쓰인 id는 바꾸지 않는다.

### 4.2 방법

- **어드민** `Seasons` 페이지 (`admin/src/pages/Seasons.tsx` → `POST /api/admin/seasons`)를 쓰거나,
- **SQL 편집기**에서 실행한다:
  ```sql
  insert into public.seasons (id, name, start_time, end_time, version)
  values (8, 'Season 32 : Split 1', <start_ms>, <end_ms 또는 null>, 1)
  on conflict (id) do nothing;
  ```
- 이미 있는 행의 경계를 고쳤다면 `version`을 +1 한다.

### 4.3 반영되는 시점

| 위치 | 읽는 방식 | 반영 지연 |
|------|-----------|-----------|
| 프록시 `resolveSeasonId` (매치 저장) | `seasons` 직접 조회 | 메모리 캐시 60초 |
| `GET /api/seasons` (웹·클라이언트 fallback) | 위와 같음 | 60초 |
| 데스크톱 백그라운드 `window.SEASONS` | 앱 시작 시 Supabase에서 1회 (`ConfigController.init`) | **앱을 재시작해야 반영** |

`season_id`는 서버가 정하므로, 앱을 켜 둔 사용자가 있어도 저장은 맞게 된다. 다만 그 사용자 UI의 "현재 시즌" 기본 선택은 재시작 전까지 이전 목록 기준이다.

`game_constants.seasons`는 Supabase 조회가 실패했을 때만 쓰는 fallback이다. 갱신하지 않아도 되지만, 남겨 둘 거면 같이 맞춘다.

---

## 5. 시즌 패치 콘텐츠 (새 시즌 때)

### 5.1 맵

- **새 맵 / 맵 리워크:** 맵 이미지와 좌표 보정값을 넣는다. 원격은 `game_constants.map_data`(`BG_MAP_DATA`), 로컬 fallback은 `src/utils/constants.ts`의 `MAP_DATA`. GEP 맵 이름 매핑은 `game_constants.map_id_map`.
- **월즈 엣지처럼 시즌별 레이아웃이 다른 맵:** `resolveWorldsEdgeMapImage`(`src/utils/helpers.ts`)가 시즌 이름(`season 30`)과 `WORLDS_EDGE_S30_START_MS`로 이미지를 고른다. 다시 바뀌면 분기와 이미지(`worlds_edge_sNN.png`)를 추가한다. 로컬 이미지 목록은 `scripts/fetch-local-images.mjs`.
- **링 히트맵:** 맵+시즌 단위로 집계하는 설계다 ([RING-HEATMAP.md](./RING-HEATMAP.md)). 구현 후에는 시즌이 바뀌면 새 버킷이 쌓이는지 확인한다.

### 5.2 레전드

- **신규 레전드:**
  - `LEGENDS_LIST`(`src/utils/gameData.ts`)에 추가 (`isKnownLegend`가 이 목록을 쓴다).
  - GEP 이름 매핑 `game_constants.legend_map`.
  - 초상화: `scripts/game-icons/sync_supabase.py`의 `LEGENDS` 매핑에 추가한 뒤 업로드 (dry run → `--upload`).
- **레전드 클래스·능력 변경:** 표시용 데이터가 있으면 같이 고친다.

### 5.3 무기

- **신규 / 삭제 / 보급 상자 전환:** `public.weapons`. 원본은 `src/utils/weaponFallbackRows.ts`이고 `npm run seed:weapons`로 넣는다. GEP 무기 이름 매핑은 `game_constants.weapon_map`. 아이콘·실루엣은 `sync_supabase.py`.
- 무기 지표 정의는 [WEAPON-STATS.md](./WEAPON-STATS.md) 참고.

### 5.4 모드·랭크

- **신규 모드:** `game_constants.game_mode_map`. 지원 모드가 아니면 `isSupportedMode`에서 걸러진다.
- **랭크 RP 구간이 바뀐 경우:** `RANK_TIER_RP_FLOORS`(`src/utils/helpers.ts`)를 고친다. 사이드바 RP 차트의 티어 점선과 색에 쓰인다.
- **랭크 엠블럼이 바뀐 경우:** `sync_supabase.py`의 `RANKS` 매핑.

### 5.5 i18n

시즌 이름은 DB 값을 그대로 쓰므로 번역 키가 필요 없다. 새 레전드·맵·무기 이름을 번역해서 표시한다면, 시드(`scripts/locale-seeds/*.json`)와 원격 `languages` 테이블에 키를 추가한다.

---

## 6. 전환 직후 검증

새 스플릿 시작 후 첫 랭크/일반 판을 몇 판 한 뒤 확인한다.

1. **시즌 배정:**
   ```sql
   select season_id, count(*) from public.matches
    where start_time >= <새 스플릿 start_ms> group by season_id;
   ```
   새 id만 나와야 한다. 시즌 없이 저장된 매치도 확인한다: `select count(*) from public.matches where season_id is null;` → 0.
2. **집계:** 샘플 uid로 `player_season_stats`의 `match_count`(새 `season_id`, mode `ALL`)와 `matches`의 `COUNT(*)`가 같은지 본다.
3. **UI:**
   - Statistics 시즌 드롭다운에 새 시즌·스플릿이 보이고 기본으로 선택되는지.
   - 이전 스플릿 데이터가 그대로인지.
   - 새 시즌 첫 스플릿에서 "시즌 전체" 범위가 정상인지.
4. **RP (스플릿 초기화):**
   - 사이드바 RP 차트와 일별 랭크 추이(`daily_rank_snapshots`)에서 초기화 지점이 크게 떨어지는 건 정상이다.
   - **스플릿 경계 가드:** GEP `season`은 **스플릿을 구분하지 않는다** ([GEP-REQUESTS.md](./GEP-REQUESTS.md) §player_stats). 초기화 전후 스냅샷도 "한 판 차이"로 보일 수 있다. 그러면 `rpChange`가 "초기화된 RP − 이전 스플릿 마지막 RP"로 잘못 잡힌다.
     - 그래서 판 RP는 이전 스냅샷 시각과 이번 스냅샷 시각이 **같은 `seasons` 행(스플릿)** 에 있을 때만 계산한다. 서버는 `sameSplit`(`lib/accountStats.js`), 클라이언트는 `sameSplitLocal`(`events.js`)이다.
     - 따라서 **새 스플릿 첫 랭크 판은 RP 변화가 비어 있는 것이 정상**이다. 그 다음 판부터 채워진다.
     - 이 가드도 `seasons` 행이 제때 들어가 있어야 동작한다. §4가 늦으면 경계를 모르므로 잘못된 값이 다시 들어갈 수 있다.
     - 전환 후 첫 랭크 판의 `matches.rp_change`가 `null`인지 확인한다. 값이 들어가 있으면 그 판만 `rp_change = null, rp_processed = false`로 되돌린다.
5. **티어 표시:** 초기화 후 RP에 맞는 티어 이름·색이 나오는지. ALS `rank_name`은 반영이 늦을 수 있다.

---

## 7. 경계를 잘못 넣었거나 늦게 넣었을 때

재배정 RPC가 없으므로 수동으로 처리한다. 지난번 사례인 `supabase/manual/fix_seasons_from_game_data.sql`을 템플릿으로 쓴다.

1. 바꿀 행을 `backup` 스키마에 백업한다 (`seasons`, 옮길 `matches`의 `id, season_id, start_time`, 관련 `player_season_stats`).
2. `seasons` 경계를 수정하고 `version`을 +1 한다.
3. `matches.season_id`를 `start_time` 범위로 다시 배정한다. 시즌 없이 저장된 매치도 같은 방식으로 채운다.
4. `player_season_stats`의 버킷 사이에서 `payload.matches`를 옮긴다. `matchId`로 중복을 없애고, `startTime` 내림차순으로 정렬하고, `match_count`를 다시 센다.
5. §6의 1·2로 검증한다.

`begin; … commit;`으로 감싸서 SQL 편집기에서 검토한 뒤 실행한다. 자동 적용하지 않는다.

---

## 8. 나중에 줄일 수 있는 수작업

- `reassign_match_seasons` / `recompute_player_season_stats` RPC를 구현하면 §7이 RPC 호출 두 번으로 끝난다 (ARCHITECTURE §8.3).
- `game_data.py` 출력(`seasons.json`)으로 `seasons` upsert SQL을 자동 생성하면 §3·§4를 합칠 수 있다.
- 데스크톱 `window.SEASONS`를 주기적으로 다시 불러오면 재시작 없이 반영된다.
