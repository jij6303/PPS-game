# PPS-game

## 개발 워크플로우

이슈 생성 → `feature-#N` 브랜치 → 개발 → PR → 리뷰 요청 순서로 진행하며,
GitHub 작업은 모두 `github/` 봇 스크립트로 수행합니다. 자세한 규칙은 `.claude/rules/rules.md` 참고.

## 제출용 ZIP 만들기

```bash
python tools/package.py --name 성명
# → dist/AI게임_실행파일_달이의조달창구_성명.zip
```

게임 실행에 필요한 파일(`index.html`, `css/`, `js/`, `assets/`, `CREDITS.md`)과 `실행방법.txt`만 담는다.
압축 전에 참조 파일 누락·외부 주소·`type="module"`·`fetch()`를 점검하고, 문제가 있으면 ZIP을 만들지 않는다.
