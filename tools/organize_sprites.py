from __future__ import annotations

import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "characters"


def crop_strip(src_name, frames, out_path, padding=8):
    src = Image.open(ASSETS / src_name).convert("RGBA")
    crops = [src.crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3])) for rect in frames]
    width = sum(im.width for im in crops) + padding * (len(crops) + 1)
    height = max(im.height for im in crops) + padding * 2
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    rects = []
    x = padding
    for im in crops:
        out.alpha_composite(im, (x, padding))
        rects.append([x, padding, im.width, im.height])
        x += im.width + padding
    out.save(out_path)
    return {"src": "./" + out_path.relative_to(ASSETS).as_posix(), "rects": rects}


def cell_strip(src_name, cells, out_path, cell=512):
    src = Image.open(ASSETS / src_name).convert("RGBA")
    out = Image.new("RGBA", (cell * len(cells), cell), (0, 0, 0, 0))
    rects = []
    for i, (x, y) in enumerate(cells):
        out.alpha_composite(src.crop((x, y, x + cell, y + cell)), (i * cell, 0))
        rects.append([i * cell, 0, cell, cell])
    out.save(out_path)
    return {"src": "./" + out_path.relative_to(ASSETS).as_posix(), "rects": rects}


def action_dir(character, category):
    path = ASSETS / character / category
    path.mkdir(parents=True, exist_ok=True)
    return path


def main():
    manifests = {}
    # The original 4x4 atlas: blue row 1/2 and red row 3/4.
    base = {
        "canglan": [
            [34, 10, 225, 286], [348, 18, 216, 280], [628, 21, 290, 277],
            [945, 9, 297, 291], [35, 303, 228, 324], [356, 374, 251, 251],
            [679, 319, 189, 247], [912, 541, 317, 88],
        ],
        "chifeng": [
            [24, 641, 256, 285], [348, 644, 219, 282], [628, 644, 289, 282],
            [945, 635, 298, 291], [12, 971, 318, 260], [397, 963, 231, 268],
            [682, 927, 200, 248], [917, 1142, 323, 93],
        ],
    }
    for character, rects in base.items():
        common = action_dir(character, "common")
        names = ["idle", "guard", "punch", "kick", "special-punch", "hurt", "jump", "ko"]
        manifest = {"character": character, "actions": {}}
        for name, rect in zip(names, rects):
            info = crop_strip("arcade-fighters.png", [rect], common / f"{name}.png")
            manifest["actions"][name] = {"src": info["src"], "frames": info["rects"]}
        walk_frames = {
            "canglan": [[37,29,229,293],[390,30,172,292],[674,30,255,292],[1016,30,163,292]],
            "chifeng": [[38,14,247,305],[375,14,200,306],[659,25,265,298],[1012,16,173,307]],
        }[character]
        walk_source = "canglan-actions-v2.png" if character == "canglan" else "chifeng-actions-v2.png"
        walk = crop_strip(walk_source, walk_frames, common / "walk.png")
        manifest["actions"]["walk"] = {"src": walk["src"], "frames": walk["rects"]}

        for category in ("skill1", "skill2", "super"):
            action_dir(character, category)
        manifests[character] = manifest

    # V5 skill/super atlases are already 3x2, so split them into one action file.
    v5 = {
        "canglan": {"skill1": "canglan-skill-v5.png", "super": "canglan-super-v5.png"},
        "chifeng": {"skill1": "chifeng-skill-v5.png", "super": "chifeng-super-v5.png"},
    }
    cells = [(0, 0), (512, 0), (1024, 0), (0, 512), (512, 512), (1024, 512)]
    for character, actions in v5.items():
        for category, source in actions.items():
            out = action_dir(character, category) / "atlas.png"
            info = cell_strip(source, cells, out)
            manifests[character]["actions"][category] = {"src": info["src"], "frames": info["rects"], "frameWidth": 512, "frameHeight": 512}

    # Skill two and knockdown rows from the 6x4 atlas.
    for character, row, category in [("canglan", 0, "skill2"), ("chifeng", 1, "skill2")]:
        cells = [(i * 256, row * 294) for i in range(6)]
        out = action_dir(character, category) / "atlas.png"
        info = cell_strip("skill-knockdown-v3.png", cells, out, cell=256)
        manifests[character]["actions"][category] = {"src": info["src"], "frames": info["rects"], "frameWidth": 256, "frameHeight": 256}

    # Shared state copies that are visually specific to both fighters.
    shared = ASSETS / "shared"
    shared.mkdir(exist_ok=True)
    for character, y in [("canglan", 576), ("chifeng", 787)]:
        cells = [(i * 256, y) for i in range(6)]
        out = ASSETS / character / "common" / "knockdown.png"
        info = cell_strip("skill-knockdown-v3.png", cells, out, cell=256)
        manifests[character]["actions"]["knockdown"] = {"src": info["src"], "frames": info["rects"], "frameWidth": 256, "frameHeight": 256}

    # Directional attacks get their own per-character folders, while retaining
    # the common category requested by the design document.
    for character in manifests:
        common = action_dir(character, "common")
        directional = "direction-attacks-v4.png"
        rows = {
            "canglan": [(0, 225, 272, 280), (0, 478, 304, 280), (0, 0, 272, 280)],
            "chifeng": [(0, 712, 272, 280), (0, 1175, 304, 280), (0, 926, 272, 280)],
        }[character]
        for name, yrect in zip(("forward-punch", "forward-kick", "down-punch"), rows):
            frames = [(x, yrect[1], w, yrect[3]) for x, w in [(0, 272), (272, 272), (544, 304), (848, 238)]]
            info = crop_strip(directional, frames, common / f"{name}.png")
            manifests[character]["actions"][name] = {"src": info["src"], "frames": info["rects"]}
        sweep_y = 180 if character == "canglan" else 570
        sweep_frames = [(0, sweep_y, 380, 280), (400, sweep_y, 510, 280), (912, sweep_y, 510, 280), (1430, sweep_y, 344, 280)]
        info = crop_strip("sweeps-v4.png", sweep_frames, common / "down-kick.png")
        manifests[character]["actions"]["down-kick"] = {"src": info["src"], "frames": info["rects"]}
        # Two-frame crouch guard: source is a 2x2 sheet, blue row first, red row second.
        y = 0 if character == "canglan" else 627
        guard_frames = [(0, y, 627, 627), (627, y, 627, 627)]
        info = crop_strip("crouch-guard-v1.png", guard_frames, common / "crouch-guard.png")
        manifests[character]["actions"]["crouch-guard"] = {"src": info["src"], "frames": info["rects"]}
        manifests[character]["actions"]["dodge"] = manifests[character]["actions"]["guard"]
        # Dodge has a separate file so future characters can replace it without
        # changing the common guard asset; it starts from the guard pose today.
        guard_src = ASSETS / character / "common" / "guard.png"
        (common / "dodge.png").write_bytes(guard_src.read_bytes())
        manifests[character]["actions"]["dodge"] = {"src": f"./{character}/common/dodge.png", "frames": manifests[character]["actions"]["guard"]["frames"]}
        (ASSETS / character / "manifest.json").write_text(json.dumps(manifests[character], ensure_ascii=False, indent=2), encoding="utf-8")

    print("Organized character sprite assets for:", ", ".join(manifests))


if __name__ == "__main__":
    main()
