"""Package only the exact expected production files, with index.html at ZIP root."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parents[1]
release = root / "release"
release.mkdir(exist_ok=True)
expected = json.loads((root / 'output/production-files.json').read_text(encoding='utf-8'))
for platform in ["toy", "xhs"]:
    dist = root / "dist" / platform
    paths = expected
    actual = {p.relative_to(dist).as_posix() for p in dist.rglob("*") if p.is_file()}
    if actual != set(paths):
        raise ValueError(f"Unexpected/missing files in {dist}: {actual.symmetric_difference(paths)}")
    version = json.loads((root / "package.json").read_text(encoding="utf-8"))["version"]
    output = release / f"ra2-tier-list-{platform}-{version}.zip"
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for relative in sorted(paths):
            archive.write(dist / relative, relative)
    with ZipFile(output) as archive:
        assert "index.html" in archive.namelist()
        assert archive.testzip() is None
    print(f"{output.name}: {output.stat().st_size:,} bytes; {len(paths)} files")
