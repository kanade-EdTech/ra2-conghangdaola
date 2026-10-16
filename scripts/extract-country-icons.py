"""Copy local CnCNet country icons unchanged and create a labeled preview."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


COUNTRIES = [
    ("america", "美国", "America"),
    ("britain", "英国", "Great Britain"),
    ("france", "法国", "France"),
    ("germany", "德国", "Germany"),
    ("korea", "韩国", "Korea"),
    ("russia", "苏俄", "Russia"),
    ("iraq", "伊拉克", "Iraq"),
    ("cuba", "古巴", "Cuba"),
    ("libya", "利比亚", "Libya"),
    ("yuri", "尤里阵营", "Yuri"),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Local CnCNet Resources directory")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = root / "assets" / "countries"
    preview_path = root / "docs" / "国旗图标预览.png"

    # Validate every source and destination before starting the copy.
    for country_id, _, source_name in COUNTRIES:
        source = args.source / (source_name + "icon.png")
        with Image.open(source) as icon:
            icon.verify()
        target = output / (country_id + ".png")
        if target.exists() and target.read_bytes() != source.read_bytes():
            raise FileExistsError(f"Refusing to overwrite a different file: {target}")

    output.mkdir(parents=True, exist_ok=True)
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    manifest = []
    preview = Image.new("RGB", (1000, 480), "#151b23")
    draw = ImageDraw.Draw(preview)
    font_path = Path("C:/Windows/Fonts/msyh.ttc")
    font = ImageFont.truetype(str(font_path), 22) if font_path.exists() else ImageFont.load_default()
    small = ImageFont.truetype(str(font_path), 17) if font_path.exists() else font
    draw.text((24, 18), "红警 2 国家／阵营图标 · 本机 CnCNet 资源", font=font, fill="#f2f4f8")
    draw.text((24, 57), "原图 33×16 PNG；下方左侧原尺寸，右侧 4 倍最近邻预览", font=small, fill="#aab7c5")

    for index, (country_id, label, source_name) in enumerate(COUNTRIES):
        source = args.source / (source_name + "icon.png")
        target = output / (country_id + ".png")
        shutil.copyfile(source, target)
        with Image.open(target) as raw:
            icon = raw.convert("RGBA")
            manifest.append({
                "id": country_id,
                "name": label,
                "kind": "faction-emblem" if country_id == "yuri" else "country-flag",
                "versions": ["yr"] if country_id == "yuri" else ["ra2", "yr"],
                "path": f"assets/countries/{country_id}.png",
                "sourcePath": str(source.resolve()),
                "sourceType": "local-cncnet-client-resource",
                "width": icon.width,
                "height": icon.height,
                "bytes": target.stat().st_size,
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                "transformation": "none; byte-for-byte copy",
                "licenseStatus": "not determined from local resource files",
            })
            x = 20 + (index % 5) * 196
            y = 106 + (index // 5) * 174
            draw.rounded_rectangle((x, y, x + 184, y + 156), radius=10, fill="#26303d")
            draw.text((x + 12, y + 12), label, font=font, fill="#f2f4f8")
            preview.paste(icon, (x + 12, y + 72), icon)
            enlarged = icon.resize((icon.width * 4, icon.height * 4), Image.Resampling.NEAREST)
            preview.paste(enlarged, (x + 48, y + 52), enlarged)
            draw.text((x + 12, y + 126), country_id, font=small, fill="#aab7c5")

    (root / "assets" / "asset-manifest.json").write_text(
        json.dumps({"assets": manifest}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    preview.save(preview_path)
    print(f"Copied {len(manifest)} icons, {sum(item['bytes'] for item in manifest)} bytes total")
    print(f"Preview: {preview_path}")


if __name__ == "__main__":
    main()
