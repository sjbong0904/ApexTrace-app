# Match Storage V2

> **Note:** For the target architecture (summary/detail split, server-side season stats, seasons SSOT), see **[match-data-architecture-v3.md](./match-data-architecture-v3.md)**. This document remains the reference for the v2 `public.matches` column layout and legacy frontend contract.

This document describes the normalized match storage rollout for ApexTrace.

## Goals

- Keep the current frontend response shape stable.
- Store new matches as one row per match in `public.matches`.
- Leave `public.match_archives` unchanged as the legacy archive source.
- Avoid backfilling legacy archives during the first rollout.

## Tables

### `public.match_archives`

Legacy archive table. It remains unchanged.

- `uid text`
- `matches jsonb`: array of legacy flat match objects
- `start_time bigint`
- `end_time bigint`
- `match_count integer`

### `public.matches`

Normalized v2 table. One row per match.

Primary key: `(uid, match_id)`. `match_id` comes from the client match timestamp, so it is only guaranteed to be unique within a user profile.

| Column | Source from legacy match |
| --- | --- |
| `match_id` | `match.matchId` |
| `uid` | request `uid` or `match.platformId` |
| `start_time` | `match.startTime` |
| `end_time` | `match.endTime` |
| `mode` | `match.mode` |
| `map` | `match.map` |
| `legend` | `match.legend` |
| `placement` | `match.placement` parsed as integer |
| `kills` | `match.kills` |
| `assists` | `match.assists` |
| `knocks` | `match.knocks` |
| `damage` | `match.damage` |
| `squad_kills` | `match.squadKills` |
| `ultimates_used` | `match.ultimatesUsed` |
| `headshots` | `match.headshots` |
| `grenade_damage` | `match.grenadeDamage` |
| `rank_score` | `match.rankScore` |
| `rp_change` | `match.rpChange` |
| `rp_processed` | `match.rpProcessed` |
| `is_kill_leader` | `match.isKillLeader` |
| `rank` | `match.rank` |
| `loadout` | `match.loadout` |
| `team_stats` | `match.teamStats` |
| `events` | `match.events` |
| `path` | `match.path` |
| `ring_rounds` | `match.ringRounds` |
| `weapon_timeline` | `match.weaponTimeline` |
| `teammate_kills` | `match.teammateKills` |
| `legacy_match` | exact legacy flat match object |
| `schema_version` | `2` |

### Future Timeline Fields

`ring_rounds` stores per-round ring data once GEP exposes it:

```json
[
  {
    "round": 1,
    "startTime": 1781987900000,
    "endTime": 1781988200000,
    "nextRingCenterX": 12345.67,
    "nextRingCenterY": -23456.78,
    "nextRingRadius": 4500,
    "revealedAt": 1781987895000
  }
]
```

`weapon_timeline` stores weapon state changes for replay/timeline UI:

```json
[
  {
    "timestamp": 1781988000000,
    "action": "loadout_change",
    "previousPrimary": "mozambique",
    "previousSecondary": null,
    "primary": "r301-carbine",
    "secondary": "peacekeeper"
  }
]
```

The current extension can populate `weaponTimeline` from `info.info.me.weapons` by appending an entry only when the normalized primary or secondary weapon changes. Future GEP support can add more precise actions such as `pickup`, `drop`, `swap`, or `equip`.

These fields are optional in legacy match objects and default to empty arrays in `public.matches`.

## Legacy Frontend Contract

The existing app expects `/history` to return:

```json
{
  "history": [
    {
      "matchId": "1781987842965",
      "platformId": "1009381116634",
      "playerName": "Aim3r",
      "mode": "Ranked",
      "map": "Broken Moon",
      "legend": "valkyrie",
      "placement": 15,
      "kills": 0,
      "assists": 1,
      "knocks": 0,
      "damage": 284,
      "squadKills": 2,
      "ultimatesUsed": 0,
      "headshots": 0,
      "rank": { "name": "Unknown", "score": 0, "startScore": 0 },
      "rpChange": 0,
      "rpProcessed": false,
      "startTime": 1781987842965,
      "endTime": 1781988254712,
      "loadout": { "primary": "mozambique", "secondary": "hemlok" },
      "path": [],
      "ringRounds": [],
      "weaponTimeline": [],
      "events": [],
      "teamStats": [],
      "teammateKills": {}
    }
  ]
}
```

Do not remove or rename these fields in the response until all frontend components have moved to v2-aware accessors.

## Write Path

The extension can continue POSTing the current legacy payload:

```json
{
  "uid": "1009381116634",
  "match": { "matchId": "1781987842965" }
}
```

The proxy should transform this into a `public.matches` row and upsert by `match_id`.

Recommended Supabase upsert conflict target:

```ts
await supabase
  .from('matches')
  .upsert(row, { onConflict: 'uid,match_id' });
```

During rollout, the proxy may also continue appending to `match_archives` as a safety mirror.

## Read Path

`GET /history?uid=...` should:

1. Read v2 rows from `public.matches` by `uid`.
2. Read legacy rows from `public.match_archives` by `uid`.
3. Convert v2 rows to legacy flat match objects.
4. Merge with legacy archive matches.
5. De-duplicate by `matchId`.
6. Sort by `startTime || endTime` descending.
7. Return `{ history }` using the legacy frontend contract.

## Compatibility Rules

- `legacy_match` is the source of truth for the initial rollout response.
- If `legacy_match` is missing a field, reconstruct from normalized columns.
- Runtime/private keys such as `_saved`, `_currentPhase`, `_lastLocationTime`, `startPos`, and `endPos` should not be returned.
- `teamStats`, `events`, and `path` must always be arrays.
- `ringRounds` and `weaponTimeline` must always be arrays when returned.
- `loadout`, `rank`, and `teammateKills` must always be objects.
- `matchId`, `startTime`, and `endTime` must stay epoch-ms legacy fields in frontend responses.
- `rpChange`, `rpProcessed`, and `rankScore` must be preserved when present so later RP correction does not repeat work.

## Backfill

No backfill is part of the first rollout. Legacy `match_archives` rows remain readable through the compatibility merge. A later backfill can unpack `match_archives.matches` into `public.matches` once the v2 write/read path is stable.
