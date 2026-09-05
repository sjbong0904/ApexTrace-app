# 매치 플레이스타일 설계 (초기본)

매치 히스토리 상세의 플레이스타일 칸을, 집계 스탯 룰트리에서 **서사·성과 기반 한 단어 기억 장치**로 확장하기 위한 설계.

**상태:** 설계만. QA 중 미구현. **Free QA 통과 후 Premium 업서트에 포함** ([ROADMAP.md](./ROADMAP.md) §A.5).  
**관련 코드 (현행):** `src/components/MatchStats.tsx` (`determinePlaystyle`), `scripts/locale-seeds/*/playstyles`, `public/background/events.js` (combat events)

---

## 1. 목적

히스토리에서 매치를 다시 볼 때 **「아, 그때 이랬지」**가 떠오르는 **한 단어 기억 장치**.

- 스탯 요약 뱃지가 아님
- 한 장면 클립 제목이 목적이 아님 (다만 1회 패턴도 부여 가능 — 아래 원칙)

---

## 2. 파이프라인

```text
[매치 중]  startTime 기준 이벤트를 메모리 버퍼에만 누적 (t=초)
[finalize] classify(버퍼 + 매치 요약) → playstyleKey 1개
[저장]     playstyleKey (+ 선택 playstyleVersion)
[UI]       key → locale name / sub / gradient
[레거시]   key 없음 → 동일 룰로 클라 fallback
```

- 타임라인·서술 문장은 DB에 넣지 않음
- 런타임 버퍼·팀원 `state` 등은 업로드 전 strip (`stripRuntimeFields`와 동일 철학)

### 저장 스키마

```text
playstyleKey: string | null
playstyleVersion: 1    // 선택, 룰 변경 시
```

---

## 3. 판정 원칙

1. 애매하면 억지로 키를 달지 않고 다음 단계 / 최종 `npc`.
2. 순간 패턴도 **기본 1회면 부여** (지원 모드: 랭크·트리오·듀오 — `count >= 2`는 사실상 무의미).
3. **고난이도 스탯**은 서사와 무관하게 부여 (달성 자체가 기억).
4. **`atlas`는 고난이도 제외** — 출현 빈도가 높아, **서사 매칭이 없을 때만**.
5. 긍정·부정 **서사**와, 서사 없을 때 **긍정·부정 스탯** 매칭을 모두 허용. 부정은 가볍게.
6. 우선순위 순 **첫 매칭 1개만** 저장.
7. UI 카드에는 짧은 `name`만, 설명은 `sub`(툴팁).  
   최악 가용 폭 ~150px (wide 3열 MatchStats) → 짧은 표시명 유지.

### `wiped` vs 초반 엘리

- `wiped` = `sweep`의 **공수 대칭** (짧은 시간 창에 우리 셋 down/death).
- **초반 전멸 전용이 아님.** 시간대 무관.

---

## 4. 우선순위

```text
1) 고난이도 스탯
2) 판 뼈대·결과 아크
3) 교전 버스트 (1회 OK) — sweep ↔ wiped 대칭
4) 솔로·팀 서사 (Phase B)
5) 부정 서사 (가볍게)
6) 긍정 스탯 fallback (atlas 포함)
7) 부정 스탯 fallback
8) npc
```

---

## 5. 키 목록

### 5.1 고난이도 스탯 — 서사 무관

| 순 | key | KO | EN | 조건 스케치 |
|----|-----|----|----|-------------|
| 1 | `dominator` | 지배자 | Dominator | kills≥10 ∧ 고전환 |
| 2 | `aimbot` | 에임봇 | Aimbot | kills≥7 ∧ 효율 딜밴드 |
| 3 | `warlord` | 전쟁군주 | Warlord | kills≥7 ∧ damage≥2500 |
| 4 | `protagonist` | 주인공 | Protagonist | 스쿼드 킬 많음 ∧ KPP 극단 |

### 5.2 판 뼈대·결과 아크

| 순 | key | KO | EN | 조건 스케치 |
|----|-----|----|----|-------------|
| 5 | `phoenix` | 불사조 | Phoenix | 사망 → 복귀 → P1 |
| 6 | `reborn` | 부활 | Reborn | 사망 → 복귀 → Top5 (P≠1) |
| 7 | `clutch` | 클러치 | Clutch | 후반 킬 버스트 + 상위 |
| 8 | `unlucky` | 언럭키 | Unlucky | kills≥5 ∧ P>10 |
| 9 | `pacifist` | 평화주의자 | Pacifist | P1 ∧ k=a=0 ∧ 저딜 |
| 10 | `backpack` | 5렙가방 | Backpack | P1 ∧ 저킬·저딜 |
| 11 | `heartbreak` | 한끗차이 | Heartbreak | P=2 |

### 5.3 교전 버스트 — 1회 OK

| 순 | key | KO | EN | 조건 스케치 |
|----|-----|----|----|-------------|
| 12 | `one_v_three` | 1대3 | 1v3 | 솔로(팀 둘 down/death) 중 내 킬≥3 |
| 13 | `ace` | 에이스 | Ace | ≤8초 내 내 킬≥3 |
| 14 | `sweep` | 스윕 | Sweep | ≤12초 내 내 킬≥3 (`ace` 미해당 시) |
| 15 | `wiped` | 전멸 | Wiped | ≤12초 내 우리 셋(나+팀) down/death |

