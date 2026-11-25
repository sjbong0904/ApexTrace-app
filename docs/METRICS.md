# 테스트 & 버전 지표

버전이 바뀔 때마다 품질/크기 지표를 같은 기준으로 측정하고, 이전 버전과의 차이를 기록합니다.

## 명령

| 명령 | 용도 |
| --- | --- |
| `npm test` | 단위 + 골든 테스트 실행 (vitest) |
| `npm run test:watch` | 개발 중 감시 모드 |
| `npm run test:coverage` | `src/utils` 커버리지 요약 |
| `npm run test:update` | 의도된 계산 변경 후 골든 스냅샷 갱신 |
| `npm run metrics` | 작업 트리 측정 → 기록 + 직전 버전 대비 diff |
| `npm run metrics -- --ref v0.0.15` | 과거 태그를 임시 폴더에 풀어 같은 기준으로 측정 |
| `npm run metrics -- --compare v0.0.14` | 직전이 아닌 특정 기록과 비교 |
| `npm run metrics -- --skip build,lint` | 느린 단계 생략 (`test`, `typecheck`, `lint`, `build`, `load`). 생략한 항목은 기존 기록 값 유지 |
| `npm run metrics -- --runs 11` | 시작 벤치마크 반복 횟수 (기본 7) |

## 릴리스 루틴

1. `npm test` 통과 확인. 스냅샷이 깨졌다면 diff가 **의도한 변경**인지 검토 후 `npm run test:update`.
2. 버전 올린 뒤 `npm run metrics` → `metrics/diffs/v<버전>.md`에서 ⚠️ 항목 확인.
3. `metrics/` 폴더를 릴리스 커밋에 포함.

## 무엇을 측정하나

- **테스트**: 개수 / 실패 / 스킵 / 골든 스냅샷 불일치, 커버리지(%, 커버된 줄, 대상 줄 수)
- **정적 품질**: `tsc -b` 오류 수, `eslint src` 오류·경고 수(상위 규칙 포함)
- **번들**: JS/CSS 원본·gzip 크기, dist 총량, 청크별 크기(해시 제거 후 비교), 빌드 시간
- **코드 규모**: src / background LOC, 컴포넌트 수, 테스트 LOC

## 로드 속도 (시작 벤치마크)

`scripts/loadbench/run.mjs` — 빌드된 dist를 헤드리스 Edge(설치된 브라우저 사용, `playwright-core`)로 띄웁니다.

- 하네스: `background.html`을 숨은 iframe으로 먼저 띄우고(Overwolf 백그라운드 창 역할) 그다음 데스크톱 `index.html`.
  Overwolf API는 `scripts/loadbench/overwolf-stub.js`로 대체(게임 미실행 상태).
- 매 실행 새 브라우저 프로필 = 첫 실행 상태. 워밍업 1회 버리고 N회 중앙값.
- **네트워크 재생(기본)**: 실제 응답을 한 번 녹화(`fixtures/network.json`, gitignore)해 두고 모든 버전에 **같은 데이터 + 같은 지연(80 ms)**으로 응답 →
  인터넷/서버 상태와 무관하게 클라이언트 코드 차이만 비교. 픽스처에 없는 요청은 503 + `unmatched`로 기록.
- 시나리오:
  - `empty` — 데모 끔, 모든 버전 동일한 빈 첫 화면 (**버전 비교용 기본**)
  - `demo` — 첫 실행 샘플 프로필 (v0.0.16+)
  - `profile` — 저장된 프로필(`apex_pinned_uid`)로 **새 기기에서 열기**: 캐시 없이 프로필 + 경기 기록 + 상세를 네트워크로 받음
  - `profile-warm` — 같은 사용자가 **앱을 다시 열기**: 같은 브라우저 프로필로 한 번 미리 열어 IndexedDB 캐시를 채운 뒤 측정
- 프로필 시나리오 계정: `scripts/loadbench/fixtures/profile.json` (`{"uid": "...", "name": "..."}`, gitignore — 레포에 남지 않음).
  `name`이 있으면 화면에 그 이름이 실제로 떴는지(`Profile rendered (runs)`)도 확인합니다.
- 픽스처는 **기존 응답을 덮어쓰지 않고** 새 요청만 추가합니다. `npm run metrics -- --record-load`는 측정 전에 그 버전 빌드로 녹화해
  그 버전만 쓰는 요청(예: 다른 쿼리 파라미터)을 채웁니다. 계정 데이터를 새로 받으려면 `fixtures/network.json`을 지우고 다시 녹화하세요
  (그때는 모든 버전을 다시 측정해야 비교가 유효합니다).

| 지표 | 의미 |
| --- | --- |
| Desktop / Background initial gzip | 창이 앱 코드를 실행하기 전 받아야 하는 JS+CSS (정적, 지연 청크 제외) |
| Startup FCP | 첫 화면 페인트 |
| 90% rendered / settled | 최종 DOM의 90% 도달 시각 / 1.5초간 DOM 변화가 없어진 시각 |
| script time / long tasks | 시작 중 JS 실행 시간(전체 페이지) / 50 ms 넘는 메인 스레드 작업 합 |
| network requests / bytes | 시작 중 외부 요청 수 / 응답 크기 |

```powershell
node scripts/loadbench/run.mjs --dist dist --record
```
```powershell
node scripts/loadbench/run.mjs --dist dist --scenario demo --runs 9
```
```powershell
node scripts/loadbench/run.mjs --dist dist --network live
```

- `--record`: 픽스처 갱신(기존에 병합). API 응답 형태가 바뀌었을 때 다시 녹화.
- `--network live`: 실제 인터넷으로 호스트별 소요 시간 측정(서버 성능 포함, 편차 큼).
- 한계: 게임 실행 중 동작(GEP 이벤트, 오버레이)과 실제 서버 응답 속도는 재생 모드에 포함되지 않습니다(서버는 `--network live`로 따로).
  ms 단위 값은 같은 PC에서도 ±5–10% 흔들리니, 그보다 작은 차이는 잡음으로 보세요.

## 골든 테스트

`src/utils/__tests__/golden.test.ts`는 익명화된 실제 경기 데이터(`src/assets/demo/demoMatches.json`)로
`calculateStats`, 레전드·무기·위협·맵 집계, 종합 티어/점수, 팀원 기준치, 최근 비교를 계산해 스냅샷으로 고정합니다.
통계 로직이 바뀌면 어느 수치가 어떻게 바뀌었는지 diff로 바로 보입니다.

`--ref`로 과거 태그를 측정할 때는 **현재 테스트를 과거 코드에 실행**합니다. 그래서
`metrics/diffs/<tag>.behavior.txt`에 "그 버전과 지금 사이 계산 결과 차이"가 남습니다.
과거 버전에 아직 없던 함수/모듈 테스트는 실패가 아니라 *skipped*로 집계됩니다(골든 테스트).

## 해석 주의

- 커버리지 %는 `src/utils` 전체가 분모입니다. 테스트 없는 새 파일이 늘면 커버된 줄이 늘어도 %는 떨어집니다 —
  `Covered lines`와 `utils lines`를 같이 보세요.
- `*` 표시는 커밋되지 않은 변경이 있는 작업 트리에서 측정한 기록입니다. 릴리스 커밋 후 다시 측정하면 덮어씁니다.
- 과거 태그 행의 테스트 수치는 "그 코드가 오늘의 기대치를 얼마나 만족하는가"이지, 당시의 테스트 결과가 아닙니다.
