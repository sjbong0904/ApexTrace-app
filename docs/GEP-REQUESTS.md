# GEP 이벤트 요청 (Overwolf)

Overwolf [Game Events Request Form](https://overwolf.com) 제출 기록.  
실측 버그·quirk는 [GEP-BUGS.md](./GEP-BUGS.md). 제품 의존은 [ROADMAP.md](./ROADMAP.md).  
공식 스펙: [Apex Legends GEP](https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/apex-legends/).

폼 공통: Game `Apex Legends` (21566) · App `ApexTrace` · Overwolf Native. 스토어 미출시면 released = No.  
티켓은 **한 건씩**. 이미 낸 요청에 다음 건을 붙이지 않음.

| 상태 | 의미 |
|------|------|
| 제출 | 폼을 보냄. GEP 반영 대기 |
| 예정 | 다음 티켓 |
| 반영 | GEP에 들어옴. 앱 구독/파싱 작업으로 넘어감 |

---

## 반영

### Next ring location data (center, radius)

- **상태:** 반영 (GEP Ver. **312.0**). feature `ring` — `next_ring` + `active_ring` (요청보다 많음).
- **제품:** [ROADMAP A.1](./ROADMAP.md) 매치 지도 링 오버레이. 컬럼 `matches.ring_rounds` / 타입 `RingRound`.
- **앱 작업:** `setRequiredFeatures`에 `'ring'` 추가 ✅ → **다음 패치(QA 후):** 파싱·`ringRounds` 저장 · Free 정적 링 / Premium 맵 플레이어 ([ROADMAP](./ROADMAP.md) §4c).
- **예시 JSON:** [gep-next-ring-event-example.json](./gep-next-ring-event-example.json)

**공식 패킷 (docs)**

```json
{"info":{"ring":{"next_ring":"{\"x\":\"7106.97\",\"y\":\"-3570.12\",\"radius\":\"13000\"}"}},"feature":"ring"}
{"info":{"ring":{"active_ring":"{\"x\":\"-4181.48\",\"y\":\"1583.48\",\"radius\":\"32085.9\"}"}},"feature":"ring"}
```

요청 때 쓰던 `next_ring_center_x` / `_y` / `_radius` 키가 아니라 **`x` / `y` / `radius`** 한 객체. feature도 `match_info`가 아니라 `ring`.

**본문 (제출본, 보관)**

```
Hi Overwolf Team,
I am currently developing a post-match analysis app for Apex Legends that focuses on visualizing player movement and rotation paths. While the current location data from GEP is excellent for reconstructing routes, there is a critical missing link for macro-level analysis: the "Next Ring" position.
Without the next ring data, it is difficult to distinguish whether a player’s movement was a proactive rotation, a forced move by the zone, or an intentional edge play. Adding this data would bridge the gap between "where" the player moved and "why" they moved there.
Requested Data Examples (Once revealed in-game):
• next_ring_center_x
• next_ring_center_y
• next_ring_radius

Having this environmental context would significantly level up the quality of stats and replay apps on the Overwolf platform.
Thank you for your hard work and for considering this request!🥹
```

---

## 제출

### Local Player Item Used (on consumable use completed)

- **상태:** 제출 2026-09-15. GEP 반영 대기.
- **예시 JSON:** [gep-item-used-event-example.json](./gep-item-used-event-example.json)

**본문 (제출본)**

```
Suggested event name: item_used
Feature: inventory (or a new consumables feature)
Scope: local player only
Fired when: the item is consumed (not on channel start, cancel, interrupt, pickup, or drop)

Target items (English names / requested stable ids):
Phoenix Kit - phoenix_kit
Shield Battery - shield_battery
Shield Cell - shield_cell
Med Kit - med_kit
Syringe - syringe
Ultimate Accelerant - ultimate_accelerant

+ Survival items (if possible) - evac_tower, mobile_respawn_beacon, etc..

Event data example:
{"events":[{"name":"item_used","data":"ultimate_accelerant"}]}

Why current GEP data is not enough:
me.inUse reports the currently held item (mostly weapons). It does not tell us whether a heal channel finished or was cancelled.
inventory_XX often uses unknown_XX names, and amount changes also happen on pickup, drop, and death. We cannot reliably infer "completed" from inventory deltas.

This would let us record a per-match consumable timeline and amount of usage (phoenix / battery / cell / medkit / syringe / accelerant).
```

**Workaround 답 (제출본)**

```
No reliable workaround.

We already subscribe to inventory. me.inUse (and consumables leaking into me.weapons) only tells us the local player started holding/channeling an item, not that it was consumed — cancel and interrupt look the same. inventory_XX amount changes also fire on pickup, drop, and death, and names are often unknown_XX, so we cannot treat a delta as a completed use. ultimate_cooldown is too noisy to infer Ultimate Accelerant.

Without a dedicated item_used event, we cannot record consumable usage.
```

필수 6종만 타임라인에 쓰면 됨. survival은 같은 이벤트에 `data` 값이 더 오면 쓰는 보너스.

---

## 예정

각 건 별도 티켓. `item_used`에 붙이지 않음.

### Inventory item names (replace unknown_XX with stable ids)

`inventory_XX`의 `unknown_42` 같은 이름을 **안정 id + amount**로 바꿔 달라는 요청. 힐만이 아니라 탄약·부착물·서바이벌 포함. `item_used`의 `phoenix_kit` / `syringe`와 같은 id를 쓰면 두 티켓이 맞물림.

- 예시: `{"info":{"me":{"inventory_0":"{\"name\":\"syringe\",\"amount\":\"4\"}"}},"feature":"inventory"}`
- Workaround: 없음. `unknown_XX`는 매핑 키가 없음.

### Match summary squad stats (kills / assists / knocks / damage / revives / respawns)

인게임 매치 서머리와 같은 **내 스쿼드(나 포함)** 행. 지금 `match_summary`는 `rank` / `teams` / `squadKills`뿐.

이미 있는 것과 겹치지 않게:

- 로컬 `tabs`: 내 킬·어시·딜. 녹다운·회생·부활 없음. 팀원 없음.
- `team_damage_dealt`: 팀원 딜만.
- `kill_feed`: 팀원 킬 대략. 어시·딜·회생·부활 불가.

발화: 팀 전멸 또는 승리 후, 인게임 서머리가 뜰 때. 로컬 death·팀원 생존 중에는 보내지 말 것. 직전 판 JSON 재주입 금지 ([GEP-BUGS](./GEP-BUGS.md) stale summary).

```json
{"info":{"match_info":{"match_summary":"{\"rank\":\"4\",\"teams\":\"20\",\"squadKills\":\"9\",\"players\":[{\"name\":\"SiNiz\",\"kills\":3,\"assists\":2,\"knocks\":4,\"damage\":780,\"revives\":1,\"respawns\":0}] }"}},"feature":"match_summary"}
```

Workaround: 내 킬/딜은 `tabs`로 부분 가능. 팀원 전체 행은 없음.

### Ranked RP after match (delta and total)

랭크 매치 전멸/승리 후, **RP가 반영된 뒤** `rp_change`와 `rp_total`. `rank` feature의 `victory`만으로는 점수가 없음.

`match_summary`에 붙이지 말 것. 등수 화면이 RP 연출보다 이르고, 잔상 JSON과 섞인다. ranked BR만. 배치·캐주얼·아레나 AP는 제외하거나 따로.

`player_stats` (312.0)는 **시즌/커리어 누적**이지 매치 단위 RP 델타 이벤트는 아님. 다만 `br_ranked_latest.rank_score`(문서 미기재, 실기 확인)가 판마다 갱신되므로 **로컬 플레이어는 직전 값과의 차로 RP 델타를 계산 가능** → 이 티켓의 우선순위는 낮아짐 (아래 §player_stats).

```json
{"info":{"match_info":{"ranked_result":"{\"rp_change\":\"+48\",\"rp_total\":\"4520\"}"}},"feature":"rank"}
```

Workaround: ALS 프로필 RP를 읽고 다음 판에 이전 델타를 보정 (`correctPreviousMatchRP`). 매치 단위 델타가 없고 지연·리밋이 있음.

---

## GEP 312.0 추가분 (요청 외 · 앱 활용)

공식 문서에 같이 올라온 것. 별도 요청 티켓은 아님.

### `player_stats` (feature, since 312.0)

로컬 계정 레벨·XP·모드별 lifetime / 시즌 ranked·unranked 누적.

| key | 내용 |
|-----|------|
| `player_stats_career` | level, XP, arenas + battle_royale lifetime |
| `player_stats_br_ranked_latest` | 현재 시즌 ranked BR |
| `player_stats_br_ranked_history` | 이전 시즌 ranked 목록 |
| `player_stats_br_unranked_latest` | 현재 시즌 pubs |
| `player_stats_br_unranked_history` | 이전 시즌 pubs |

**쓸 곳:** 프로필 XP 바·계정 오버롤/20판 토글, Statistics Overview(Ranked) 시즌 요약, ALS 축소(RP 포함). 매치 1판 스탯·팀원 행은 안 옴. **로컬 플레이어 본인 것만** 옴 → 타인 프로필 표시는 DB 저장 필요.  
**앱 작업:** `'player_stats'` 구독 ✅ → **다음 패치(QA 후):** 스냅샷·파싱·UI·`global_profiles` 파이프라인 ([ROADMAP](./ROADMAP.md) §4d).

#### 실기 확인 (2026-11-14, 랭크 18판, GEP provider 로그)

원본: `%LOCALAPPDATA%\Overwolf\Log\Apps\Overwolf General GameEvents Provider\index.html*.log` (`[GEP] info update`, `value`는 JSON 문자열).

**필드 (문서와 다른 점)**

- `br_ranked_latest` / `br_ranked_history[]`에 **`rank_score`** 포함 (문서 미기재). ALS RP와 정확히 일치 (5776 → 6436, DB `daily_rank_snapshots`와 동일).
- `career.level`은 **프레스티지 포함 총 레벨** (1155 = prestige 2 × 500 + 155). 프레스티지 필드 없음 → `floor(level / 500)`으로 역산.
- `season`은 **시즌 번호만** (31). 스플릿 구분 없음 → `seasons`(스플릿 단위, S31 Split 1 = id 6)와 1:N 매핑. history도 시즌당 1행.
- history는 최근 20개 시즌 배열, 중간 시즌 누락 가능 (14–16 없음). 랭크 이력 없으면 `[]`.
- `unranked_latest`는 `highest_*`·`longest_win_streak` 없음 (문서와 동일).

```json
{"season":31,"assists":20,"damage_dealt":15832,"deaths":25,"games":23,"highest_damage":1711,"highest_kills":3,"kills":23,"knockdowns":29,"longest_win_streak":0,"rank_score":6436,"teammates_respawned":6,"teammates_revived":2,"top_5s":7,"wins":0,"win_rate":0.0,"average_damage":688.35,"kill_death_ratio":0.92}
```

**발송 시점**

| key | 시점 |
|-----|------|
| `career` | 세션 시작 1회 · 매치 중 소량 XP 증가 시마다 · **최종 사망 / `victory=false` 직후 0–3s**에 판 XP 반영 · `match_end` 후 로딩/로비에서 같은 값 재발송 |
| `br_ranked_latest` | **판당 1회** (`games` +1, `rank_score` 갱신). 최종 사망 ~ `match_end` 후 **최대 ~80s** (22:14:50 end → 22:16:11) |
| `*_history`, `unranked_latest` | 세션 시작 1회만 |

**함의**

- `match_end` 시점 스냅샷(`_finalizeRingAndStats`)은 XP는 대체로 반영, **RP는 아직 직전 판 값**. 업로드와 분리해 로비에서 늦게 오는 `ranked_latest`를 따로 반영해야 함.
- 판 RP 델타 = `rank_score(이번 ranked_latest) − rank_score(직전)`. 현재 `correctPreviousMatchRP` 경로는 최근 `matches`에서 `rank_score`/`rp_change` 전부 null, `rp_processed=false` → GEP 값으로 대체 대상.
- `events.js` `PLAYER_STATS_KEYS`에 `*_history` 미포함 → 시즌 추이 기능 시 추가.
- ApexTrace 측 `[PlayerStats]` 수신 로그는 미확인 (앱 로그 로테이션으로 소실, debug-match 게이트). 다음 플레이에서 확인.

### `kill_feed.action2` (since docs update / 312.x 계열)

`action`이 특수 능력명(`"Sniper's Mark"` 등)일 때 `action2`에 표준 결과(`knockdown` / `kill` …). 표준 `action`이면 `action2`는 `null`.

```json
{"events":[{"name":"kill_feed","data":"{\"action\":\"Sniper's Mark\",\"action2\":\"knockdown\",...}"}]}
{"events":[{"name":"kill_feed","data":"{\"action\":\"kill\",\"action2\":null,...}"}]}
```

**앱 작업:** **다음 패치(QA 후)** — `resolveCombatImpact`가 `impact` → `action`만 보므로, **`action2`를 `action`보다 먼저**(또는 `impact` 다음) 보게 함 ([ROADMAP](./ROADMAP.md) §4e). 로케일 출혈/링 finish 문제는 `action2`가 영어 표준일 때만 이득.
