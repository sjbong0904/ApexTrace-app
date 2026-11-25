# ApexTrace 문서

내부 문서 허브. 루트 [README](../README.md)는 GitHub/외부용 앱 개요·셋업이고, 상세·운영은 여기만 보면 됩니다.

내부용 문서는 **한국어**. 스토어·SNS에 그대로 붙이는 카피만 EN/JA로 유지 ([LAUNCH.md](./LAUNCH.md) §2·§3 템플릿).

| 문서 | 용도 |
|------|------|
| [RELEASE_NOTES.md](./RELEASE_NOTES.md) | 버전 변경 이력 (v0.0.13+는 버전별 테스트·성능 측정 포함) |
| [CHANGE-ROUTINE.md](./CHANGE-ROUTINE.md) | **변경할 때마다** 하는 순서: 테스트 · 지표 기록 · 성능 비교 · 라이브 빌드 호환 · 문서화 · 커밋 |
| [CHANGES-1.0.0.md](./CHANGES-1.0.0.md) | v0.0.15 → v1.0.0 파일 단위 변경 전수조사 |
| [METRICS.md](./METRICS.md) | 테스트·버전 지표·시작 벤치마크 사용법 (`npm test`, `npm run metrics`) |
| [ROADMAP.md](./ROADMAP.md) | 제품 향후 계획 + Overwolf API 후보 (**Free QA 후 Premium 출시 체크리스트** 포함) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 매치 데이터 V3 (summary/detail, seasons, `payload.matches` 클라 집계, 로스터 트래픽) |
| [SEASON-ROLLOVER.md](./SEASON-ROLLOVER.md) | 시즌·스플릿 전환마다 할 일 (`seasons` 행·게임 데이터 추출·맵/레전드/무기·검증·수동 재배정) |
| [WEAPON-STATS.md](./WEAPON-STATS.md) | Weapons 탭 지표·킬/데스 귀속·Top Threats |
| [PLAYSTYLE.md](./PLAYSTYLE.md) | 매치 플레이스타일 서사·키 설계 (초기본, QA 후 구현) |
| [NICKNAME-SEARCH.md](./NICKNAME-SEARCH.md) | 닉변·alias·exact 검색·keep-alive / ALS 예산 |
| [DB-OPTIMIZATION.md](./DB-OPTIMIZATION.md) | Supabase 테이블·인덱스 실측과 단계별 최적화 계획 (미구현) |
| [RING-HEATMAP.md](./RING-HEATMAP.md) | 전체 사용자 링 중심 히트맵: 격자 집계·같은 경기 중복 제거 설계 (미구현) |
| [GEP-BUGS.md](./GEP-BUGS.md) | Apex GEP에서 실측한 버그·quirk |
| [GEP-REQUESTS.md](./GEP-REQUESTS.md) | Overwolf GEP 이벤트 요청 (제출본·예정 티켓) |
| [STORE-QA.md](./STORE-QA.md) | Overwolf 스토어 QA 피드백 라운드 |
| [QA.md](./QA.md) | Overwolf 제출·수동 QA 체크리스트 |
| [LAUNCH.md](./LAUNCH.md) | Phase 1 런칭: infra → store → organic → week-2 |

**런칭 읽는 순서:** QA → LAUNCH(infra) → LAUNCH(store) → ship → LAUNCH(organic) → week-2.  
**개발:** ARCHITECTURE / WEAPON-STATS / PLAYSTYLE / NICKNAME-SEARCH / RING-HEATMAP / ROADMAP / GEP-REQUESTS. **릴리즈 기록:** RELEASE_NOTES.
