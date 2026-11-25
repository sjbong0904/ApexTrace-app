# GEP 관측 이슈 (Apex Legends / Overwolf)

실기·로그로 확인된 것만 기록. 추정·미재현은 넣지 않음.  
신규 이벤트·필드 요청은 [GEP-REQUESTS.md](./GEP-REQUESTS.md).

## 디버그 로그 (QA 이후 피처용)

Background. Overwolf `Apps/ApexTrace/background.html.log`에 WARN으로 쌓임.

| 태그 | 기본 | 플래그 | 내용 |
|------|------|--------|------|
| `[Match]` / `[GEP]` | ON | `__APEX_DEBUG_MATCH__` | 경계·세션, raw `onNewEvents` / info(위치 제외), **features subscribed** (`requested`/`supported`/`missing`), 게임 감지 |
| `[Location]` | OFF | `__APEX_DEBUG_LOCATION__` | `location` info-update만 (~2 Hz). stale first location 거절 |

`__APEX_DEBUG__ = false`면 전부 OFF. location은 match와 **독립** — match ON이어도 location은 따로 `true`여야 함.

```js
window.__APEX_DEBUG_LOCATION__ = true;  // location만 켜기
window.__APEX_DEBUG_MATCH__ = false;    // match/GEP만 끄기
```

스토어 제출 전 match 기본 ON도 끄는 것을 권장 (`public/background/utils.js`).

---

## 매치 경계

### 재큐 시 `match_end` / `match_start` / `pseudo_match_id` 미발송
한 판이 끝나고 바로 다음 판 셀렉으로 들어가도 GEP가 종료·시작·pseudo 교체를 안 보내는 경우가 있다.  
같은 `pseudo_match_id` 아래에서 tabs만 `0/0/0`으로 리셋되고, 이후 다른 레전드·다른 스쿼드 `legendSelect`가 이어진다.

- 관측: 2026-08-02 TST2 — Crypto 판(23:07 `match_start`) 이후 다음 `match_end`가 23:36. 그 사이 Axle 셀렉·새 팀으로 재큐.

### 전멸 직후 직전 판 `match_summary` 재주입 + `match_end`
로컬 death 직후 GEP가 **직전 판과 JSON이 동일한** `match_summary`(예: `rank`/`teams`/`squadKills`)를 다시 보내고 바로 `match_end`·`phase: match_summary`→`loading_screen`으로 넘어가는 경우가 있다. 이번 판의 진짜 등수가 아니라 **이전 HUD summary 잔상(stale replay)** 이다.

- 관측: 2026-09-07 SiNiz — Crypto 판(22:35~, 전멸 직전 `tabs.teams:8`) 로컬 death **22:45:20**과 동시에 `match_summary={"rank":"2","teams":"20","squadKills":"7"}` + `match_end`. 직전 Bangalore 판(22:33) summary와 **동일 JSON**. 이후 22:47 Bangalore 재큐·`match_start`·summary rank 8.
- 관측: 2026-09-30 QQ-1657824747 — 직전 판(01:59) summary `{"rank":"2","teams":"20","squadKills":"7"}` 후, 다음 판(02:01~, `minTeamsAlive:13`) 로컬 death **02:07:02**에 **동일 JSON** 재주입 + `match_end`. `your_squad_is_eliminated` 없음. 앱이 summary를 권위로 받아 **2등으로 저장** (`MatchAudit` `source:match_summary`, `minTeamsAlive:13`). 첨부: ApexTrace `background.html.log` + GEP `index.html.log`.
- 앱(현재 QA 빌드): **거절 미구현** — `applyMatchSummaryToMatch`가 stale JSON도 `_matchSummaryRank`로 채택함. (구 문서의 “이미 거절” 표기는 오류였음.)
- **다음 패치(QA 후):** `applyMatchSummaryToMatch`에서 (1) 직전 종료 판 summary fingerprint(`rank`/`teams`/`squadKills`) 동일 → 거절, (2) 안전망으로 `rank + 1 < _minTeamsAlive`면 거절. 거절 시 estimate(`tabs.teams` min)로 finalize. 진짜 등수를 GEP에서 발명하지 않음. MatchAudit에 `rejected: stale_replay | impossible_vs_min_teams` 남김.

### 셀렉트 직후 `match_start` 재발송
`legendSelect`로 세션이 이미 열린 뒤, 드롭십 진입 시점에 `match_start`가 다시 온다.  
(정상 계약에 가깝지만, 빈 roster만 보고 이전 세션을 끊으면 오분할됨.)

### 동일 레전드 연속 픽 시 로컬 `legendSelect` 생략
같은 레전드를 다시 고르면 로컬 `legendSelect_*`(`is_local`)가 안 오는 경우가 많다. 팀원 슬롯만 오거나 둘 다 비는 경우도 있음.

### 연속 큐에서 `match_start` / `pseudo` / `legendSelect` 누락
Overwolf 측에 제보한 케이스. 재큐·연속 매치에서 경계 신호가 빠짐.

---

## 전투 / 킬피드

### finish `action`이 로케일 문자열
넉다운 후 처치가 `kill`이 아니라 `출혈` 등 로케일 `action`으로 온다. `tabs.kills`는 올라가는데 피드 타입만 애매함.

- 앱(v0.0.10+): 로컬·팀메이트 모두 knock→opaque finish 페어링으로 집계 (언어 사전 없음).
- 관측: 2026-08-05 — SiNiz 10킬 중 5킬이 `출혈`/`링`이라 팀메이트 킬이 반토막 (페어링 전).
- GEP 312+: `action2`가 표준 outcome(`kill`/`knockdown`)을 줄 수 있음. 특수 능력명은 `action`에 두고 `action2`에 knockdown/kill. **다음 패치(QA 후):** `resolveCombatImpact`에 `action2` 우선 반영 ([GEP-REQUESTS](./GEP-REQUESTS.md) §kill_feed.action2 · [ROADMAP](./ROADMAP.md) §4e).

