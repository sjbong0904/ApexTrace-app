export const EVENT_ICON_BASE = '/images/events';

/** Combat log event icon file names (without extension). */
export const EVENT_ICON_FILES: Record<string, string> = {
    death: 'death1',
    kill: 'kill',
    knockdown: 'knockdown',
    respawn: 'respawn',
    revive: 'revive',
};

export const getEventIconUrl = (type: string): string | null => {
    const file = EVENT_ICON_FILES[type];
    return file ? `${EVENT_ICON_BASE}/${file}.png` : null;
};
