# GEP 관측 이슈 (Apex Legends / Overwolf)

실기·로그로 확인된 것만 기록. 추정·미재현은 넣지 않음.

---

## 매치 경계

### 재큐 시 `match_end` / `match_start` / `pseudo_match_id` 미발송
한 판이 끝나고 바로 다음 판 셀렉으로 들어가도 GEP가 종료·시작·pseudo 교체를 안 보내는 경우가 있다.  
같은 `pseudo_match_id` 아래에서 tabs만 `0/0/0`으로 리셋되고, 이후 다른 레전드·다른 스쿼드 `legendSelect`가 이어진다.

- 관측: 2026-08-02 TST2 — Crypto 판(23:07 `match_start`) 이후 다음 `match_end`가 23:36. 그 사이 Axle 셀렉·새 팀으로 재큐.

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
