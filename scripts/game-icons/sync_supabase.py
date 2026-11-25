"""Convert extracted game icons to the Supabase `images` bucket naming and upload them.

Steps:
  1. Build <out>/upload/<bucket name>.png from the extracted `named/` tree (crop/mirror/pad as needed).
  2. Back up every bucket object that will be overwritten to <out>/supabase-backup/<timestamp>/.
  3. Upload (upsert) with the service-role key from the project .env (only with --upload).

Usage:
  python -I scripts/game-icons/sync_supabase.py --named "D:/apex-extract/run/<build>/named"          # dry run
  python -I scripts/game-icons/sync_supabase.py --named "D:/apex-extract/run/<build>/named" --upload

Names kept as the bucket already has them. Weapon colour renders are NOT replaced; game HUD
silhouettes are added next to them as "<bucket name>_silhouette.png".
"""
import argparse
import datetime
import os
import sys
import urllib.parse
import urllib.request

from PIL import Image

PROJECT_URL = "https://ureuzkxyyozzzluzawwr.supabase.co"
BUCKET = "images"
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# bucket name -> character itemflavor file (portrait path is read from its characterSelectIcon)
LEGENDS = {
    "alter": "alter", "ash": "ash", "axle": "overdrive", "ballistic": "ballistic", "bangalore": "bangalore",
    "bloodhound": "bloodhound", "catalyst": "catalyst", "caustic": "caustic", "conduit": "conduit",
    "crypto": "crypto", "fuse": "fuse", "gibraltar": "gibraltar", "horizon": "horizon", "lifeline": "lifeline",
    "loba": "loba", "mad maggie": "madmaggie", "mirage": "mirage", "newcastle": "newcastle", "octane": "octane",
    "pathfinder": "pathfinder", "rampart": "rampart", "revenant": "revenant", "seer": "seer", "sparrow": "sparrow",
    "valkyrie": "valkyrie", "vantage": "vantage", "wattson": "wattson", "wraith": "wraith",
}

# bucket name -> half emblem (game mirrors it at runtime)
RANKS = {
    "rookie": "rank_emblem_rookie", "bronze": "rank_emblem_bronze", "silver": "rank_emblem_silver",
    "gold": "rank_emblem_gold", "platinum": "rank_emblem_platinum", "diamond": "rank_emblem_diamond_flat",
    "master": "rank_emblem_master_flat", "predator": "rank_emblem_apex_flat",
}

PERKS = ["bottomless_batteries", "infinite_ammo", "over_armor", "overflow_healer", "power_booster"]

# bucket name (without _silhouette) -> rui/weapon_icons/r5/<file>
WEAPON_SILHOUETTES = {
    "30-30": "weapon_3030repeater", "alternator": "weapon_alternator", "bocek": "weapon_bow",
    "c.a.r.": "weapon_car", "charge rifle": "weapon_charge_rifle", "chargerifle": "weapon_charge_rifle",
    "devotion": "weapon_devotion", "eva-8": "weapon_eva8", "flatline": "weapon_flatline",
    "g7 scout": "weapon_g7", "g7scout": "weapon_g7", "havoc": "weapon_energy_ar", "hemlok": "weapon_hemlock",
    "kraber": "weapon_sniper", "l-star": "weapon_lstar", "longbow": "weapon_longbow", "mastiff": "weapon_mastiff",
    "mozambique": "weapon_mozambique", "mozambique_akimbo": "weapon_mozambique_akimbo_active",
    "nemesis": "weapon_nemesis", "p2020": "weapon_p2020", "p2020_akimbo": "weapon_p2020_akimbo_active",
    "peacekeeper": "weapon_peacekeeper", "prowler": "weapon_prowler", "r-301": "weapon_r301", "r-99": "weapon_r97",
    "rampage": "weapon_dragon", "re-45": "weapon_r45", "sentinel": "weapon_sentinel", "spitfire": "weapon_spitfire",
    "triple take": "weapon_triple_take", "tripletake": "weapon_triple_take", "volt": "weapon_volt",
    "wingman": "weapon_wingman", "wingman_akimbo": "weapon_wingman_akimbo_active",
}


