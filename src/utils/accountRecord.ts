import type { AccountStats } from '../types';

/** GEP BR block (career battle_royale or a ranked season). */
type BrBlock = {
    games?: number; wins?: number; kills?: number; deaths?: number;
    damage_dealt?: number; top_5s?: number; rank_score?: number; season?: number;
};

export const summarizeBrBlock = (block: BrBlock | null | undefined) => {
    const games = Number(block?.games) || 0;
    if (!block || games <= 0) return null;
    const kills = Number(block.kills) || 0;
    const deaths = Number(block.deaths) || 0;
    const avgDamage = Math.round((Number(block.damage_dealt) || 0) / games);
    return {
        games,
        wins: Number(block.wins) || 0,
        winRate: (((Number(block.wins) || 0) / games) * 100).toFixed(1),
        top5Rate: (((Number(block.top_5s) || 0) / games) * 100).toFixed(1),
        kills,
        kd: (deaths > 0 ? kills / deaths : kills).toFixed(2),
        avgDamage,
    };
};

/** True when the account snapshot has an all-time BR block for the record view. */
export const hasAccountRecord = (account: AccountStats | null | undefined): boolean =>
    Boolean(summarizeBrBlock(account?.career?.battle_royale));
