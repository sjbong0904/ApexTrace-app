# Supabase DB 최적화 계획

테이블 구조·인덱스·쓰기 경로를 실측 기반으로 점검하고, 단계별 개선안을 정리한 설계 문서.

**상태:** 계획 (미구현). 이 문서의 SQL·코드 변경은 아직 어디에도 적용되지 않았다.
**측정일:** 2026-11-14 (프로덕션 프로젝트 `ureuzkxyyozzzluzawwr`, Postgres 17)
**관련:** [ARCHITECTURE.md](./ARCHITECTURE.md) (매치 V3) · [NICKNAME-SEARCH.md](./NICKNAME-SEARCH.md) (검색·keep-alive)
**코드:** `trace-proxy-server/lib/playerStats.js`, `lib/matchHistory.js`, `lib/profiles.js`, `lib/nameAliases.js`, `api/history.js`, `api/player-stats.js`, `api/address-book.js`, `api/keep-alive.js`, `src/utils/statsAggregation.ts`, `src/components/MapVisualizer.tsx`

---

## 0. 요약

| 우선 | 단계 | 내용 | 효과 | 위험 |
|------|------|------|------|------|
| ★★★ | [Phase 0](#2-phase-0--스키마-기준선-정리) | 원격 ↔ 로컬 마이그레이션 동기화, 죽은 pg_cron 제거 | 이후 모든 변경의 전제 | 낮음 |
| ★★★ | [Phase 1](#3-phase-1--global_profiles-인덱스정규화) | `global_profiles` 인덱스 (`linked_uid`, `name_norm`, refresh 순서) | 상위 DB 시간 쿼리 대부분이 seq scan → index scan | 낮음 |
| ★★☆ | [Phase 2](#4-phase-2--player_season_stats-제거) | `player_season_stats` 제거, `matches` 직접 조회 | 매치 저장당 JSON 2개 RMW 제거, lost update 제거, 중복 저장 제거 | 중간 (프록시 변경) |
| ★★☆ | [Phase 3](#5-phase-3--matches-저장-형식) | `matches` 값 정규화, 미사용 인덱스 제거, path 압축 포맷 | 쓰기 비용·egress 감소, 통계 정확도 | 중간 (클라 디코더) |
| ★☆☆ | [Phase 4](#6-phase-4--소규모-정리) | advisor 경고, 소형 테이블 인덱스, TTL 작업 이전 | 위생 | 낮음 |

**하지 않을 것:** 파티셔닝, 별도 DB/웨어하우스, detail 컬럼 즉시 분리 → [§8](#8-검토했지만-채택하지-않은-안).

---

## 1. 현황 측정

### 1.1 테이블

| 테이블 | 행 | 총 크기 | 비고 |
|--------|-----|---------|------|
| `global_profiles` | 67,880 | 15 MB | 매치 있는 uid는 **7**개. 나머지는 GEP 로스터로 학습한 "본 적 있는 플레이어" |
| `matches` | 1,513 | 13 MB | heap 3.7 MB, TOAST 8.7 MB, 인덱스 0.8 MB. 유저 7명 |
| `player_season_stats` | 37 | 1.4 MB | payload 평균 22 KB, 최대 134 KB. 누적 update 2,960회 |
| `languages` | 10 | 472 KB | `strings` JSONB |
| `profile_name_aliases` | 306 | 368 KB | |
| `weapons` / `daily_rank_snapshots` / `seasons` / `game_constants` / `admin_users` | ≤ 175 | < 120 KB | 문제 없음 |

### 1.2 `matches` 컬럼별 비중

| 컬럼 | 원문 JSON | 저장 (pglz TOAST 후) | 사용처 |
|------|-----------|----------------------|--------|
| `path` | 25 MB | **3.6 MB** | 펼침 시 맵 경로 (`MapVisualizer`, 이동거리) |
| `events` | 1.5 MB | 638 kB | Combat Log, weaponThreats 계산 |
| `weapon_timeline` | — | 436 kB | 펼침 |
| `weapon_combat` | 593 kB | 430 kB | summary (Weapons 탭) |
| `team_stats` | — | 300 kB | summary (Teammates) |
| 나머지 스칼라 + 소형 JSONB | — | 행당 ≈ 3.7 KB | summary |

- path: 매치당 평균 266점, 최대 1,909점. 샘플 간격 중앙값 **2,000 ms**. 점 하나 = `{p, s, t, x, y}`
  - `p`(phase) 값 분포: `landed` 86%, `unknown` 9%, `freefly`·`aircraft` 등 나머지. 같은 값이 연속으로 반복된다.
  - `s`: 92%가 `0`.
- pglz가 이미 약 **7배** 압축 중이라 DB 저장 공간 관점에서 path는 생각보다 작다. 압축 전 25 MB가 문제가 되는 곳은 **응답 egress와 클라 JSON 파싱**이다.
- 행당 summary ≈ 3.7 KB + detail ≈ 3.2 KB (저장 기준). 인덱스 포함 약 **9 KB/판**.

### 1.3 DB 시간 상위 쿼리 (`pg_stat_statements`, 2025-12-26 이후 누적)

| 호출 | 평균 | 쿼리 | 원인 |
|------|------|------|------|
| 9,635 | **187 ms** | `global_profiles WHERE name ILIKE $1 ORDER BY rank_score` | btree(`name`)가 ILIKE에 안 쓰임 → seq scan |
| 17,674 | 42 ms | `global_profiles ORDER BY updated_at ASC LIMIT` (keep-alive) | `updated_at` 인덱스 없음 → 전체 정렬 |
| 31,060 + 8,792 + 7,041 | 13–38 ms | `global_profiles WHERE uid = $1 OR linked_uid = $2` (`resolveRelatedUids`, address-book GET) | `linked_uid` 인덱스 없음 → seq scan (EXPLAIN: 67,879행 버림, 16 ms) |
| 4,514 | 53 ms | `global_profiles` upsert (address-book) | 정상 범위 |
| 2,164 | 19 ms | `player_season_stats` upsert | 페이로드 전체 재작성 |

`match_archives` 쿼리도 상위에 있으나 테이블은 이미 삭제됨 (과거 누적치).

### 1.4 인덱스 사용량

| 인덱스 | idx_scan | 판단 |
|--------|----------|------|
| `matches_uid_mode_start_time_desc_idx` | 0 | 삭제 |
| `matches_uid_map_start_time_desc_idx` | 0 | 삭제 |
| `matches_uid_legend_start_time_desc_idx` | 253 | 유지 (사용처 재확인 후 판단) |
| `matches_uid_start_time_desc_idx` / `..._season_id_...` / `pkey` | 2,882 / 1,247 / 5,189 | 유지 |
| `languages_active_idx`, `seasons_start_time_idx`, `weapons_active_category_idx` | 0 | 삭제 (행 수 < 40, seq scan이 더 쌈) |
| `idx_global_profiles_name` | 445 | `name_norm` 인덱스로 교체 ([§3.2](#32-닉네임-exact-검색-name_norm)) |

### 1.5 advisor

- Performance: FK 인덱스 없음 2건 (`matches.season_id`, `player_season_stats.season_id`), 미사용 인덱스 5건
- Security: `set_matches_updated_at`의 `search_path`가 고정 안 됨, `pg_net`이 `public` 스키마에 있음, Auth 유출 비밀번호 차단 꺼짐, `admin_users`는 RLS만 있고 정책 없음 (의도된 상태: service role 전용)

### 1.6 그 외 발견

- **pg_cron `invoke-keep-alive-5min`이 죽어 있음.** `https://apex-trace.vercel.app/api/keep-alive`를 5분마다 호출하지만 응답은 전부 **404**. 실제 keep-alive는 Vercel cron(하루 1회, `trace-proxy-server`)뿐이다.
- `global_profiles.platform`과 `hw`가 같은 정보를 중복 저장한다. `hw` 7 = `Steam`, 2 = `Origin`, 1 = `PlayStation`, 9 = `Switch`이고, 매핑이 없는 hw(8, 10, 11)는 `platform`에 `hw_8` 같은 값이 들어간다. `hw`는 text 타입.
- `global_profiles` 46,502행(68%)은 90일 넘게 갱신되지 않았다.
- `matches.rp_processed = true`인 행이 **0**개. RP 확정 파이프라인이 동작하지 않거나 컬럼이 사실상 미사용 ([§5.4](#54-rp_change--rp_processed-점검)).
- `matches.mode` / `map` 표기가 섞여 있다: `BR` / `Battle Royale`, `Kings Canyon` / `King Canyon`, `UNKNOWN` / `Unknown`.
- `matchFromRow()`는 summary에서 `row.weapon_threats`를 읽지만 **그런 컬럼은 없다**. 그래서 summary의 weaponThreats는 `player_season_stats` payload 안에만 존재한다. Phase 2의 전제 조건.
- `resolveRelatedUids()`와 address-book GET이 `.or(\`uid.eq.${uid},linked_uid.eq.${uid}\`)`처럼 **입력을 PostgREST 필터 문자열에 그대로 보간**한다. `,`나 `)`가 들어간 uid로 필터를 조작할 수 있다 (service role 키로 실행되므로 RLS 보호도 없음).

---

## 2. Phase 0 — 스키마 기준선 정리

다른 모든 Phase의 전제. 지금 원격과 로컬 마이그레이션 이력이 다르다.

| 구분 | 내용 |
|------|------|
| 원격에만 있음 | `seed_language_pack_function` 외 language seed 관련 4건, `matches_add_player_name_missing_signals`, `matches_drop_legacy_match_and_schema_version` |
| 생성 마이그레이션 자체가 없음 | `global_profiles`, `game_constants` (대시보드에서 직접 생성) |
| 버전 번호 불일치 | 로컬 파일 타임스탬프와 원격 `version`이 전부 다름 (예: 로컬 `20260624055100` / 원격 `20260624055216`) |

**작업:**

1. `supabase db pull`(또는 `supabase db dump --schema public`)로 현재 원격 스키마를 받아 `supabase/migrations/<ts>_baseline.sql` 하나로 고정.
2. 기존 로컬 마이그레이션은 `supabase/migrations/_archive/`로 옮기거나 `supabase migration repair`로 원격 이력과 버전을 맞춘다. 둘 중 하나로 통일하고, 이후 원격 적용은 **반드시 로컬 파일 → `db push`** 순서로.
3. 죽은 pg_cron 제거: `select cron.unschedule('invoke-keep-alive-5min');`
   - 제거하면 `pg_net`을 쓰는 곳이 없어지므로, 확장을 지워도 되는지 같이 판단 ([§6](#6-phase-4--소규모-정리)).
4. 프로덕션에 적용하기 전 Supabase branch(또는 로컬 `supabase start`)에서 마이그레이션 리허설.

**완료 기준:** `supabase db diff`가 비어 있음.

---

## 3. Phase 1 — `global_profiles` 인덱스·정규화

DB 시간을 가장 많이 쓰는 테이블. 마이그레이션 + 프록시 쿼리 소폭 수정만으로 끝난다.

### 3.1 연동 uid 조회 (`linked_uid`)

```sql
create index concurrently if not exists global_profiles_linked_uid_idx
  on public.global_profiles (linked_uid)
  where linked_uid is not null;
```

- `uid = X OR linked_uid = X`는 Postgres가 `pkey`와 이 인덱스를 BitmapOr로 결합해서 처리한다. 16 ms → 1 ms 미만 예상.
- 프록시 `resolveRelatedUids()` 수정:
  - 입력 검증: `/^\d{1,25}$/` 같은 숫자 패턴이 아니면 400 응답 (§1.6 필터 보간 문제 해결).
  - 가능하면 `.or()` 문자열 대신 두 번 조회하거나(`eq('uid')` → 없으면 `eq('linked_uid')`), 아래 RPC 하나로 대체:

```sql
create or replace function public.resolve_related_uids(p_uid text)
returns table (main_uid text, linked_uid text, role text)
language sql stable security invoker set search_path = ''
as $$
  select g.uid, g.linked_uid, g.role
  from public.global_profiles g
  where g.uid = p_uid or g.linked_uid = p_uid
  limit 1;
$$;
```

- `resolveRelatedUids()`는 `/history`, `/player-stats` 등 **모든 요청마다** 호출된다. 함수 인스턴스 메모리에 60초 TTL 캐시를 두면 호출 수 자체도 줄일 수 있다 (`lib/seasons.js`와 같은 패턴).

### 3.2 닉네임 exact 검색 (`name_norm`)

검색 규칙은 "대소문자 무시 exact"이다 ([NICKNAME-SEARCH §3](./NICKNAME-SEARCH.md)). 지금은 이를 `ILIKE '<escape된 원문>'`으로 구현해서 인덱스를 못 탄다.

```sql
alter table public.global_profiles
  add column name_norm text generated always as (lower(btrim(name))) stored;

create index concurrently global_profiles_name_norm_rank_idx
  on public.global_profiles (name_norm, rank_score desc);

drop index if exists public.idx_global_profiles_name;
```

- `profile_name_aliases.name_norm`과 같은 정규화 규칙(`trim` + `lower`)이다. JS `normalizeName()`은 `String.trim()`(유니코드 공백 포함)이고 SQL `btrim`은 기본적으로 ASCII 공백만 지우므로, 프록시에서도 **입력은 SQL과 같은 규칙으로 정규화**하거나 테스트로 동치성을 확인한다.
- `(name_norm, rank_score desc)` 복합 인덱스 하나로 `WHERE name_norm = $1 ORDER BY rank_score DESC LIMIT 30`을 정렬 없이 처리한다.
- 프록시 변경: `findProfilesByExactName()`과 address-book 폴백의 `.ilike('name', escapeIlikeExact(raw))`를 `.eq('name_norm', normalizeName(raw))`로 교체. `escapeIlikeExact`는 삭제.
- 187 ms → 1 ms 미만 예상. generated column 추가는 테이블 재작성이 필요하지만 15 MB라 수 초면 끝난다.

### 3.3 keep-alive 갱신 순서 (`als_synced_at`)

현재 keep-alive는 `ORDER BY updated_at ASC LIMIT 12`로 대상을 고른다. 문제는 세 가지다.

1. 인덱스가 없어서 매번 67,880행을 정렬한다.
2. `updated_at`은 GEP 로스터 upsert(address-book)도 갱신하므로, "ALS로 마지막 확인한 시각"을 뜻하지 않는다.
3. 대상이 "본 적 있는 플레이어" 전체(67,880명)라서, 하루 12명 예산이 실제 유저(매치 보유 7명)나 검색된 프로필에 거의 돌아가지 않는다.

```sql
alter table public.global_profiles
  add column als_synced_at timestamptz,
  add column refresh_priority smallint not null default 0;  -- 0: 로스터만, 1: 검색/조회됨, 2: 앱 사용자

create index concurrently global_profiles_refresh_idx
  on public.global_profiles (refresh_priority desc, als_synced_at asc nulls first);
```

- keep-alive: `order by refresh_priority desc, als_synced_at asc nulls first limit 12`, ALS 호출 후 `als_synced_at = now()` 저장.
- 우선순위 승격 시점:
  - `/history` POST를 보낸 uid → 2
  - `/apex-stats`·검색으로 조회된 uid → `greatest(현재값, 1)`
- 승격 작업은 이미 해당 행을 쓰는 경로에서 같이 처리하므로 추가 왕복이 없다.
- `ALS bridge` 호출에 `platform=PC`가 하드코딩되어 있다. hw/platform 정리 후 실제 플랫폼을 넘기도록 같이 수정한다.

### 3.4 `platform` / `hw` 정규화

| 현재 | 제안 |
|------|------|
| `hw text` (`'7'`, `'2'`, …, null 77행) | `hw smallint` (null 허용) |
| `platform text` (`Steam`, `Origin`, `hw_8`, `PC`, …) | **제거**. 표시 라벨은 클라이언트가 `hw`로 매핑. 단 `PC`/`Xbox` 81행처럼 hw 없이 platform만 있는 행은 매핑 전에 hw를 채운다 |

- 클라이언트·프록시에서 `platform`을 읽는 곳(검색 결과 표시, address-book 비교 필드)을 먼저 `hw` 기반으로 바꾸고, 한 릴리즈 동안 두 컬럼을 같이 쓴 뒤 drop.
- 우선순위 낮음. 저장 공간 이득은 행당 수 바이트이고, 핵심은 `hw_8` 같은 값이 UI에 노출되지 않게 하는 정합성이다.

### 3.5 오래된 프로필 정책 (선택)

- 46,502행(68%)이 90일 넘게 갱신되지 않았다. 행당 약 135 B라 지금은 비용이 거의 없다(총 15 MB).
- 지금은 **보존**. 다만 `refresh_priority = 0`이면서 1년 넘게 관측되지 않은 행은 나중에 정리할 수 있게 `last_seen_at`(GEP 로스터 관측 시각)을 남겨 둔다. 현재 `updated_at`이 사실상 이 역할이고, §3.3 이후 의미가 분리된다.

---

## 4. Phase 2 — `player_season_stats` 제거

### 4.1 현재 구조의 문제

`player_season_stats.payload.matches`는 집계값이 아니라 **`matches` summary 행을 camelCase JSON으로 복사한 배열**이다 (시즌·모드당 최대 2,000판).

| 문제 | 내용 |
|------|------|
| 쓰기 증폭 | `POST /history` 1회마다 `ALL` + 모드 버킷, **2개 행**을 select → JS에서 배열 정렬·삽입 → JSONB 전체 upsert. 2,000판이 차면 행당 약 3 MB라 매치 1판 저장에 약 6 MB를 다시 쓴다 (TOAST 재작성 + WAL) |
| lost update | 읽기와 쓰기 사이에 잠금이 없다. 같은 uid의 POST 두 개가 겹치면(재전송, 연동 계정) 한쪽 매치가 payload에서 사라진다 |
| 원본 불일치 | `matches`의 `rp_change`, `deaths`, 관리자 콘솔 수정, 매치 삭제가 payload에 반영되지 않는다. 시즌 경계가 바뀌면 전체 recompute가 필요하다 |
| 읽기 경로에서 쓰기 | `fetchPlayerSeasonStats()`가 weaponThreats가 비어 있으면 events를 읽어 계산한 뒤 **GET 중에** payload 전체를 다시 upsert한다 |
| 불필요한 키 | 항목마다 `path: []`, `events: []`, `ringRounds: []`, `weaponTimeline: []`, `_detailLoaded`, `platformId`가 들어간다 |

### 4.2 목표 구조

payload를 저장하지 않고, `/player-stats`가 매번 `matches`에서 summary 컬럼을 읽는다. **응답 shape(`{ payload: { matches } }`)는 유지**해서 클라이언트(`StatisticsTab`, `statsAggregation`) 변경은 없다.

#### 4.2.1 `matches` 컬럼 추가

```sql
-- summary에 필요한데 events에서 매번 계산하던 값
alter table public.matches
  add column weapon_threats jsonb;

-- 통계 모드 버킷. matchModes.js getStatisticsModeBuckets()와 같은 규칙
alter table public.matches
  add column stats_mode text generated always as (
    case
      when lower(mode) like '%ranked%' then 'RANKED'
      when lower(mode) like '%trio%'   then 'TRIO'
      when lower(mode) like '%duo%'    then 'DUO'
      when upper(btrim(mode)) = 'BR'   then 'OTHER'
      else null                        -- 통계 미지원 모드 (Control, Wildcard, Unknown …)
    end
  ) stored;

create index concurrently matches_uid_season_stats_mode_idx
  on public.matches (uid, season_id, stats_mode, start_time desc)
  where stats_mode is not null;
```

- `stats_mode is not null`이 `isSupportedMode()`에 해당하고, `ALL` = 해당 시즌의 not null 전체다.
- §5.2에서 `mode` 값을 정규화하면 이 식도 단순해진다. 정규화를 먼저 하면 generated column 대신 `mode` 자체를 쓸 수도 있다.
- 기존 `matches_uid_season_id_start_time_desc_idx`는 이 인덱스가 대체하므로 사용량을 확인한 뒤 삭제한다 (`/history`가 season 필터를 쓰지 않는다면).

#### 4.2.2 쓰기 경로

`POST /history`:

1. `rowFromMatch()`가 `weapon_threats`도 채운다. 계산은 기존 `computeMatchWeaponThreats()`를 그대로 쓰고, 클라이언트가 보낸 `match.weaponThreats`가 있으면 그것을 우선한다 (현행 로직과 동일).
2. `matches` upsert **1회로 끝**. `incrementPlayerSeasonStatsForMatch()` 호출 삭제.

#### 4.2.3 읽기 경로

`GET /player-stats?uid&season_id&mode`:

```js
let q = supabase
  .from('matches')
  .select(`${SUMMARY_SELECT}, weapon_threats`)
  .eq('uid', mainUid)
  .eq('season_id', seasonId)
  .not('stats_mode', 'is', null)
  .order('start_time', { ascending: false })
  .limit(MAX_STORED_MATCHES);   // 2000
if (mode !== 'ALL') q = q.eq('stats_mode', mode);
```

- `matchFromRow(row, { includeDetail: false })`로 변환한 뒤 `{ uid, season_id, mode, match_count, updated_at, payload: { matches } }`로 응답한다.
- `matchFromRow()`의 summary 분기에서 `path`, `events`, `ringRounds`, `weaponTimeline`, `_detailLoaded` 키를 **아예 내보내지 않도록** 바꾼다. 응답이 매치당 약 100 B 줄어든다.
  - 클라이언트 `matchNormalizer`가 빈 배열로 기본값을 채우는지 먼저 확인한다 (`toArray(source.path)`이므로 문제없을 것으로 보임).
- `match_count`: 2,000판 상한을 넘는 경우를 위해 `select('match_id', { count: 'exact', head: true })`를 따로 날리거나, 그냥 반환된 길이를 쓴다. 현재 시즌·uid당 최대가 498판이므로 후자로 충분하다.
- 캐시: 지금은 `no-store`. 방금 플레이한 매치가 바로 보여야 하므로 `s-maxage=15, stale-while-revalidate=60` 정도가 적당하다. 클라이언트는 이미 로컬 live 매치를 병합한다 ([ARCHITECTURE §흐름](./ARCHITECTURE.md)).
- 성능: 인덱스 범위 스캔 + 행당 약 3.7 KB(TOAST 해제 포함). 2,000판이면 약 7 MB를 읽고 응답 JSON은 약 2.6 MB다. **지금 payload 1행을 읽는 것과 응답 크기는 같고**, DB 측 읽기는 조금 늘지만 쓰기 증폭이 없어진다. 498판(현재 최대) 기준 수십 ms 예상 → 롤아웃 전 EXPLAIN ANALYZE로 확인.

#### 4.2.4 더 줄이고 싶다면 (선택, 지금은 불필요)

클라이언트 집계에 필요한 필드만 SQL에서 뽑는 RPC를 두는 방법도 있다.

- `get_player_season_matches(p_uid, p_season_id, p_mode)` → `jsonb_agg(jsonb_build_object('matchId', …))`
- 이 경우 `matchFromRow`를 SQL로 다시 구현해야 하므로 두 군데를 유지보수해야 한다. 응답이 1 MB를 넘는 유저가 많아질 때 검토한다.
- 진짜 사전집계(레전드·맵·무기별 합계 테이블)는 클라이언트가 매치 배열로 Overview 스파크라인·Teammates 등을 계산하는 현 구조와 맞지 않는다. 채택하지 않는다.

### 4.3 롤아웃

1. 마이그레이션: `weapon_threats`, `stats_mode`, 인덱스 추가.
2. 백필 스크립트(`scripts/backfill-weapon-threats.ts`): `weapon_threats is null`인 행을 uid별로 읽어 `computeMatchWeaponThreats({ playerName, events })` 결과를 update. 1,513행이라 한 번에 끝난다. `player_season_stats` payload에 이미 계산된 값이 있으면 그것을 우선 사용해도 된다.
3. 프록시 배포 A: 쓰기는 `matches.weapon_threats` + 기존 `player_season_stats` **둘 다**(dual write). 읽기는 기존 그대로. 동시에 `?source=matches` 쿼리로 새 경로를 열어 두고, 샘플 유저로 두 응답의 matchId 집합·weaponThreats·matchCount를 비교한다.
4. 프록시 배포 B: 읽기를 새 경로로 전환하고 `incrementPlayerSeasonStats*`, `backfillMissingWeaponThreats`, `recomputePlayerSeasonStatsFromMatches`를 삭제.
5. 1–2주 관찰 후 `drop table public.player_season_stats;` (FK advisor 경고 1건도 같이 사라짐).
6. [ARCHITECTURE.md](./ARCHITECTURE.md) §3.3·§9 갱신: Tier 3는 "저장된 payload"가 아니라 "matches summary 조회"로.

---

## 5. Phase 3 — `matches` 저장 형식

### 5.1 미사용 인덱스 제거

```sql
drop index concurrently if exists public.matches_uid_mode_start_time_desc_idx;
drop index concurrently if exists public.matches_uid_map_start_time_desc_idx;
```

- 인덱스당 약 150 KB이고, 매치 insert/update마다 유지 비용이 든다. 맵·모드 필터는 클라이언트 집계라 서버에서 쓰지 않는다.
- `matches_uid_legend_start_time_desc_idx`(253회 사용)는 어디서 쓰는지 프록시·관리자 콘솔에서 찾아 본 뒤 결정한다.
- `season_id` FK 인덱스 advisor 경고는 무시한다. `seasons` 행을 지울 일이 거의 없고, 지운다면 그때 seq scan 1회면 된다.

### 5.2 `mode` / `map` 값 정규화

| 컬럼 | 현재 값 | 정규화 |
|------|---------|--------|
| `mode` | `Ranked` 1,456 · `Trio` 30 · `BR` 18 · `Battle Royale` 1 · `Control` 3 · `Unknown` 4 · `Wildcard` 1 | 쓰기 시 표준 키로 통일 (`Ranked`, `Trio`, `Duo`, `BR`, `Control`, …). `Battle Royale` → `BR` |
| `map` | `King Canyon` 1 · `Kings Canyon` 14 · `UNKNOWN` 1 | `Kings Canyon`, `Unknown`으로 통일 |

- 프록시 `rowFromMatch()`에 매핑 테이블을 두고, 기존 행은 일회성 update로 고친다.
- enum이나 FK 테이블까지는 만들지 않는다. GEP가 새 모드·맵 문자열을 내보낼 때 쓰기가 실패하면 안 되기 때문이다. 대신 관리자 콘솔에서 `select mode, count(*) … group by 1`로 모니터링한다.
- 클라이언트 `matchMode.ts`의 `includes()` 기반 판정과 결과가 같아야 한다.

### 5.3 `path` 압축 포맷 (v2)

**목적:** DB 저장 공간보다 **egress와 파싱 비용**. 저장 측은 pglz가 이미 7배 압축 중이다.

현재 (점 하나 약 60 B 원문):

```json
[{"p":"aircraft","s":0,"t":1788701655450,"x":424,"y":-135}, …]
```

제안:

```json
{
  "v": 2,
  "t0": 1788701655450,
  "dt": [0, 2000, 2000, 1998, …],
  "x":  [424, 431, …],
  "y":  [-135, -140, …],
  "p":  [[0, "aircraft"], [41, "freefly"], [63, "landed"]],
  "s":  [[120, 1], [131, 0]]
}
```

- `p`와 `s`는 값이 바뀌는 지점만 `[시작 인덱스, 값]`으로 기록한다 (run-length).
- 예상 원문 크기: 점당 약 12–15 B, 266점이면 약 4 KB (현재 약 17 KB). 응답 원문 기준 **약 4배** 감소.
- 측정 메모: 같은 데이터를 Postgres `int[]` 컬럼 3개로 바꾸면 TOAST 압축이 덜 먹어서 오히려 4.8 MB로 **커졌다**. 그래서 별도 배열 컬럼이 아니라 JSONB 안의 압축 포맷으로 간다.
- 호환:
  - 클라이언트 `matchNormalizer`에 `decodePath(raw)`를 추가한다. 배열이면 v1, `{ v: 2 }`이면 v2로 판단해 기존 `{p,s,t,x,y}[]`로 펼친다. `MapVisualizer`와 이동거리 계산 코드는 변경 없음.
  - 쓰기: 클라이언트 배포가 충분히 퍼진 뒤 프록시 `rowFromMatch()`에서 인코딩한다. 그전에는 v1 저장을 유지한다.
  - 기존 행 백필은 선택. 1,513행이면 한 번에 가능하다.
- 같은 원리를 `weapon_timeline`(같은 키 반복)에도 적용할 수 있지만, 크기(436 kB)를 보면 지금은 불필요하다.

### 5.4 `rp_change` / `rp_processed` 점검

- 1,513행 중 `rp_processed = true` **0**, `rp_change` 값 있음 **3**, `rank_score` 값 있음 **0**.
- 확인할 것: 매치 후 랭크 업데이트로 RP 차이를 확정하는 경로(`daily_rank_snapshots`와 연결되어 있을 것으로 추정)가 실제로 `matches`를 update하는지.
  - 동작하지 않으면 → 고칠지, 컬럼 2개를 지울지 결정한다.
  - `rank_score`(매치 후 RP)도 한 번도 채워지지 않았다. 세 컬럼 모두 dead column 후보다.

### 5.5 TOAST 압축 방식 (선택)

```sql
alter table public.matches alter column path   set compression lz4;
alter table public.matches alter column events set compression lz4;
```

- lz4는 pglz보다 압축률이 약간 낮을 수 있지만 압축 해제가 몇 배 빠르다. detail 조회와 백필 CPU에 유리하다.
- 이후 새로 쓰는 값부터 적용된다. 효과가 작으므로 §5.3을 한 뒤 측정하고 결정한다.

### 5.6 detail 컬럼 분리 — 보류, 트리거 조건만 정의

`path`/`events`/`weapon_timeline`/`ring_rounds`를 `match_details` 테이블이나 Supabase Storage(gzip JSON 객체)로 옮기는 안.

- **지금 보류하는 이유:** 큰 JSONB는 이미 TOAST로 행 밖에 저장되어 있어서, summary SELECT(컬럼을 지정한 조회)는 이 데이터를 읽지 않는다. 분리해도 읽기 이득이 거의 없고, 쓰기는 2단계가 되어 복잡해진다.
- **재검토 트리거** (하나라도 해당하면):
  - `matches` 총 크기 > DB 한도의 30% (Pro 8 GB 기준 약 2.4 GB)
  - detail egress가 Supabase egress 비용의 상당 부분을 차지
  - 백업/복원 시간이 운영에 영향
- 그때의 1안: Storage `match-details/{uid}/{match_id}.json.gz` + `matches.detail_ref`. 매치는 불변이라 Storage·CDN 캐시와 잘 맞는다.

---

## 6. Phase 4 — 소규모 정리

| 항목 | 작업 |
|------|------|
| 소형 테이블 미사용 인덱스 | `languages_active_idx`, `seasons_start_time_idx`, `weapons_active_category_idx` drop |
| `set_matches_updated_at` | `alter function public.set_matches_updated_at() set search_path = '';` (본문은 `now()`만 써서 영향 없음) |
| `pg_net` in public | Phase 0에서 pg_cron 제거 후 사용처가 없으면 `drop extension pg_net;`. 나중에 필요해지면 `extensions` 스키마에 재설치 |
| 유출 비밀번호 차단 | Auth 설정에서 켜기 (관리자 콘솔 로그인용). 대시보드 작업 |
| `admin_users` RLS 정책 없음 | 의도된 상태 (service role만 접근). 테이블 comment에 의도를 명시해서 advisor 경고를 기록으로 남김 |
| alias TTL purge | keep-alive(하루 1회)에 붙어 있다. `pg_cron`에서 `delete from profile_name_aliases where seen_at < now() - interval '30 days'`를 매일 실행하도록 옮기면 Vercel 함수 시간과 분리된다 |
| `matches.updated_at` 트리거 | 유지. 관리자 수정 추적에 쓰임 |
| `global_profiles` 테이블 grant | 2026-10-20 마이그레이션으로 정리됨. baseline에 포함되는지 Phase 0에서 확인 |

---

## 7. 용량 전망

| 가정 | 값 |
|------|-----|
| 매치당 저장 (인덱스 포함) | 약 9 KB (현재). Phase 2 후 `player_season_stats` 중복분(약 1.6 KB/판 × 버킷 2개) 제거 |
| 유저당 월 매치 | 100–300판 (현재 상위 유저 시즌당 약 500판) |

| DB 한도 | 매치 수용량 (약) | 활성 유저 (월 200판, 1년 보존) |
|---------|------------------|-------------------------------|
| Free 500 MB | 약 5만 판 | 약 20명 |
| Pro 8 GB | 약 90만 판 | 약 370명 |

- Phase 2 전에는 `player_season_stats`가 매치 1판당 약 3.2 KB를 더 쓰고, dead tuple까지 쌓여 실효 용량이 약 30% 줄어든다.
- path v2는 DB 용량에는 거의 영향이 없고 egress를 약 4배 줄인다.
- 런칭 후 활성 유저가 수백 명을 넘으면 §5.6 트리거를 다시 측정한다.

---

## 8. 검토했지만 채택하지 않은 안

| 안 | 이유 |
|----|------|
| `matches` 파티셔닝 (uid 해시 / 시즌 범위) | 1,513행. 수백만 행 전까지 이득보다 운영 복잡도가 크다. `(uid, …)` 선두 인덱스로 충분 |
| path를 `int[]` 컬럼으로 | 실측 결과 pglz로 압축한 JSONB보다 저장 크기가 큼 (4.8 MB vs 3.6 MB) |
| 사전집계 숫자 테이블 (레전드·맵·무기별 합계) | 클라이언트가 매치 배열로 계산하는 지표(스파크라인, 팀원 조합, 무기 qualify)를 다 담기 어렵고, 집계 로직이 SQL·TS 두 곳에 생긴다 |
| `player_season_stats` 유지 + 원자적 SQL 함수로 append | lost update는 해결되지만 쓰기 증폭·중복·불일치는 그대로다 |
| `global_profiles` 오래된 행 삭제 | 15 MB로 저렴하고, 검색·로스터 이름 해석에 쓰인다. 정책만 정의해 둔다 (§3.5) |
| `pg_trgm` 부분 문자열 검색 | 제품 규칙이 exact only. 필요해지면 `name_norm`에 GIN trigram 인덱스를 추가하면 된다 |

---

## 9. 실행 체크리스트

### Phase 0
- [ ] 원격 스키마 덤프 → baseline 마이그레이션
- [ ] 로컬 마이그레이션 이력 정리 (`migration repair` 또는 archive)
- [ ] `supabase db diff` 비어 있음 확인
- [ ] `cron.unschedule('invoke-keep-alive-5min')`

### Phase 1
- [ ] `global_profiles_linked_uid_idx`
- [ ] `resolveRelatedUids` / address-book GET 입력 검증 + `.or()` 보간 제거 (+ 60초 캐시)
- [ ] `name_norm` generated column + `(name_norm, rank_score desc)` 인덱스, `idx_global_profiles_name` drop
- [ ] `findProfilesByExactName`·address-book 폴백을 `eq('name_norm')`으로
- [x] `als_synced_at` + 인덱스, keep-alive 정렬 변경 (`20261117090000_global_profiles_als_synced_at.sql`) — `/apex-stats` uid DB 캐시(10분)도 이 컬럼 기준
- [ ] `refresh_priority` + 우선순위 승격 쓰기
- [ ] 배포 후 `pg_stat_statements` 재측정 (seq_scan 증가 멈춤 확인)
- [ ] (후순위) `hw smallint` 전환, `platform` 제거

### Phase 2
- [ ] `weapon_threats`, `stats_mode`, `matches_uid_season_stats_mode_idx`
- [ ] weaponThreats 백필 스크립트
- [ ] 프록시 dual write + `?source=matches` 비교
- [ ] 읽기 전환, increment/backfill/recompute 코드 삭제
- [ ] `matchFromRow` summary에서 빈 detail 키 제거
- [ ] `/player-stats` 짧은 edge 캐시
- [ ] `player_season_stats` drop, ARCHITECTURE.md 갱신

### Phase 3
- [ ] `matches_uid_mode_*`, `matches_uid_map_*` drop
- [ ] `legend` 인덱스 사용처 확인
- [ ] `mode`/`map` 정규화 (쓰기 매핑 + 기존 행 update)
- [ ] `rp_change`/`rp_processed` 파이프라인 확인 → 수정 또는 제거
- [ ] 클라 `decodePath` (v1/v2) 배포 → 프록시 v2 인코딩 → (선택) 백필
- [ ] (선택) lz4 전환 측정

### Phase 4
- [ ] 소형 테이블 인덱스 drop
- [ ] `set_matches_updated_at` search_path
- [ ] `pg_net` 제거 여부 결정
- [ ] Auth 유출 비밀번호 차단
- [ ] alias purge를 pg_cron으로
- [ ] advisor 재실행 → 남은 경고 기록
