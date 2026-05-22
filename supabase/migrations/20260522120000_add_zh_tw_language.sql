-- Traditional Chinese (Taiwan) locale zh-tw.
-- Payload: scripts/locale-seeds/zh-tw.json via npm run seed:languages

update public.languages set display_name = '简体中文（中国大陆）' where lang = 'zh';
