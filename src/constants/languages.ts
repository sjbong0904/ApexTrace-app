/** 앱 언어 선택 목록 (languages 테이블 lang 코드와 일치) */
export const APP_LANGUAGES = [
    { code: 'en', label: '🇺🇸 English' },
    { code: 'ja', label: '🇯🇵 日本語' },
    { code: 'ko', label: '🇰🇷 한국어' },
    { code: 'zh-CN', label: '🇨🇳 简体中文（中国大陆）' },
    { code: 'zh-TW', label: '🇹🇼 繁體中文（台灣）' },
    { code: 'fr', label: '🇫🇷 Français' },
    { code: 'es-ES', label: '🇪🇸 Español (España)' },
    { code: 'es-MX', label: '🇲🇽 Español (México)' },
    { code: 'pt-BR', label: '🇧🇷 Português (Brasil)' },
    { code: 'pt-PT', label: '🇵🇹 Português (Portugal)' },
] as const;

export type AppLanguageCode = (typeof APP_LANGUAGES)[number]['code'];

/** 이전 lang 코드 → BCP 47 (localStorage 마이그레이션) */
export const LEGACY_LANGUAGE_CODES: Record<string, AppLanguageCode> = {
    zh: 'zh-CN',
    'zh-tw': 'zh-TW',
    es: 'es-ES',
    'es-mx': 'es-MX',
    pt: 'pt-BR',
    'pt-pt': 'pt-PT',
};

export function normalizeLanguageCode(code: string): string {
    return LEGACY_LANGUAGE_CODES[code] ?? code;
}