### 재큐 후 tabs / damage / weapons / summary 미발송
전멸 후 같은 GEP 세션에서 `legendSelect`만 오고 `match_start`·새 `pseudo`·`tabs`·`totalDamageDealt`·`weapons`·`location`·`match_summary`가 비는 경우가 있다. `kill_feed`만 살아 있어 전투로그만 쌓이고 킬/딜/등수/로드아웃/동선은 비게 됨.

- 관측: 2026-08-06 — kob 킬 판 (`index.html.15.log`), `match_end` 직후 게임 종료. summary 없음.
- 앱(v0.0.10+): 20등+0스탯+무로드아웃+무동선 hollow는 버리되, 미완료 형제 세션이 있으면 전투로그 백필 후 유지.

### 어시스트는 카운트만
어시스트 증가 시 victim 이름이 없는 경우가 많다. 팀원 처치 피드와 별개로 카운터만 움직임.

### 사망 행에 attacker 누락
스쿼드 전멸 등으로 찍히는 로컬 death에 attacker가 빈 경우가 있다. 직전 self-knockdown 피드에는 있는 경우가 많음.

### `knocked_out`와 `healed_from_ko` 동시 발송
같은 시각에 knockdown과 `healed_from_ko`가 같이 온 적이 있다 (2026-08-02 TST2 23:22:21).

---

## 로드아웃 / 모드

### `task_weapon` 플러그인 크래시
착지 직후 Apex 플러그인이 `crashed_on_task_task_weapon`으로 죽으면 `me.weapons`가 `unknown`으로 고정되고 로드아웃 타임라인이 비게 됨.

### `game_mode` 미표시
맵·매치는 있는데 `game_mode`가 비어 있는 경우가 있다.

### weapon 슬롯에 Melee / 수류탄
`weapon0` / `weapon1`에 주무기 대신 fists·grenade류가 올라온다.

---

## 로스터

### 관전 중 타인 이름 유입
스쿼드 전멸 후 관전하면 `teammate_*` / select 계열로 다른 스쿼드 이름이 들어온다.

---

## 링 (`ring`, GEP 317.4)

2026-11-14 Broken Moon / Storm Point 랭크 14판 앱 로그(`[GEP] onInfoUpdates2`)로 확인. GEP Provider 자체 로그(`index.html.log`)에는 ring·location 값이 **찍히지 않음** — 앱 로그로만 검증 가능.

### `next_ring` 중심 좌표가 쓰레기 값
`x` / `y`가 `1.38986e-40`, `1.79548e-41` 같은 denormal float로 온다(매판·매라운드). **`radius`만 정상**(28500 → 13000 → 8000 → 4000 → 2000 → 1).
- **GEP 318.0.0 (2026-11-16~)**: 형태가 바뀜 — `x`가 매판 `-2.00 ~ -2.03`(라운드 내내 동일), `y`는 `1.44446e-41`. "0 근처" 검사(`|x| > 1e-3`)를 통과해 맵 원점(0,0) 중심 링으로 그려지는 회귀가 발생(11/16 매치 27판 중 26판 오염). → 이제 **값과 무관하게 next_ring x/y를 절대 신뢰하지 않음**. 수신 원본은 GEP 수정 여부 확인용으로 `gepCenterRaw`에만 남김. 렌더러(`resolveRingCenter`, `src/utils/ringOverlay.ts`)도 저장된 `nextRingCenterX/Y`를 무시하고 `activeSamples`에서 다시 계산하므로 이미 업로드된 매치도 DB 수정 없이 바로잡힘. Overwolf 제보 대상(태그: issue / game event).
- **수축 도중 경기 종료 (2026-11-17)**: 마지막 라운드는 분대 전멸·우승으로 수축이 목표 반경에 닿기 전에 끝나는 경우가 많아 중심을 못 구함 → 리플레이에서 목표 링 없이 active 링만 줄어듦. 수축 중 중심은 반경에 선형으로 이동하므로 `resolveRingCenter`가 샘플 x(r), y(r) 최소제곱 직선을 목표 반경에서 평가해 외삽(`source: 'extrapolated'`, 반경 폭 1 m 이상·샘플 2개 이상일 때). 완료된 라운드 검증: 앞 샘플 3~5개로 실제 최종 중심과 0.11~0.35 m 오차. 수축 시작 전에 끝난 라운드(샘플 0개)는 여전히 복원 불가.
- 앱 대응: 중심을 `null`로 저장하고, 경기 종료 시 그 라운드 수축이 끝난 시점의 `active_ring` 중심으로 채움(`centerSource: 'active_end'`, `MatchService.finalizeRingRounds`). 마지막(미완료) 라운드는 `null`로 남음.
- 실시간으로 "다음 링 위치 미리 보기"는 이 버그가 고쳐질 때까지 불가. Overwolf에 리포트 필요.

### `active_ring` 동작 (정상, 참고)
- 수축 중에만 약 2초 간격으로 스트리밍, 대기 중엔 미발송. 라운드당 22~135샘플.
- 로컬 플레이어 **사망 중에도 계속 수신**됨.
- 매치 시작/종료 시 `""`(빈 값)과 리셋 값 `{"x":"0","y":"0","radius":"100000"}`가 옴 → 무시.

### 좌표 단위
ring 좌표·반경 = `location`(m) × **100**, 축 방향 동일. 2등 판 최종 링 중심 (3122.8, 21799.2)/100 = (31.2, 218) vs 같은 시점 플레이어 (32, 221).
