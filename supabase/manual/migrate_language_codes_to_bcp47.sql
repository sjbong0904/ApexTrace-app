-- =============================================================================
-- ApexTrace: languages.lang → BCP 47 코드 마이그레이션
-- Supabase Dashboard → SQL Editor 에서 실행
--
-- 방법 A (권장): 기존 strings 그대로 복사 → 새 lang 행 추가 → 구 코드 비활성화
-- 방법 B: PK(lang) 직접 rename (간단, 단 충돌 시 실패)
--
-- 앱 코드는 이미 zh-CN, es-ES 등을 사용합니다.
-- 실행 후 사용자 앱은 languages_cache_v2 로 자동 갱신됩니다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 방법 A — 새 행 추가 (안전, strings 유지)
-- -----------------------------------------------------------------------------

insert into public.languages (lang, display_name, strings, version, is_active, is_default, updated_at)
select 'zh-CN', '简体中文（中国大陆）', strings, 2, true, false, now()
from public.languages where lang = 'zh'
on conflict (lang) do update set
  display_name = excluded.display_name,
  strings = excluded.strings,
  version = excluded.version,
  is_active = true,
  updated_at = now();

insert into public.languages (lang, display_name, strings, version, is_active, is_default, updated_at)
select 'zh-TW', '繁體中文（台灣）', strings, 2, true, false, now()
from public.languages where lang = 'zh-tw'
on conflict (lang) do update set
  display_name = excluded.display_name,
  strings = excluded.strings,
  version = excluded.version,
  is_active = true,
  updated_at = now();

insert into public.languages (lang, display_name, strings, version, is_active, is_default, updated_at)
select 'es-ES', 'Español (España)', strings, 2, true, false, now()
from public.languages where lang = 'es'
on conflict (lang) do update set
  display_name = excluded.display_name,
  strings = excluded.strings,
  version = excluded.version,
  is_active = true,
  updated_at = now();

insert into public.languages (lang, display_name, strings, version, is_active, is_default, updated_at)
select 'es-MX', 'Español (México)', strings, 2, true, false, now()
from public.languages where lang = 'es-mx'
on conflict (lang) do update set
  display_name = excluded.display_name,
  strings = excluded.strings,
  version = excluded.version,
  is_active = true,
  updated_at = now();

insert into public.languages (lang, display_name, strings, version, is_active, is_default, updated_at)
select 'pt-BR', 'Português (Brasil)', strings, 2, true, false, now()
from public.languages where lang = 'pt'
on conflict (lang) do update set
  display_name = excluded.display_name,
  strings = excluded.strings,
  version = excluded.version,
  is_active = true,
  updated_at = now();

insert into public.languages (lang, display_name, strings, version, is_active, is_default, updated_at)
select 'pt-PT', 'Português (Portugal)', strings, 2, true, false, now()
from public.languages where lang = 'pt-pt'
on conflict (lang) do update set
  display_name = excluded.display_name,
  strings = excluded.strings,
  version = excluded.version,
  is_active = true,
  updated_at = now();

-- 변경 없음: en, ja, ko, fr (display_name만 맞추고 싶으면 아래 참고)
update public.languages set version = 2, updated_at = now()
where lang in ('en', 'ja', 'ko', 'fr') and is_active = true;

-- 구 코드 비활성화 (삭제하지 않음 — 롤백·참고용)
update public.languages set is_active = false, updated_at = now()
where lang in ('zh', 'zh-tw', 'es', 'es-mx', 'pt', 'pt-pt');

-- 확인
select lang, display_name, is_active, version
from public.languages
order by is_active desc, lang;


-- -----------------------------------------------------------------------------
-- 방법 B — lang PK 직접 변경 (6행만, en/ja/ko/fr 은 그대로)
-- 방법 A를 이미 실행했다면 실행하지 마세요.
-- -----------------------------------------------------------------------------
/*
update public.languages set lang = 'zh-CN', display_name = '简体中文（中国大陆）', version = 2, updated_at = now() where lang = 'zh';
update public.languages set lang = 'zh-TW', display_name = '繁體中文（台灣）', version = 2, updated_at = now() where lang = 'zh-tw';
update public.languages set lang = 'es-ES', display_name = 'Español (España)', version = 2, updated_at = now() where lang = 'es';
update public.languages set lang = 'es-MX', display_name = 'Español (México)', version = 2, updated_at = now() where lang = 'es-mx';
update public.languages set lang = 'pt-BR', display_name = 'Português (Brasil)', version = 2, updated_at = now() where lang = 'pt';
update public.languages set lang = 'pt-PT', display_name = 'Português (Portugal)', version = 2, updated_at = now() where lang = 'pt-pt';
*/
