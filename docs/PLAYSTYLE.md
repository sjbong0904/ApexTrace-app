# 매치 플레이스타일 설계 v2 (초안)

매치 상세의 플레이스타일 칸을, 킬·딜 위주 룰트리에서 **「아, 그때 이랬지」가 떠오르는 한 단어**로 바꾸기 위한 설계.

**상태:** §10의 1~2단계 구현됨 (2026-11-25, 브랜치 `update`). `headhunter`·`bomber`는 대기. 언어 팩 v24 DB 반영 완료 (2026-11-25). Premium 포함 여부 미정 (§9).
**코드:** `src/utils/playstyle.ts` (규칙 표 = §5), `src/utils/__tests__/playstyle.test.ts`, `src/components/MatchStats.tsx`, `scripts/locale-seeds/*/playstyles`
**v1 설계(초기본):** git 히스토리의 이전 `docs/PLAYSTYLE.md`. v2는 그 원칙을 이어받되, 실제 매치 분포로 키·임계값을 다시 잡았다.

---

## 1. 목적

- 히스토리에서 매치를 다시 볼 때 그 판이 떠오르는 **한 단어 기억 장치**. 스탯 요약 뱃지가 아님.
- 같은 사람이 여러 판을 봐도 **문구가 골고루** 나와야 함 (한 키가 사용자 매치의 ~12%를 넘지 않는 것이 목표).

---

## 2. v1 분포 진단 (2026-11-25)

Supabase `matches` 1,692판 (사용자 7명, 랭크 95%). 순위 확정·비불완전 705판 기준. 순위 추정 판을 포함한 1,690판도 경향 동일.

| v1 키 | 비율 | 원인 |
|---|---|---|
| `soldier` | 26.8% | `kills≥1 ∧ dmg≥300` — 1~4킬 판 대부분 |
| `npc` | 25.8% | 그중 88%가 `0킬 ∧ dmg 100~599` (받는 규칙 없음) |
| `atlas` | 19.0% | `KPP≥70` — KPP 중앙값이 67이라 너무 쉬움 |
| 나머지 22개 | 28.4% | 대부분 0~2% |

- **상위 3개 = 71.6%**, 실제 등장 키 19개.
- 가로채기: `champion`(P1 108판 중 29판만, 47판은 `atlas`), `sweeper`(조건 116판 → 7판), `heartbreaker`(36판 → 2판).
- 도달 불가: `protagonist`(`KPP===90`이 `atlas` 뒤), `unluckyAce`·`runner` 0판.
- 새로 수집하는 데이터(리스폰·부활·피격·무기 타임라인·이벤트 시각·링)는 **전혀 사용하지 않음**.

---

## 3. 데이터 원천

| 원천 | 필드 / 함수 | 커버리지 | v2 사용 |
|---|---|---|---|
| 요약 스탯 | kills, assists, damage, knocks, squadKills, placement | 100% | 전 단계 |
| 이동 경로 | `path` → 거리·속도 | 100% | 부정 스탯 |
| 컴뱃 이벤트 | `events` kill/knockdown 시각 | 99% | 버스트 (`ace`, `blitz`) |
| 내 다운·부활·리스폰 | `getTimesKnocked`, `getRevivesReceived` | 99% | 복귀 아크, `tumbler` |
| 무기 타임라인 | `weaponTimeline` 보유 무기 수 | 98% | `collector` |
| 무기별 킬 | `weaponCombat` | 3킬+ 판 대부분 | `oneTrick` |
| 링 | `getTimeOutsideRingMs` | 8% (최근 빌드) | `ringSurfer` |
| 헤드샷 적중 | `damageHits`, `headshots` → `getHeadshotRate` | 신규 (아직 0판) | `headhunter` (임계값 대기) |
| 수류탄 딜 | `grenadeDamage` | 현재 전부 0 (GEP 이슈, 수정 중) | `bomber` (대기) |

