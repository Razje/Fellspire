"""Unpack a CraftPix chibi pack's separate parts and its Spriter animation file.

    python -I tools/unpack-parts.py <pack.zip> <name>

For each variant in the zip (Valkyrie_1, Valkyrie_2, ...) it copies
PNG/Vector Parts/*.png and Animations.scml into assets/parts/<Variant>/.
The game plays these itself (src/rig/), so a character can be built from parts
of different packs. Like everything under assets/, the result stays out of git
(CraftPix licence).
"""
import sys
import zipfile
from pathlib import Path

zpath, name = sys.argv[1], sys.argv[2]
root = Path(__file__).resolve().parent.parent / 'assets' / 'parts'
z = zipfile.ZipFile(zpath)
count = 0
for info in z.infolist():
    n = info.filename
    if '__MACOSX' in n or '/._' in n or n.endswith('/'):
        continue
    parts = n.split('/')
    if len(parts) < 4 or parts[1] != 'PNG' or parts[2] != 'Vector Parts':
        continue
    variant = parts[0]
    out = root / variant / parts[-1]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(z.read(n))
    count += 1
print(f'{name}: {count} files into {root}')
