"""Unpack the PNG frames of a CraftPix pack into the game's art folder.

    python -I tools/unpack.py <pack.zip> <role>

<role> is hero, ghoul or archer. Only .png files are extracted (the vector and
Unity files are not needed), and the zip is moved to assets/packs/ afterwards.
"""
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROLES = {"hero", "ghoul", "archer"}


def main() -> None:
    zip_path, role = Path(sys.argv[1]).resolve(), sys.argv[2]
    if role not in ROLES:
        sys.exit(f"role must be one of {sorted(ROLES)}")
    dest = ROOT / "assets" / "characters" / role
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    count = 0
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            name = info.filename
            if info.is_dir() or not name.lower().endswith(".png"):
                continue
            # macOS zips carry "._name.png" metadata files that are not images.
            if "__MACOSX" in name or name.rsplit("/", 1)[-1].startswith("._"):
                continue
            target = (dest / name).resolve()
            if dest not in target.parents:  # refuse paths that escape the folder
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as src, open(target, "wb") as out:
                shutil.copyfileobj(src, out)
            count += 1
    packs = ROOT / "assets" / "packs"
    packs.mkdir(parents=True, exist_ok=True)
    if zip_path.parent != packs:
        shutil.move(str(zip_path), packs / zip_path.name)
    print(f"{count} frames -> {dest}")
    # Frames arrive at 900 x 900; shrink them so they fit in graphics memory.
    subprocess.run(["node", str(ROOT / "tools" / "shrink.mjs"), str(dest)], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