# bucket map overview -> map code (named/maps/<code>/overview.png). Framing matches the current
# images, so MAP_CONFIG scale/offset in src/utils/constants.ts stays valid. worlds_edge_s29 is a
# past-season map and is left alone.
MAPS = {
    "worlds_edge_s30": "desertlands_mu5", "kings_canyon": "canyonlands_hu_avt", "olympus": "olympus_mu3",
    "storm_point": "tropic_island_mu2_landscape", "broken_moon": "divided_moon_mu1", "e_district": "district_mu1",
}
THUMBNAILS = {
    "thumbnail-worlds_edge": "desertlands_mu5", "thumbnail-kings_canyon": "canyonlands_hu_avt",
    "thumbnail-olympus": "olympus_mu3", "thumbnail-storm_point": "tropic_island_mu2_landscape",
    "thumbnail-broken_moon": "divided_moon_mu1", "thumbnail-e-district": "district_mu1",
}
THUMB_SIZE = (1536, 864)
EVENT_SIZE = (80, 80)  # matches the original hand-made events/* icons

# bucket events/* -> killfeed icon path in named/
EVENTS = {
    "events/kill": "rui/hud/gamestate/player_kills_icon",
    "events/death1": "rui/rui_screens/skull",
    "events/knockdown": "rui/hud/obituary/obituary_downed",
    "events/headshot": "rui/hud/obituary/obituary_headshot",
    "events/revive": "rui/hud/unitframes/icon_revive",
    "events/respawn": "rui/hud/unitframes/icon_respawn",
}


def cover(src, size):
    im = Image.open(src).convert("RGB")
    tw, th = size
    s = max(tw / im.size[0], th / im.size[1])
    im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS)
    l, t = (im.size[0] - tw) // 2, (im.size[1] - th) // 2
    return im.crop((l, t, l + tw, t + th))


