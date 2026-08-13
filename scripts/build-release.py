#!/usr/bin/env python3
"""distから展開済みパッケージとChrome Web Store用ZIPを生成する。"""

import json
import shutil
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
dist = root / "dist"
manifest = json.loads((dist / "manifest.json").read_text(encoding="utf-8"))
name = f"x-context-toolkit-v{manifest['version']}"
release = root / "release"
unpacked = release / name
archive = release / f"{name}.zip"

release.mkdir(exist_ok=True)
shutil.rmtree(unpacked, ignore_errors=True)
archive.unlink(missing_ok=True)
shutil.copytree(dist, unpacked)

with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for source in sorted(unpacked.rglob("*")):
        if source.is_file():
            zf.write(source, source.relative_to(unpacked))

with zipfile.ZipFile(archive) as zf:
    if "manifest.json" not in zf.namelist():
        raise RuntimeError("ZIPルートにmanifest.jsonがありません")
    bad = zf.testzip()
    if bad:
        raise RuntimeError(f"ZIP検査に失敗しました: {bad}")

print(f"動作確認用: {unpacked}")
print(f"Web Storeアップロード用: {archive}")
