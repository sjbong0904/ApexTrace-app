-- BCP 47 lang codes (zh-CN, zh-TW, es-ES, es-MX, pt-BR, pt-PT).
-- Apply packs: npm run seed:languages
-- Deactivate legacy rows after seed (seed script also sets is_active = false).

update public.languages set is_active = false
where lang in ('zh', 'zh-tw', 'es', 'es-mx', 'pt', 'pt-pt');