**쓸 수 없는 것:** 내가 팀원을 살린 횟수. `revive`/`respawn` 이벤트는 victim이 **나**인 것만 기록됨 → 메딕류 키 불가.

**null 규칙:** 신호가 없는 매치(구버전 빌드)에서는 그 신호를 쓰는 규칙을 **건너뛴다** (0으로 취급하지 않음). 상세 탭의 `-` 표시와 같은 철학.

---

## 4. 판정 원칙

1. 위에서부터 **첫 매칭 1개**만.
2. **고난이도 스탯**은 서사보다 먼저 (달성 자체가 기억).
3. **복귀 아크·버스트**는 1회로 부여하며, 일반 결과(`champion` 등)보다 먼저 — 1등 판이 전부 `champion`이 되지 않도록.
4. **팀 기여형(`atlas`)은 fallback**으로 내리고 조건을 좁힘.
5. 부정 문구는 가볍게. 서사 > 스탯 순.
6. 애매한 잔여는 중립 키(`skirmisher`, `npc`)로.
7. UI에는 짧은 `name`만, 설명은 `sub` 툴팁. 최악 가용 폭 ~150px.
8. 폭 기준: 지금 가장 긴 `Heartbreaker`가 16px·800 굵기로 ~122px. 이름 칸 실측 최소 131px(웹 800px 너비) — 새 이름은 **12자 이하**로 유지하고, 넘으면 같은 방식으로 실측.
9. **`name`은 모든 언어에서 영어**(`t(key, { lng: 'en' })`), `sub`만 현지어 (2026-11-25 결정: 번역한 이름은 게이머 용어 느낌이 안 남). 따라서 아래 표의 KO 열은 참고용이고, 새 키를 만들 때 중요한 건 EN `name`이다. 짧게(~10자).

---

## 5. 규칙 (우선순위 순)

`x.*` = 요약 스탯, `kcr` = 넉→킬 전환율(%), `kpp` = 킬 관여율(%), `dpk` = 킬당 딜, `burst12` = 12초 창 안 최대 내 킬 수, `knockBurst8` = 8초 창 안 최대 내 녹다운 수.
**상태:** 유지 / 수정 / 신규 / 대기(데이터 확보 후).
**v2 비율:** 705판 시뮬레이션에서 그 키가 최종 선택된 비율.

### 5.0 즉시 이탈

| key | KO | EN | 조건 | 상태 | v2 비율 |
|---|---|---|---|---|---|
| `deathbox` | 데스박스 | Deathbox | time<3분 ∧ dmg<150 | 유지 | 4.5% |

### 5.1 고난이도 스탯

| key | KO | EN | 조건 | 상태 | v2 비율 |
|---|---|---|---|---|---|
| `dominator` | 지배자 | Dominator | kills≥10 ∧ kcr>85 | 유지 | 2.1% |
| `aimbot` | 에임봇 | Aimbot | kills≥7 ∧ 150·k ≤ dmg ≤ 250·k | 유지 | 2.6% |
| `warlord` | 전쟁군주 | Warlord | kills≥7 ∧ dmg≥2500 | 유지 | 1.3% |
| `headhunter` | 헤드헌터 | Headhunter | damageHits≥N ∧ 헤드샷률≥X% | 대기 | — |
| `protagonist` | 주인공 | Protagonist | squadKills≥8 ∧ kills ≥ 0.6·squadKills | 수정 (도달 불가 해소) | 2.0% |

`dominator`를 `aimbot` 앞으로 옮김 (v1에서 10킬+ 고전환 5판이 `aimbot`에 가려짐).

### 5.2 복귀 아크

| key | KO | EN | 조건 | 상태 | v2 비율 |
|---|---|---|---|---|---|
| `phoenix` | 불사조 | Phoenix | 리스폰 받음 ≥1 ∧ P=1 | 신규 | 2.0% |
| `reborn` | 부활 | Reborn | 리스폰 받음 ≥1 ∧ P 2~5 | 신규 | 3.5% |

