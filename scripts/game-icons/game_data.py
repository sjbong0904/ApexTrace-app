"""Build seasons.json (season/split schedule + ranked tier floors) from an extract.py data folder.

Usage:
  python -I scripts/game-icons/game_data.py --build "D:/apex-extract/run/<build>"

Reads:
  data/settings/itemflav/calevent/season<N>.json          season start/finish
  data/settings/itemflav/ranked2pt0/rankedperiod<N>*.json  ranked splits, split-2 start, tiers/divisions
Writes:
  <build>/seasons.json
"""
import argparse
import datetime
import json
import os
import re

TIER_KEYS = {
    "ROOKIE": "rookie", "BRONZE": "bronze", "SILVER": "silver", "GOLD": "gold", "PLATINUM": "platinum",
    "DIAMOND": "diamond", "MASTER": "master", "APEX_PREDATOR": "predator", "PREDATOR": "predator",
}


def to_ms(s):
    """'2026-11-03 10:00:00 -08:00' -> epoch ms (None for empty)."""
    if not s:
        return None
    if str(s).isdigit():  # older seasons store epoch seconds
        return int(s) * 1000
    return int(datetime.datetime.strptime(s, "%Y-%m-%d %H:%M:%S %z").timestamp() * 1000)


def iso(ms):
    return None if ms is None else datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).isoformat()


def settings(path):
    return json.load(open(path, encoding="utf-8"))["settings"]


def tiers_of(period):
    out = []
    for t in period.get("tiers", []):
        m = re.match(r"#RANKED_TIER_(.+)", t.get("name", ""))
        key = TIER_KEYS.get(m.group(1), m.group(1).lower()) if m else t.get("name")
        divisions = [d.get("scoreMin") for d in t.get("divisions", [])]
        out.append({
            "key": key,
            "entryCost": t.get("entryCost"),
            "minRp": divisions[0] if divisions else None,
            "divisionMinRp": divisions,
            "allowsDemotion": t.get("allowsDemotion"),
            "lpDecayAmount": t.get("lpDecayAmount"),
        })
    return out


def build(build_dir):
    flav = os.path.join(build_dir, "data", "settings", "itemflav")
    seasons = {}
    for fn in os.listdir(os.path.join(flav, "calevent")):
        m = re.fullmatch(r"season(\d+)\.json", fn)
        if not m:
            continue
        s = settings(os.path.join(flav, "calevent", fn))
        seasons[int(m.group(1))] = {
            "season": int(m.group(1)),
            "startMs": to_ms(s.get("defaultStartTime")),
            "endMs": to_ms(s.get("defaultFinishTime")),
            "splits": [],
        }

    for fn in sorted(os.listdir(os.path.join(flav, "ranked2pt0"))):
        m = re.fullmatch(r"rankedperiod(\d+)(?:_split(\d))?\.json", fn)
        if not m:
            continue
        p = settings(os.path.join(flav, "ranked2pt0", fn))
        n = int(m.group(1))
        split = int(p.get("rankv2split") or m.group(2) or 1)
        season = seasons.setdefault(n, {"season": n, "startMs": None, "endMs": None, "splits": []})
        season["splits"].append({
            "split": split,
            "split2StartMs": to_ms(p.get("split2StartTime")),
            "tiers": tiers_of(p),
        })

    result = []
    for n in sorted(seasons):
        s = seasons[n]
        s["splits"].sort(key=lambda x: x["split"])
        split2 = next((x["split2StartMs"] for x in s["splits"] if x["split"] == 2 and x["split2StartMs"]), None)
        for x in s["splits"]:
            if len(s["splits"]) == 1:
                x["startMs"], x["endMs"] = s["startMs"], s["endMs"]
            elif x["split"] == 1:
                x["startMs"], x["endMs"] = s["startMs"], split2
            else:
                x["startMs"], x["endMs"] = split2, s["endMs"]
            x["startUtc"], x["endUtc"] = iso(x["startMs"]), iso(x["endMs"])
            del x["split2StartMs"]
        s["startUtc"], s["endUtc"] = iso(s["startMs"]), iso(s["endMs"])
        result.append(s)

    out = {"build": os.path.basename(os.path.normpath(build_dir)), "seasons": result}
    path = os.path.join(build_dir, "seasons.json")
    json.dump(out, open(path, "w", encoding="utf-8"), indent=1)
    return path, result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--build", required=True, help="<out>/<build> folder written by extract.py")
    a = ap.parse_args()
    path, seasons = build(a.build)
    print(f"wrote {path}")
    for s in seasons[-4:]:
        for x in s["splits"]:
            floors = " ".join(f"{t['key']}={t['minRp']}" for t in x["tiers"])
            print(f"  S{s['season']} split{x['split']}: {x['startUtc']} -> {x['endUtc']}  {floors}")


if __name__ == "__main__":
    main()