def load_env():
    env = {}
    path = os.path.join(ROOT, ".env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def portrait_square(src, size=300):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    if w <= h:
        return im.resize((size, size), Image.LANCZOS)
    # centre the crop on the head: mean x of opaque pixels in the top 60% of the image
    alpha = im.getchannel("A")
    xs = [x for y in range(0, int(h * 0.6), 4) for x in range(w) if alpha.getpixel((x, y)) > 128]
    cx = sum(xs) // len(xs) if xs else w // 2
    left = max(0, min(w - h, cx - h // 2))
    return im.crop((left, 0, left + h, h)).resize((size, size), Image.LANCZOS)


def mirrored_emblem(src):
    half = Image.open(src).convert("RGBA")
    w, h = half.size
    full = Image.new("RGBA", (w * 2, h))
    full.paste(half.transpose(Image.FLIP_LEFT_RIGHT), (0, 0))
    full.paste(half, (w, 0))
    return full


def pad_square(src):
    im = Image.open(src).convert("RGBA")
    s = max(im.size)
    out = Image.new("RGBA", (s, s))
    out.paste(im, ((s - im.size[0]) // 2, (s - im.size[1]) // 2))
    return out


def character_icon(data_dir, code):
    import re
    txt = open(os.path.join(data_dir, "settings", "itemflav", "character", code + ".json"), encoding="utf-8").read()
    m = re.search(r'"characterSelectIcon":\s*"(rui/[^"]+)"', txt)
    return m.group(1) if m else None


def build(named, data_dir, upload_dir):
    os.makedirs(upload_dir, exist_ok=True)
    plan = []  # (bucket name, kind)
    missing = []

    def save(img, name, kind):
        dst = os.path.join(upload_dir, name + ".png")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        img.save(dst, optimize=True)
        plan.append((name + ".png", kind))

    for name, code in LEGENDS.items():
        rel = character_icon(data_dir, code)
        src = rel and os.path.join(named, rel + ".png")
        if not src or not os.path.exists(src):
            missing.append(f"legend {name} ({code}: {rel})"); continue
        save(portrait_square(src), name, "replace")
    for name, f in RANKS.items():
        src = os.path.join(named, "rui", "menu", "ranked", f + ".png")
        if not os.path.exists(src):
            missing.append(f"rank {name} ({f})"); continue
        save(mirrored_emblem(src), name, "replace")
    for name in PERKS:
        src = os.path.join(named, "rui", "pilot_loadout", "mods", f"amp_icon_{name}.png")
        if not os.path.exists(src):
            missing.append(f"perk {name}"); continue
        save(pad_square(src), name, "replace")
    for name, f in WEAPON_SILHOUETTES.items():
        src = os.path.join(named, "rui", "weapon_icons", "r5", f + ".png")
        if not os.path.exists(src):
            missing.append(f"weapon {name} ({f})"); continue
        save(Image.open(src).convert("RGBA"), name + "_silhouette", "new")
    Image.MAX_IMAGE_PIXELS = None
    for name, code in MAPS.items():
        src = os.path.join(named, "maps", code, "overview.png")
        if not os.path.exists(src):
            missing.append(f"map {name} ({code})"); continue
        save(Image.open(src).convert("RGBA"), name, "replace")
    for name, code in THUMBNAILS.items():
        src = os.path.join(named, "maps", code, "loadscreen.png")
        if not os.path.exists(src):
            missing.append(f"thumbnail {name} ({code})"); continue
        save(cover(src, THUMB_SIZE), name, "replace")
    for name, rel in EVENTS.items():
        src = os.path.join(named, rel + ".png")
        if not os.path.exists(src):
            missing.append(f"event {name} ({rel})"); continue
        save(pad_square(src).resize(EVENT_SIZE, Image.LANCZOS), name, "replace")
    return plan, missing


def object_url(name, public=False):
    seg = urllib.parse.quote(name)
    return f"{PROJECT_URL}/storage/v1/object/{'public/' if public else ''}{BUCKET}/{seg}"


def backup(plan, backup_dir):
    os.makedirs(backup_dir, exist_ok=True)
    n = 0
    for name, kind in plan:
        if kind != "replace":
            continue
        try:
            with urllib.request.urlopen(object_url(name, public=True)) as r:
                dst = os.path.join(backup_dir, name)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                open(dst, "wb").write(r.read()); n += 1
        except urllib.error.HTTPError as e:
            print(f"  backup skip {name}: HTTP {e.code}")
    return n


def upload(plan, upload_dir, key):
    ok = 0
    for name, _ in plan:
        body = open(os.path.join(upload_dir, name), "rb").read()
        req = urllib.request.Request(object_url(name), data=body, method="POST", headers={
            "Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "image/png",
            "x-upsert": "true", "Cache-Control": "max-age=3600",
        })
        try:
            urllib.request.urlopen(req).read(); ok += 1
        except urllib.error.HTTPError as e:
            print(f"  upload FAILED {name}: HTTP {e.code} {e.read()[:200]!r}")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--named", required=True, help="<build>/named folder from extract.py")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--only", help="only back up/upload bucket names starting with this prefix (e.g. events/)")
    a = ap.parse_args()

    named = os.path.abspath(a.named)
    build_dir = os.path.dirname(named)
    out_root = os.path.dirname(os.path.dirname(build_dir))  # .../apex-extract
    upload_dir = os.path.join(build_dir, "upload")

    plan, missing = build(named, os.path.join(build_dir, "data"), upload_dir)
    if a.only:
        plan = [p for p in plan if p[0].startswith(a.only)]
    print(f"prepared {len(plan)} files -> {upload_dir}")
    print(f"  replace: {sum(k == 'replace' for _, k in plan)}, new silhouettes: {sum(k == 'new' for _, k in plan)}")
    for m in missing:
        print("  MISSING", m)

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    bdir = os.path.join(out_root, "supabase-backup", stamp)
    print(f"backed up {backup(plan, bdir)} originals -> {bdir}")

    if not a.upload:
        print("dry run: nothing uploaded (pass --upload)")
        return
    key = load_env().get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        sys.exit("SUPABASE_SERVICE_ROLE_KEY missing from .env")
    print(f"uploaded {upload(plan, upload_dir, key)} / {len(plan)}")


if __name__ == "__main__":
    main()