### 5.3 교전 버스트

| key | KO | EN | 조건 | 상태 | v2 비율 |
|---|---|---|---|---|---|
| `ace` | 에이스 | Ace | burst12 ≥ 3 (12초 안 내 킬 3) | 신규 | 4.3% |
| `blitz` | 폭풍 | Blitz | knockBurst8 ≥ 3 (8초 안 녹다운 3) | 신규 | 0.9% |

v1 설계의 `ace`(8s)/`sweep`(12s) 분리는 폐기: 12초 창이 8초 창보다 0.7%p만 더 잡아서 하나로 합침.

### 5.4 결과 아크

| key | KO | EN | 조건 | 상태 | v2 비율 |
|---|---|---|---|---|---|
| `pacifist` | 평화주의자 | Pacifist | P=1 ∧ k=a=0 ∧ dmg<300 | 유지 | 0% |
| `backpack` | 5렙 가방 | Backpack | P=1 ∧ k≤2 ∧ dmg<500 ∧ a≤2 | 유지 | 0.1% |
| `champion` | 챔피언 | Champion | P=1 | 유지 (순서만 아래로) | 6.8% |
| `unluckyAce` | 불운한 에이스 | Unlucky Ace | P>10 ∧ kills≥5 | 유지 | 0% |
| `heartbreaker` | (현행 문구) | Heartbreaker | P=2 | 수정 (순서만 위로) | 3.3% |

P1 108판의 v2 분배: champion 48 · phoenix 14 · dominator 13 · aimbot 11 · ace 7 · warlord 6 · protagonist 5 · blitz 3 · backpack 1.

### 5.5 생존 서사

| key | KO | EN | 조건 | 상태 | v2 비율 |
|---|---|---|---|---|---|
| `tumbler` | 오뚝이 | Tumbler | 내가 다운 ≥3 ∧ 부활 받음 ≥2 | 신규 | 1.1% |
| `ringSurfer` | 링 서퍼 | Ring Surfer | 링 밖 ≥60초 ∧ P≤5 | 신규 (링 데이터 판만) | 0.7% |

### 5.6 부정 서사

| key | KO | EN | 조건 | 상태 | v2 비율 |
|---|---|---|---|---|---|
| `observer` | 관전자 | Observer | squadKills≥6 ∧ kpp≤15 ∧ time>5분 | 수정 (kpp 10→15) | 0.1% |
| `sidekick` | 사이드킥 | Sidekick | assists≥4 ∧ kills=0 | 수정 | 0.7% |

### 5.7 긍정 스탯 fallback

| key | KO | EN | 조건 | 상태 | v2 비율 |
|---|---|---|---|---|---|
| `bomber` | 폭탄마 | Bomber | 수류탄 딜 ≥N 또는 비중 ≥X% | 대기 (GEP 수정 후) | — |
| `atlas` | 아틀라스 | Atlas | squadKills≥8 ∧ kpp≥80 ∧ kills≥3 | 수정 (축소) | 0.9% |
| `assassin` | 암살자 | Assassin | kills≥4 ∧ dpk<140 | 유지 | 0% |
| `sniper` | 스나이퍼 | Sniper | dmg≥2000 ∧ (kills≤3 ∨ dpk>600) | 유지 | 0% |
| `berserker` | 버서커 | Berserker | time<5분 ∧ (dpm>180 ∨ kills≥3) | 유지 | 1.4% |
| `sweeper` | 스위퍼 | Sweeper | kills≥5 | 유지 | 1.3% |
| `oneTrick` | 원툴 | One-Trick | kills≥4 ∧ 최다 무기 킬 비중 ≥90% | 신규 | 0.7% |
| `finisher` | 마무리 | Finisher | kills≥3 ∧ kcr≥90 | 신규 | 3.7% |
| `collector` | 수집가 | Collector | 보유 무기 ≥8종 | 신규 | 1.3% |
| `support` | 서포터 | Support | kills≤1 ∧ assists≥3 | 신규 | 1.4% |
| `soldier` | 군인 | Soldier | kills≥2 ∧ dmg≥600 | 수정 (조건만 축소, 문구 그대로) | 9.1% |
| `survivor` | 생존왕 | Survivor | P≤5 ∧ kills≤2 | 신규 | 1.8% |
| `vanguard` | 선봉대 | Vanguard | time<8분 ∧ dmg≥300 | 신규 | 11.8% |

