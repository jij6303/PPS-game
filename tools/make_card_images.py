"""
칭호 카드 저장용 이미지를 data URI로 만들어 js/card_images.js에 쓴다.

왜: index.html을 file://로 열면 로컬 이미지를 캔버스에 그리는 순간 캔버스가 "오염"되어
toBlob/toDataURL이 막힌다. data URI 이미지는 오염시키지 않으므로 저장이 된다.
원본 이미지가 바뀌면 다시 실행:  python tools/make_card_images.py
(마스코트 원본 디자인은 바꾸지 않고 크기만 줄인다 — GAME_SPEC 3장)
"""
import base64
import io
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "assets" / "img"
OUT = ROOT / "js" / "card_images.js"

# 키: (원본 파일, 줄일 높이 px, 저장 형식)
SOURCES = {
    "dali": ("dali_3d.png", 440, "PNG"),
    "narmi": ("narmi_3d.png", 440, "PNG"),
    "symbol": ("pps_symbol_h.jpg", 120, "JPEG"),
}


def data_uri(path: Path, height: int, fmt: str) -> str:
    im = Image.open(path)
    w = round(im.width * height / im.height)
    im = im.resize((w, height), Image.LANCZOS)
    buf = io.BytesIO()
    if fmt == "PNG":
        im.save(buf, "PNG", optimize=True)
        mime = "image/png"
    else:
        im.convert("RGB").save(buf, "JPEG", quality=88)
        mime = "image/jpeg"
    return "data:%s;base64,%s" % (mime, base64.b64encode(buf.getvalue()).decode("ascii"))


def main() -> None:
    lines = [
        "/* 자동 생성 파일 — tools/make_card_images.py로 만든다. 직접 고치지 않는다. */",
        "/* 칭호 카드 이미지 저장용 (file://에서도 캔버스가 오염되지 않게 data URI로). */",
        "window.Game = window.Game || {};",
        "Game.CARD_IMAGES = {",
    ]
    items = list(SOURCES.items())
    for i, (key, (name, h, fmt)) in enumerate(items):
        comma = "," if i < len(items) - 1 else ""
        lines.append('  %s: "%s"%s' % (key, data_uri(IMG / name, h, fmt), comma))
    lines.append("};")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote %s (%d KB)" % (OUT.relative_to(ROOT), OUT.stat().st_size // 1024))


if __name__ == "__main__":
    main()
