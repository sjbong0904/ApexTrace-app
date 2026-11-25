# ApexTrace Release Notes

## v1.0.0 — 2026-11-25

v0.0.15(Overwolf QA 제출본) 이후 전체 변경. 0.0.16은 태그·배포 없이 이 버전에 합쳐졌고, 변경량(87개 파일 수정 + 새 파일 70여 개)이 커서 1.0.0으로 올림. 파일 단위 전수조사: [CHANGES-1.0.0.md](./CHANGES-1.0.0.md). 브랜치 `update`.

> **배포 전 확인:** `src/App.tsx`의 `isPremium`은 로컬 미리보기 값(`true`)으로 커밋됨 — 스토어 빌드 전 `false`. 레벨·닉네임 복구 SQL([서버·DB](#서버db-2026-11-25-상태)), OW 실기 확인(최소 높이 720·부트 셸·하드웨어 가속 끈 상태의 캔버스·고정한 supabase-js 2.91.1) 남음.

### 새 기능

- **링 수집 + 지도 링 표시** — GEP `ring`(`next_ring`/`active_ring`)을 라운드별로 저장(`ringRounds`, 수축 샘플 `activeSamples`). 지도 보기를 경로 → 경로+링 → 리플레이로 순환. Free는 각 라운드가 닫힌 링을 정적으로 겹쳐 표시. GEP `next_ring` 중심 좌표는 쓰레기 값이라 버리고, 수축이 끝난 시점의 active 중심으로 채움(단위 = 위치 m × 100, [GEP-BUGS.md](./GEP-BUGS.md)).
- **맵 리플레이 (Premium, Free 하루 1회)** — 이동 마커와 실시간 링, 재생/일시정지·배속·진행 바, 약 30fps. 전투 로그·로드아웃 행을 누르면 그 시점으로 이동하고 행을 강조.
- **계정 스탯 (GEP `player_stats`)** — 로컬 플레이어의 계정 스냅샷을 받아 바뀐 키만 `POST /account-stats`로 업로드. 프로필 카드 레벨·RP 실시간 반영, 랭크 RP 변화를 끝난 랭크 경기에 바로 표시(서버 `rpApplied`로 확정). Premium: 사이드바 프로필 ↔ 계정 기록(앱 없이 한 경기 포함) 전환, 통계에 계정 시즌 카드.
- **매치 공유 이미지** — 펼친 매치 탭 바의 버튼으로 요약 카드를 PNG로 만들어 클립보드에 복사(미지원 시 저장). 공개 게시를 고려해 팀원 이름은 넣지 않음.
  - **공유 바 + X·페이스북** — 공유 버튼을 탭 바 끝에서 오른쪽 탭 칸 아래의 공유 바(40px)로 옮기고 X·페이스북 버튼 추가. 두 사이트 모두 링크로 이미지를 첨부할 수 없어서, 누르면 이미지를 클립보드에 복사(미지원 시 저장 → "게시물에 첨부하세요")한 뒤 X 작성 창(`x.com/intent/tweet`, 해시태그 `#ApexLegends #ApexTrace`만 채움 → 번역 불필요) 또는 facebook.com을 연다. 페이스북 sharer는 공개 URL이 필요한데 아직 스토어 URL이 없어 피드를 연다(`STORE_URL`이 생기면 `buildShareTargetUrl`에서 sharer로 바꿀 수 있음). 인스타그램은 PC에서 작성 창을 여는 공식 방법이 없어 넣지 않음. 인게임 창에서는 설정의 외부 링크와 같은 확인 창을 거친다(`useOpenExternal`, 기존 `settings.externalLink.*` 문구 재사용). 아이콘은 `react-icons/fa6`(Font Awesome Free 6, CC BY 4.0) → `credits.ts`·`THIRD_PARTY_NOTICES.md`에 추가.
  - **펼친 매치 높이 440 → 480px** — 넓은 레이아웃(지도 : 탭 = 1.2 : 1)은 그대로 두고, 공유 바 높이(40px)만큼만 늘림 → 탭 영역 높이는 기존과 같음. 헤드리스 실측(데모 프로필, 지도 칸 / 탭 칸): 1080×720 531×480 / 442 · 1680×920 785×480 / 653. 최소 창(1080×720)에서 매치 줄 + 펼친 칸이 97 ~ 652px로 한 화면에 들어옴(보이는 영역 719px). 큰 창에서 정사각형 지도 양옆 여백은 기존과 같음. 좁은 레이아웃(상세 폭 900 미만, 위아래 배치)은 탭 330px 그대로 + 공유 바 40px. 지도 칸을 정사각형으로 고정하거나, 높이를 572px로 키우고 창 높이에 맞춰 줄이는 방식도 시도했으나 되돌림.
  - **언어 팩:** `share.shareX`·`share.shareFacebook`·`share.savedAttach` 3키를 en·ko에만 **추가**(기존 `share.*`도 en·ko만 있고 나머지 8개 언어는 영어로 대체됨), 시드 버전 25 → 26. **DB 반영 완료 (2026-11-25, `npm run seed:languages`)** — 실행 전 DB(v25)와 시드 대조(DB에만 있는 키·문구 차이 0), 실행 후 10개 언어 모두 v26 · 기존 키 유실 0 · 문구 변경 0 · 추가 6개(en·ko 각 3개, 전부 `share.*`), active/default 그대로. 라이브 v0.0.15는 이 키를 쓰지 않아 보이는 문구가 같음.
- **첫 실행 경험** — 계정 감지 전에는 익명화한 실제 경기 23개로 만든 샘플 프로필(Premium 보기 해제, 해 볼 것 3가지 체크, 가이드 투어). 계정이 잡히면 자동으로 내 기록으로 전환. 내 계정·매치 0개면 설치 진행 단계 + 첫 매치 미리보기, 첫 매치가 기록되면 축하 후 자동으로 열기.
- **Premium 안내** — Free vs Premium 비교 시트, 출시 알림 토글(기기별), 좌측 메뉴 금색 Premium 항목. 잠긴 탭은 탭별 가치 문구 + 내 데이터 1행 미리보기. 결제는 아직 없음.
- **시즌 선택기** — 시즌 드롭다운 + Split 1 / Split 2 / Season 버튼. 드롭다운에는 이 플레이어 기록이 있는 시즌(+현재 시즌)만. 웹 셸에도 적용.

### 화면 개편

- **매치 상세** — 아코디언으로 접힌 행은 상세를 마운트하지 않음(목록 DOM 2,871 → 978). 지도가 중심이 되는 레이아웃(넓으면 옆, 좁으면 위), 데스크톱 4탭(Overview / Details / Combat log / Loadout). Overview에 "최근 경기 대비" 막대(가운데 = 내 평균, 양끝 = 최근 20경기 최저·최고).
- **매치 상세 DETAILS 탭 지표 재구성** — 2개씩 짝지어 5줄: 생존 시간·이동 거리 / 킬 관여율·녹다운당 대미지 / 헤드샷 비율·수류탄 대미지(비중 %) / 기절 횟수·부활·리스폰 / 궁극기 사용·링 밖 체류 시간. 헤드샷 적중 수·킬당 대미지·넉→킬 전환율·분당 대미지·평균 이동 속도·총 녹다운·총 어시스트 카드 제거(계산은 플레이스타일 판정용으로 유지). 수집되지 않은 값은 0 대신 `-`로 표시. 계산: `src/utils/matchDetailStats.ts`.
- **매치 플레이스타일 v2** — 판정을 `src/utils/playstyle.ts`로 분리(`extractPlaystyleSignals` → `classifyPlaystyle` → `PLAYSTYLE_VISUALS`). 기존 규칙은 킬·딜·순위·이동만 봐서, 정상 매치 705판 중 군인(soldier)·NPC·아틀라스 세 개가 71.6%였음. 리스폰·부활·내 다운·킬/녹다운 시각·무기별 킬·무기 타임라인·링 밖 체류 시간을 쓰는 신규 13키(불사조·부활·에이스·폭풍·오뚝이·링 서퍼·원툴·마무리·수집가·서포터·생존왕·선봉대·교전꾼)를 추가하고, 복귀·몰아치기 서사를 `champion`보다 먼저 판정. 도달 불가였던 `protagonist` 조건 수정, `atlas`·`soldier`는 조건만 축소(문구 그대로). 같은 705판 기준 상위 3개 31.5%, 최다 키 11.8%, 등장 키 19 → 32(실제 모듈로 재실행해 시뮬레이션과 705/705 일치). 신호가 없는 구버전 매치는 해당 규칙을 건너뜀. `janitor`·`runner`·`ghost`는 v2에서 안 씀. 설계·분포: [PLAYSTYLE.md](./PLAYSTYLE.md).
  - **표시명은 전 언어 영어** — 번역한 이름은 게이머 용어 느낌이 살지 않아, 카드의 이름은 `t(..., { lng: 'en' })`로 항상 영어(`Phoenix`, `Backpack` …), 툴팁 설명(`sub`)만 현지어. 언어 팩은 건드리지 않음(각 언어의 `name` 값은 남아 있지만 v1.0.0에서는 안 씀). 칸 넘침 확인(dev 웹 레이아웃, 실제 매치 카드에 36개 이름을 넣어 실측): 가장 긴 `Heartbreaker` 117~122px, 카드 이름 칸 최소 131px(창 너비 800) → 말줄임 0개. 1024~2560 너비는 칸 187~261px.
  - **카드 스타일 등급** — 36개 카드가 전부 비슷한 그라데이션이라 흔한 문구와 드문 문구가 구분되지 않았고, 흰 글자 대비가 기준(4.5) 아래인 색이 20개(3 미만 11개: Pacifist 1.1, Aimbot 1.3, Champion 1.6 등). 6등급(S 전설 · A 하이라이트 · B 이야기 · C 스탯 · D 중립 · E 가벼운 부정)으로 글로우·테두리·광택·단색·무늬를 나누고, 색은 대비 ≥ 3.5를 지키며 서로 최대한 멀어지게 재배치(거리 8 미만 짝 27 → 4), 키마다 다른 워터마크 아이콘(Game Icons 36개) 추가. 광택은 마운트 1회·hover만(무한 애니메이션 없음), 툴팁이 잘리지 않도록 장식은 안쪽 레이어에서만 자름. 아이콘 path(~50KB)는 지연 로드 청크(`playstyleIcons`, gzip 22.8KB) → 시작 번들은 gzip +0.7KB(desktop.js +370B, desktop.css +327B). 처음엔 `react-icons/gi`를 그대로 import해서 시작 시 받는 `icons` 청크가 gzip +22KB 커졌음 — CombatLog·Sidebar가 같은 모듈을 즉시 쓰고 있어 지연 import로는 분리되지 않아 path 데이터를 자체 모듈로 옮김. 시작 벤치마크(11회, 직전 v1.0.0 기록 대비): 데스크톱 첫 화면 settled 530 → 517ms, 데모 594ms(−24), 프로필 747ms(−26), long task 0 — 악화 없음. 설계: [PLAYSTYLE.md §8.1](./PLAYSTYLE.md).
- **BEST WEAPON 카드 탄종 색** — 카드 배경이 탄종 색을 22%만 섞은 옅은 그라데이션이고 글자는 테마색이라, 옆의 진한 플레이스타일 카드와 밝기가 맞지 않았음. 탄종 색과 같은 색상(hue)의 진한 그라데이션 + 흰 글자로 변경(`getWeaponCardBackground`, `AMMO_CARD_SHADES`). 밝기는 플레이스타일 그라데이션 평균(OKLab L 0.50 → 0.42)에 맞추고, 11px 글자가 있어 흰 글자 대비 ≥ 4.5를 지키는 선까지만 채도를 낮춤(테스트로 고정). 탄종 2개 무기는 첫 탄종 → 둘째 탄종 그라데이션, 보급 무기는 Mythic, 엘리트는 Arrows(금색).
- **오픈소스 라이선스 표기** — CC BY 아이콘(Game Icons 3.0, Font Awesome Free 4.0)을 출처 표기 없이 쓰고 있었음. 설정 > 앱 정보에 "오픈소스 라이선스" 행 추가(누르면 아이콘 5종·라이브러리 7종과 라이선스 링크 목록, 링크는 기존 `openExternal` — 인게임 창에서는 확인 후 기본 브라우저). Game Icons 작가 7명(Lorc 16 · Delapouite 16 · Sbed 2 · Carl Olsen · Aussiesim · DarkZaitzev · John Colburn)은 game-icons 저장소 폴더와 path 데이터를 대조해 확인, 플레이스타일 아이콘은 "recolored, resized and rotated" 명시. 목록 작성 중 `react-icons/ci`(Circum Icons, **MPL-2.0**)·`react-icons/cg`(css.gg, MIT)도 쓰고 있던 것을 발견해 포함. 저장소 루트 `THIRD_PARTY_NOTICES.md`에 전문, 데이터 `src/utils/credits.ts`, 테스트 `credits.test.ts`가 src에서 import하는 react-icons 세트·Game Icons 아이콘마다 표기가 있는지 검사(새 아이콘 세트를 쓰면 표기 없이는 테스트 실패).
  - **언어 팩:** `settings.items.licensesTitle/licensesDesc`, `settings.licenses.icons/libraries` 4키만 10개 언어로 **추가**(`check:compat` 문구 변경 0), 버전 24 → 25. **DB 반영 완료 (2026-11-25)** — 실행 전 DB(v24)와 시드 대조(DB에만 있는 키·문구 차이 0), 실행 후 10개 언어 모두 v25 · 기존 키 유실 0 · 문구 변경 0 · 추가 4개(전부 `settings.*`), active/default 그대로.
  - **언어 팩:** `playstyles.*`에 신규 13키만 10개 언어로 **추가**, 기존 키·문구는 그대로(`check:compat` 문구 변경 0). 시드 버전 23 → 24. **DB 반영 완료 (2026-11-25, `npm run seed:languages`)** — 실행 전 DB(v23)와 시드를 대조해 DB에만 있는 키·문구 차이 0을 확인하고, 실행 후 10개 언어 모두 v24 · 기존 키 유실 0 · 문구 변경 0 · 추가 26개(전부 `playstyles.*`), active/default 그대로. 라이브 v0.0.15는 새 버전을 받아도 보이는 문구가 같음.
- **전투 로그** — 킬피드형 고정 열(공격자 · 무기 실루엣 · 이벤트 아이콘 · 피해자).
- **프로필·사이드바** — 실제 RP 기준 차트(티어 색·티어 하한선·RP 축), 최근 20경기 순위 블록, 이름 옆 수동 새로고침. 랭크 티어 하한(S28–S31: Bronze 1000 · Silver 3000 · Gold 5500 · Platinum 8500 · Diamond 12000 · Master 16000).
- **내비게이션** — 데스크톱은 Matches + Statistics를 "Records" 하나로 통합, 아이콘 아래 라벨, 구분선.
- **통계 탭** — 공통 카드·이미지 헤더·분석 패널·2열 그리드로 전 하위 탭 재구성, 카드에서 다른 탭으로 이동(맵 카드의 레전드 → 레전드 탭).
- **무기 이미지** — 게임 HUD 흰색 실루엣 + 탄약색 타일(통계·티어표·전투 로그), 크기 배율 1×로 통일.
- **테마 대비** — 보조 텍스트 ≥ 4.5:1, 흐린 힌트 ≥ 3.5:1.

### 개선

- **팀메이트 프로필 초상화·랭크 지연** — 매치 상세 팀메이트 클릭 시 `{uid, name}`만 넘어와 이름만으로 캐시로 판정, ALS를 건너뛰고 레벨 0 감지 effect의 두 번째 로드에서야 레전드·RP가 채워지던 문제. 이름만 있는 경우 캐시로 보지 않고, ALS 응답 전에 주소록 DB 행으로 먼저 그림. 로딩 중에는 레벨 0 effect가 ALS를 중복 호출하지 않으며, 클라이언트 `/apex-stats` 동시 요청은 하나로 합침. 다른 유저로 바뀔 때 이전 유저 레전드·랭크명이 잠깐 남던 것도 수정.
- **ALS 호출 절감 (서버)** — `global_profiles.als_synced_at` 추가(`20261117090000_global_profiles_als_synced_at.sql`). `/apex-stats` uid 조회에 DB 캐시(10분) 추가, 닉네임 DB 캐시 판단도 `updated_at` 대신 이 컬럼 사용. keep-alive는 `als_synced_at` 오래된 순(미동기 우선). `/apex-stats` upsert에 `prestige` 누락 수정. **마이그레이션 적용 후 프록시 배포.**
- **흰 화면 깜박임 제거** — 네이티브 창은 `changeSize`/`changePosition` 호출만으로 흰색으로 다시 그려짐. 모니터 식별에서 너비·높이를 빼고(전체화면·DPI로 흔들림), 크기·위치가 실제로 바뀔 때만 호출, 화면 밖으로 나간 창만 구조, 최대화·숨김 창은 크기 조정 안 함, 포커스·해상도 이벤트로는 창을 건드리지 않음. 사이드바 배지의 무한 반짝임 애니메이션(유휴 중 초당 ~270프레임, 고주사율 모니터에서 흰 깜박임)을 1회 + hover로 변경.
- **목록 재렌더 감소** — 30초 폴링이 같은 내용이면 이전 배열·객체를 그대로 재사용해 매치 목록이 다시 그려지지 않음.
- **이미지 디스크 캐시** — 이미지를 처음 한 번 Supabase에서 받아 Overwolf 앱 데이터에 저장하고 재사용. 프로필(새 기기) 5.1MB → 1.8MB, 재방문 4.7MB → 0.57MB. 없는 파일은 깨진 이미지 대신 투명 처리.
- **첫 화면 장식 지도 14.5MB → 76KB** — 첫 실행 패널·광고 레일 배경이 `previewImageUrl('worlds_edge_s30.png')`를 썼는데, 미리보기 파일을 패키지에서 뺀 뒤로 4096² 원본(14.5MB)을 받고 있었음(시작 벤치마크로 발견). 1024px webp(`src/assets/worlds-edge-decor.webp`)를 번들에 넣어 네트워크 요청 없이 표시. 첫 화면 네트워크 15.5MB → 1.0MB, 안정화 774 → 517ms, JS 힙 27.0 → 12.8MB. 맵 리플레이 등 실제 지도는 원본 그대로.
- **광고 레일을 Overwolf 광고 영역 배치(440×670)에 맞춤 / 최소 창 높이 780 → 720** — 레일 안 "Go ad-free with Premium" 버튼 제거(좌측 메뉴 Premium 유지), 400×60 ↔ 400×600 사이 간격을 빈 요소+gap 두 번(28px) → 한 번(10px), 상단 여백 12 → 10px. 400×600 하단이 창 기준 775 → 716px로 올라와 1366×768(Win11 작업 영역 720px)에서도 두 광고가 온전히 보임(헤드리스 측정, 715px부터 잘림). 레일 너비 433 → 441px(High Impact 광고 영역 최소 440px 충족). 1366×720은 타이틀바+두 광고만으로 695px이라 여전히 불가.
- **시작 화면 (Overwolf QA: 실행 후 바로 창 표시, 로더 허용)** — `index.html`에 JS 없이 그려지는 부트 셸(타이틀바·최소화·닫기·드래그 + 로딩 표시) 추가, React 첫 렌더가 덮어씀(`src/bootShell.ts`). 첫 페인트 428 → 48ms(시작 벤치마크), 번역 팩 로딩이 느려도 빈 창이 보이지 않음.
- **첫 실행 오프라인 화면** — 번역 캐시가 없는 상태로 오프라인 실행 시 텍스트 한 줄만 남고 타이틀바·닫기가 없던 문제. 부트 셸 안에 "인터넷 연결 확인" 안내 + 다시 시도 버튼, 온라인 복귀 시 자동 재시도. 창 이동·최소화·닫기(닫기 설정 hide/quit 따름) 동작.
- **세컨드 스크린 플래그** — 데스크톱 창에 `disable_hardware_acceleration: true` (Overwolf 세컨드 스크린 가이드). 맵 리플레이 등 캔버스 렌더링 성능은 OW 실기 확인 필요.
- **인게임 창 외부 링크 확인** — 인게임 오버레이의 설정에서 Discord·로그 폴더(브라우저 대체 경로)를 열 때 "브라우저에서 열까요?" 확인 후 기본 브라우저로 염(Overwolf QA: 인게임 링크는 OW 브라우저 또는 사용자 확인 후 기본 브라우저). 데스크톱 창은 기존처럼 바로 열림.
- **디버그 로그** — 매치·GEP 원본(`[GEP]`·`[Ring]`·`[PlayerStats]`)은 기본 켜짐, 위치(`[Location]`, ~2Hz)는 기본 꺼짐. 백그라운드 DevTools에서 `__APEX_DEBUG__` / `__APEX_DEBUG_MATCH__` / `__APEX_DEBUG_LOCATION__`로 전환. 구독에서 빠진 GEP 기능은 플래그와 무관하게 WARN.

- **스토어 QA 하위 항목 정리** — manifest `externally_connectable`에서 개발용 `localhost:3000`·`127.0.0.1:3000` 제거. `background.html`·`worker.html`의 jsDelivr `@supabase/supabase-js@2`(현재 2.119.2로 풀림)를 앱 번들과 같은 **2.91.1**로 고정. 어디서도 쓰지 않던 `tesseract.js@5` 로드 제거. 튜토리얼·데모 투어는 버튼으로만 시작하고 닫기 가능(자동 코치마크 없음) 확인.

### 수정

- **GEP 구독 누락 (ring / player_stats / match_summary / damage)** — Supabase `game_constants.gep_features`가 코드의 구독 목록을 통째로 대체해, 앱을 게임보다 먼저 켠 경우 원격 목록(14개, `ring` 없음)으로 구독되어 링·플레이어 스탯이 저장되지 않던 문제. 구독 목록은 이제 코드(`GEP_BASE_FEATURES`)가 소유하고, 원격 설정은 `gep_features_disabled`로 **끄기만** 가능(전체 또는 `minVersion`/`maxVersion` 범위). 구독 후 설정이 바뀌면 재구독하고, 누락·차단된 기능은 항상 `[GEP] subscription incomplete` WARN으로 남김. `gep_features`는 v0.0.15 이하 호환용으로만 남김.
- **미수집 매치 컬럼 기록 시작**
  - `headshots` — GEP `damage` 이벤트 `headshot:"true"` 히트 수(헤드샷 **킬** 수 아님).
  - `grenade_damage` — `grenade:"true"` 히트의 `amount` 합(실드 포함, 반올림). 이 버전부터 0 시작 → null은 미수집 빌드.
  - `damage_hits` — GEP `damage` 히트 전체 수(헤드샷 비율의 분모). null = 미수집 빌드. **프록시에 `damageHits` ↔ `damage_hits` 매핑 필요.**
  - `ultimates_used` — `me.ultimate_cooldown`이 JSON 문자열(`{"ultimate_cooldown":"15"}`)인데 `parseInt`로 읽어 항상 NaN이던 파싱 버그 수정. 단 현재 GEP가 값을 보내지 않음(Provider `Missing feature ultimate_cooldown`).
- **킬리더 제거** — 문서화된 GEP 키가 없고(HUD 현지화 텍스트뿐, `hud` 미구독) 전 행 null이던 `is_kill_leader` 제거. 프록시(`9462a69`)·타입·테스트 데이터 정리.
- **등수 오판 (stale `match_summary`)** — GEP가 직전 판 `{"rank","squadKills"}`를 다시 보내 분대 전멸 시점의 생존 팀 수보다 낮은 등수가 저장되던 문제. 불가능한 등수는 payload 전체(squadKills 포함)를 무시.
- **닉네임 깨짐** — 평범한 닉네임("HiRo", "RAMIN256" 등)이 base64처럼 보이면 디코드되어 제어문자로 저장되던 문제. 출력 가능한 문자가 아니면 디코드 거절, 두 번 적용해도 같은 결과. 기존 행 복구: `supabase/manual/repair_mangled_profile_names.sql`.
- **레벨 이중 합산** — 검색 후보의 총 레벨(level + prestige×500)을 주소록에 다시 저장해 `global_profiles.level`에 500씩 쌓이던 문제(`normalizeLevelPair`). 복구: `supabase/manual/repair_double_counted_levels.sql`.
- **드롭쉽 경로가 지상 경로로 그려짐** — GEP가 한 경기 내내 `phase`를 안 보내면 이전 판 값(`landed`)이 남아 드롭쉽 구간까지 그려지던 문제. 이번 세션에서 PHASE 이벤트를 받은 경우만 신뢰하고, 아니면 속도로 낙하 구간을 잘라냄(`groundPath.ts`, 지도·리플레이·공유 카드 공통).
- **무기 귀속** — 적이 나를 넉다운한 행의 적 무기를 내 무기로 킬·어시스트에 귀속하던 문제. 케어패키지 Mozambique(`mp_weapon_shotgun_pistol_crate`) 인식.
- **킬 관여율 100% 고정** — squadKills가 없는 경기(구버전 수집·팀 킬 0)에서 내 킬로 대체되던 것을 해당 경기 제외로 변경. 넉 지표(`avgKnocks`·`knockToKillRate`) 추가, 넉 미수집 경기는 제외.
- **로컬 DB 병합 손실** — 같은 `matchId`가 한 배치에 두 번 오면 앞의 병합이 사라지던 문제. 배치 내 중복을 먼저 합치고 읽기·쓰기를 한 트랜잭션으로.
- **오래된 상세 캐시** — 상세 버전 v2(`ring_rounds`)보다 오래된 로컬 캐시는 열 때 한 번 재요청.
- **공백 있는 이미지 경로** — 따옴표 없는 CSS `url()`이 "mad maggie" 같은 경로에서 무시되던 문제.
- **티어표 모드 전환 시 저장 순서** — 모드를 바꾸는 순간 이전 모드의 표가 새 모드 키로 한 번 저장되던 문제(로드 effect와 저장 effect가 같은 커밋에서 실행). 모드 전환 시 렌더 중에 새 모드 표를 읽도록 변경.
- **프로필 태그 아이콘 깜박임** — 아이콘 id가 바뀌면 effect(페인트 후)에서 초기화해 이전 아이콘이 한 프레임 보이던 것을 렌더 중 초기화로 변경.
- **린트 오류 120 → 0** (`npm run lint`: src 115 + admin 5, admin 경고 1건 남음) — `any` 93건을 실제 타입으로 교체: 백그라운드 창 API(`vite-env.d.ts`의 `BgProfile`·`BgSearchResult`·`SelectableProfile` 등), 검색 후보 `PlayerCandidate`, 기록 동기화·LocalDB 제네릭, `MapConfig`. React 훅 규칙 17건은 "props 변경 시 effect에서 state 초기화" 패턴을 렌더 중 조정으로 바꾸는 식으로 정리(검색창·랭크 차트·이미지 훅·통계 탭·무기 탭 등). `useApexRunning`은 `src/hooks/`, `useTheme`는 `src/theme/useTheme.ts`로 분리(Fast Refresh). ESLint에 `ignoreRestSiblings` 허용. 동작 변경 없음은 골든 스냅샷·시작 벤치마크·헤드리스 화면 순회로 확인.

### 서버·DB (2026-11-25 상태)

공용 Supabase·프록시(`trace-proxy-server`, 별도 레포)는 v0.0.15 클라이언트도 함께 쓴다. 모든 변경은 **추가형**(nullable 컬럼·새 엔드포인트·새 언어 키)이라 0.0.15 동작은 그대로다.

| 항목 | 상태 | 0.0.15 영향 |
| --- | --- | --- |
| `20261020090000_fix_global_profiles_write_rls.sql` + `…090100_revoke_global_profiles_extra_client_grants.sql` — `global_profiles` 쓰기가 PUBLIC(anon)에 열려 있던 것 차단 | 적용됨 | 없음 — 0.0.15도 프록시로만 씀 |
| `20261114184658_player_account_stats.sql` + 프록시 `/account-stats`(`45a72bf`) | 적용·배포됨 | 없음 — 0.0.15는 호출 안 함 |
| `20261117090000_global_profiles_als_synced_at.sql` + 프록시 DB 캐시(`9462a69`) | 적용·배포됨 | ALS 호출만 줄어듦 |
| `20261116120000_drop_matches_is_kill_leader.sql` | 적용됨(프록시가 먼저 필드 무시) | 없음 |
| `20261116130000_add_matches_damage_hits.sql` | **2026-11-25 적용** | 없음 — nullable |
| 프록시 `damageHits` ↔ `damage_hits` 매핑 (`6f89fb6`) | **2026-11-25 배포** | 없음 — 0.0.15 행은 null, 응답에 필드 하나 추가 |
| `manual/fix_seasons_from_game_data.sql` | 적용됨(S30 Split 2 ~ S31 Split 2 일치 확인) | — |
| `manual/repair_double_counted_levels.sql` | **미실행** — `level > 500` 92행 | 복구해도 0.0.15가 다시 쓸 수 있음 → 1.0.0 보급 후 실행 권장 |
| `manual/repair_mangled_profile_names.sql` | **미실행** — 이름에 제어문자 621행 | 프록시가 깨진 이름 쓰기를 이미 차단(`9462a69`). 미리보기로 확인 후 실행 |

1.0.0이 보내는 `damageHits`는 이 배포 이후 업로드부터 저장된다(이전 행은 null → 헤드샷 비율 `-`).

**배포 검증 (2026-11-25)**

- 배포 전: 로컬에서 `rowFromMatch`/`matchFromRow` 왕복 — 0.0.15 형태(필드 없음) → `damage_hits` null, 1.0.0 형태(`damageHits: 7`) → 7 저장·조회. `SUMMARY_SELECT`에 `damage_hits` 포함(컬럼을 먼저 추가해 두어 조회 실패 없음).
- Vercel: 커밋 `6f89fb6` 프로덕션 배포 `dpl_5rdonjd9roazwEfu9Jy672UtrKfD` BUILDING → **READY**.
- 배포 중·후 `/api/history` 3분간 10초 간격 18회 호출 — 전부 HTTP 200(중단 없음).
- 배포 후 실제 사용자 1명 `/api/history`(summary): HTTP 200, 20경기, 기존 필드(kills 등) 그대로, 기존 행 `damageHits` = null.
- 0.0.15 클라이언트 관점: 보내는 데이터 변화 없음, 응답에 읽지 않는 필드 하나 추가뿐 → 영향 없음.

**언어 팩 version 23 (2026-11-25 시딩 완료)** — v23: 호환 검사(`npm run check:compat`)에서 한국어 `statistics.maps.legendWinPercent`가 "승률%" → "승률"로 바뀐 것이 발견되어(0.0.15 통계 헤더에도 반영되던 변경) "승률%"로 복구. 이제 0.0.15 대비 문구 변경 0건.

**언어 팩 version 22** — v17(QA 제출본) → 22. 0.0.15가 쓰는 739개 키는 모두 유지하고 보간 변수도 바뀌지 않았다(10개 언어 비교). v21에서 1.0.0 탭 이름 때문에 `combatLog.title`이 "Combat Log" → "Combat"으로 바뀌어 0.0.15 전투 로그 제목까지 짧아졌던 것을 되돌렸다. 짧은 이름은 새 키 `combatLog.tabTitle`로 분리. 클라이언트 언어 캐시 키는 `languages_cache_v5`.

### 테스트·측정 도입

- **vitest 테스트 84개** — `src/utils/__tests__/`: 단위 테스트 + 익명화 실제 경기 23개(`demoMatches.json`) 골든 스냅샷(통계·레전드/무기/위협/맵 집계·종합 티어·팀원·최근 비교·경기 상세·리플레이/링). `npm test`, `npm run test:coverage`.
- **버전 지표 `npm run metrics`** — 테스트·커버리지·TS/린트 오류·번들 크기·시작 벤치마크를 측정해 `metrics/history/<버전>.json`, `metrics/HISTORY.md`, `metrics/diffs/<버전>.md`에 기록. `--ref <태그>`로 과거 버전을 같은 기준(현재 테스트 포함)으로 재측정.
- **시작 벤치마크** — 헤드리스 Edge + Overwolf API 대체 + 녹화 네트워크 재생(80ms). 시나리오: 빈 첫 화면 / 데모 / 저장 프로필 새 기기 / 재방문. 사용법·해석: [METRICS.md](METRICS.md).

### 개발 도구·문서

- **변경 루틴** — [CHANGE-ROUTINE.md](./CHANGE-ROUTINE.md): 변경마다 테스트 → 지표 기록·성능 비교 → 라이브 빌드 호환 → 문서화 → 커밋. `npm run check`(테스트·타입체크·린트·빌드·호환 검사 한 번에), `npm run check:compat`(`scripts/check-compat.mjs`: 라이브 빌드 `c68b2ce` 대비 언어 키 누락·보간 변수·문구 변경, 새 마이그레이션의 drop/rename/revoke 표시).

- 스크립트: `build-demo-matches.mjs`(데모 데이터 생성·익명화), `game-icons/*.py`(설치된 게임에서 아이콘·시즌 일정 추출 → Supabase), `fetch-local-images.mjs`·`make-image-previews.py`(로컬 이미지).
- 새 문서: [METRICS.md](./METRICS.md), [SEASON-ROLLOVER.md](./SEASON-ROLLOVER.md), [GEP-REQUESTS.md](./GEP-REQUESTS.md), [DB-OPTIMIZATION.md](./DB-OPTIMIZATION.md)·[RING-HEATMAP.md](./RING-HEATMAP.md)(미구현 설계), [CHANGES-1.0.0.md](./CHANGES-1.0.0.md). GEP-BUGS(링)·ROADMAP·NICKNAME-SEARCH·ARCHITECTURE·QA 갱신.

### 측정 (2026-11-25, v1.0.0 기록 — `metrics/history/v1.0.0.json`)

변경 루틴([CHANGE-ROUTINE.md](./CHANGE-ROUTINE.md))으로 처음 남긴 v1.0.0 기록. `npm run metrics -- --compare v0.0.15`, 시작 수치 7회 중앙값, 녹화 네트워크 재생(80ms).

| 항목 | v0.0.15 | v1.0.0 | |
| --- | ---: | ---: | --- |
| 테스트 / 실패 / 스냅샷 불일치 | 47 / 2 / 1 | **84 / 0 / 0** | |
| 커버리지 줄 · 분기 · 함수 | 46.5 · 71.8 · 53.2% | 46.9 · **76.1** · 50.5% | 함수 비율은 새 UI 헬퍼(미테스트)로 하락 |
| TS / 린트 오류 · 경고 | 0 / 113 · 3 | 0 / **0 · 0** | |
| JS gzip (전체) | 481KB | 630KB | +149KB 중 106KB는 데모 데이터(지연 청크, 첫 실행 샘플만 로드) |
| 데스크톱 초기 로드 gzip | 384KB | 415KB | +8% |
| 첫 화면 FCP | 396ms | **48ms** | 부트 셸 |
| 첫 화면 90% 렌더링 / 안정화 | 331 / 476ms | 369 / 530ms | +11.5% — 아래 |
| 첫 화면 롱태스크 | 51ms | **0ms** | |
| 첫 화면 네트워크 | 9건 / 882KB | 10건 / **812KB** | |
| 프로필(새 기기) 안정화 / JS / 바이트 | 846ms / 214ms / 5.2MB | **773ms / 150ms / 1.6MB** | 이미지 디스크 캐시 |
| 프로필(재방문) 안정화 / 요청 / 바이트 | 685ms / 42 / 4.8MB | **574ms / 17 / 0.37MB** | |
| 데모 화면 90% / 안정화 | (없음) | 487 / 628ms | v0.0.15는 빈 화면이라 비교 불가 |

- **첫 화면 +11.5% (감수)**: 첫 실행 화면이 빈 상자에서 설치 진행·첫 매치 미리보기 패널로 바뀌어 DOM 120 → 168, 초기 JS +8%. 사용자가 보는 첫 페인트는 396 → 48ms로 오히려 빨라졌고 롱태스크가 없어짐. 전날 작업 트리 기록(v0.0.16 표기, 347 / 508ms) 대비로는 +6%(잡음 범위 경계).
- 상세: [metrics/diffs/v1.0.0.md](../metrics/diffs/v1.0.0.md), 전 버전 표 [metrics/HISTORY.md](../metrics/HISTORY.md).

### 측정 (2026-11-24, 커밋 전 작업 트리 — 버전 1.0.0으로 올리기 직전)

비교 대상은 v0.0.15. 시작 수치는 7회 중앙값, ±5–10%는 잡음. 이후 바뀐 것은 광고 레일 간격·부트 셸·인게임 링크 확인·버전 번호뿐이며, 부트 셸의 첫 페인트(428 → 48ms)는 별도 측정.

| 항목 | v0.0.15 | v1.0.0 | |
| --- | ---: | ---: | --- |
| 테스트 (현재 기준) | 42/47 통과 | **84/84** | |
| 커버리지 (`src/utils` 줄) | 46.5% (1,739줄) | 46.9% (2,470줄) | 대상 줄 3,736 → 5,272 |
| TS / 린트 오류 (`src`) | 0 / 113 | 0 / **0** | |
| JS 번들 (gzip) | 1,788KB (481) | 2,635KB (629) | +692KB는 데모 데이터(지연 청크) |
| 데스크톱 초기 로드 gzip | 384KB | 414KB | +8% |
| 첫 화면 90% 렌더링 / 안정화 | 331 / 476ms | 358 / 519ms | 소폭 증가 |
| 첫 화면 외부 요청 / 바이트 | 9 / 0.86MB | 10 / 1.0MB | |
| 프로필(새 기기) 요청 / 바이트 | 39 / 5.1MB | **30 / 1.8MB** | 이미지 디스크 캐시 |
| 프로필(새 기기) JS 실행 / 안정화 | 214 / 846ms | **145 / 753ms** | |
| 프로필(재방문) 요청 / 바이트 | 42 / 4.7MB | **17 / 0.57MB** | |
| 프로필(재방문) 안정화 | 685ms | **575ms** | |
| 프로필 화면 DOM 노드 | 2,871 | **978** | |
| 데모 화면 (신규) | — | 90% 482ms, DOM 974 | |

- 골든 스냅샷: `calculateStats`에 `avgKnocks`·`knockToKillRate` 추가. 그 외 집계 결과는 v0.0.15와 동일.
- 첫 화면 장식 지도 수정 전 측정치: 네트워크 15.5MB, 안정화 774ms, 힙 27.0MB.
- 상세: [metrics/diffs/v0.0.16.md](../metrics/diffs/v0.0.16.md) (측정 당시 버전 표기 0.0.16)

---

## v0.0.16 — 미배포

태그·배포 없이 [v1.0.0](#v100--2026-11-25)에 합쳐짐(GEP 구독 누락·미수집 컬럼·킬리더 제거).

---

## v0.0.15 — 2026-09-10

Statistics 탭 레이아웃/시각 정리, 모드 라벨 정비, 무기 실루엣 톤 통일. 상세 기준: [WEAPON-STATS.md](WEAPON-STATS.md). GitHub `v0.0.15`.

### 개선

- **대시보드 모드 라벨** — 내부 `BR` 로직은 유지하고, 표시만 **ALL**로 변경. 10개 언어 시드와 language pack version 15 동기화.
- **좁은 폭 대응** — Statistics Overview / Maps / Legends / Weapons 상단 스탯 스트립을 한 줄 유지 + 중앙 정렬로 정리하고, 레이더 + Best 3 카드도 4열 고정으로 2단 밀림을 방지.
- **무기 드롭다운 시각 통일** — 무기 선택 드롭다운 이미지를 로드아웃 타임라인과 같은 **white silhouette** 스타일로 변경하고, 확대 비율은 기존 대비 10% 축소.
- **무기 표 아이콘** — 레전드/무기 관련 표의 무기 썸네일을 탄종 색상 tinted silhouette로 통일. CARE PACKAGE는 `#D73055` mythic 톤 사용, Elite는 골드 대신 실제 탄종 색 사용.

### 수정

- **드롭다운 윤곽선 가림** — 확대된 무기 이미지가 셀 윤곽선을 덮던 문제를 오버레이 outline으로 수정.
- **레전드 초상화 프레임 제거** — 각종 표의 원형 레전드 초상화 바깥 네모 슬롯 제거로 밀도 개선.
- **케어패키지 색 통일** — mythic/care package 색상을 `#D73055`로 통일하고 관련 강조색을 HEX 기준으로 정리.

### 문서

- [RELEASE_NOTES.md](RELEASE_NOTES.md) — `v0.0.15` 릴리즈 내역 추가.
- [WEAPON-STATS.md](WEAPON-STATS.md) — 기준 버전 `v0.0.15`로 갱신.

### 측정 (2026-11-24 재측정, `v0.0.15` 태그)

태그 코드를 그대로 빌드해 현재 테스트 세트·같은 녹화 네트워크로 측정. 비교 대상은 v0.0.14.

| 항목 | v0.0.14 | v0.0.15 | |
| --- | ---: | ---: | --- |
| 테스트 (현재 기준) | 39/47 통과 | 42/47 통과 | 실패 5 → 2 |
| 린트 오류 | 119 | 113 | |
| JS 번들 (gzip) | 1,779KB (478) | 1,788KB (481) | |
| 첫 화면 90% 렌더링 / 안정화 | 330 / 475ms | 331 / 476ms | 변화 없음 |
| 프로필(새 기기) JS 실행 / 안정화 | 182 / 819ms | 214 / 846ms | JS +18% |
| 프로필(재방문) 안정화 | 547ms | 685ms | +25% (아래 주의) |

- **릴리즈 노트에 없던 집계 변화 (골든 스냅샷으로 확인)**
  - 무기 매치 수: 교체만 하고 킬·어시스트·qualify가 없는 무기는 그 경기 사용으로 세지 않음(`weaponHasMatchCredit`). 데모 데이터에서 NEMESIS 14 → 13경기 등.
  - Paired weapons: "가장 오래 든 다른 무기 1개" → **같은 시간에 다른 슬롯에 든 무기**, K/D/A도 그 동시 구간만(`computePairedPartnerCombatWhileSelected`).
  - 맵 통계: 경기 수·승률만 → K/D·평균 대미지·평균 순위·랭크 점수 추가, 정렬도 랭크 점수 기준으로 바뀜.
  - 순위 색: HEX(`#fdcb6e` 등) → 테마 CSS 변수(`var(--color-rank-first)` …).
- 현재 테스트 대비 남은 차이: `calculateStats`에 넉 지표 없음(작업 트리 v0.0.16/Unreleased에서 추가), `getRankTierNameFromRp` 없음.
- 주의: 재방문 시나리오에서 녹화에 없던 아이콘 요청 8건이 503으로 응답되어, 재방문 수치는 다른 버전보다 덜 정확함.
- 상세: [metrics/diffs/v0.0.15.md](../metrics/diffs/v0.0.15.md), 스냅샷 diff 원문 `metrics/diffs/v0.0.15.behavior.txt`

---

## v0.0.14 — 2026-09-09

무기 통계·Weapons 탭 개편. 상세 기준: [WEAPON-STATS.md](WEAPON-STATS.md). GitHub `v0.0.14`.

### 개선

- **킬 귀속** — 무기 통계 kill은 확킬 피드가 아니라 **녹다운 무기 우선** (`resolveKillCreditWeapon`). 클라이언트·background·프록시 동기화.
- **데스 귀속** — 로컬 데스마다 1.0을 생존 구간의 **유효 총기 홀드 시간 비율**로 분배. mid-match “킬만 있으면 deaths=1” 보정 제거. deaths=0이면 무기 **K/D·KA/D = N/A**.
- **Top Threats** — 나를 죽인/녹다운한 적 무기 집계 (`weaponThreats`). finalize 시 저장. 시즌 fetch 시 프록시 backfill.
- **Weapons 탭 UI** — Legends와 유사 레이아웃: Top Weapons / Top Threats → 피커 → 선택 무기 요약(매치·승률·평균순위·K/D·KA/D) → Paired weapons / Weapon legends 카드·표. Usage → **Matches**. 기본 선택 = 카탈로그 첫 무기.
- **매치 수** — 무기 사용 매치는 **정수 1/매치**로 통일 (소수 매치 폐기).
- **표시명** — `getWeaponDisplayName` / SHORT 이름 우선, i18n raw 키 노출 완화. `languages_cache_v4`. `statistics.common.na`.
- **팀메이트 표** — 최대 30명, UID 없는 닉은 집계에는 포함·목록에서 제외.

### 수정

- **레전드 피커 리사이즈 쏠림** — 최대화↔복원 시 선택창이 왼쪽으로 압축되던 레이아웃.
- **C.A.R. 이미지** — 로드아웃 id ↔ 카탈로그/이미지 매칭.
- **K/D raw 표기** — `calculateStats`가 deaths=0일 때 킬 정수를 그대로 넣던 문제, `parseFloat`로 trailing zero가 사라지던 표시를 `toFixed(2)` / N/A로 통일.
- **Weapons 표 이름 줄바꿈** — 무기·레전드명 한 줄 + ellipsis.

### 서버 (trace-proxy-server, 별도 레포)

- `weaponCombat` 데스 분배·킬 크레딧 동기화.
- 시즌 stats 경로에서 비어 있는 `weaponThreats` events 기반 backfill + persist.

### 문서

- [WEAPON-STATS.md](WEAPON-STATS.md) — 지표·킬/데스 모델·배포 메모.

### 측정 (2026-11-24 재측정, `v0.0.14` 태그)

비교 대상은 v0.0.13.

| 항목 | v0.0.13 | v0.0.14 | |
| --- | ---: | ---: | --- |
| 테스트 (현재 기준) | 38/47 통과 | 39/47 통과 | |
| 린트 오류 | 119 | 119 | |
| JS 번들 (gzip) | 1,774KB (477) | 1,779KB (478) | |
| 첫 화면 외부 요청 / 바이트 | 20 / 15.0MB | **9 / 0.86MB** | |
| 첫 화면 90% 렌더링 / 안정화 | 389 / 504ms | **330** / 475ms | 90% −15% |
| 프로필(새 기기) 요청 / 바이트 | 49 / 19.2MB | **39 / 5.1MB** | |
| 프로필(재방문) 안정화 | 695ms | **547ms** | −21% |

- 첫 화면에서 원본 지도 이미지(`worlds_edge_s30.png`, 14.5MB) 1건과 광고 SDK 관련 요청 10건(`content.overwolf.com` 8, `www.overwolf.com` 2)이 사라짐 → 첫 화면 바이트 −94%.
- **무기 집계 개편 확인 (골든 스냅샷)**: 같은 데모 23경기에서 대표 무기(`mostWeapon`)가 L-STAR → **EVA-8**, Top Weapons 순서·K/D가 크게 바뀜 — 위 "킬 귀속/데스 귀속" 변경의 실제 영향.
- 현재 테스트 대비 남은 차이: 무기·맵 집계(v0.0.15에서 다시 바뀜), 순위 색 HEX, 넉 지표 없음.
- 상세: [metrics/diffs/v0.0.14.md](../metrics/diffs/v0.0.14.md)

---

## v0.0.13 — 2026-09-06

등수 폴링 복구, 주소록 504/트래픽 절감, 매치 스키마를 컬럼 전용으로 정리. GitHub `v0.0.13`.

### 수정

- **프로필 로드 가림막 빈틈** — 오버레이가 스크롤 영역 padding 안에 있어 위·아래로 내용이 비침. 스크롤 패널 전체를 덮는 레이어로 옮김.
- **match_end 이후 GEP 재조회가 무시됨** — `overwolf.games.events.getInfo`는 `{ success, res }`로 응답하는데 `applyInfoToMatch`가 `.info`/root만 읽어 폴링 결과(특히 `match_summary`)가 조용히 버려졌음. `.res`도 읽도록 수정. 같은 판에서 클라이언트마다 등수가 갈리던 사례 중 라이브 `match_summary`를 놓친 쪽이 폴링으로 복구되도록. `[MatchAudit] match_summary applied` WARN 로그 추가.
- **주소록 갱신 504** — 매 매치 후 로스터(~60명) 전체를 한 번의 `POST /address-book`으로 보내 Vercel 10초 제한을 넘김. 클라이언트는 20명씩 순차 전송, 서버(`trace-proxy-server`)는 닉이 바뀐 UID만 alias 동기화하고 5개 병렬 처리.
- **로스터 주소록 재전송** — 매치 중 로스터가 커질 때마다 전체 ~60명을 다시 보내지 않고, 세션 동안 처음 보이거나 name/hw가 바뀐 UID만 4초 debounce 후 전송. 프로필 로드 시 값이 같으면 `address-book` POST를 건너뜀.
- **프록시 캐시 버스터 제거** — `t=Date.now()`를 빼서 `/api/seasons`, `/api/search-candidates`, `/api/apex-stats`, `/api/history` GET의 엣지 캐시가 동작하도록.

### 서버 (trace-proxy-server)

- 매치를 정규화 컬럼만으로 저장. `legacy_match` / `schema_version` / `dataQuality` / `confidence` 제거. `player_name`, `missing_signals` 컬럼으로 불완전 배지 툴팁 유지.
- 주소록 POST는 기존 행과 name/hw/platform 등이 같으면 upsert를 건너뜀.
- GET 읽기 엔드포인트에 짧은 엣지 캐시 (`history` 30s, `search-candidates` 60s, `seasons` 1h, `apex-stats` 180s).

### 측정 (2026-11-24 재측정, `v0.0.13` 태그 — 측정 기준선)

측정을 시작한 첫 버전. 이후 버전 비교의 기준선. 서버 쪽 변경(엣지 캐시 등)은 녹화 네트워크 재생이라 이 수치에 반영되지 않음.

| 항목 | 값 |
| --- | ---: |
| 테스트 (현재 기준) | 38/47 통과, 실패 5, 스킵 4 |
| 커버리지 (`src/utils` 줄) | 29.1% (886 / 3,041줄) |
| TS / 린트 오류 | 0 / 119 (경고 3) |
| JS 번들 (gzip) | 1,774KB (477KB) |
| 초기 로드 gzip (데스크톱 / 백그라운드) | 383KB / 252KB |
| 첫 화면 FCP / 90% 렌더링 / 안정화 | 392 / 389 / 504ms |
| 첫 화면 외부 요청 / 바이트 | 20 / 15.0MB (원본 지도 14.5MB 포함) |
| 프로필(새 기기) 90% / 안정화 / JS 실행 | 509 / 802 / 178ms |
| 프로필(새 기기) 요청 / 바이트 / DOM | 49 / 19.2MB / 2,883 |
| 프로필(재방문) 안정화 / 요청 / 바이트 | 695ms / 41 / 18.8MB |

- 현재 테스트 실패는 버그가 아니라 이후 버전에서 바뀐 동작: 무기 집계(v0.0.14), 맵 집계·순위 색(v0.0.15), 넉 지표(v0.0.16/Unreleased), 이후 추가된 모듈(스킵).
- 상세: [metrics/diffs/v0.0.13.md](../metrics/diffs/v0.0.13.md)

---

## v0.0.12 — 2026-09-05

Overwolf 스토어 QA 피드백 반영, 등수·좌표 보정, 프로필 로드 가림막. GitHub `v0.0.12`.

### 수정

- **스토어 QA (2026-09)** — [STORE-QA.md](STORE-QA.md)
  - 광고 링크: `manifest` `force_browser: "user"` (시스템 기본 브라우저)
  - in-game minimize가 2nd-screen 광고를 죽이던 `onStateChanged` 창 필터 누락
  - `openUrlInDefaultBrowser` 2인자 호출 → 로그 Uncaught Error (Settings/tray Discord)
  - FTUE / coach marks 중 창 드래그 (타이틀바 z-index, empty 영역, tutorial capture)
  - 광고 슬롯 흰 배경 완화 (다크 플레이트 + OwAd 자식 transparent)
- **사망 시점 등수 고정** (QA §5.2 이슈 A) — 등수 추정을 `Utils.applyPlacementEstimate` 하나로 통일. 생존 팀원이 있으면 추정 안 함, 로스터 없는 로컬 사망은 provisional로 `tabs.teams` 최솟값을 따라가고, 전멸 신호·팀원 전원 death에서 freeze. 먼저 나간 경우(lobby fallback / 팀원 생존 중 summary)는 `placement_estimated` 플래그.
- **이전 매치 사망 위치가 다음 매치 첫 좌표로 기록** (QA §5.2 이슈 B) — pre-match phase 좌표 무시, 이전 세션 마지막 GEP 좌표(`Store.lastSessionEndPos`)와 같은 첫 좌표 거절, 좌표가 움직인 뒤에만 첫 포인트 채택. `startPos`/`endPos`는 채택 포인트에서만 갱신.
- **Free 고정 복원** — `isPremium = false` (스토어 QA 빌드).
- **프로필 로드 가림막** (2026-09-05) — `ProfileLoadingOverlay`가 스크롤 컨테이너에서 `absolute; inset: 0`이라 첫 화면만 덮고, 아래로 스크롤하면 매치/통계가 그대로 보였음. 프로필 로드는 `sticky`로 보이는 영역에 붙이고 로딩 중 메인 스크롤을 잠금. 아카이브 동기화 오버레이는 리스트 전체 `absolute` 커버 유지.

### 개선

- **닉네임 검색** — case-insensitive **exact**만 사용. 현닉(`global_profiles.name`) → 이전닉(`profile_name_aliases`, UID당 3·30일) → ALS. GEP/ALS/keep-alive 닉 변경 시 alias 동기화. 후보 모달에 former-name 표시.
- **keep-alive** — `updated_at` 오래된 순, 회당 12명·순차 5초. **목표**는 분당 1회(출시 후에도 동일). **현재 Hobby**는 Vercel cron 하루 1회만; Pro 후 `* * * * *`로 전환 ([NICKNAME-SEARCH](NICKNAME-SEARCH.md) §5, [LAUNCH](LAUNCH.md) §1.2.1).

### 문서

- [NICKNAME-SEARCH.md](NICKNAME-SEARCH.md) — 설계·Hobby/Pro cron·운영 체크
- QA §닉네임 · LAUNCH §1.2.1 keep-alive cron
- [STORE-QA.md](STORE-QA.md) — Overwolf 스토어 QA 피드백 (2026-09) 기록

---

## v0.0.10 — 2026-08-06

전투 집계·고스트 매치 방어와 문서 정리. GEP 로케일 finish / tabs 미발송 실기 로그 반영.

### 수정

- **팀메이트 킬 누락** — `출혈`·`링` 등 로케일 finish를 팀메이트에도 knock→opaque 페어링으로 집계 (언어 사전 없음). 로컬 `_pendingKnocks`와 분리된 `_squadCombatPairs` 사용.
- **20등 / 0킬·0딜 고스트** — tabs·로드아웃·동선이 비고 등수만 기본 20인 세션은 버림. 다만 **완성된 형제 세션이 있을 때만** 버려서, 한 판이 둘로 쪼개진 경우 전투로그 백필 기회를 남김.
- **전투로그 → tabs 백필** — 버릴 수 없는 hollow 절반에 대해 local kill/assist/knock을 이벤트에서 복구.

### 개선

- **매치 경계·업로드** — live/post-elim `legendSelect` 분할, keeper sibling 메타(`hadStats`/`completed`) 기록.
- **맵** — World's Edge Season 30 에셋 (`worlds_edge_s30.png`).
- **UI / 로케일** — 통계·사이드바·맵 시각화·시드 카피 소규모 갱신 (10개 언어 동기화).

### 문서

- [GEP-BUGS.md](GEP-BUGS.md) — 실기 관측 이슈 목록.
- Docs hub — [ARCHITECTURE](ARCHITECTURE.md) / [QA](QA.md) / [LAUNCH](LAUNCH.md) / [ROADMAP](ROADMAP.md) (구 `docs/launch/`, `match-data-architecture-v3` 통합).
- README — 버전 `0.0.10`, 문서 링크 갱신.

---

## v0.0.9 — 2026-07-27

매치 경계(capture) 로직을 **이상적 GEP 계약** 기준으로 재정리. Overwolf 측에 연속 큐 시 `match_start`/`pseudo`/`legendSelect` 누락 이슈도 제보함.

### 개선

- **1차 경계** — `match_start` / `match_end`를 주 시작·종료 신호로 사용.
- **2차 경계** — `pseudo_match_id` 부여·클리어·교체, 스쿼드 `legendSelect_*` 채움·null 클리어로 start/end 누락 보정.
- **3차** — `legend_selection` phase / stats_reset / orphan 타이머.
- **세션 vs 업로드 분리** — `MatchLifecycle`(핸드오프)과 `MatchUploadQueue`(POST)를 분리해, 이전 판 업로드가 다음 판 캡처를 막지 않음.
- **시작/종료 레이스 방어** — pending `match_end` 타이머를 rotate 시 취소, 1차 end 대기 중 2차 end/start 보류, 세션 종료 후 `match_start` 15초 가드 완화.

### 문서

- README — 레거시 `match-storage-v2` 링크 정리, 버전 `0.0.9`.

---

## v0.0.8 — 2026-07-23

Overwolf Free 티어 QA 제출용 빌드. 데스크톱 광고 + Free 게이트 고정 (Premium 미리보기 제거).

### 새 기능

- **OwAd 데스크톱 광고 레일** — 오른쪽 `AdsRail`: 상단 **400×60**, 하단 **400×600**. `OwAd.shutdown()` / `containerId` / SDK ready 대기. SETTINGS·검색 모달·종료 다이얼로그·minimize·GEP 드롭다운 시 `display:none` pause.
- **인라인 프로필 헤더** — 대시보드에 프로필 카드 + 스탯 카드 나란히 (`InlineProfileSection`).
- **오버레이 입력 실패 배너** — `overlayInputHookError` / `inputFailure` 시 PC 재시작 안내 (`OverlayHealthBanner`).
- **GEP Obituaries 안내** — 헤더 GEP 상태 패널에 Apex Obituaries On 권장 팁.

### Manifest / 패키지

- `dock_button_title`, 잘못된 `disable_hardware_acceleration` 제거.
- 권한: `Extensions` / `Streaming` / `Profile` / `DesktopStreaming` (`getMonitorsList`).
- `externally_connectable` 확장 (Supabase, proxy, OwAd SDK, GEP status, jsDelivr).
- 데스크톱 기본/최소 크기 조정, 데스크톱에서 `focus_game_takeover` 제거.
- 제거(uninstall) 시 앱 UI 없이 브라우저 설문만 오픈.

### 개선

- **Free 고정** — 설정 Premium 미리보기 토글·localStorage override 제거. `isPremium=false` (광고 ON + 분석 탭 잠금). 구독 연동 시 같은 플래그로 광고/게이트 일괄 전환.
- **창 실행** — 독/트레이 토글, Discord 초대 `skip_in_game_notification`, 트레이 destroy 시 리스너 정리, 게임 종료 시 desktop restore가 `_isWindowOpen` 동기화.
- **광고·UI 안전** — 리사이즈 핸들 z-index/광고 레일 inset, 인게임에서 광고 미마운트, 네트워크·오버레이 배너 스택, `tryLoadSeasons` 취소·재시도 상한, AdUnit OwAd 대기 abort.
- **최소 높이** — 창 높이 ≤800일 때 프로필 태그 최대 3개로 프로필/스탯 카드 높이 맞춤.
- **무기 데이터** — fallback/타입 분리, `seed:weapons` 스크립트.

### 문서

- Docs — [QA.md](QA.md), [LAUNCH.md](LAUNCH.md), [ROADMAP.md](ROADMAP.md) (구 `docs/launch/` 통합).

---

## v0.0.7 — 2026-06-28

### 새 기능

- **Match Data V3 (클라이언트)** — Statistics 탭이 `player_season_stats` 서버 집계를 우선 사용. 매치 목록은 summary-only 동기화, 펼침 시 detail lazy fetch + prefetch. `public.seasons` SSOT 기반 시즌 필터.
- **팀원별 내 기록** — TOP3 카드(팀원 픽 포디움), 2단 헤더 표(팀원/내 기록), 표 첫 줄에 **나의 시즌 평균** baseline, 5판 이상 함께한 팀원은 **▲/▼** 시즌 평균 대비 표시, 긴 닉네임 marquee.
- **닫기 확인** — 데스크톱 창 X / Alt+F4 시 종료·백그라운드 유지 확인 다이얼로그 + “다시 묻지 않기” (`CloseConfirmDialog`, `is_alt_f4_blocked`).
- **Supabase 마이그레이션** — `seasons`, `matches.season_id`, `player_season_stats`, `matches.weapon_combat`, `matches.deaths` 스키마 추가.
- **개발용 시드** — `npm run seed:teammate-test` / `:clean` (가짜 팀원 매치 삽입·삭제).

### 개선

- **동기화·레이스** — 검색 후 Statistics 탭 점프 방지, 프로필 로드 generation guard, 수동 새로고침만 원격 sync (60s 폴링 제거).
- **네트워크** — `fetchPlayerStats` 클라이언트 캐시, i18n `languages_cache_v3` + 버전 게이트, 타인 프로필 lazy archive (page 2+).
- **로케일** — 팀원 탭/표 copy 개선, `{{variables}}` 미번역 버그 수정 (seed version 5), 10개 언어 동기화.
- **매치 상세** — `matchDetail` 유틸, `matchPanelStyles` 공유, `ProfileTagIcon` 사이드바 태그.
- **배경** — summary/detail API 분리, `apiService` stats 엔드포인트, repository lazy history.
- **무기별 킬/어시·통계 재설계** — 소지 시간(`hh:mm`), 이벤트 킬, 사망 시점 슬롯 데스(+중간 킬 보정 1), 승률/평균 순위는 최종 로드아웃·킬·전투 시점 양 슬롯 qualifying. KA/D 숨김. 매치 `weaponCombat` 요약 저장.
- **K/D 데스** — 전체/레전드/팀원도 컴뱃로그 사망 횟수 기준(한 판 2회 사망 = 2데스). 레거시 매치는 기존 패배=1 폴백.
- **Top Legends / Weapons** — 하이브리드 순위 `sqrt(사용량) × K/D` (레전드=판수, 무기=소지 분). Overview 메인 픽도 동일.
- **통계 오버뷰 카드** — 맵/레전드 오버뷰 카드에서 무기 승률·팀원 레전드 픽률 제거(표는 유지). Weapons 탭 포디움 승률은 유지하며 ≥10%면 초록 표시.
- **스탯 색 티어** — 승률·K/D·KA/D·평균 딜·평균 순위를 회색(낮음)/흰색(보통)/초록(높음)/금색(매우 높음) 4단계로 통일.

### 수정

- **컴뱃로그 킬 누락** — GEP가 출혈/링 등 finish를 로케일 `action`으로 보낼 때, 내가 넉다운한 victim이면 locale 무관하게 kill로 승격. `tabs.kills`와 컴뱃로그 불일치 완화.

### 문서

- [ARCHITECTURE.md](ARCHITECTURE.md) — V3 아키텍처 (Shipped 상태; 구 `match-data-architecture-v3.md`).
- README — V3 마이그레이션·스크립트·기능 목록 갱신.

---

## v0.0.6 — 2026-06-28

### 새 기능

- **티어표 (Tier Table)** — 레전드/무기 티어표 탭 추가. 드래그 앤 드롭으로 티어 배치, 행 순서 변경, 로컬 저장. `html2canvas`로 캡처·미리보기·워터마크 오버레이 지원.
- **매치 상세 레이아웃** — 중복 로드아웃 패널 제거, 전투기록(Combat Log) 영역 확대.
- **로드아웃 타임라인** — Before/After 슬롯에 무기 이름 대신 Supabase Storage 무기 PNG 표시.
- **지도 마커 호버** — 시작/끝은 각각 독립 호버, 점프(사망↔리스폰) 마커는 쌍으로 함께 강조. 툴팁 없음.

### 개선

- **Match Data V3** — `matches` 단일 소스, summary/detail 분리 로드, `public.seasons` SSOT, `player_season_stats` 서버 통계, 통계탭은 `/player-stats` 전용. 매치 펼침 시 detail lazy fetch + prefetch.
- **지도 마커 크기** — 모든 마커 반지름 통일, 전체화면에서는 초기 크기 50% 축소.
- **전투기록 아이콘** — `eventIcons.ts`로 Combat Log 아이콘 URL 공유.
- **통계 탭** — Statistics UI/차트 개선.
- 10개 언어 — 티어표·네비 등 번역 추가 (`npm run seed:languages`로 Supabase 반영).

### 정리

- dev 매치 프리뷰, `LoadoutDisplay`, `App.css`, `game_constants.json`, 미사용 `BackgroundController` 제거.
- locale 시드에서 사용하지 않는 top-level `loadout.*` 키 정리.

---

## v0.0.5b — 2026-06-26

### 새 기능

- **프리미엄 통계 블러 미리보기** — Maps / Legends / Weapons / Teammates 탭은 잠금 상태에서도 실제 UI를 블러 처리해 미리보기로 표시하고, 업그레이드 CTA를 제공합니다. **Overview**는 무료 사용자에게 전체 공개(맛보기)입니다.
- **설정: 앱 데이터 초기화** — 로컬 캐시(IndexedDB, localStorage)를 삭제하고 앱을 재시작합니다. 고정 프로필·즐겨찾기 등 로컬 데이터가 제거됩니다.
- **전투기록 아이콘** — Supabase Storage `images/events/` PNG 아이콘 사용 (kill, knockdown, death1, revive, respawn). 화살표 제거, 툴팁 첫 글자 대문자.

### 버그 수정

- **전투기록 death 누락** — 녹다운 후 확킬 없이 스쿼드 전멸 시 `kill_feed` death가 오지 않아 combat log에 death가 빠지던 문제를 수정합니다. `your_squad_is_eliminated` 및 매치 저장 직전에 knockdown 기준으로 death를 보충 기록합니다 (부활 케이스는 제외).

### 개선

- **매치 저장 즉시 UI 반영** — 같은 UID 조회 중 새 매치가 저장되면 background → UI 메시지로 동기화하고, 원격 히스토리 로드 시 로컬 매치가 지워지지 않도록 병합합니다.
- **Recharts 차트** — `ChartContainer`로 컨테이너 크기 0일 때 렌더 지연, `width(-1) height(-1)` 경고 제거.
- **튜토리얼** — 2단계(플레이어 검색) 툴팁이 검색창을 정확히 가리키도록 `#search-bar` 앵커 및 정렬 수정.
- **단축키 안내** — HotkeyReminder UI 정리.
- **IndexedDB** — `LocalDB.clearAll()`이 트랜잭션 완료까지 대기하도록 수정 (초기화 안정성).
- 10개 언어 — 설정 초기화·데이터 섹션 번역 추가 (`npm run seed:languages`로 Supabase 반영).

### 알려진 이슈

- **GEP `task_weapon` 크래시** — 매치 착지 직후 Overwolf Apex 플러그인이 `crashed_on_task_task_weapon`으로 종료되면 `me.weapons`가 `unknown`으로 고정되어 로드아웃 타임라인이 비어 있을 수 있습니다. GEP 측 이슈입니다.
- **GEP 게임 모드 미표시** — v0.0.5 fallback 및 상태 패널로 영향 범위를 안내합니다.

---

## v0.0.5 — 2026-06-25

### 새 기능

- **GEP 이벤트 상태 패널** — 상단 상태 점(인디케이터)을 클릭하면 Overwolf [game-events-status API](https://game-events-status.overwolf.com/21566_prod.json) 기준으로 어떤 기록이 영향받는지 확인할 수 있습니다.
  - **Game Mode** — `game_mode`
  - **Combat Logs** — `kill`, `kill_feed`, `knockdown`, `tabs` 등
  - **Placement (등수)** — `victory`, `match_summary`
  - **Movement Path (동선 기록)** — `phase`, `location`
  - Loadout, Team Info, Legend, Ultimate 등 추가 그룹
- **Statistics Overview 개편** — 5축 레이더(교전·화력·매크로·팀·피크), 시즌·모드 필터, 맵/레전드/무기/팀원 서브탭 분석
- **일별 RP 추이 차트** — Supabase `daily_rank_snapshots` 기반, Statistics Overview(All·Ranked)에 표시
  - 랭크 티어별 색상, 승강 시점부터 색 전환
  - 시즌 초 0 RP·배치 급등 구간 제외, RP > 0 없으면 차트 숨김
- **사이드바 최근 20경기 요약** — 승률, 평균 등수, 평균 킬/대미지/어시스트, 최다 픽 레전드 (2×3 카드)
- **점진적 매치 동기화** — 최초 100경기 UI 표시 후 백그라운드 전체 동기화, 탭·페이지·필터 변경 시 flush
- 10개 언어 번역 (en, ko, ja, zh-CN, zh-TW, fr, es-ES, es-MX, pt-BR, pt-PT) — Supabase `languages` 테이블 반영

### 개선

- **GEP 게임 모드 fallback** — GEP에서 `game_mode`가 오지 않아도, 맵·팀원·플레이 흔적이 있는 매치는 `BR`로 저장합니다.
- **BR 탭 전용 표시** — fallback `BR` 매치는 Ranked / Trio / Duo 탭에 노출되지 않고 **BR 탭에만** 표시됩니다.
- **매치 폐기 기준 완화** — 이동 경로, 무기 교체, 사망 등 실제 매치 증거가 있으면 킬/대미지 0·2분 미만만으로 junk 세션을 폐기하지 않습니다.
- **전투 로그** — 부활/리스폰 이벤트 표시 개선(공격자 공란, 피해자 닉네임, 지원 이벤트 녹색 강조), 스크롤 클리핑 수정
- **맵 전체화면** — `Esc`로 전체화면 해제
- **Overview 레이더·점수** — 교전 축 곡선 조정, 대미지/피크 200 dmg/kill 기준 통일
- **한국어** — UI 전반 `데미지` → `대미지`, K/D 라벨 정리
- **랭크 티어 색상** — `getRankTierColor` 공통 유틸 (플레이어 검색·RP 차트)
- 통계 탭·웹 프리뷰에도 동일한 모드 필터 규칙을 적용했습니다.

### 알려진 이슈

- **GEP 게임 모드 미표시** — Overwolf GEP 측 이슈입니다. v0.0.5에서 fallback 저장과 상태 패널로 영향 범위를 안내합니다.

---

## v0.0.4 — 2026-06-24

### 새 기능

- **테마 시스템** — 설정에서 다크 / 라이트 모드를 선택할 수 있습니다.
- **단축키 분리** — 데스크톱(세컨드 스크린)과 인게임 오버레이 단축키를 각각 설정합니다.
  - 데스크톱: `Ctrl+Shift+=` (기본값)
  - 인게임: `Ctrl+Shift+-` (기본값)
- **앱 내 단축키 설정** — Overwolf 설정으로 이동하지 않고 설정 탭에서 단축키를 변경할 수 있습니다.
- **매치 상세 탭** — Stats / Loadout Timeline 탭으로 매치 정보를 구분해 볼 수 있습니다.
- **로드아웃 타임라인** — 매치 중 감지된 무기 변경 이력을 시간순으로 표시합니다.
- **Match Storage V2** — Supabase `matches` 테이블에 매치를 정규화해 저장합니다 (레거시 `match_archives`와 병행).
- **웹 프리뷰 모드** — Overwolf 환경이 아닌 브라우저에서도 UI를 확인할 수 있습니다.
- **Executioner 홉업** — 무기 탭에 Executioner 홉업 정보를 추가했습니다.

### 개선

- HotkeyReminder가 데스크톱 / 인게임 단축키를 구분해 표시합니다.
- 데스크톱 창 위치를 유지합니다 (`keep_window_location`).
- 하드웨어 가속을 비활성화해 일부 환경에서의 렌더링 문제를 줄였습니다.
- UI 전반을 CSS 테마 변수 기반으로 정리했습니다.
- 플레이어 검색·상대 시간 표시에 "방금" 문구를 추가했습니다.
- Supabase 마이그레이션: `daily_rank_snapshots`, `matches` (v2 스키마) 테이블 추가.

---

## v0.0.3

- Revive GEP 기능 등록
- 부활 후 이동 경로가 맵에 올바르게 기록·표시되도록 per-life-segment 경로 필터링 수정

## v0.0.2

- 언어 코드 BCP 47 형식으로 마이그레이션