### 5.8 부정 스탯 fallback

| key | KO | EN | 조건 | 상태 | v2 비율 |
|---|---|---|---|---|---|
| `chihuahua` | 치와와 | Chihuahua | kills=0 ∧ dmg≥450 | 수정 (600→450) | 1.8% |
| `rat` | 존버 | Rat | time>12분 ∧ 속도<45 | 유지 | 0.6% |
| `delivery` | 배달중 | Delivery | 거리>1500 ∧ dmg<200 | 유지 | 0.3% |
| `tourist` | 관광중 | Tourist | kills=0 ∧ dmg<150 | 수정 (100→150) | 9.5% |

### 5.9 중립 잔여

| key | KO | EN | 조건 | 상태 | v2 비율 |
|---|---|---|---|---|---|
| `skirmisher` | 교전꾼 | Skirmisher | kills≥1 ∨ dmg≥300 | 신규 | 8.2% |
| `npc` | NPC | NPC | 그 외 | 유지 | 10.2% |

### 5.10 폐지

| key | 이유 |
|---|---|
| `janitor` | 조건 판이 거의 없고 `finisher`와 겹침 |
| `runner` | 705판 중 0판 |
| `ghost` | 705판 중 0판, `rat`·`delivery`와 겹침 |

### 5.11 로케일 규칙 (v0.0.15 호환)

언어 팩(`languages` 테이블)은 스토어에 나가 있는 v0.0.15와 공용이다. v0.0.15가 v1 규칙으로 보여 주는 문구가 바뀌면 안 된다.

- 기존 `playstyles.*` 키의 `name`·`sub`는 **수정·삭제하지 않는다**. 폐지 키(`janitor`·`runner`·`ghost`)도 시드에 그대로 두고 v2 코드에서만 안 쓴다.
- 문구를 바꾸고 싶으면 **새 키**를 만든다 (예: `soldier` 문구를 「1인분」으로 바꾸려면 새 키 `solid`).
- 신규 키 13개(`phoenix`·`reborn`·`ace`·`blitz`·`tumbler`·`ringSurfer`·`oneTrick`·`finisher`·`collector`·`support`·`survivor`·`vanguard`·`skirmisher`)만 10개 언어 시드에 **추가**. v0.0.15는 이 키를 안 쓰므로 이후 문구를 다듬어도 라이브에 영향 없음.
- 화면에는 EN `name`만 쓰지만(§4-9), 다른 언어의 `name` 값도 시드에 계속 채워 둔다 (v0.0.15가 v1 키의 현지어 `name`을 쓰고, 나중에 방침을 되돌릴 수도 있음).
- 반영: `npm run check:compat`(문구 변경 0건 확인) → 시드 버전 올림 → `npm run seed:languages` (공용 DB 쓰기, 사용자 승인 후).

---

## 6. 시뮬레이션 결과 (v1 → v2)

같은 705판 기준. 스크립트는 저장소 밖 임시 분석본 (구현 시 `src/utils/playstyle.ts` 테스트로 대체).

| 지표 | v1 | v2 |
|---|---|---|
| 상위 3개 비중 | 71.6% | 31.5% |
| 최다 키 비중 | 26.8% (`soldier`) | 11.8% (`vanguard`) |
| 실제 등장 키 | 19 | 32 |
| `npc` | 25.8% | 10.2% |
| 사용자별 최다 키 (상위 3명) | — | 11.0% / 14.2% / 11.4% |

