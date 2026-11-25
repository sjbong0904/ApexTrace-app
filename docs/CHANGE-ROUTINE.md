# 변경 루틴

코드·데이터·서버를 바꿀 때마다 이 순서대로 한다. 빠뜨리면 안 되는 것은 **테스트, 지표 기록, 성능 비교, 문서화** 네 가지다.

핵심 전제: Supabase(언어 팩·스키마)와 프록시(`trace-proxy-server`)는 **스토어에 나가 있는 빌드(현재 v0.0.15, `c68b2ce`)와 공용**이다. 다음 버전용 변경이 라이브 앱을 깨면 안 된다.

---

## 0. 시작 전

- [ ] 브랜치 확인: 작업은 `update`(또는 그 다음 작업 브랜치). `main`·릴리스 태그는 건드리지 않는다.
- [ ] `git status`로 남의 작업·미커밋 변경 파악. 프록시 레포(`trace-proxy-server/`)도 따로 확인.
- [ ] 변경이 **공용 백엔드**(DB·언어 팩·프록시)에 닿는지 판단 → 닿으면 3단계 필수.

## 1. 테스트

- [ ] `npm run check` — 테스트(vitest) → 타입체크(`tsc -b`) → 린트(`eslint src`, 오류 0 유지) → 빌드 → 호환 검사를 한 번에.
- [ ] 골든 스냅샷이 깨지면: diff가 **의도한 계산 변경**인지 검토 → 맞으면 `npm run test:update`, 아니면 버그.
- [ ] 새 계산·유틸은 `src/utils/__tests__/`에 테스트 추가.
- [ ] 화면 변경: 헤드리스로 확인(시작 벤치마크 하네스 또는 dev 서버) + 필요하면 OW 실기 확인 목록에 추가.

## 2. 지표 기록 + 성능 비교

- [ ] `npm run metrics` — 테스트·커버리지·TS/린트 오류·번들 크기·시작 벤치마크를 `metrics/history/v<버전>.json`에 기록하고 직전 버전과 비교(`metrics/diffs/v<버전>.md`, `metrics/HISTORY.md`).
  - 성능과 무관한 작은 변경: `npm run metrics -- --skip load`(생략한 항목은 이전 값 유지).
  - 로딩·렌더링·이미지·네트워크를 건드린 변경: 전체 측정 + `--runs 11`.
  - 특정 기록과 비교: `--compare v0.0.15`. 과거 버전 재측정: `--ref <태그>`.
- [ ] diff에서 확인할 것: ⚠️ 표시, 시작 수치 ±10% 넘는 변화(±5–10%는 잡음), 초기 로드 gzip·외부 요청 바이트 증가, DOM 노드 수.
- [ ] 나빠졌으면 원인을 찾아 고치거나, 감수하는 이유를 문서에 적는다.
- [ ] `metrics/` 변경을 같은 커밋에 포함.

## 3. 라이브 빌드 호환 (공용 백엔드를 건드릴 때)

- [ ] `npm run check:compat` — 라이브 빌드 대비 언어 키 누락·보간 변수 변경(실패 처리), **문구 변경**(목록), 새 마이그레이션의 drop·rename·revoke 등(점검 표시)을 보여 준다. 라이브 빌드가 바뀌면 `scripts/check-compat.mjs`의 `DEFAULT_BASE`를 갱신.
- [ ] 언어 팩: 기존 키는 지우거나 뜻을 바꾸지 않는다. 새 문구가 필요하면 **새 키**(예: `combatLog.tabTitle`). 버전(`scripts/seed-languages.ts`) 올리고 `npm run seed:languages` → DB에서 값 확인.
- [ ] DB: 추가형(nullable 컬럼, 새 테이블)만 바로 적용. 삭제·이름 변경·타입 변경은 라이브 빌드와 프록시가 그 값을 안 쓰는지 확인한 뒤, **프록시 배포 후** 적용.
- [ ] 프록시: 라이브 빌드가 보내는/읽는 필드는 그대로 두고 추가만. 배포(`trace-proxy-server` `main` 푸시 = Vercel 프로덕션)는 **매번 사용자 승인**. 배포 후 READY 확인 + 실제 엔드포인트(`/api/history` 등) 200·기존 필드 확인.
- [ ] 운영 데이터 수정(수동 복구 SQL)은 미리보기 쿼리로 대상 수를 확인하고 사용자 승인 후 실행.

## 4. 문서화

- [ ] [RELEASE_NOTES.md](./RELEASE_NOTES.md)의 진행 중 버전 섹션에 기록: 새 기능 / 개선 / 수정 / 서버·DB(적용 상태 + 라이브 빌드 영향) / 측정(2단계 수치).
  - "무엇이 문제였고 → 어떻게 바꿨고 → 수치나 확인 방법"이 보이게.
- [ ] 큰 변경 묶음(릴리스)은 파일 단위 전수조사 문서(`CHANGES-<버전>.md`)를 만들고 [docs/README.md](./README.md)에 링크.
- [ ] 관련 문서 갱신: QA 항목이면 [QA.md](./QA.md), GEP 이상 동작은 [GEP-BUGS.md](./GEP-BUGS.md), 계획 변경은 [ROADMAP.md](./ROADMAP.md), 측정 방법은 [METRICS.md](./METRICS.md).
- [ ] 배포·적용한 것은 커밋 해시·배포 id·확인 결과까지 적는다(예: v1.0.0 "배포 검증").
- [ ] 아직 못 한 것(OW 실기 확인, 미실행 SQL, `isPremium` 등)은 "배포 전 확인"에 남긴다.

## 5. 커밋·푸시

- [ ] 커밋 전 민감 정보 확인: `.env`·키·개인 uid(녹화 픽스처는 `.gitignore`), `plans.txt`·`.claude/launch.json` 제외.
- [ ] `update` 브랜치에만 커밋. 푸시는 사용자 승인 후. PR·`main` 머지는 요청이 있을 때만.
- [ ] 푸시 후 `git ls-remote`로 `main`·태그가 그대로인지 확인.

## 6. 보고

- [ ] 한 일, 수치(전/후), 확인 방법, 남은 일과 이유를 짧게 보고.

---

## 릴리스할 때 추가로

1. 버전 올리기: `manifest.json`, `package.json`, `package-lock.json`, `README.md`.
2. `npm run check` → `npm run metrics`(전체) → RELEASE_NOTES 측정 표 갱신.
3. `src/App.tsx` `isPremium`이 `false`인지 확인(스토어 빌드).
4. 태그는 사용자가 정한 시점에. 새 빌드가 스토어에 나가면 `check-compat.mjs`의 `DEFAULT_BASE`를 그 커밋으로.
