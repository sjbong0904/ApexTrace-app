"""Extract named UI icons (legends, weapons, loot, abilities...) from the installed Apex Legends.

Pipeline (run with the game CLOSED):
  1. RSX lists every asset in the UI/common rpaks (GUIDs only; retail paks carry no names).
  2. RSX exports settings/weapon/datatable assets, which reference icons by path ("rui/...").
  3. Each path is hashed (ui_image/<path>.rpak -> GUID) and matched to the UI image list.
  4. RSX exports the UI images, and matched ones are copied to <out>/<build>/named/<path>.png.

Usage:
  python -I scripts/game-icons/extract.py --rsx C:/Users/sjbon/tools/rsx/rsx_nogui.exe \
      --game "C:/SteamLibrary/steamapps/common/Apex Legends" --out D:/apex-extract/run
"""
import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rpak_guid import guid  # noqa: E402

DATA_PAKS = ["common.rpak", "common_mp.rpak", "common_early.rpak", "ui.rpak"]
IMAGE_PAKS = ["ui.rpak", "ui_lobby.rpak", "ui_main_menu.rpak", "common.rpak"]
RUI_RE = re.compile(rb"rui/[A-Za-z0-9_/.\-]+")

# Icons that no settings/datatable asset names (RUI passes them from compiled script).
# Found by hashing guesses; add new ones here.
EXTRA_PATHS = [
    "rui/hud/obituary/obituary_downed",
    "rui/hud/obituary/obituary_headshot",
    "rui/hud/gamestate/player_kills_icon",
    "rui/rui_screens/skull",
    "rui/hud/unitframes/icon_revive",
    "rui/hud/unitframes/revive_icon",
    "rui/hud/unitframes/icon_respawn",
]

# Map paks: mp_rr_<code>.rpak holds the 4096x4096 overview, mp_rr_<code>_loadscreen.rpak the loading art.
MAP_PAK_RE = re.compile(r"^mp_rr_(?!.*_client_)(?!.*\(\d+\))(.+?)(_loadscreen)?\.rpak$")


def game_running() -> bool:
    r = subprocess.run(["tasklist", "/FI", "IMAGENAME eq r5apex_dx12.exe"], capture_output=True, text=True)
    return "r5apex" in r.stdout.lower()


