# 닉네임 검색 · 이전닉(alias) · keep-alive

닉변 후에도 주소록 검색이 되도록 하는 설계·구현 메모.  
ALS(Apex Legends Status) 예산(현재 키 기준 약 10 req/s)을 검색 엔진처럼 쓰지 않는 것이 목표.

**상태:** Phase 1 shipped (스키마 · 프록시 프로덕션 · 클라이언트).  
**관련:** [LAUNCH.md §1](./LAUNCH.md#1-infra-vercel--supabase-pro) (Pro 후 cron) · [QA.md §닉네임](./QA.md#닉네임-검색-alias)  
**코드:** `trace-proxy-server/lib/nameAliases.js`, `api/search-candidates.js`, `api/address-book.js`, `api/apex-stats.js`, `api/keep-alive.js`, `public/background/main.js`, `src/components/PlayerSelectionModal.tsx`  
**마이그레이션:** `supabase/migrations/20260806090000_create_profile_name_aliases.sql` (원격 적용됨)

---

## 1. 문제

- `global_profiles.name`은 마지막으로 본 닉 스냅샷이다.
- 닉변 후 DB에 남은 옛 닉으로는 검색되고, 실제 현닉으로는 안 되는 경우가 있다.
- 검색마다 ALS를 치면 런칭 트래픽에서 리밋에 걸린다.

---

## 2. 데이터

| 역할 | 저장 | 한도 |
|------|------|------|
| 현닉 | `global_profiles.name` | UID당 1 |
| 이전닉 | `profile_name_aliases` | UID당 **최대 3** |
| 합계 | 현닉 + 이전 | **4** |

### `profile_name_aliases`

| 컬럼 | 설명 |
|------|------|
| `uid` | Origin/EA uid (`global_profiles.uid` FK, cascade delete) |
| `name_norm` | `trim` + `lower` — exact 검색 키 |
| `name_raw` | 표시·디버그용 원문 |
| `source` | `gep` \| `als` \| `keep-alive` \| `unknown` |
| `seen_at` | 마지막 관측 시각 (TTL·개수 상한에 사용) |

- PK: `(uid, name_norm)`
- TTL: `seen_at` 기준 **30일** (keep-alive 실행 시 purge)
- 현닉과 동일한 `name_norm`은 alias에 넣지 않음. 현닉으로 복귀 시 해당 alias 행 삭제.

---

## 3. 검색 플로우

**대소문자 무시, exact only** (starts-with / contains 없음).

```text
1) global_profiles.name  exact  +  profile_name_aliases.name_norm exact (항상 둘 다 조회)
   → 현닉 히트 먼저, 그 뒤 alias 히트 (중복 uid 제거, 각각 rank_score 순, 최대 30)
2) 둘 다 0건 → 클라이언트/프록시가 ALS player 검색
      → uid + name upsert (+ rename이면 alias)
3) DB 후보 2명+ → PlayerSelectionModal (ALS 스킵)
```

- `/search-candidates`가 1을 담당. 응답 행에 `matchType`: `"name"` | `"alias"`.
- 예전에는 현닉 히트가 1건이라도 있으면 alias를 건너뛰어, 다른 플레이어가 지금 그 닉을 쓰는 경우 닉변한 유저가 검색되지 않았다 (2026-11-14 실측 alias 306개 중 37개).
- alias 히트는 모달에 “Former name” 표시 (`playerModal.formerName`).
- ALS 닉 검색 성공 시 uid·name을 `global_profiles`에 넣는 동작은 기존 `/apex-stats`와 동일.

---

## 4. 쓰기 경로 (닉 변경 시)

공통 헬퍼: `syncNameAliases` / `syncAliasesForUpserts` (`lib/nameAliases.js`).

| 소스 | endpoint | `source` 값 |
|------|----------|-------------|
| GEP 로스터 | `POST /address-book` | `gep` |
| 명시 검색·프로필 | `/apex-stats` | `als` |
| 백그라운드 갱신 | `/keep-alive` | `keep-alive` |

GEP 로스터는 인원이 늘어날 때마다 전체 60명을 다시 보내지 않는다.

- 클라이언트(`SyncManager`): 세션 동안 보낸 UID fingerprint(name/hw/linked_uid/platform)와 같으면 스킵. 신규·변경분만 4초 debounce 후 전송, 매치 종료 시 flush. 프로필 로드도 값이 같으면 POST 생략.
- 서버(`api/address-book.js`): 기존 행과 comparable 필드가 같으면 upsert를 건너뛰어 `updated_at`만 갱신하는 no-op write를 막음. alias sync는 **닉이 바뀐 UID만**, 동시 5개.

전체 로스터를 한 번에 보내면 Vercel 10초 제한을 넘겨 504가 났음. 클라이언트는 그래도 20명 청크로 나눈다.

규칙:

0. 제어문자·U+FFFD가 섞인 닉(`isCorruptName`)은 현닉으로도 alias로도 저장하지 않는다. 구 클라이언트의 base64 이중 디코딩(`"HiRo"` → `"\x1e$h"`)이 만든 값이다. address-book은 해당 항목의 `name`만 버리고 나머지 필드는 반영한다. 기존 손상분 복구: `supabase/manual/repair_mangled_profile_names.sql`.
1. 들어오는 닉이 기존 현닉과 norm이 같으면 alias 작업 최소(현닉과 겹치는 alias만 제거).
2. 다르면 옛 현닉을 alias upsert, 현닉 갱신.
3. UID당 alias가 3 초과면 `seen_at`이 가장 오래된 것부터 삭제.
4. 같은 이전닉이 다시 보이면 `seen_at`만 갱신.

평소 현닉 학습의 주력은 **GEP 로스터**(ALS 0). ALS는 exact 0건 검색·keep-alive·명시 새로고침용.

---

## 5. keep-alive

### 5.1 목표 페이스 (출시 후에도 고정)

| 항목 | 값 |
|------|-----|
| 정렬 | `updated_at` 오래된 순 |
| 배치 | **매분** 1회 호출, 회당 **12명** |
| 간격 | 순차, **5초** |
| 처리량 | ≈ 0.2 req/s, ≈ 1.7만/일 |
| `maxDuration` | `api/keep-alive.js` **90초** |
| 부가 | 매 실행 시 30일 지난 alias purge |

ALS 한도가 올라도 이 페이스는 올리지 않는다. 순간 버스트 없이 순차만 사용.

### 5.2 현재 운영 (Hobby)

| 항목 | 값 |
|------|-----|
| Vercel cron | `0 0 * * *` (UTC 자정, **하루 1회**) — Hobby는 분 단위 cron 불가 |
| 회당 | 12명 · 5초 (코드 동일) |
| 실효 일일 | ≈ **12명/일** (목표 대비 보조 거의 없음) |

- 닉 검색 Phase 1(exact · alias · GEP · 검색 미스 ALS)은 그대로 동작한다.
- cron-job.org 등 외부 스케줄러는 타임아웃 상한(예: 30초)이 있어 12×5초 배치와 맞지 않음 → **당장 쓰지 않음**.
- **Vercel Pro 올린 뒤** `vercel.json` schedule을 `* * * * *`로 바꾸고 재배포하면 목표 페이스로 전환 ([LAUNCH §1.2](./LAUNCH.md#12-vercel--pro) 체크리스트).

---

## 6. Phase 2 (미구현 · 런칭 스케일 보험)

- 전역 ALS 게이트 (`alsClient`): 토큰 버킷 · singleflight · uid/player 공통 soft TTL
- keep-alive 목표 페이스(0.2/s)만으로는 Phase 1 한도 부담은 작음

---

## 7. 의도적 한계

- 로스터·검색·keep-alive에 한 번도 안 잡힌 완전 신규 닉 → ALS 필요
- 30일 지난 옛 닉 / 4번째 이전 닉 초과분 → DB exact로 안 찾음
- 동일 표시명 다중 UID → 후보 모달
- ALS `platform=PC` 제약은 별도

---

## 8. 운영 체크리스트

### 이미 된 것

- [x] Supabase `profile_name_aliases` 마이그레이션
- [x] `trace-proxy-server` 프로덕션 배포 (alias · exact search · keep-alive 코드)
- [x] 앱 쪽 `matchType` / Former name UI (로컬 빌드; Overwolf에 최신 `dist` 로드 필요)

### 수동 스모크

- [ ] 현닉 exact → 프로필 로드
- [ ] (가능하면) 닉변 유저 옛 닉 exact → alias 히트, 모달에 Former name
- [ ] DB에 없는 닉 → ALS 폴백 후 이후 DB exact
- [ ] 부분 일치/짧은 문자열은 의도적으로 안 뜸 (exact only)

### Pro 이후

- [ ] `vercel.json` cron → `* * * * *`
- [ ] 재배포 후 Vercel cron 로그에서 분당 keep-alive 확인
- [ ] 한 실행이 ~60–90초 안에 끝나는지 확인
