/*
 * 시나리오 데이터 (GAME_SPEC 9.2)
 * 사업·업체·서류·뉴스·칭호 문구는 전부 여기에 둔다. 엔진 코드에 하드코딩하지 않는다.
 * 모든 업체명·인물·번호는 가상이다 (GAME_SPEC 10장).
 *
 * 업체 서류(docs) 구조 — GAME_SPEC 5.1
 *   application: 입찰참가 신청서 { company, ceo, bizNo, address, submitDate }
 *   quote:       견적서         { company, bizNo, unitPrice, qty, total, note }
 *   certs:       인증서 목록     [{ type, number, validUntil, issuer, bizNo }]
 *   spec:        제품 사양서     { requiredSpec의 키와 같은 항목 + material } — 사양서의 제품 사진도 이 값대로 그려진다
 *   status:      업체 현황       { bizNo, hasOffice, hasFactory, employees, deliveries, seriousAccidents }
 *
 * 부적격 업체는 서류 안에 reason에 해당하는 근거가 반드시 있어야 한다.
 * Game.engine.validateData()가 이를 자동으로 검사한다.
 */
window.Game = window.Game || {};

Game.DATA = {
  /*
   * 이야기: 달이의 첫 출근 (GAME_SPEC 3장 스토리 뼈대).
   * scene: "home"(달이의 집) | "street"(출근길) | "building"(조달청) | "office"(업무 장소) — 배경 그림은 index.html·css
   * speaker: "dali" | "narmi", <b>는 강조.
   */
  intro: [
    { scene: "home", speaker: "dali", text: "따르릉! 오늘은 <b>조달청 첫 출근</b> 날이야. 떨리지만… 잘할 수 있겠지?" },
    { scene: "street", speaker: "dali", text: "출근길은 상쾌해! 저 가로등이랑 버스 정류장 의자도 <b>조달</b>로 산 물건이래. 다 국민 세금이지!" },
    { scene: "building", speaker: "dali", text: "도착! 여기가 오늘부터 내가 일할 <b>조달청</b>이야." },
    { scene: "office", speaker: "narmi", text: "안녕하세요, 달이 조달관님! 저는 AI 조달 비서 <b>나르미</b>예요. 조달청은 학교 책상, 도서관 조명처럼 나라에 필요한 물건과 공사를 <b>국민 세금</b>으로 사는 곳이에요." },
    { scene: "office", speaker: "narmi", text: "업체들이 서류를 내면 공고 조건과 꼼꼼히 비교해 주세요. 조건에 안 맞으면 <b>부적격</b>, 맞으면 <b>적격</b> 도장을 쾅!" },
    { scene: "office", speaker: "narmi", text: "심사를 통과한 업체들 중에서 낙찰할 한 곳을 골라요. 그때는 정답이 없어요 — <b>무엇을 더 소중히 여길지</b> 고르는 거예요." },
    { scene: "office", speaker: "dali", text: "좋아, 공정하게! 책상 위 <b>컴퓨터</b>를 켜서 첫 업무를 골라 볼게!" }
  ],
  /* 장면 이름표 (화면 왼쪽 위) */
  scenes: { home: "달이의 집 · 아침 7:30", street: "출근길", building: "조달청 · 일하는 곳", office: "업무 장소" },

  /* 업무 장소(사무실) — 책상 위 컴퓨터를 누르면 바탕화면 → 사업 폴더 → 공고 → 심사. 배치는 docs/office_layout.png 기준 */
  office: {
    prompt: {
      first: "책상 위 컴퓨터를 눌러 오늘 할 업무를 골라요!",
      next: "다음 업무를 골라 볼까요? 컴퓨터를 눌러 주세요!"
    },
    pcLabel: "컴퓨터 · 업무 고르기",
    spots: {
      door: "업체 대표들이 서류를 들고 이 문으로 들어와요.",
      window: "오늘도 맑음! 공정한 조달로 나라 살림을 지켜요.",
      narmi: [
        "컴퓨터를 켜면 사업마다 폴더가 있어요. 어떤 사업부터 해도 괜찮아요!",
        "서류는 탭을 눌러 펼치고, 펜·형광펜으로 표시하면서 공고 조건과 비교해 보세요.",
        "헷갈리면 심사 중에 <b>힌트</b>를 눌러요. 사업마다 두 번 도와드릴게요.",
        "통과한 업체 중 낙찰할 곳을 고를 때는 정답이 없어요. 무엇을 더 소중히 여길지 골라요."
      ]
    }
  },

  /* 컴퓨터 바탕화면 (전자조달 시스템) — 폴더 하나가 사업 하나 */
  computer: {
    title: "전자조달 시스템",
    user: "신입 조달관 달이",
    hint: "폴더를 열어 할 업무를 골라요. 어떤 순서로 해도 괜찮아요!",
    noticeFile: "입찰공고문",
    biddersFile: "입찰 업체 ({n}곳)",
    folderNote: "공고문을 먼저 읽고 심사를 시작해요.",
    newReasonNote: "이 사업에서 새 확인 사항이 나와요!",
    doneBadge: "심사 완료",
    doneNote: "이 업무는 끝냈어요. 낙찰: <b>{name}</b>",
    failedName: "유찰",
    off: "사무실로",
    back: "‹ 바탕화면",
    help: "? 도움말",
    /*
     * 바탕화면 둘러보기 (처음 컴퓨터를 켤 때 한 번, 도움말 버튼으로 다시).
     * target: 비출 곳 (CSS 선택자, 여러 개면 합친 영역). folder: true면 남은 첫 사업 폴더를 열어 놓고 비춘다.
     */
    tour: {
      next: "다음",
      done: "알겠어요!",
      skip: "건너뛰기",
      counter: "{i} / {n}",
      steps: [
        { target: "#pc-topbar", text: "여기는 <b>전자조달 시스템</b>이에요. 공공기관이 필요한 물건을 사는 일을 모두 이 컴퓨터로 해요. 오른쪽 위에서 <b>남은 업무</b> 수를 볼 수 있어요." },
        { target: ".pc-icon[data-action='open-folder']", text: "노란 <b>폴더</b> 하나가 사업 하나예요. <b>어떤 순서로 해도</b> 괜찮아요. 끝낸 사업에는 ✔ 표시가 붙어요." },
        { target: ".pc-file[data-action='open-notice']", folder: true, text: "폴더를 열면 <b>입찰공고문</b>이 있어요. <b>예산 상한 · 필수 인증 · 마감일 · 요구 사양</b>을 먼저 읽어 두세요. 이게 심사 기준이에요!" },
        { target: ".pc-file[data-action='open-bidders']", folder: true, text: "<b>입찰 업체</b> 파일에는 업체들의 서류가 들어 있어요. 공고 조건과 하나씩 비교해서 <b>적격 · 부적격</b> 도장을 찍어요." },
        { target: ".pc-icon-book", text: "모르는 말이 나오면 <b>용어 사전</b>을 열어 봐요. 일을 할수록 새 용어 카드가 모여요." },
        { target: "#pc-off, #pc-help", text: "<b>사무실로</b>를 누르면 사무실로 돌아가요. 이 안내는 <b>도움말</b>에서 다시 볼 수 있어요. 그럼 첫 폴더를 열어 볼까요?" }
      ]
    }
  },

  /* 타이틀 이어하기 버튼 ({n}: 이어서 할 사업 번호). 진행은 사업을 끝낼 때마다 저장된다. */
  continueLabel: "이어하기 <small>사업 {n}/{total}부터</small>",

  /*
   * 조달 용어 사전 (카드 모으기). 기본 용어·기본 사유는 처음부터, 새 사유는 처음 소개될 때,
   * 정책 카드는 그 사업(project)을 끝냈을 때 얻는다. 사유 카드 설명은 위 reasons를 그대로 쓴다.
   */
  glossary: {
    title: "조달 용어 사전",
    groups: { basics: "기본 용어", reasons: "부적격 사유", policies: "조달 정책" },
    lockedName: "???",
    lockedHint: "업무를 하다 보면 열려요.",
    pick: "카드를 눌러 설명을 봐요.",
    got: "용어 카드 획득!",
    complete: "조달 박사",
    completeNote: "카드를 모두 모았어요! 이제 조달 박사예요.",
    open: "용어 사전",
    shelfLabel: "책장 · 용어 사전",
    basics: [
      { id: "pps", name: "조달청",
        desc: "학교 책상, 도서관 조명, 체육관 공사처럼 나라에 필요한 물건과 공사를 국민 세금으로 사고 계약하는 정부 기관이에요.",
        more: "여러 기관이 따로 사지 않고 모아서 사면 더 싸고 공정하게 살 수 있어요." },
      { id: "eprocure", name: "전자조달",
        desc: "공고·입찰·계약을 인터넷 시스템으로 하는 거예요. 종이 서류를 들고 오지 않아도 돼요.",
        more: "모든 과정이 기록으로 남아서 누구나 확인할 수 있어 투명해요." },
      { id: "notice", name: "공고",
        desc: "무엇을, 얼마까지, 어떤 조건으로 살지 모두에게 알리는 글이에요.",
        more: "모두가 같은 정보를 보고 똑같은 조건에서 참여해야 공정해요." },
      { id: "bid", name: "입찰",
        desc: "업체들이 \"이 조건이면 이 가격에 하겠습니다\" 하고 서류를 내는 거예요.",
        more: "여러 업체가 경쟁할수록 나라는 더 좋은 조건으로 살 수 있어요." },
      { id: "screening", name: "적격 심사",
        desc: "업체가 공고 조건을 지킬 수 있는지 서류로 꼼꼼히 확인하는 일이에요. 달이가 창구에서 하는 일이죠!",
        more: "조건에 맞으면 적격, 하나라도 어긋나면 부적격이에요." },
      { id: "award", name: "낙찰",
        desc: "심사를 통과한 업체 중 한 곳을 계약할 업체로 정하는 거예요.",
        more: "가격만 보지 않고 품질·안전·환경·상생 같은 가치도 함께 따져요." },
      { id: "nobid", name: "유찰",
        desc: "조건에 맞는 업체가 없어서 계약이 이뤄지지 않는 거예요.",
        more: "유찰되면 공고를 다시 내야 해서 물건을 받기까지 더 오래 걸려요." }
    ],
    /* 사유 카드에 덧붙이는 한 줄 (없으면 설명만) */
    reasonMore: {
      OVER_BUDGET: "예산은 국민이 낸 세금으로 미리 정한 금액이에요.",
      LATE: "한 업체만 늦게 내도 받아 주면 시간을 지킨 업체들이 손해를 봐요.",
      CERT_MISSING: "인증서는 제품이 안전하고 품질 기준을 지켰다는 증명이에요.",
      CERT_EXPIRED: "인증에도 유효기간이 있어요. 입찰 마감일에 살아 있는 인증이어야 해요.",
      SPEC_MISMATCH: "물건을 쓸 기관이 꼭 필요한 조건을 정한 거라 하나라도 다르면 안 돼요.",
      INFO_MISMATCH: "서류끼리 정보가 다르면 위조나 실수일 수 있어서 믿을 수 없어요.",
      COLLUSION: "업체들이 짜고 가격을 맞추면 경쟁이 사라져 세금이 낭비돼요.",
      BROKER: "물건을 만들 능력 없이 계약만 따서 다른 곳에 넘기는 업체를 막아요.",
      SAFETY: "일하는 사람의 안전을 지키지 않은 기업은 공공 계약에서 불리해져요."
    },
    policies: [
      { project: "desk", name: "혁신조달",
        desc: "나라가 새 기술·새 제품의 첫 구매자가 되어 주는 정책이에요. 처음 팔 곳이 없는 스타트업이 실적을 쌓고 자랄 수 있어요.",
        more: "새 제품은 아직 검증이 덜 됐을 수 있어서, 안정과 혁신 사이에서 고민하게 돼요." },
      { project: "chair", name: "가격과 품질",
        desc: "싼 물건이 늘 알뜰한 건 아니에요. 오래 쓰는 물건은 고장·교체 비용까지 따져 봐야 해요.",
        more: "당장 아끼는 돈과 오래 쓰는 튼튼함, 둘 다 세금을 아끼는 방법이에요." },
      { project: "led", name: "녹색조달",
        desc: "환경을 덜 해치는 친환경 인증 제품을 우선 사는 거예요. 탄소를 줄여 지구를 지키는 데 보탬이 돼요.",
        more: "친환경 제품은 조금 비쌀 수 있지만 전기 요금이나 환경 비용을 줄일 수 있어요." },
      { project: "mask", name: "사회적 가치 조달",
        desc: "장애인 표준사업장이나 사회적기업이 만든 제품을 사서 일자리와 상생을 돕는 거예요.",
        more: "공공기관이 이런 제품을 우선 구매하도록 하는 제도가 있어요." },
      { project: "gym", name: "안전한 조달",
        desc: "공사는 싼 가격보다 안전하게 일하는 업체가 중요할 때가 많아요. 중대재해를 낸 기업은 낙찰이 제한될 수 있어요.",
        more: "아이들이 쓸 시설일수록 안전 점수를 꼼꼼히 봐야 해요." }
    ]
  },

  speakers: { dali: "달이", narmi: "나르미" },

  /* 부적격 사유 (GAME_SPEC 5.2). desc는 나르미가 쉬운 말로 설명할 때 쓴다. */
  reasons: {
    OVER_BUDGET:   { name: "예산 초과",          policy: "예산 집행 원칙", desc: "견적 총액이 공고의 예산 상한보다 많아요. 국민 세금은 정해진 만큼만 써야 해요." },
    LATE:          { name: "마감 후 제출",        policy: "입찰 절차",     desc: "신청서 제출일이 마감일보다 늦어요. 모두에게 같은 마감을 지켜야 공정해요." },
    CERT_MISSING:  { name: "필수 인증 누락",      policy: "품질 관리",     desc: "공고에서 꼭 필요하다고 한 인증서가 없어요." },
    CERT_EXPIRED:  { name: "인증 유효기간 만료",  policy: "품질 관리",     desc: "인증서 유효기간이 입찰 마감일 전에 끝났어요." },
    SPEC_MISMATCH: { name: "요구 사양 불일치",    policy: "수요기관 요구 충족", desc: "제품 사양이 공고에서 요구한 것과 달라요." },
    INFO_MISMATCH: { name: "서류 간 정보 불일치", policy: "서류 위조 방지", desc: "서류마다 사업자번호 같은 기본 정보가 서로 달라요." },
    COLLUSION:     { name: "담합 의심",          policy: "공정조달",      desc: "다른 업체와 견적 단가와 문구까지 똑같아요. 미리 짜고 입찰했을 수 있어요." },
    BROKER:        { name: "실체 없는 업체",      policy: "공정조달 — 브로커 입찰 근절", desc: "공장도 사무실도 없고 직원도 거의 없어요. 물건을 만들 수 없는 업체예요." },
    SAFETY:        { name: "중대재해 이력",       policy: "안전 — 중대재해 기업 낙찰 제한", desc: "일하던 사람이 크게 다친 사고 기록이 있어요." }
  },

  /*
   * 심사 요령 (부적격 판정 튜토리얼). 심사 데스크에 처음 들어갈 때 한 번, '심사 요령' 버튼으로 다시.
   * 사유 페이지: look = [조건 쪽, 서류 쪽] 비교할 곳, example = 두 칸 비교 예시(same: true면 '똑같아서' 문제),
   * tips = 꼭 확인할 점. 아직 소개되지 않은 사유는 잠금으로 보인다. 예시 값은 설명용 가상 값.
   */
  guide: {
    title: "심사 요령",
    button: "심사 요령",
    reasonLink: "사유가 헷갈려요? <b>심사 요령</b> 보기",
    prev: "‹ 이전",
    next: "다음 ›",
    close: "심사 시작!",
    lookLabel: "이곳을 비교해요",
    exampleLabel: "예시",
    tipsLabel: "꼭 확인!",
    condTitle: "공고 조건표",
    docTitle: "업체 서류",
    lockedName: "???",
    lockedText: "아직 소개되지 않은 사유예요. 이 사유가 필요한 사업을 열면 나르미가 알려 줄게요.",
    intro: {
      nav: "심사 순서",
      title: "서류는 공고 조건과 맞춰 봐요",
      lead: "업체 서류를 <b>공고 조건표</b>와 하나씩 비교해요. 하나라도 어긋나면 <b>부적격</b>이에요.",
      steps: [
        "오른쪽 <b>공고 조건표</b>에서 예산 상한 · 필수 인증 · 입찰 마감 · 요구 사양을 먼저 봐요.",
        "서류 탭(신청서 · 견적서 · 인증서 · 사양서 · 업체 현황)을 펼쳐 조건과 비교해요.",
        "수상한 곳은 <b>펜 · 형광펜</b>으로 표시해 두면 헷갈리지 않아요.",
        "문제가 없으면 <b>적격</b>, 있으면 <b>부적격</b> 도장을 찍고 사유를 골라요."
      ],
      note: "업체 대표의 말은 참고만 해요. 판정은 <b>서류</b>로 해요!"
    },
    reasons: {
      OVER_BUDGET: {
        look: ["예산 상한", "견적서 · 총액"],
        example: { cond: ["예산 상한", "40,000,000원"], doc: ["견적서 총액", "43,000,000원"] },
        tips: ["총액이 예산 상한과 <b>같으면 괜찮아요</b>. 1원이라도 넘으면 부적격이에요.", "단가가 싸 보여도 <b>총액</b>으로 비교해요."]
      },
      LATE: {
        look: ["입찰 마감", "신청서 · 제출일"],
        example: { cond: ["입찰 마감", "2026-03-10"], doc: ["신청서 제출일", "2026-03-11"] },
        tips: ["마감일 <b>당일</b>에 낸 건 괜찮아요. 하루라도 늦으면 부적격이에요.", "날짜는 연 → 월 → 일 순서로 비교해요."]
      },
      CERT_MISSING: {
        look: ["필수 인증", "인증서 · 인증 종류"],
        example: { cond: ["필수 인증", "KC, 고효율"], doc: ["인증서", "KC"] },
        tips: ["필수 인증이 여러 개면 <b>하나씩 전부</b> 찾아요.", "다른 인증이 많아도 필수 인증이 하나 빠지면 부적격이에요."]
      },
      CERT_EXPIRED: {
        look: ["입찰 마감", "인증서 · 유효기간"],
        example: { cond: ["입찰 마감", "2026-03-10"], doc: ["KC 유효기간", "2026-02-28"] },
        tips: ["인증 <b>이름</b>만 보지 말고 <b>유효기간</b>까지 봐요.", "유효기간이 입찰 마감일보다 <b>앞</b>이면 만료예요."]
      },
      SPEC_MISMATCH: {
        look: ["요구 사양", "사양서"],
        example: { cond: ["요구 사양", "높이 조절 있음"], doc: ["사양서 높이 조절", "없음"] },
        tips: ["요구 사양 항목을 <b>하나씩</b> 사양서에서 찾아요.", "제품 사진보다 사양서 <b>표의 값</b>을 믿어요."]
      },
      INFO_MISMATCH: {
        look: ["신청서 · 사업자번호", "다른 서류 · 사업자번호"],
        condTitle: "입찰참가 신청서",
        example: { cond: ["사업자번호", "305-86-11240"], doc: ["견적서 사업자번호", "305-86-11420"] },
        tips: ["숫자 <b>한두 자리</b>만 바뀌어 있을 수 있어요. 끝까지 비교해요.", "업체명도 서류마다 같은지 봐요."]
      },
      COLLUSION: {
        look: ["앞서 본 업체 견적서", "이 업체 견적서"],
        condTitle: "앞서 본 업체 견적서", docTitle: "이 업체 견적서",
        example: { cond: ["단가 · 비고", "172,000원 · 납품 후 1년 무상 교체"], doc: ["단가 · 비고", "172,000원 · 납품 후 1년 무상 교체"], same: true },
        tips: ["견적서 탭에서 <b>앞서 본 업체의 견적서를 불러와</b> 나란히 놓아요.", "다른 업체인데 단가와 비고 문구가 <b>똑같으면</b> 미리 짰을 수 있어요."]
      },
      BROKER: {
        look: ["물건을 만들 수 있는 업체인가?", "업체 현황 · 사무실 · 공장 · 직원 수"],
        condTitle: "보통 업체",
        example: { cond: ["사무실 · 공장 · 직원", "있음 · 있음 · 25명"], doc: ["사무실 · 공장 · 직원", "없음 · 없음 · 1명"] },
        tips: ["사무실과 공장이 <b>둘 다 없거나</b>, 직원이 <b>1명 이하</b>면 의심해요.", "납품 실적 0건은 괜찮아요 — 처음 납품하는 새 업체일 수 있어요!"]
      },
      SAFETY: {
        look: ["안전 기준", "업체 현황 · 중대재해 이력"],
        condTitle: "안전 기준",
        example: { cond: ["중대재해 이력", "0건"], doc: ["중대재해 이력", "1건"] },
        tips: ["중대재해 이력이 <b>1건이라도</b> 있으면 부적격이에요.", "직원이 많고 실적이 좋아도 이 칸은 꼭 확인해요."]
      }
    },
    outro: {
      nav: "헷갈릴 때",
      title: "헷갈릴 때는 이렇게",
      steps: [
        "나르미 <b>힌트</b>(사업당 2번)를 누르면 수상한 곳에 형광펜을 칠해 줘요.",
        "부적격은 맞는데 <b>사유만 틀리면</b> 감사 지적은 없어요. 나르미가 맞는 사유를 알려 줘요.",
        "적격 업체를 반려하거나 부적격 업체를 통과시키면 <b>감사 지적</b>이 1회 쌓여요.",
        "다 끝나면 <b>심사 기록</b>에서 판정을 하나씩 복기할 수 있어요."
      ],
      note: "이 안내는 오른쪽 아래 <b>심사 요령</b> 버튼으로 언제든 다시 볼 수 있어요."
    }
  },

  /* 처음부터 쓸 수 있는 사유. 나머지(담합·서류 불일치·브로커·중대재해)는 그 사유가 필요한 사업을
     처음 열 때 나르미가 소개하고 선택지에 추가된다 — 사업을 어떤 순서로 골라도 된다 (GAME_SPEC 5.2). */
  startingReasons: ["OVER_BUDGET", "LATE", "CERT_MISSING", "CERT_EXPIRED", "SPEC_MISMATCH"],

  /* 사양서 항목 이름 (화면 표시용) */
  specLabels: {
    size: "상판 크기",
    heightAdjustable: "높이 조절",
    seatHeight: "좌석 높이",
    armrest: "팔걸이",
    power: "소비전력",
    colorTemp: "색온도",
    grade: "등급",
    packaging: "포장",
    roofPanel: "지붕재",
    period: "공사 기간",
    material: "재질"
  },

  /* 나르미 안내 문구. {name}·{desc}는 화면에서 사유 이름·설명으로 바뀐다. */
  narmi: {
    newReason: "새로운 확인 사항이 생겼어요! <b>{name}</b> — {desc}",
    /* 첫 사업 공고 화면에서 한 번 (심사 중에는 나르미가 말하지 않는다) */
    howTo: "서류 탭을 누르면 책상에 펼쳐지고, <b>서류 머리를 잡아 끌면</b> 옮길 수 있어요. 앞서 본 업체의 견적서도 불러와 나란히 놓을 수 있어요.",
    /* {count}: 플레이어가 적격 도장을 찍은 업체 수 — 정답(적격 업체) 수를 알려 주지 않는다 (GAME_SPEC 4.2) */
    awardTip: "심사를 통과한 <b>{count}곳</b> 중에서 낙찰 업체를 골라 주세요. 정답은 없어요 — 무엇을 더 소중히 여길지 골라요.",
    awardTipOne: "심사를 통과한 곳은 <b>한 곳</b>이에요. 이 업체로 낙찰할까요?",
    noCandidate: "통과한 업체가 없어서 이번 사업은 유찰됐어요. 다시 공고를 내야 해요.",

    /* 부적격은 맞췄지만 사유가 틀렸을 때 (GAME_SPEC 4.2) */
    reasonFix: "부적격 판정은 맞아요! 그런데 진짜 이유는 <b>{name}</b>였어요. {desc}",

    /* 판정 복기 (심사 기록에서 업체를 눌렀을 때). {name}: 정답 사유, {picked}: 내가 고른 사유 */
    review: {
      okRight: "이 업체는 서류가 모두 공고 조건에 맞았어요. 통과시킨 판단이 맞아요!",
      okWrong: "'<b>{picked}</b>' 사유로 반려했지만, 이 업체 서류는 모두 조건에 맞았어요. 좋은 업체가 억울하게 기회를 잃지 않게 꼼꼼히 확인해요.",
      rejectRight: "'<b>{name}</b>' 문제를 잘 찾아냈어요!",
      rejectWrong: "통과시켰지만, 이 업체에는 '<b>{name}</b>' 문제가 있었어요. 조건에 안 맞는 업체가 낙찰되면 국민 세금이 낭비될 수 있어요.",
      partial: "부적격은 맞았어요! 다만 고른 사유는 '<b>{picked}</b>', 진짜 이유는 '<b>{name}</b>'였어요.",
      none: "판정하지 않은 업체예요.",
      /* 근거 설명: 없으면 아래 hints 문구를 쓴다 */
      explain: {
        COLLUSION: "<b>{other}</b> 견적서와 단가·비고 문구까지 똑같아요."
      }
    },

    /* 힌트 (GAME_SPEC 5.3). {…}는 엔진이 찾은 값으로 바뀐다. */
    hints: {
      OVER_BUDGET: "견적 총액이 예산 상한({budget})보다 많아 보여요.",
      LATE: "제출일이 입찰 마감({deadline})보다 늦어요.",
      CERT_MISSING: "공고에서 꼭 필요하다고 한 '{cert}' 인증서가 안 보여요.",
      CERT_EXPIRED: "'{cert}' 인증서 유효기간이 입찰 마감({deadline}) 전에 끝나요.",
      SPEC_MISMATCH: "사양서의 '{spec}' 항목이 공고에서 요구한 것과 달라요.",
      INFO_MISMATCH: "{doc}의 사업자번호가 신청서와 달라요.",
      COLLUSION: "다른 업체 견적서와 단가·비고 문구가 똑같아요. 견적서를 나란히 비교해 보세요.",
      BROKER: "사무실도 공장도 없고, 직원도 거의 없어요. 물건을 직접 만들 수 있을까요?",
      SAFETY: "업체 현황에 중대재해 이력이 있어요.",
      none: "제가 보기엔 이 업체 서류에서 수상한 곳이 없어요."
    }
  },

  /* 사업당 나르미 힌트 횟수 (GAME_SPEC 5.3) */
  hintsPerProject: 2,

  projects: [
    {
      id: "desk",
      folder: "교실 책상",         // 컴퓨터 바탕화면 폴더 이름
      picture: "desk",          // 납품 물건 그림 종류 (ui.js의 ITEM_PICTURES)
      title: "○○초등학교 교실 책상 구매",
      agency: "○○초등학교",
      item: "학생용 책상",
      qty: 200,
      budgetMax: 40000000,
      requiredCerts: ["KC"],
      deadline: "2026-03-10",
      requiredSpec: { size: "600×400mm", heightAdjustable: true },
      dilemma: "검증된 안정과 새로운 혁신 — 나라가 새 기술의 첫 구매자가 되어 줄 수도 있어요. 무엇을 더 소중히 여길까요?",

      bidders: [
        {
          id: "desk-a", name: "튼튼가구", verdict: "ok", tag: "stable",
          pitch: "30년 동안 학교 책상만 만들어 왔습니다. 고장 없이 오래 쓰는 책상을 약속드려요.",
          docs: {
            application: { company: "튼튼가구", ceo: "김든든", bizNo: "214-81-30571", address: "경기도 ○○시 산업로 12", submitDate: "2026-03-05" },
            quote: { company: "튼튼가구", bizNo: "214-81-30571", unitPrice: 185000, qty: 200, total: 37000000, note: "설치·수거 포함, 무상 A/S 3년" },
            certs: [{ type: "KC", number: "KC-26-1187", validUntil: "2027-05-31", issuer: "한국○○시험원", bizNo: "214-81-30571" }],
            spec: { size: "600×400mm", heightAdjustable: true, material: "강철 프레임 + 합판 상판" },
            status: { bizNo: "214-81-30571", hasOffice: true, hasFactory: true, employees: 120, deliveries: 48, seriousAccidents: 0 }
          }
        },
        {
          id: "desk-b", name: "새싹디자인랩", verdict: "ok", tag: "innovation",
          pitch: "아이 키에 맞춰 자동으로 높이가 바뀌는 책상을 개발했어요. 학교 납품은 처음이에요!",
          docs: {
            application: { company: "새싹디자인랩", ceo: "이새봄", bizNo: "305-86-11240", address: "대전광역시 ○○구 창업로 5", submitDate: "2026-03-08" },
            quote: { company: "새싹디자인랩", bizNo: "305-86-11240", unitPrice: 176000, qty: 200, total: 35200000, note: "혁신제품 지정, 초기 6개월 현장 점검 무료" },
            certs: [{ type: "KC", number: "KC-26-2410", validUntil: "2026-12-31", issuer: "한국○○시험원", bizNo: "305-86-11240" }],
            spec: { size: "600×400mm", heightAdjustable: true, material: "재생 플라스틱 + 알루미늄" },
            status: { bizNo: "305-86-11240", hasOffice: true, hasFactory: true, employees: 9, deliveries: 0, seriousAccidents: 0 }
          }
        },
        {
          id: "desk-c", name: "구름가구", verdict: "reject", reason: "OVER_BUDGET",
          pitch: "최고급 원목 책상입니다. 조금 비싸도 그만한 값을 해요.",
          docs: {
            application: { company: "구름가구", ceo: "박구름", bizNo: "118-81-55302", address: "서울특별시 ○○구 목공길 8", submitDate: "2026-03-06" },
            quote: { company: "구름가구", bizNo: "118-81-55302", unitPrice: 215000, qty: 200, total: 43000000, note: "원목 상판, 무상 A/S 2년" },
            certs: [{ type: "KC", number: "KC-26-0932", validUntil: "2027-02-28", issuer: "한국○○시험원", bizNo: "118-81-55302" }],
            spec: { size: "600×400mm", heightAdjustable: true, material: "원목 상판 + 강철 프레임" },
            status: { bizNo: "118-81-55302", hasOffice: true, hasFactory: true, employees: 34, deliveries: 15, seriousAccidents: 0 }
          }
        },
        {
          id: "desk-d", name: "반짝가구", verdict: "reject", reason: "CERT_EXPIRED",
          pitch: "가격도 품질도 딱 적당한 책상이에요. 서류는 다 챙겨 왔습니다!",
          docs: {
            application: { company: "반짝가구", ceo: "최반짝", bizNo: "402-81-77815", address: "전라북도 ○○시 공단로 21", submitDate: "2026-03-07" },
            quote: { company: "반짝가구", bizNo: "402-81-77815", unitPrice: 190000, qty: 200, total: 38000000, note: "납품 후 무상 A/S 2년 보장드립니다" },
            certs: [{ type: "KC", number: "KC-24-5521", validUntil: "2026-02-28", issuer: "한국○○시험원", bizNo: "402-81-77815" }],
            spec: { size: "600×400mm", heightAdjustable: true, material: "강철 프레임 + MDF 상판" },
            status: { bizNo: "402-81-77815", hasOffice: true, hasFactory: true, employees: 41, deliveries: 22, seriousAccidents: 0 }
          }
        },
        {
          id: "desk-e", name: "바른책상", verdict: "reject", reason: "COLLUSION", collusionWith: "desk-d",
          pitch: "합리적인 가격의 튼튼한 책상! 다른 곳과 비교해 보시면 알 거예요.",
          docs: {
            application: { company: "바른책상", ceo: "정바른", bizNo: "609-81-24468", address: "경상남도 ○○시 가구단지길 3", submitDate: "2026-03-07" },
            quote: { company: "바른책상", bizNo: "609-81-24468", unitPrice: 190000, qty: 200, total: 38000000, note: "납품 후 무상 A/S 2년 보장드립니다" },
            certs: [{ type: "KC", number: "KC-26-3307", validUntil: "2027-01-31", issuer: "한국○○시험원", bizNo: "609-81-24468" }],
            spec: { size: "600×400mm", heightAdjustable: true, material: "강철 프레임 + MDF 상판" },
            status: { bizNo: "609-81-24468", hasOffice: true, hasFactory: true, employees: 27, deliveries: 11, seriousAccidents: 0 }
          }
        }
      ],

      /* 1년 후 조달 뉴스 (GAME_SPEC 7.1). 낙찰 가능한 적격 업체마다 하나씩. */
      news: {
        "desk-a": { head: "○○초 책상, 1년간 고장 0건 — 안정적 납품", sub: "혁신 스타트업은 다른 판로 찾아" },
        "desk-b": { head: "책상 납품한 스타트업, 1년 만에 해외 수출 성공!", sub: "초기 납품 일부 지연, 신속 보완" }
      }
    },

    /* ── 사업 2: 딜레마 #1 가격 vs 품질 ─────────────────────────────── */
    {
      id: "chair",
      folder: "민원실 의자",         // 컴퓨터 바탕화면 폴더 이름
      picture: "chair",          // 납품 물건 그림 종류 (ui.js의 ITEM_PICTURES)
      title: "○○시청 민원실 의자 구매",
      agency: "○○시청",
      item: "민원실 대기 의자",
      qty: 100,
      budgetMax: 15000000,
      requiredCerts: ["KC"],
      deadline: "2026-04-15",
      requiredSpec: { seatHeight: "45cm", armrest: true },
      dilemma: "지금 아끼는 돈과 오래 쓰는 튼튼함 — 어느 쪽이 진짜 알뜰한 선택일까요?",

      bidders: [
        {
          id: "chair-a", name: "알뜰체어", verdict: "ok", tag: "thrift",
          pitch: "이번 입찰에서 가장 싼 가격이에요! 아낀 세금은 다른 곳에 쓰실 수 있어요.",
          docs: {
            application: { company: "알뜰체어", ceo: "한알뜰", bizNo: "131-81-40726", address: "인천광역시 ○○구 가구로 17", submitDate: "2026-04-10" },
            quote: { company: "알뜰체어", bizNo: "131-81-40726", unitPrice: 98000, qty: 100, total: 9800000, note: "최저가 보장, 무상 A/S 1년" },
            certs: [{ type: "KC", number: "KC-26-4471", validUntil: "2027-03-31", issuer: "한국○○시험원", bizNo: "131-81-40726" }],
            spec: { seatHeight: "45cm", armrest: true, material: "플라스틱 + 철제 다리" },
            status: { bizNo: "131-81-40726", hasOffice: true, hasFactory: true, employees: 22, deliveries: 31, seriousAccidents: 0 }
          }
        },
        {
          id: "chair-b", name: "오래가구", verdict: "ok", tag: "quality",
          pitch: "조금 비싸지만 10년은 거뜬해요. 자주 바꾸지 않아도 되니 길게 보면 이득이에요.",
          docs: {
            application: { company: "오래가구", ceo: "윤오래", bizNo: "224-86-07153", address: "충청북도 ○○시 장인길 9", submitDate: "2026-04-12" },
            quote: { company: "오래가구", bizNo: "224-86-07153", unitPrice: 139000, qty: 100, total: 13900000, note: "10년 사용 보증, 무상 A/S 5년" },
            certs: [{ type: "KC", number: "KC-26-1029", validUntil: "2027-08-31", issuer: "한국○○시험원", bizNo: "224-86-07153" }],
            spec: { seatHeight: "45cm", armrest: true, material: "알루미늄 + 고밀도 쿠션" },
            status: { bizNo: "224-86-07153", hasOffice: true, hasFactory: true, employees: 45, deliveries: 27, seriousAccidents: 0 }
          }
        },
        {
          id: "chair-c", name: "해맑은의자", verdict: "reject", reason: "INFO_MISMATCH",
          pitch: "서류는 급하게 챙겼지만 의자는 정말 편해요. 한번 앉아 보세요!",
          docs: {
            application: { company: "해맑은의자", ceo: "서해맑", bizNo: "507-81-33019", address: "경상북도 ○○시 산단로 44", submitDate: "2026-04-13" },
            quote: { company: "해맑은의자", bizNo: "507-81-33091", unitPrice: 120000, qty: 100, total: 12000000, note: "등받이 각도 조절, 무상 A/S 2년" },
            certs: [{ type: "KC", number: "KC-26-3856", validUntil: "2027-01-31", issuer: "한국○○시험원", bizNo: "507-81-33019" }],
            spec: { seatHeight: "45cm", armrest: true, material: "철제 프레임 + 패브릭" },
            status: { bizNo: "507-81-33019", hasOffice: true, hasFactory: true, employees: 18, deliveries: 9, seriousAccidents: 0 }
          }
        },
        {
          id: "chair-d", name: "편한자리", verdict: "reject", reason: "SPEC_MISMATCH",
          pitch: "팔걸이 없는 깔끔한 디자인이 요즘 대세예요. 공간도 덜 차지하고요.",
          docs: {
            application: { company: "편한자리", ceo: "조편안", bizNo: "613-81-58240", address: "광주광역시 ○○구 첨단로 31", submitDate: "2026-04-11" },
            quote: { company: "편한자리", bizNo: "613-81-58240", unitPrice: 105000, qty: 100, total: 10500000, note: "공간 절약형 디자인, 무상 A/S 2년" },
            certs: [{ type: "KC", number: "KC-26-2297", validUntil: "2027-06-30", issuer: "한국○○시험원", bizNo: "613-81-58240" }],
            spec: { seatHeight: "45cm", armrest: false, material: "플라스틱 일체형" },
            status: { bizNo: "613-81-58240", hasOffice: true, hasFactory: true, employees: 26, deliveries: 14, seriousAccidents: 0 }
          }
        },
        {
          id: "chair-e", name: "의자나라", verdict: "reject", reason: "LATE",
          pitch: "늦어서 죄송해요, 길이 너무 막혔어요! 그래도 제품은 자신 있어요.",
          docs: {
            application: { company: "의자나라", ceo: "마나라", bizNo: "305-81-62917", address: "대전광역시 ○○구 엑스포로 52", submitDate: "2026-04-17" },
            quote: { company: "의자나라", bizNo: "305-81-62917", unitPrice: 125000, qty: 100, total: 12500000, note: "인체공학 설계, 무상 A/S 3년" },
            certs: [{ type: "KC", number: "KC-26-0618", validUntil: "2027-04-30", issuer: "한국○○시험원", bizNo: "305-81-62917" }],
            spec: { seatHeight: "45cm", armrest: true, material: "강철 프레임 + 메시" },
            status: { bizNo: "305-81-62917", hasOffice: true, hasFactory: true, employees: 33, deliveries: 20, seriousAccidents: 0 }
          }
        }
      ],

      news: {
        "chair-a": { head: "민원실 의자 예산 410만 원 절약, 남은 돈으로 정수기 설치", sub: "2년 차부터 삐걱거림 민원 늘어" },
        "chair-b": { head: "민원실 의자 1년간 고장 0건 — 시민 만족도 상승", sub: "구매 비용은 최저가보다 410만 원 더 들어" }
      }
    },

    /* ── 사업 3: 딜레마 #4 일반 제품 vs 친환경 제품 ──────────────────── */
    {
      id: "led",
      folder: "도서관 LED 조명",         // 컴퓨터 바탕화면 폴더 이름
      picture: "led",          // 납품 물건 그림 종류 (ui.js의 ITEM_PICTURES)
      title: "○○도서관 LED 조명 교체",
      agency: "○○시립도서관",
      item: "LED 평판 조명",
      qty: 300,
      budgetMax: 30000000,
      requiredCerts: ["KC", "고효율"],
      deadline: "2026-05-20",
      requiredSpec: { power: "40W", colorTemp: "5000K" },
      dilemma: "오늘의 가격과 지구의 내일 — 환경을 위해 돈을 조금 더 쓸까요?",

      bidders: [
        {
          id: "led-a", name: "반딧불조명", verdict: "ok", tag: "thrift",
          pitch: "기본에 충실한 조명을 가장 좋은 가격에 드려요. 밝기는 똑같아요!",
          docs: {
            application: { company: "반딧불조명", ceo: "남반디", bizNo: "411-81-20583", address: "경기도 ○○시 광명로 6", submitDate: "2026-05-14" },
            quote: { company: "반딧불조명", bizNo: "411-81-20583", unitPrice: 62000, qty: 300, total: 18600000, note: "일반형 LED, 무상 교체 2년" },
            certs: [
              { type: "KC", number: "KC-26-5530", validUntil: "2027-05-31", issuer: "한국○○시험원", bizNo: "411-81-20583" },
              { type: "고효율", number: "HE-26-0712", validUntil: "2027-05-31", issuer: "한국○○에너지공단", bizNo: "411-81-20583" }
            ],
            spec: { power: "40W", colorTemp: "5000K", material: "알루미늄 프레임" },
            status: { bizNo: "411-81-20583", hasOffice: true, hasFactory: true, employees: 38, deliveries: 52, seriousAccidents: 0 }
          }
        },
        {
          id: "led-b", name: "초록빛라이팅", verdict: "ok", tag: "green",
          pitch: "수명이 두 배 길고 다 쓴 조명은 저희가 회수해서 재활용해요.",
          docs: {
            application: { company: "초록빛라이팅", ceo: "류초록", bizNo: "621-86-31478", address: "부산광역시 ○○구 녹산로 19", submitDate: "2026-05-18" },
            quote: { company: "초록빛라이팅", bizNo: "621-86-31478", unitPrice: 89000, qty: 300, total: 26700000, note: "환경표지 인증 제품, 수명 5만 시간, 폐조명 회수·재활용" },
            certs: [
              { type: "KC", number: "KC-26-6204", validUntil: "2027-09-30", issuer: "한국○○시험원", bizNo: "621-86-31478" },
              { type: "고효율", number: "HE-26-1189", validUntil: "2027-09-30", issuer: "한국○○에너지공단", bizNo: "621-86-31478" },
              { type: "환경표지", number: "EL-26-0347", validUntil: "2027-12-31", issuer: "한국○○환경산업기술원", bizNo: "621-86-31478" }
            ],
            spec: { power: "40W", colorTemp: "5000K", material: "재생 알루미늄 프레임" },
            status: { bizNo: "621-86-31478", hasOffice: true, hasFactory: true, employees: 24, deliveries: 17, seriousAccidents: 0 }
          }
        },
        {
          id: "led-c", name: "빛나리상사", verdict: "reject", reason: "BROKER",
          pitch: "공장은 따로 없지만 걱정 마세요. 아는 곳에서 물건을 받아다 드릴게요.",
          docs: {
            application: { company: "빛나리상사", ceo: "변빛나", bizNo: "120-81-99541", address: "서울특별시 ○○구 ○○빌딩 우편함 302호", submitDate: "2026-05-15" },
            quote: { company: "빛나리상사", bizNo: "120-81-99541", unitPrice: 70000, qty: 300, total: 21000000, note: "신속 조달 가능" },
            certs: [
              { type: "KC", number: "KC-26-7015", validUntil: "2027-02-28", issuer: "한국○○시험원", bizNo: "120-81-99541" },
              { type: "고효율", number: "HE-26-0954", validUntil: "2027-02-28", issuer: "한국○○에너지공단", bizNo: "120-81-99541" }
            ],
            spec: { power: "40W", colorTemp: "5000K", material: "알루미늄 프레임" },
            status: { bizNo: "120-81-99541", hasOffice: false, hasFactory: false, employees: 1, deliveries: 0, seriousAccidents: 0 }
          }
        },
        {
          id: "led-d", name: "밝은세상", verdict: "reject", reason: "CERT_MISSING",
          pitch: "KC 인증 받은 튼튼한 조명이에요. 전기도 아껴 드릴게요!",
          docs: {
            application: { company: "밝은세상", ceo: "고밝음", bizNo: "312-81-45026", address: "충청남도 ○○시 산업단지로 27", submitDate: "2026-05-16" },
            quote: { company: "밝은세상", bizNo: "312-81-45026", unitPrice: 75000, qty: 300, total: 22500000, note: "설치비 포함, 무상 교체 3년" },
            certs: [{ type: "KC", number: "KC-26-3381", validUntil: "2027-07-31", issuer: "한국○○시험원", bizNo: "312-81-45026" }],
            spec: { power: "40W", colorTemp: "5000K", material: "알루미늄 프레임" },
            status: { bizNo: "312-81-45026", hasOffice: true, hasFactory: true, employees: 29, deliveries: 23, seriousAccidents: 0 }
          }
        },
        {
          id: "led-e", name: "한결조명", verdict: "reject", reason: "OVER_BUDGET",
          pitch: "최고급 부품만 썼어요. 도서관에 딱 어울리는 고급 조명입니다.",
          docs: {
            application: { company: "한결조명", ceo: "엄한결", bizNo: "514-81-70392", address: "대구광역시 ○○구 조명로 8", submitDate: "2026-05-17" },
            quote: { company: "한결조명", bizNo: "514-81-70392", unitPrice: 105000, qty: 300, total: 31500000, note: "프리미엄 부품, 무상 교체 5년" },
            certs: [
              { type: "KC", number: "KC-26-8842", validUntil: "2027-10-31", issuer: "한국○○시험원", bizNo: "514-81-70392" },
              { type: "고효율", number: "HE-26-1530", validUntil: "2027-10-31", issuer: "한국○○에너지공단", bizNo: "514-81-70392" }
            ],
            spec: { power: "40W", colorTemp: "5000K", material: "다이캐스팅 알루미늄" },
            status: { bizNo: "514-81-70392", hasOffice: true, hasFactory: true, employees: 51, deliveries: 38, seriousAccidents: 0 }
          }
        }
      ],

      news: {
        "led-a": { head: "도서관 조명 교체비 810만 원 절약", sub: "전기요금 절감 효과는 기대보다 작아" },
        "led-b": { head: "도서관 전기요금 1년 새 35% 줄어 — 탄소 배출도 감소", sub: "구매 비용은 일반 제품보다 810만 원 더 들어" }
      }
    },

    /* ── 사업 4: 딜레마 #5 빠른 납기 vs 사회적 가치 ───────────────────── */
    {
      id: "mask",
      folder: "보건소 방역 마스크",         // 컴퓨터 바탕화면 폴더 이름
      picture: "mask",          // 납품 물건 그림 종류 (ui.js의 ITEM_PICTURES)
      title: "○○보건소 방역 마스크 구매",
      agency: "○○보건소",
      item: "보건용 마스크",
      qty: 50000,
      budgetMax: 25000000,
      requiredCerts: ["식약처 허가"],
      deadline: "2026-06-10",
      requiredSpec: { grade: "KF94", packaging: "개별 포장" },
      dilemma: "빠른 납품과 함께 사는 사회 — 속도와 사회적 가치 중 무엇을 고를까요?",

      bidders: [
        {
          id: "mask-a", name: "빠른방역", verdict: "ok", tag: "stable",
          pitch: "주문하시면 사흘 안에 5만 장 전부 보내 드려요. 급할 땐 저희가 제일 빨라요.",
          docs: {
            application: { company: "빠른방역", ceo: "신속해", bizNo: "135-81-28864", address: "경기도 ○○시 물류로 101", submitDate: "2026-06-05" },
            quote: { company: "빠른방역", bizNo: "135-81-28864", unitPrice: 420, qty: 50000, total: 21000000, note: "주문 후 3일 내 전량 납품" },
            certs: [{ type: "식약처 허가", number: "MFDS-26-0381", validUntil: "2027-06-30", issuer: "식품의약품안전처", bizNo: "135-81-28864" }],
            spec: { grade: "KF94", packaging: "개별 포장", material: "4중 필터" },
            status: { bizNo: "135-81-28864", hasOffice: true, hasFactory: true, employees: 80, deliveries: 64, seriousAccidents: 0 }
          }
        },
        {
          id: "mask-b", name: "함께일터", verdict: "ok", tag: "coexist",
          pitch: "직원 절반이 장애인인 일터예요. 조금 천천히지만 정성껏 만들어요.",
          docs: {
            application: { company: "함께일터", ceo: "나함께", bizNo: "402-82-15570", address: "전라북도 ○○시 나눔로 12", submitDate: "2026-06-08" },
            quote: { company: "함께일터", bizNo: "402-82-15570", unitPrice: 470, qty: 50000, total: 23500000, note: "장애인 표준사업장, 2주에 걸쳐 분할 납품" },
            certs: [{ type: "식약처 허가", number: "MFDS-26-1127", validUntil: "2027-03-31", issuer: "식품의약품안전처", bizNo: "402-82-15570" }],
            spec: { grade: "KF94", packaging: "개별 포장", material: "4중 필터" },
            status: { bizNo: "402-82-15570", hasOffice: true, hasFactory: true, employees: 35, deliveries: 12, seriousAccidents: 0 }
          }
        },
        {
          id: "mask-c", name: "맑은숨", verdict: "reject", reason: "CERT_EXPIRED",
          pitch: "작년에도 보건소에 납품했었어요. 품질은 그때랑 똑같아요!",
          docs: {
            application: { company: "맑은숨", ceo: "공맑음", bizNo: "214-81-66310", address: "경기도 ○○시 의료단지길 4", submitDate: "2026-06-04" },
            quote: { company: "맑은숨", bizNo: "214-81-66310", unitPrice: 450, qty: 50000, total: 22500000, note: "작년 동일 제품, 1주 내 납품" },
            certs: [{ type: "식약처 허가", number: "MFDS-24-0915", validUntil: "2026-05-31", issuer: "식품의약품안전처", bizNo: "214-81-66310" }],
            spec: { grade: "KF94", packaging: "개별 포장", material: "4중 필터" },
            status: { bizNo: "214-81-66310", hasOffice: true, hasFactory: true, employees: 42, deliveries: 30, seriousAccidents: 0 }
          }
        },
        {
          id: "mask-d", name: "숨결마스크", verdict: "reject", reason: "SPEC_MISMATCH",
          pitch: "숨쉬기 편한 마스크예요. 하루 종일 써도 답답하지 않아요.",
          docs: {
            application: { company: "숨결마스크", ceo: "하숨결", bizNo: "609-81-37752", address: "경상남도 ○○시 섬유로 15", submitDate: "2026-06-06" },
            quote: { company: "숨결마스크", bizNo: "609-81-37752", unitPrice: 400, qty: 50000, total: 20000000, note: "숨쉬기 편한 2중 필터, 10일 내 납품" },
            certs: [{ type: "식약처 허가", number: "MFDS-26-0774", validUntil: "2027-05-31", issuer: "식품의약품안전처", bizNo: "609-81-37752" }],
            spec: { grade: "KF80", packaging: "개별 포장", material: "2중 필터" },
            status: { bizNo: "609-81-37752", hasOffice: true, hasFactory: true, employees: 27, deliveries: 19, seriousAccidents: 0 }
          }
        },
        {
          id: "mask-e", name: "튼튼방역", verdict: "reject", reason: "INFO_MISMATCH",
          pitch: "공장을 넓혀서 생산량이 두 배가 됐어요. 서류도 새로 다 준비했어요!",
          docs: {
            application: { company: "튼튼방역", ceo: "강튼튼", bizNo: "312-81-80462", address: "충청남도 ○○시 바이오로 23", submitDate: "2026-06-07" },
            quote: { company: "튼튼방역", bizNo: "312-81-80462", unitPrice: 480, qty: 50000, total: 24000000, note: "생산 설비 증설, 1주 내 납품" },
            certs: [{ type: "식약처 허가", number: "MFDS-26-1342", validUntil: "2027-08-31", issuer: "식품의약품안전처", bizNo: "312-81-80426" }],
            spec: { grade: "KF94", packaging: "개별 포장", material: "4중 필터" },
            status: { bizNo: "312-81-80462", hasOffice: true, hasFactory: true, employees: 56, deliveries: 25, seriousAccidents: 0 }
          }
        }
      ],

      news: {
        "mask-a": { head: "감염병 유행 초기, 마스크 사흘 만에 전 시민 배부", sub: "지역 장애인 일터는 납품 기회 놓쳐" },
        "mask-b": { head: "마스크 납품한 장애인 일터, 직원 10명 새로 채용", sub: "분할 납품으로 초기 배부 일주일 늦어" }
      }
    },

    /* ── 사업 5: 딜레마 #7 싼 시공 vs 안전 ─────────────────────────────── */
    {
      id: "gym",
      folder: "체육관 지붕 공사",         // 컴퓨터 바탕화면 폴더 이름
      picture: "gym",          // 납품 물건 그림 종류 (ui.js의 ITEM_PICTURES)
      title: "○○중학교 체육관 지붕 보수 공사",
      agency: "○○중학교",
      item: "체육관 지붕 보수 공사",
      qty: 1,
      unit: "식",
      budgetMax: 300000000,
      requiredCerts: ["건설업 면허"],
      deadline: "2026-07-15",
      requiredSpec: { roofPanel: "단열 샌드위치 패널", period: "45일 이내" },
      dilemma: "아끼는 비용과 지키는 안전 — 아이들이 쓸 체육관, 무엇을 먼저 볼까요?",

      bidders: [
        {
          id: "gym-a", name: "알찬건설", verdict: "ok", tag: "thrift",
          pitch: "방학 안에 끝내고 공사비도 확 줄여 드릴게요. 숙련된 팀이 빠르게 작업해요.",
          docs: {
            application: { company: "알찬건설", ceo: "임알찬", bizNo: "128-81-51907", address: "경기도 ○○시 건설로 33", submitDate: "2026-07-09" },
            quote: { company: "알찬건설", bizNo: "128-81-51907", unitPrice: 238000000, qty: 1, total: 238000000, note: "공사 기간 단축(35일), 하자 보수 2년" },
            certs: [{ type: "건설업 면허", number: "CL-○○-0457", validUntil: "2028-12-31", issuer: "○○도청", bizNo: "128-81-51907" }],
            spec: { roofPanel: "단열 샌드위치 패널", period: "45일 이내", material: "아연도 강판 + 우레탄 단열재" },
            status: { bizNo: "128-81-51907", hasOffice: true, hasFactory: false, employees: 60, deliveries: 40, seriousAccidents: 0 }
          }
        },
        {
          id: "gym-b", name: "든든건설", verdict: "ok", tag: "safety",
          pitch: "현장에 안전관리자가 늘 있어요. 10년째 사고 없이 공사하고 있습니다.",
          docs: {
            application: { company: "든든건설", ceo: "백든든", bizNo: "305-81-74218", address: "대전광역시 ○○구 안전로 7", submitDate: "2026-07-12" },
            quote: { company: "든든건설", bizNo: "305-81-74218", unitPrice: 279000000, qty: 1, total: 279000000, note: "안전관리자 상주, 최근 10년 무사고, 하자 보수 5년" },
            certs: [{ type: "건설업 면허", number: "CL-○○-1182", validUntil: "2029-06-30", issuer: "○○시청", bizNo: "305-81-74218" }],
            spec: { roofPanel: "단열 샌드위치 패널", period: "45일 이내", material: "아연도 강판 + 불연 단열재" },
            status: { bizNo: "305-81-74218", hasOffice: true, hasFactory: false, employees: 74, deliveries: 36, seriousAccidents: 0 }
          }
        },
        {
          id: "gym-c", name: "번개건설", verdict: "reject", reason: "SAFETY",
          pitch: "가격은 저희가 제일 싸요! 공사도 번개처럼 끝내 드립니다.",
          docs: {
            application: { company: "번개건설", ceo: "도번개", bizNo: "617-81-23395", address: "부산광역시 ○○구 공사로 58", submitDate: "2026-07-10" },
            quote: { company: "번개건설", bizNo: "617-81-23395", unitPrice: 225000000, qty: 1, total: 225000000, note: "최저가, 공사 기간 30일" },
            certs: [{ type: "건설업 면허", number: "CL-○○-0896", validUntil: "2028-03-31", issuer: "○○시청", bizNo: "617-81-23395" }],
            spec: { roofPanel: "단열 샌드위치 패널", period: "45일 이내", material: "아연도 강판 + 스티로폼 단열재" },
            status: { bizNo: "617-81-23395", hasOffice: true, hasFactory: false, employees: 48, deliveries: 29, seriousAccidents: 1 }
          }
        },
        {
          id: "gym-d", name: "튼실종합건설", verdict: "reject", reason: "BROKER",
          pitch: "저희가 직접 하진 않지만 실력 있는 업체에 맡길 테니 안심하세요.",
          docs: {
            application: { company: "튼실종합건설", ceo: "오튼실", bizNo: "107-81-60231", address: "서울특별시 ○○구 공유오피스 5층 좌석 B-12", submitDate: "2026-07-11" },
            quote: { company: "튼실종합건설", bizNo: "107-81-60231", unitPrice: 250000000, qty: 1, total: 250000000, note: "협력 업체를 통한 시공" },
            certs: [{ type: "건설업 면허", number: "CL-○○-1504", validUntil: "2028-09-30", issuer: "○○구청", bizNo: "107-81-60231" }],
            spec: { roofPanel: "단열 샌드위치 패널", period: "45일 이내", material: "협력 업체 자재 사용" },
            status: { bizNo: "107-81-60231", hasOffice: false, hasFactory: false, employees: 1, deliveries: 0, seriousAccidents: 0 }
          }
        },
        {
          id: "gym-e", name: "우뚝건설", verdict: "reject", reason: "OVER_BUDGET",
          pitch: "지붕에 태양광까지 얹어 드릴게요. 학교의 자랑이 될 거예요!",
          docs: {
            application: { company: "우뚝건설", ceo: "주우뚝", bizNo: "214-81-88456", address: "경기도 ○○시 하늘로 90", submitDate: "2026-07-08" },
            quote: { company: "우뚝건설", bizNo: "214-81-88456", unitPrice: 312000000, qty: 1, total: 312000000, note: "태양광 패널 추가 설치, 하자 보수 3년" },
            certs: [{ type: "건설업 면허", number: "CL-○○-0733", validUntil: "2029-01-31", issuer: "○○도청", bizNo: "214-81-88456" }],
            spec: { roofPanel: "단열 샌드위치 패널", period: "45일 이내", material: "아연도 강판 + 태양광 패널" },
            status: { bizNo: "214-81-88456", hasOffice: true, hasFactory: false, employees: 66, deliveries: 33, seriousAccidents: 0 }
          }
        }
      ],

      news: {
        "gym-a": { head: "체육관 지붕 공사비 4,100만 원 절약, 방학 중 조기 완공", sub: "공사 중 작은 안전사고 1건 — 다행히 가벼운 부상" },
        "gym-b": { head: "체육관 지붕 무사고 완공 — 새 학기 첫 체육 수업", sub: "공사비는 최저가 업체보다 4,100만 원 더 들어" }
      }
    }
  ],

  /* 성향 태그 이름 (화면 표시용, GAME_SPEC 6장) */
  tagLabels: {
    stable: "안정",
    innovation: "혁신",
    thrift: "알뜰",
    quality: "품질",
    green: "친환경",
    coexist: "상생",
    safety: "안전"
  },

  /*
   * 칭호 (GAME_SPEC 7.2, 2026-11-07 확정).
   * 같은 칭호를 가진 태그(stable·quality)는 점수를 합쳐서 센다.
   * 가장 높은 칭호가 둘 이상이면 balanced, 감사 지적 0회면 앞에 perfectPrefix.
   */
  titles: {
    innovation: "혁신 개척자",
    thrift: "알뜰 살림꾼",
    quality: "믿음직한 조달관",
    stable: "믿음직한 조달관",
    coexist: "상생 조달관",
    green: "초록 조달관",
    safety: "안전 지킴이",
    balanced: "균형 잡힌 조달관"
  },

  /* 엔딩 (GAME_SPEC 7장). {title}은 사업명, {n}은 감사 지적 수. */
  ending: {
    perfectPrefix: "완벽한",
    paperName: "나르미 신문",
    paperDate: "2027년 3월 10일",
    paperSlogan: "1년 후, 그때 그 선택은 어떻게 됐을까요?",
    failed: { head: "{title}, 맞는 업체가 없어 유찰 — 재공고 예정", sub: "필요한 물품은 몇 달 늦게 도착할 예정" },
    badAward: { head: "{title}, 조건에 맞지 않는 업체가 낙찰 — 감사에서 지적", sub: "계약 해지 후 다시 입찰 진행 중" },
    correction: "[정정] {title} 심사에서 판정 실수 {n}건이 감사에서 지적됐습니다. 담당 조달관은 서류 심사 교육을 다시 받았습니다.",
    finalMessage: "조달은 정답 찾기가 아니라, 무엇을 더 소중히 여길지 고르는 일이에요.",
    titleBlurb: {
      innovation: "새로운 기술에 첫 기회를 주는 용기 있는 조달관이에요.",
      thrift: "국민 세금을 한 푼이라도 아끼는 살림꾼 조달관이에요.",
      stable: "검증된 품질로 믿고 쓰게 하는 조달관이에요.",
      coexist: "함께 사는 사회를 생각하는 따뜻한 조달관이에요.",
      green: "지구와 다음 세대를 먼저 생각하는 조달관이에요.",
      safety: "일하는 사람과 쓰는 사람의 안전을 지키는 조달관이에요.",
      balanced: "여러 가치를 고르게 저울질하는 조달관이에요."
    }
  }
};
