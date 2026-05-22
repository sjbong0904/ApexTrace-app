-- Regional locales es-mx (México) and pt-pt (Portugal).
-- Translation payloads live in scripts/locale-seeds/ and are applied with:
--   npm run seed:languages
-- (requires execute on upsert_language_pack or service role).

update public.languages set display_name = 'Español (España)' where lang = 'es';
update public.languages set display_name = 'Português (Brasil)' where lang = 'pt';