def rsx(exe, paks_dir, args, log):
    with open(log, "w", encoding="utf-8", errors="replace") as f:
        subprocess.run([exe, "-nogui", *args], cwd=paks_dir, stdout=f, stderr=subprocess.STDOUT, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rsx", required=True)
    ap.add_argument("--game", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--threads", type=int, default=8)
    ap.add_argument("--keep-raw", action="store_true", help="keep the unnamed GUID PNG export")
    a = ap.parse_args()

    if game_running():
        sys.exit("Apex is running. Close the game (and EAC) before extracting.")

    paks = os.path.join(a.game, "paks", "Win64")
    build = open(os.path.join(a.game, "build.txt"), encoding="utf-8").read().strip()
    build_tag = re.sub(r"[^A-Za-z0-9_.-]", "_", build)
    work = os.path.join(a.out, build_tag)
    os.makedirs(work, exist_ok=True)
    t = str(a.threads)

    # 1. asset list
    assets_csv = os.path.join(work, "assets.csv")
    print("[1/5] listing assets")
    rsx(a.rsx, paks, ["--list", assets_csv, "--listformat", "csv", *sorted(set(DATA_PAKS + IMAGE_PAKS))],
        os.path.join(work, "log_list.txt"))
    uiia = {}
    for r in csv.DictReader(open(assets_csv, encoding="utf-8")):
        if r["type"] == "uiia":
            uiia.setdefault(int(r["guid"], 16), r["file_name"])

    # 2. data assets -> icon paths
    data_dir = os.path.join(work, "data")
    print("[2/5] exporting settings/weapons/datatables")
    rsx(a.rsx, paks, ["-export", "--exporttypes", "stgs,wepn,dtbl", "--exportdir", data_dir,
                      "--exportthreads", t, *DATA_PAKS], os.path.join(work, "log_data.txt"))
    paths = set()
    for root, _, files in os.walk(data_dir):
        for fn in files:
            with open(os.path.join(root, fn), "rb") as f:
                for m in RUI_RE.findall(f.read()):
                    p = m.decode().lower()
                    paths.add(p[:-5] if p.endswith(".rpak") else p)
    paths.update(EXTRA_PATHS)

    # 3. hash + match
    mapping = {}
    for p in paths:
        g = guid(f"ui_image/{p}.rpak")
        if g in uiia:
            mapping[g] = p
    print(f"[3/5] matched {len(mapping)} / {len(uiia)} UI images by name")

    # 4. export images + rename
    raw = os.path.join(work, "raw")
    print("[4/5] exporting UI images")
    rsx(a.rsx, paks, ["-export", "--exporttypes", "uiia", "--exportdir", raw, "--exportthreads", t, *IMAGE_PAKS],
        os.path.join(work, "log_images.txt"))
    raw_img = os.path.join(raw, "uiia", "ui_image")
    named = os.path.join(work, "named")
    manifest = []
    for g, p in sorted(mapping.items(), key=lambda kv: kv[1]):
        src = os.path.join(raw_img, f"0x{g:X}.png")
        if not os.path.exists(src):
            continue
        dst = os.path.join(named, p + ".png")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        manifest.append({"guid": f"{g:016x}", "pak": uiia[g], "path": p})
    json.dump({"build": build, "count": len(manifest), "images": manifest},
              open(os.path.join(work, "manifest.json"), "w", encoding="utf-8"), indent=1)

    # Legend index straight from character itemflavors (portrait/icon paths).
    legends = {}
    char_dir = os.path.join(data_dir, "settings", "itemflav", "character")
    if os.path.isdir(char_dir):
        for fn in os.listdir(char_dir):
            txt = open(os.path.join(char_dir, fn), encoding="utf-8", errors="replace").read()
            fields = dict(re.findall(r'"(characterSelectIcon|galleryPortrait|galleryPortraitBackground|icon)":\s*"(rui/[^"]+)"', txt))
            if fields:
                legends[fn[:-5]] = fields
    json.dump(legends, open(os.path.join(work, "legends.json"), "w", encoding="utf-8"), indent=1)

    # 5. maps: overview + loadscreen per mp_rr_* pak -> named/maps/<code>/{overview,loadscreen}.png
    print("[5/5] exporting map overviews and loadscreens")
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    maps_raw = os.path.join(work, "maps_raw")
    maps_out = os.path.join(named, "maps")
    for fn in sorted(os.listdir(paks)):
        m = MAP_PAK_RE.match(fn)
        if not m:
            continue
        code, is_load = m.group(1), bool(m.group(2))
        dest = os.path.join(maps_raw, fn[:-5])
        rsx(a.rsx, paks, ["-export", "--exporttypes", "uiia", "--exportdir", dest, fn],
            os.path.join(work, "log_maps.txt"))
        img_dir = os.path.join(dest, "uiia", "ui_image")
        if not os.path.isdir(img_dir):
            continue
        sized = [(Image.open(os.path.join(img_dir, f)).size, f) for f in os.listdir(img_dir)]
        if is_load:
            pick = max(sized, key=lambda s: s[0][0] * s[0][1], default=None)
        else:
            pick = next((s for s in sized if s[0] == (4096, 4096)), None)
        if pick:
            os.makedirs(os.path.join(maps_out, code), exist_ok=True)
            shutil.copyfile(os.path.join(img_dir, pick[1]),
                            os.path.join(maps_out, code, "loadscreen.png" if is_load else "overview.png"))
    shutil.rmtree(maps_raw, ignore_errors=True)

    if not a.keep_raw:
        shutil.rmtree(raw, ignore_errors=True)
    print(f"done: {len(manifest)} named images -> {named}")


if __name__ == "__main__":
    main()
