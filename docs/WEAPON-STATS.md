# 무기 통계 기준 (Weapons)

Statistics → Weapons 탭·집계 규칙.  
**기준일:** 2026-09-10 (`v0.0.15`).

**관련 코드**

| 영역 | 경로 |
|------|------|
| 클라이언트 집계 SSOT | `src/utils/weaponMatchStats.ts` |
| 집계 UI | `src/utils/statsAggregation.ts`, `src/components/StatisticsTab.tsx` |
| 라이브 finalize | `public/background/utils.js` (`syncWeaponCombatFromEvents`) |
| 프록시 (gitignore) | `trace-proxy-server/lib/weaponCombat.js`, `playerStats.js` (threat backfill) |

---

## 1. 데이터 범위

- `hasUsableMatchStats`를 통과한 매치만 집계.
- 매치 단위 원자값은 `resolveWeaponCombatForMatch` / `resolveWeaponThreatsForMatch`.
- finalize 시 **rich** `weaponCombat` + `weaponThreats`를 매치에 저장. 이후 클라이언트는 rich 저장값이 있으면 그대로 씀(디테일 있어도 재계산하지 않음).
- 옛 매치에 `weaponThreats`가 비어 있으면: events가 있으면 클라이언트에서 재계산 가능 / 시즌 stats fetch 시 프록시 backfill(프록시 배포 필요).

---

## 2. 지표 정의

| 지표 | 기준 |
|------|------|
| **Hold Time** | primary/secondary로 들고 있던 시간 합(ms). 타임라인 있으면 구간별, 없으면 최종 로드아웃에 매치 전체. 표시 `hh:mm`. |
| **Matches (usage)** | 해당 무기를 한 매치에서 한 번이라도 쓰면 **정수 1**. 슬롯 교체만 해도 1. (소수 매치 폐기) |
| **Kills** | 녹다운 우선 크레딧 무기 100% (`resolveKillCreditWeapon`). 확킬 피드 무기는 fallback. |
| **Deaths (내 총기)** | 로컬 데스마다 **1.0**을 생존 구간(이전 데스\|매치 시작 → 해당 데스)의 **유효 총기 홀드 시간 비율**로 분배. 분수 가능. 데스 없으면 모든 무기 deaths=0. |
| **K/D · KA/D** | `kills / deaths`, `(kills+assists) / deaths`. **deaths==0이면 N/A** (킬 수로 대체하지 않음). |
| **Win Rate / Avg Placement** | `qualify`된 매치만. qualify 없으면 `-`. |
| **Qualify** | 최종 로드아웃 항상 후보 + 내 kill/knockdown/damage 시점의 primary·secondary. |
| **Top Weapons** | hold/usage·KD 하이브리드 랭크. |
| **Top Threats** | 나를 죽인/녹다운한 적 무기 (`weaponThreats`). 킬 귀속은 녹다운 선호(나와 동일한 로직). 표시: 킬(확정 데스 크레딧) + 녹다운 횟수. |
| **Paired weapons** | 선택 무기와 **같은 매치**에서 같이 쓴 다른 총기. 매치 수 합 ≠ 선택 무기 매치 수일 수 있음(한 판에 페어가 여럿). |
| **Weapon legends** | 선택 무기를 쓴 매치의 내 레전드. |

### 폐기한 보정

- 예전: “킬>0 + 최종 로드아웃 아님 + deaths=0 → deaths=1” mid-match 보정 **제거**.

---

## 3. 킬 크레딧 예시

들고 있던 총: Nemesis + R-99. Nemesis로 녹다운 → R-99로 확킬.

| 관점 | 귀속 |
|------|------|
| 무기 통계 kill | **Nemesis** (+1) |
| 킬피드/매치 kills 합 | R-99 (인게임 피드; 매치 총 킬 카운트와는 별개 레이어) |

---

## 4. 데스 분배 예시

한 생존 구간에서 R-301을 60초, Flatline을 40초 들고 죽은 경우 → R-301 deaths += 0.6, Flatline += 0.4.  
유효하지 않은 슬롯(주먹·수류탄 등)은 분모에서 제외.

리스폰 후 두 번째 데스도 구간별로 각각 1.0을 다시 분배.

---

## 5. UI 메모 (Weapons 탭)

- 레이아웃: Top Weapons / Top Threats → 카탈로그 피커 → 선택 무기 요약 → Paired / Legends 카드·표.
- 기본 선택 무기: 카탈로그 **첫 항목**(R-301 등), Prowler 아님.
- 이름: `getWeaponDisplayName` (SHORT 이름 우선, i18n 키 raw 노출 방지). 캐시 키 `languages_cache_v4`.
- 표 이름: 한 줄 + ellipsis (`title`에 전체명).
- K/D 표시: 항상 소수 2자리 또는 `statistics.common.na`.

---

## 6. 운영 / 배포

| 대상 | 필요 조건 |
|------|-----------|
| **이후 새 매치** 기록 | 최신 `public/background/utils.js`가 로드된 Overwolf 앱 (`npm run build` 후 앱 재시작). Git push 불필요. |
| **옛 매치 weaponThreats 백필** | `trace-proxy-server` 배포 후 시즌 stats fetch. |
| **옛 rich weaponCombat 데스 모델** | 저장값 우선 → 새 홀드비율 모델로 자동 재작성되지 않음. 재계산하려면 저장 무효화/재업로드 정책이 별도 필요. |

로케일 시드 변경 시: `npm run seed:languages` (필수).
