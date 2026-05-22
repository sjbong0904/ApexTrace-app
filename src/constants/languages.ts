/** 앱 언어 선택 목록 (languages 테이블 lang 코드와 일치) */
export const APP_LANGUAGES = [
    { code: 'en', label: '🇺🇸 English' },
    { code: 'ko', label: '🇰🇷 한국어' },
    { code: 'ja', label: '🇯🇵 日本語' },
    { code: 'zh', label: '🇨🇳 简体中文（中国大陆）' },
    { code: 'zh-tw', label: '🇹🇼 繁體中文（台灣）' },
    { code: 'fr', label: '🇫🇷 Français' },
    { code: 'es', label: '🇪🇸 Español (España)' },
    { code: 'es-mx', label: '🇲🇽 Español (México)' },
    { code: 'pt', label: '🇧🇷 Português (Brasil)' },
    { code: 'pt-pt', label: '🇵🇹 Português (Portugal)' },
] as const;

export type AppLanguageCode = (typeof APP_LANGUAGES)[number]['code'];