단계별: 스탯 fallback 41.6% · 부정 17.6% · 결과 아크 15.7% · npc 10.2% · 고난이도 7.9% · 버스트 5.1% · 생존 서사 1.8%.

**남은 쏠림:** `vanguard`·`tourist`·`soldier`·`npc`가 각 9~12%. 수용 범위로 보되, `headhunter`·`bomber`가 들어오면 이 구간 일부를 가져갈 것으로 예상.

---

## 7. 대기 키 임계값 정하는 법

- `headhunter`: `damageHits`가 실린 판이 ~200판 쌓이면, `damageHits≥30` 판의 헤드샷률 p90 근처를 X로, 최종 비율 2~4% 목표.
- `bomber`: GEP 수정 후 `grenadeDamage>0` 판 분포에서 상위 ~3%가 되게 N(절대값)과 X(비중)를 정함.
- `ringSurfer`: 링 데이터 판이 늘면 60초 기준 재확인.

---

## 8. 구현 구조

```text
src/utils/playstyle.ts
  extractPlaystyleInputs(match) → { x, f }   // 신호 없으면 f.* = null
  classifyPlaystyle(inputs)     → key        // 순수 함수, 규칙 표 = 이 문서 §5
  PLAYSTYLE_VISUALS[key]        → { gradient, isPrimary }
MatchStats.tsx                  → key → t('playstyles.<key>.name/sub') + visuals
```

- **저장 안 함 (v2 결정):** 키는 지금처럼 렌더 시 계산. DB 스키마 변경·백필이 없고, 임계값을 바꾸면 과거 매치에도 바로 반영됨. 단점: 규칙을 바꾸면 과거 매치 문구도 바뀜 → 기억 장치로서는 감수. (v1 설계의 `playstyleKey` 저장은 보류)
- 단위 테스트: 규칙마다 경계값 1쌍(걸림/안 걸림) + 신호 null 시 건너뛰기 + 우선순위 충돌 예시(P1+리스폰 → `phoenix`, P1+ace → `ace` 등).
- 분포 회귀: 데모 매치셋(`src/assets/demo/demoMatches.json`)으로 키 분포 스냅샷 테스트 — 규칙 변경 시 분포 변화를 리뷰에서 보이게.

---

## 9. 열린 질문

1. **Premium 범위:** v1 설계는 「Free QA 통과 후 Premium 업서트에 포함」. v2를 Free에 그대로 둘지, 신규 서사 키(복귀·버스트·생존)만 Premium으로 둘지.
2. **`vanguard` 이름·조건:** 8분 안에 300딜 이상 넣고 죽은 판 전반이라 비중이 가장 큼. 「선봉대」 톤이 맞는지, 시간 기준을 줄일지.
3. **`ace` vs `unluckyAce`:** 둘 다 「에이스」를 써서 헷갈릴 수 있음. `ace` KO를 「몰아치기」 등으로 바꿀지.
4. **sub 문구:** 신규 키 툴팁 문구(9개 언어)는 구현 시 작성.

---

## 10. 구현 순서

1. ✅ `src/utils/playstyle.ts` 분리 + 테스트 (v1 이식 단계는 건너뛰고 바로 v2).
2. ✅ v2 규칙·순서 적용, 신규 키 locale 시드 **추가** (폐지 키는 시드에 그대로 — §5.11). 언어 팩 v24 DB 반영 완료.
3. 데모셋 분포 스냅샷 테스트.
4. 데이터 확보 후 `headhunter`·`bomber` 임계값 확정 (§7).

---

## 11. 한 줄 요약

**어려운 성과 → 복귀·몰아치기 서사 → 결과 → 생존 서사 → 스탯 순으로 판정하고, 새 신호(리스폰·부활·이벤트 시각·무기·링)로 1인분·NPC·아틀라스 쏠림(72%)을 32%로 푼다. 헤드샷·수류탄 키는 데이터가 쌓이면 붙인다.**
