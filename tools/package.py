"""
제출용 게임 실행파일 ZIP 만들기 (GAME_SPEC 1장 제출물, 12장 M5)

사용:
    python tools/package.py --name 홍길동
    → dist/AI게임_실행파일_달이의조달창구_홍길동.zip

ZIP 안에는 게임 실행에 필요한 파일만 넣는다:
    달이의 조달 창구/
      index.html, css/, js/, assets/, CREDITS.md, 실행방법.txt

압축 전에 아래를 점검하고, 하나라도 실패하면 ZIP을 만들지 않는다 (GAME_SPEC 9장 — file://로 열어도 동작):
    - index.html·css·js가 가리키는 로컬 파일이 모두 패키지 안에 있는지
    - 외부 주소(http://, https://, //)를 불러오지 않는지
    - <script type="module">, fetch() 를 쓰지 않는지
"""
import argparse
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME_TITLE = "달이의 조달 창구"
TITLE_FOR_FILENAME = "달이의조달창구"

# 패키지에 넣을 것 (파일 또는 폴더). 폴더는 안의 파일 전부.
INCLUDE = ["index.html", "css", "js", "assets", "CREDITS.md"]

README_TEXT = """{title} — 실행 방법

1. 이 ZIP 파일의 압축을 풉니다.
2. "{title}" 폴더 안의 index.html 을 더블클릭합니다.
   (Chrome, Edge, Safari 최신 버전 권장. 인터넷 연결·설치 없이 실행됩니다.)
3. 화면 아무 곳이나 클릭해 시작하세요. 마우스와 터치 모두 됩니다.

- 소리: 왼쪽 아래(심사 화면에서는 왼쪽 위) 스피커 버튼으로 켜고 끕니다.
- 휴대폰을 세로로 들면 세로 화면으로 바뀝니다.
- 사용한 폰트·이미지 출처는 CREDITS.md 에 있습니다.

2026 조달청 AI 게임 공모전 출품작
"""

# 로컬 파일 참조를 찾는 패턴
REF_PATTERNS = [
    re.compile(r"""\b(?:src|href)\s*=\s*["']([^"']+)["']"""),      # html, js 문자열 안의 src=/href=
    re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)"""),          # css url()
]
EXTERNAL = re.compile(r"^(?:[a-z]+:)?//", re.I)
FORBIDDEN = [
    (re.compile(r"""type\s*=\s*["']module["']"""), 'type="module" (file://에서 막힘)'),
    (re.compile(r"\bfetch\s*\("), "fetch() (file://에서 로컬 파일 못 읽음)"),
    (re.compile(r"""\bimport\s*\(|^\s*import\s.+from\s""", re.M), "ES module import"),
]


COMMENTS = {
    ".html": re.compile(r"<!--.*?-->", re.S),
    ".css": re.compile(r"/\*.*?\*/", re.S),
    ".js": re.compile(r"/\*.*?\*/|(?<![:'\"])//[^\n]*", re.S),
}


def strip_comments(text, suffix):
    """주석 속 설명(예: 'type="module" 없이')이 걸리지 않게 주석을 지운다."""
    return COMMENTS[suffix].sub("", text)


def collect_files():
    files = []
    for item in INCLUDE:
        path = ROOT / item
        if not path.exists():
            raise SystemExit(f"[오류] 패키지에 넣을 '{item}' 이(가) 없습니다.")
        if path.is_dir():
            files += sorted(p for p in path.rglob("*") if p.is_file())
        else:
            files.append(path)
    return files


def check(files):
    """문제 목록을 돌려준다 (비어 있으면 통과)."""
    problems = []
    packaged = {p.resolve() for p in files}
    for f in files:
        if f.suffix not in (".html", ".css", ".js"):
            continue
        text = strip_comments(f.read_text(encoding="utf-8"), f.suffix)
        rel = f.relative_to(ROOT).as_posix()

        for pattern, why in FORBIDDEN:
            if pattern.search(text):
                problems.append(f"{rel}: {why} 사용")

        for pattern in REF_PATTERNS:
            for ref in pattern.findall(text):
                if ref.startswith(("#", "data:", "mailto:", "javascript:")):
                    continue
                if EXTERNAL.match(ref):
                    problems.append(f"{rel}: 외부 주소를 불러옴 → {ref}")
                    continue
                if "{" in ref or "'" in ref or "+" in ref:   # js에서 조립하는 경로는 건너뜀
                    continue
                path = ref.split("?")[0].split("#")[0]
                # html·js 안의 경로는 index.html 기준, css 안의 경로는 css 파일 기준
                base = f.parent if f.suffix == ".css" else ROOT
                target = (base / path).resolve()
                if target not in packaged:
                    problems.append(f"{rel}: 참조한 파일이 패키지에 없음 → {ref}")
    return problems


def dirty_files():
    """패키지 대상 중 커밋 안 된 변경이 있는 파일 (git이 없으면 빈 목록)."""
    try:
        out = subprocess.check_output(
            ["git", "status", "--porcelain", "--", *INCLUDE], cwd=ROOT, stderr=subprocess.DEVNULL
        ).decode("utf-8", "replace")
    except Exception:
        return []
    return [line[3:] for line in out.splitlines() if line.strip()]


def main():
    try:   # 윈도우 콘솔(cp949)에서도 한글 메시지가 깨지지 않게
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    parser =argparse.ArgumentParser(description="제출용 게임 실행파일 ZIP 만들기")
    parser.add_argument("--name", required=True, help="참가자 성명 (파일 이름에 들어감)")
    parser.add_argument("--out", default=str(ROOT / "dist"), help="ZIP을 만들 폴더 (기본: dist/)")
    args = parser.parse_args()

    name = args.name.strip()
    if not name or re.search(r'[\\/:*?"<>|]', name):
        raise SystemExit("[오류] --name 에 파일 이름으로 쓸 수 없는 글자가 있습니다.")

    files = collect_files()
    problems = check(files)
    if problems:
        print("[실패] 아래 문제를 고친 뒤 다시 실행하세요. ZIP을 만들지 않았습니다.")
        for p in problems:
            print("  -", p)
        sys.exit(1)

    dirty = dirty_files()
    if dirty:
        print("[경고] 커밋 안 된 변경이 들어갑니다:")
        for d in dirty:
            print("  -", d)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / f"AI게임_실행파일_{TITLE_FOR_FILENAME}_{name}.zip"

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in files:
            z.write(f, f"{GAME_TITLE}/{f.relative_to(ROOT).as_posix()}")
        z.writestr(f"{GAME_TITLE}/실행방법.txt", README_TEXT.format(title=GAME_TITLE).encode("utf-8"))

    size_mb = zip_path.stat().st_size / 1024 / 1024
    print(f"[완료] {zip_path}  ({len(files) + 1}개 파일, {size_mb:.1f}MB)")
    print("       점검 통과: 참조 파일 모두 포함 · 외부 주소 없음 · module/fetch 없음")


if __name__ == "__main__":
    main()