### 5.4 솔로·팀 서사 — Phase B

| 순 | key | KO | EN | 조건 스케치 |
|----|-----|----|----|-------------|
| 16 | `last_stand` | 라스트 맨 | Last Man | 긴 솔로 생존 + 상위/팀 복귀 |
| 17 | `solo_carry` | 솔로캐리 | Solo Carry | 솔로 매우 김 + P1 |

`beacon`(비콘)은 **목록에서 제외**.

### 5.5 부정 서사 — 가볍게

| 순 | key | KO | EN | 조건 스케치 |
|----|-----|----|----|-------------|
| 18 | `deathbox` | 데스박스 | Deathbox | 초단시간 + 저딜 |
| 19 | `spectator` | 관전 | Spectator | 스쿼드 킬 많음 · 내 기여 극소 |
| 20 | `sidekick` | 조수 | Sidekick | **어시 많음 ∧ 킬 0** |
| 21 | `throw` | 사출됨 | Ejected | 내 초반 사망 → 팀 전멸/`wiped`로 직결 (Phase B, 선택) |

### 5.6 긍정 스탯 fallback — 서사 없을 때

| key | KO | EN |
|-----|----|----|
| `atlas` | 아틀라스 | Atlas |
| `assassin` | 암살자 | Assassin |
| `sweeper` | 스위퍼 | Sweeper |
| `berserker` | 버서커 | Berserker |
| `soldier` | 1인분 | Solid |
| `champion` | 챔피언 | Champion |
| `janitor` | 청소부 | Janitor |
| `sniper` | 스나이퍼 | Sniper |

### 5.7 부정 스탯 fallback — 서사 없을 때

| key | KO | EN | 조건 스케치 |
|-----|----|----|-------------|
| `chihuahua` | 치와와 | Chihuahua | 고딜 · 0킬 |
| `tourist` | 관광중 | Tourist | 무킬 · 극저딜 |
| `looter` | 파밍중 | Looter | 긴 생존 · 저딜 · 이동多 |
| `rat` | 존버 | Rat | 긴 매치 · 저속 · 저교전 |
| `delivery` | 배달중 | Delivery | 거리/이속만 · 딜 거의 없음 |

### 5.8 최종

| key | KO | EN |
|-----|----|----|
| `npc` | NPC | NPC |

---

## 6. 런타임 버퍼 (저장 X)

최소 이벤트:

- Phase A: `my_kill`, `my_death`, `my_revive`, `my_respawn` (+ knockdown 필요 시)
- Phase B: `tm_down`, `tm_death`, `tm_revive`, `tm_respawn` → `solo_start` / `solo_end` 유도

파생 예: `early`(<180s), `late`(≥0.7T), `soloMs`, 버스트 창(8s/12s).

### 현행 데이터 구멍

- 컴뱃로그 `revive`/`respawn`은 **로컬 위주**
- `teamStats.state`는 매치 중만 있고 finalize 시 삭제
- 타입의 `team_revive_attempt` / `team_respawn_success`는 미사용

→ `wiped`, `one_v_three`, `last_stand`, `solo_carry`, `throw` 등은 **팀원 생사 추적(Phase B)** 선행 필요.

---

## 7. 데이터 Phase

| Phase | 가능 키 |
|-------|---------|
| **A** (현 events) | 고난이도, 뼈대 아크, `ace`/`sweep`, 부정 서사 일부, 스탯 fallback |
| **B** (팀원 생사) | `wiped`, `one_v_three`, `last_stand`, `solo_carry`, `throw` |

---

## 8. UI

- 카드: `AutoResizingText`로 `name`만 (nowrap + ellipsis)
- 라벨(`플레이 스타일`): 기존 Marquee
- `sub`: info 툴팁 한 줄
- wide 레이아웃에서 MatchStats가 flex 4/12라 name 가용 폭이 가장 빡셈 (~150px)

---

## 9. 범위 밖·보류

- 타임라인·서술 문장 DB 저장
- Moment 전용 뱃지 / `highlightKey` (추후 분리 가능)
- `trade_wipe` 등 추가 변형
- `count >= 2` 필터
- `beacon` (비콘)
- 애매 톤 대량 추가 (`runner` 등)

---

## 10. 구현 순서 (QA 이후)

1. `playstyleKey` nullable + UI 맵핑 + 현행과 맞는 fallback  
2. 고난이도 우선 + Phase A 아크/버스트 + 부정 서사·스탯  
3. 팀원 state → arc 버퍼  
4. Phase B  
5. (선택) Moment UI  

임계값(초·킬·딜)은 `playstyleVersion`으로 조정.

---

## 11. 한 줄 요약

**어려운 성과는 바로 남기고, 스윕/전멸·복귀·솔로 같은 「그 판」 서사(긍정·부정)를 1회로도 남기며, 서사가 없으면 긍정·부정 스탯으로 가볍게 채운다. 비콘은 없음.**
