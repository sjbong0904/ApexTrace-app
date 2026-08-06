# 닉네임 검색 · 이전닉(alias) · keep-alive

닉변 후에도 주소록 검색이 되도록 하는 설계·구현 메모.  
ALS(Apex Legends Status) 예산(현재 키 기준 약 10 req/s)을 검색 엔진처럼 쓰지 않는 것이 목표.

**상태:** Phase 1 shipped (스키마 + 프록시 + 클라이언트 후보 표시).  
**관련 코드:** `trace-proxy-server/lib/nameAliases.js`, `api/search-candidates.js`, `api/address-book.js`, `api/apex-stats.js`, `api/keep-alive.js`, `public/background/main.js`, `src/components/PlayerSelectionModal.tsx`  
**마이그레이션:** `supabase/migrations/20260806090000_create_profile_name_aliases.sql`

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
1) global_profiles.name  exact
2) 없으면 profile_name_aliases.name_norm exact → 해당 uid의 프로필
3) 둘 다 0건 → 클라이언트/프록시가 ALS player 검색
      → uid + name upsert (+ rename이면 alias)
4) DB 후보 2명+ → PlayerSelectionModal (ALS 스킵)
```

- `/search-candidates`가 1·2를 담당. 응답 행에 `matchType`: `"name"` | `"alias"`.
- alias 히트는 모달에 “Former name” 표시.
- ALS 닉 검색 성공 시 uid·name을 `global_profiles`에 넣는 동작은 기존 `/apex-stats`와 동일.

---

## 4. 쓰기 경로 (닉 변경 시)

공통 헬퍼: `syncNameAliases` / `syncAliasesForUpserts` (`lib/nameAliases.js`).

| 소스 | endpoint | `source` 값 |
|------|----------|-------------|
| GEP 로스터 | `POST /address-book` | `gep` |
| 명시 검색·프로필 | `/apex-stats` | `als` |
| 백그라운드 갱신 | `/keep-alive` | `keep-alive` |

규칙:

1. 들어오는 닉이 기존 현닉과 norm이 같으면 alias 작업 최소(현닉과 겹치는 alias만 제거).
2. 다르면 옛 현닉을 alias upsert, 현닉 갱신.
3. UID당 alias가 3 초과면 `seen_at`이 가장 오래된 것부터 삭제.
4. 같은 이전닉이 다시 보이면 `seen_at`만 갱신.

평소 현닉 학습의 주력은 **GEP 로스터**(ALS 0). ALS는 exact 0건 검색·keep-alive·명시 새로고침용.

---

## 5. keep-alive (출시 후에도 동일)

| 항목 | 값 |
|------|-----|
| 정렬 | `updated_at` 오래된 순 |
| 배치 | **매분** `/api/keep-alive` 호출, 회당 **12명** |
| 간격 | 순차 호출, **5초** |
| 처리량 | ≈ 0.2 req/s, ≈ 1.7만/일 |
| `maxDuration` | `api/keep-alive.js` **90초** (`vercel.json`) |
| 부가 | 매 실행 시 30일 지난 alias purge |

유료로 ALS 한도가 올라도 **이 페이스는 고정**. 순간 버스트 없이 순차만 사용.

**스케줄러 (Hobby 제약)**

- Vercel Hobby는 cron이 **하루 1회**만 가능. `vercel.json`에는 fallback으로 `0 0 * * *`(UTC 자정)만 넣어 둠.
- 설계상 **분당 1회**는 Pro cron 또는 **외부 스케줄러**(cron-job.org, GitHub Actions 등)가  
  `GET https://trace-proxy-server.vercel.app/api/keep-alive` 를 매분 호출해야 함.

---

## 6. Phase 2 (미구현 · 런칭 스케일 보험)

- 전역 ALS 게이트 (`alsClient`): 토큰 버킷 · singleflight · uid/player 공통 soft TTL
- keep-alive는 이미 0.2/s라 Phase 1만으로도 한도 부담은 작음

---

## 7. 의도적 한계

- 로스터·검색·keep-alive에 한 번도 안 잡힌 완전 신규 닉 → ALS 필요
- 30일 지난 옛 닉 / 4번째 이전 닉 초과분 → DB exact로 안 찾음
- 동일 표시명 다중 UID → 후보 모달
- ALS `platform=PC` 제약은 별도

---

## 8. 운영 체크

1. Supabase에 `profile_name_aliases` 마이그레이션 적용됨 (원격 적용 완료 시 생략).
2. `trace-proxy-server` 재배포 (search-candidates / address-book / apex-stats / keep-alive / vercel.json).
3. 앱 빌드·배포 (`public/background`, 후보 모달).
4. 스모크: 닉변 유저 옛 닉 exact → alias 히트 / 현닉 exact → name 히트 / 미등록 닉 → ALS.
5. Vercel cron 로그에서 분당 keep-alive·순차 5초 확인.
