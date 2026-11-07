/*
 * 시나리오 데이터 (GAME_SPEC 9.2)
 * 사업·업체·서류·뉴스·칭호 문구는 전부 여기에 둔다. 엔진 코드에 하드코딩하지 않는다.
 * 모든 업체명·인물·번호는 가상이다 (GAME_SPEC 10장).
 *
 * 업체 서류(docs) 구조 — GAME_SPEC 5.1
 *   application: 입찰참가 신청서 { company, ceo, bizNo, address, submitDate }
 *   quote:       견적서         { company, bizNo, unitPrice, qty, total, note }
 *   certs:       인증서 목록     [{ type, number, validUntil, issuer, bizNo }]
 *   spec:        제품 사양서     { requiredSpec의 키와 같은 항목 + material }
 *   status:      업체 현황       { bizNo, hasOffice, hasFactory, employees, deliveries, seriousAccidents }
 *
 * 부적격 업체는 서류 안에 reason에 해당하는 근거가 반드시 있어야 한다.
 * Game.engine.validateData()가 이를 자동으로 검사한다.
 */
window.Game = window.Game || {};

Game.DATA = {
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

  /* 첫 사업부터 쓸 수 있는 사유. 이후 사업마다 introducesReason이 하나씩 추가된다 (GAME_SPEC 5.2). */
  startingReasons: ["OVER_BUDGET", "LATE", "CERT_MISSING", "CERT_EXPIRED", "SPEC_MISMATCH"],

  /* 사양서 항목 이름 (화면 표시용) */
  specLabels: {
    size: "상판 크기",
    heightAdjustable: "높이 조절",
    material: "재질"
  },

  /* 나르미 안내 문구. {name}·{desc}는 화면에서 사유 이름·설명으로 바뀐다. */
  narmi: {
    newReason: "새로운 확인 사항이 생겼어요! <b>{name}</b> — {desc}",
    deskTip: "오른쪽 공고 조건표와 서류를 하나씩 비교해 보세요. 이상한 점이 없으면 적격, 있으면 부적격 도장을 찍어요.",
    compareTip: "견적서 탭에서 앞서 본 업체의 견적서를 불러와 나란히 비교할 수 있어요.",
    awardTip: "두 곳 모두 조건을 갖췄어요. 정답은 없어요 — 무엇을 더 소중히 여길지 골라 주세요.",
    noCandidate: "통과한 업체가 없어서 이번 사업은 유찰됐어요. 다시 공고를 내야 해요."
  },

  projects: [
    {
      id: "desk",
      title: "○○초등학교 교실 책상 구매",
      agency: "○○초등학교",
      item: "학생용 책상",
      qty: 200,
      budgetMax: 40000000,
      requiredCerts: ["KC"],
      deadline: "2026-03-10",
      requiredSpec: { size: "600×400mm", heightAdjustable: true },
      introducesReason: "COLLUSION",
      dilemma: "실적 많은 대기업과 실적 없는 혁신 스타트업 — 정부가 첫 구매자가 되어 줄까요?",

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
    }
  ],

  /* 칭호 (GAME_SPEC 7.2 — 🔲 미정, 제안안). 엔딩 이슈에서 확정한다. */
  titles: {
    innovation: "혁신 개척자",
    thrift: "알뜰 살림꾼",
    quality: "믿음직한 조달관",
    stable: "믿음직한 조달관",
    coexist: "상생 조달관",
    green: "초록 조달관",
    safety: "안전 지킴이",
    balanced: "균형 잡힌 조달관"
  }
};
