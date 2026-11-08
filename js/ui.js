/*
 * 화면 렌더링, 화면 전환, 무대 스케일.
 * 게임 상태는 바꾸지 않는다 — 판정·낙찰은 main.js가 Game.engine을 통해 처리하고, 여기서는 그리기만 한다.
 */
window.Game = window.Game || {};

(function () {
  /* 서류 종류. badge는 서류 머리의 작은 표식 — 색·무늬(css의 .paper.is-<key>)와 함께 서류끼리 한눈에 구분되게. */
  var DOC_TABS = [
    { key: "application", label: "입찰참가 신청서", badge: "신청" },
    { key: "quote", label: "견적서", badge: "₩" },
    { key: "certs", label: "인증서", badge: "인증" },
    { key: "spec", label: "제품 사양서", badge: "규격" },
    { key: "status", label: "업체 현황", badge: "현황" }
  ];

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function won(n) { return n.toLocaleString("ko-KR") + "원"; }

  /** 수량 단위 (기본 "개", 공사처럼 개수가 아닌 품목은 데이터의 unit). */
  function unitOf(project) { return project.unit || "개"; }

  /** "사업 2/5" 같은 진행 표시 (몇 번째로 하는 사업인지 — 사업은 아무 순서로나 고른다). */
  function projectNo() {
    return Game.engine.projectNumber() + "/" + Game.engine.data.projects.length;
  }

  /** 폴더 아이콘 (CSS 그림). done이면 완료 표시. */
  function folderIconHtml(done) {
    return '<span class="pc-folder' + (done ? " is-done" : "") + '"><i></i>' + (done ? '<b aria-hidden="true">✔</b>' : "") + "</span>";
  }

  function yesNo(v) { return v ? "있음" : "없음"; }

  function specValue(v) {
    if (v === true) return "있음";
    if (v === false) return "없음";
    return v;
  }

  /**
   * 표 HTML. rows: [이름, 값, 항목 키(선택)].
   * hl(형광펜 칠할 항목 키 목록)에 들어 있는 행은 형광펜으로 표시한다 (나르미 힌트).
   */
  function rowsHtml(rows, hl) {
    hl = hl || [];
    return '<table class="doc-table">' + rows.map(function (r) {
      var on = r[2] && hl.indexOf(r[2]) !== -1;
      return "<tr" + (on ? ' class="is-hl"' : "") + "><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>";
    }).join("") + "</table>";
  }

  /*
   * 업체 대표 캐릭터 (GAME_SPEC 3장 — CSS로 그린 단순 캐릭터, 업체마다 색만 다르게).
   * 이미지 없이 도형만 쓰고, 정장·넥타이 색은 사업 안에서 업체 순서로 정한다 (5곳 모두 다른 색).
   */
  var NPC_COLORS = [
    { suit: "#6f9fe6", tie: "#f2a33a" },   // 파랑 + 귤색
    { suit: "#6cc4a1", tie: "#e8607a" },   // 민트 + 분홍
    { suit: "#ef8f74", tie: "#4f6fc4" },   // 코랄 + 남색
    { suit: "#a68be0", tie: "#f3c94d" },   // 보라 + 노랑
    { suit: "#e9b44c", tie: "#3f8f7a" }    // 겨자 + 초록
  ];

  function npcHtml(project, bidder, extraClass) {
    var idx = project.bidders.indexOf(bidder);
    var c = NPC_COLORS[(idx < 0 ? 0 : idx) % NPC_COLORS.length];
    return '<div class="npc ' + (extraClass || "") + '" style="--suit:' + c.suit + ";--tie:" + c.tie + '" role="img" aria-label="' + esc(bidder.name) + ' 대표">' +
      '<div class="npc-body"><div class="npc-collar"></div><div class="npc-tie"></div></div>' +
      '<div class="npc-head"><div class="npc-hair"></div>' +
        '<div class="npc-eye is-l"></div><div class="npc-eye is-r"></div>' +
        '<div class="npc-cheek is-l"></div><div class="npc-cheek is-r"></div>' +
        '<div class="npc-mouth"></div></div>' +
      "</div>";
  }

  /*
   * 납품 물건 그림 (GAME_SPEC 5.1 "제품 사양서 — 사진", 10장 "CSS/SVG로 직접 그리기").
   * 사업의 picture 값으로 고르고, 사양서 값(spec)대로 그린다 → 사진과 사양서 글자가 항상 일치.
   * 모두 viewBox 0 0 200 140, 파스텔 톤.
   */
  function has(text, word) { return String(text || "").indexOf(word) !== -1; }

  var ITEM_PICTURES = {
    /** 학생용 책상: 상판 색은 재질, 높이 조절이면 다리에 조절 손잡이 */
    desk: function (s) {
      var top = has(s.material, "원목") ? "#d9a46c" : has(s.material, "플라스틱") ? "#9fd8c4" : "#e8c79a";
      var adj = s.heightAdjustable === true;
      var leg = function (x) {
        return '<rect x="' + x + '" y="58" width="10" height="38" rx="2" fill="#8d99ab"/>' +
          '<rect x="' + (x + 2) + '" y="94" width="6" height="26" rx="2" fill="#b4bdca"/>' +
          (adj ? '<circle cx="' + (x + 5) + '" cy="96" r="5" fill="#f2a33a" stroke="#fff" stroke-width="2"/>' : "") +
          '<rect x="' + (x - 12) + '" y="119" width="34" height="7" rx="3.5" fill="#6f7b8d"/>';
      };
      return '<rect x="34" y="52" width="132" height="22" rx="4" fill="#cfd6e0"/>' +   // 책 넣는 칸
        '<rect x="42" y="58" width="116" height="10" rx="2" fill="#b9c2cf"/>' +
        leg(40) + leg(150) +
        '<rect x="18" y="38" width="164" height="16" rx="5" fill="' + top + '"/>' +
        '<rect x="18" y="38" width="164" height="5" rx="2.5" fill="#fff" opacity="0.35"/>' +
        '<rect x="128" y="26" width="34" height="12" rx="2" fill="#f2a6a0"/><rect x="132" y="20" width="26" height="7" rx="2" fill="#8fb8ef"/>';   // 책
    },

    /** 대기 의자: 팔걸이 있음/없음, 쿠션 색은 재질 */
    chair: function (s) {
      var seat = has(s.material, "패브릭") ? "#7fa6e6" : has(s.material, "메시") ? "#6b7280" :
        has(s.material, "쿠션") ? "#f0a46e" : "#8fd3bb";
      var arms = s.armrest === true
        ? '<rect x="40" y="70" width="8" height="26" rx="3" fill="#8d99ab"/><rect x="30" y="64" width="30" height="9" rx="4.5" fill="#6f7b8d"/>' +
          '<rect x="152" y="70" width="8" height="26" rx="3" fill="#8d99ab"/><rect x="140" y="64" width="30" height="9" rx="4.5" fill="#6f7b8d"/>'
        : "";
      return '<rect x="64" y="96" width="8" height="36" rx="3" fill="#8d99ab"/><rect x="128" y="96" width="8" height="36" rx="3" fill="#8d99ab"/>' +
        '<rect x="56" y="126" width="24" height="6" rx="3" fill="#6f7b8d"/><rect x="120" y="126" width="24" height="6" rx="3" fill="#6f7b8d"/>' +
        '<rect x="62" y="12" width="76" height="66" rx="16" fill="' + seat + '"/>' +
        '<rect x="70" y="20" width="60" height="8" rx="4" fill="#fff" opacity="0.3"/>' +
        '<rect x="50" y="78" width="100" height="20" rx="9" fill="' + seat + '"/>' +
        '<rect x="50" y="92" width="100" height="6" rx="3" fill="#000" opacity="0.08"/>' + arms;
    },

    /** 천장 LED 평판 조명: 빛 색은 색온도 (5000K 이상 하얀빛, 낮으면 노란빛) */
    led: function (s) {
      var k = parseInt(s.colorTemp, 10) || 5000;
      var glow = k >= 4500 ? "#e8f3ff" : "#fff0c2";
      var core = k >= 4500 ? "#ffffff" : "#fff8e0";
      return '<rect x="0" y="0" width="200" height="14" fill="#efe6d8"/>' +
        '<line x1="70" y1="14" x2="70" y2="30" stroke="#9aa6b8" stroke-width="2"/><line x1="130" y1="14" x2="130" y2="30" stroke="#9aa6b8" stroke-width="2"/>' +
        '<polygon points="44,50 156,50 196,140 4,140" fill="' + glow + '" opacity="0.9"/>' +
        '<rect x="36" y="30" width="128" height="22" rx="4" fill="#cfd6e0"/>' +
        '<rect x="42" y="34" width="116" height="14" rx="2" fill="' + core + '" stroke="#e1e6ee" stroke-width="1.5"/>' +
        '<line x1="100" y1="34" x2="100" y2="48" stroke="#e1e6ee" stroke-width="1.5"/>' +
        '<g stroke="#f3c94d" stroke-width="3" stroke-linecap="round" opacity="0.8">' +
          '<line x1="24" y1="44" x2="12" y2="40"/><line x1="176" y1="44" x2="188" y2="40"/><line x1="100" y1="62" x2="100" y2="74"/></g>';
    },

    /** 보건용 마스크: 마스크에 등급 표시 */
    mask: function (s) {
      return '<ellipse cx="44" cy="70" rx="24" ry="30" fill="none" stroke="#a9b4c4" stroke-width="5"/>' +
        '<ellipse cx="156" cy="70" rx="24" ry="30" fill="none" stroke="#a9b4c4" stroke-width="5"/>' +
        '<path d="M48 42 Q100 20 152 42 L152 96 Q100 126 48 96 Z" fill="#ffffff" stroke="#c9d3e0" stroke-width="3"/>' +
        '<path d="M52 62 Q100 50 148 62" fill="none" stroke="#e1e7ef" stroke-width="3"/>' +
        '<path d="M52 84 Q100 98 148 84" fill="none" stroke="#e1e7ef" stroke-width="3"/>' +
        '<text x="100" y="80" text-anchor="middle" font-size="20" font-weight="700" fill="#3a6fd1">' + esc(s.grade || "") + "</text>";
    },

    /** 체육관 지붕 공사: 건물 + 지붕 패널, 재질에 태양광이 있으면 태양광 패널 */
    gym: function (s) {
      var solar = has(s.material, "태양광")
        ? '<polygon points="110,44 150,62 142,66 102,48" fill="#3f5f9e" stroke="#fff" stroke-width="1.5"/>' +
          '<polygon points="116,55 156,73 148,77 108,59" fill="#3f5f9e" stroke="#fff" stroke-width="1.5"/>'
        : "";
      return '<rect x="0" y="124" width="200" height="16" fill="#cfe8d6"/>' +
        '<rect x="30" y="72" width="140" height="56" fill="#f6e7c8"/>' +
        '<rect x="88" y="96" width="24" height="32" rx="2" fill="#c9a77c"/>' +
        '<rect x="44" y="84" width="28" height="18" rx="2" fill="#bfe0ff"/><rect x="128" y="84" width="28" height="18" rx="2" fill="#bfe0ff"/>' +
        '<polygon points="16,76 100,30 184,76" fill="#7fa6d6"/>' +
        '<g stroke="#5f86bd" stroke-width="2.5" fill="none">' +
          '<polyline points="30,70 100,38 170,70"/><polyline points="44,74 100,48 156,74"/></g>' +
        '<polygon points="16,76 100,30 184,76 178,80 100,37 22,80" fill="#5f86bd"/>' + solar +
        '<text x="100" y="91" text-anchor="middle" font-size="11" font-weight="700" fill="#8a6a3f">체육관</text>';
    }
  };

  /** 납품 물건 그림 SVG. spec: 그릴 사양 값 (업체 사양서 또는 공고 요구 사양). */
  function itemPictureHtml(project, spec, extraClass) {
    var draw = ITEM_PICTURES[project.picture];
    if (!draw) return "";
    return '<svg class="item-pic ' + (extraClass || "") + '" viewBox="0 0 200 140" role="img" aria-label="' +
      esc(project.item) + ' 그림">' + draw(spec || {}) + "</svg>";
  }

  /** 서류 한 장의 HTML. hl: 형광펜 칠할 항목 키 목록 (힌트가 없으면 빈 배열). */
  function docHtml(project, bidder, key, hl) {
    var d = bidder.docs;
    var labels = Game.DATA.specLabels;
    var title = "", badge = "";
    var body = "";
    hl = hl || [];

    for (var i = 0; i < DOC_TABS.length; i++) {
      if (DOC_TABS[i].key === key) { title = DOC_TABS[i].label; badge = DOC_TABS[i].badge; }
    }

    if (key === "application") {
      body = rowsHtml([
        ["업체명", d.application.company, "application.company"],
        ["대표자", d.application.ceo, "application.ceo"],
        ["사업자번호", d.application.bizNo, "application.bizNo"],
        ["소재지", d.application.address, "application.address"],
        ["제출일", d.application.submitDate, "application.submitDate"]
      ], hl);
    } else if (key === "quote") {
      body = rowsHtml([
        ["업체명", d.quote.company, "quote.company"],
        ["사업자번호", d.quote.bizNo, "quote.bizNo"],
        ["단가", won(d.quote.unitPrice), "quote.unitPrice"],
        ["수량", d.quote.qty.toLocaleString("ko-KR") + unitOf(project), "quote.qty"],
        ["총액", won(d.quote.total), "quote.total"],
        ["비고", d.quote.note, "quote.note"]
      ], hl);
    } else if (key === "certs") {
      body = (d.certs && d.certs.length) ? d.certs.map(function (c, idx) {
        var f = "certs." + idx + ".";
        return rowsHtml([
          ["인증 종류", c.type, f + "type"],
          ["인증 번호", c.number, f + "number"],
          ["유효기간", "~ " + c.validUntil, f + "validUntil"],
          ["발급기관", c.issuer, f + "issuer"],
          ["사업자번호", c.bizNo, f + "bizNo"]
        ], hl);
      }).join("") : '<p class="doc-empty">제출된 인증서가 없습니다.</p>';
    } else if (key === "spec") {
      var rows = [];
      for (var k in labels) {
        if (Object.prototype.hasOwnProperty.call(d.spec, k)) rows.push([labels[k], specValue(d.spec[k]), "spec." + k]);
      }
      var pic = itemPictureHtml(project, d.spec);
      body = (pic ? '<figure class="doc-photo">' + pic + "<figcaption>제품 사진</figcaption></figure>" : "") +
        rowsHtml(rows, hl);
    } else if (key === "status") {
      body = rowsHtml([
        ["사업자번호", d.status.bizNo, "status.bizNo"],
        ["사무실", yesNo(d.status.hasOffice), "status.hasOffice"],
        ["공장", yesNo(d.status.hasFactory), "status.hasFactory"],
        ["직원 수", d.status.employees + "명", "status.employees"],
        ["납품 실적", d.status.deliveries + "건", "status.deliveries"],
        ["중대재해 이력", d.status.seriousAccidents + "건", "status.seriousAccidents"]
      ], hl);
    }

    // 서류 전체가 근거일 때 (예: 필수 인증서 누락) 종이 전체에 형광펜
    var whole = hl.indexOf(key) !== -1;
    return '<article class="paper is-' + key + (whole ? " is-hl" : "") + '">' +
      '<header class="paper-head"><span class="paper-badge">' + esc(badge) + "</span>" +
      '<span class="paper-title">' + esc(title) + "</span>" +
      '<span class="paper-company">' + esc(bidder.name) + "</span></header>" +
      body + "</article>";
  }

  /** "적격" / "부적격(사유)" */
  function verdictText(v, reason) {
    if (!v) return "판정 안 함";
    if (v === "ok") return "적격";
    return "부적격" + (reason ? "(" + Game.DATA.reasons[reason].name + ")" : "");
  }

  function findIn(project, bidderId) {
    for (var i = 0; i < project.bidders.length; i++) if (project.bidders[i].id === bidderId) return project.bidders[i];
    return null;
  }

  // ----- 펜·형광펜 선 -----
  var MARK_WIDTH = { pen: 4, marker: 24 };   // 선 굵기 (색은 css .mark.is-pen / .is-marker)
  var ERASER_R = 14;                          // 지우개 반경

  function strokeD(pts) {
    if (pts.length === 1) return "M" + pts[0][0] + " " + pts[0][1] + "l0.1 0";   // 콕 찍은 점도 보이게
    return "M" + pts.map(function (p) { return p[0] + " " + p[1]; }).join("L");
  }

  function strokeHtml(s) {
    return '<path class="mark is-' + s.tool + '" d="' + strokeD(s.points) + '"/>';
  }

  /** 점에서 선분까지 거리 */
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = dx * dx + dy * dy;
    var t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    return Math.sqrt(x * x + y * y);
  }

  /** 지우개가 선에 닿았는지 (선 굵기 포함) */
  function strokeNear(s, p, r) {
    var reach = r + MARK_WIDTH[s.tool] / 2, pts = s.points;
    if (pts.length === 1) return segDist(p, pts[0], pts[0]) <= reach;
    for (var i = 1; i < pts.length; i++) if (segDist(p, pts[i - 1], pts[i]) <= reach) return true;
    return false;
  }

  /** 힌트 문구 채우기: {키}를 vars 값으로. */
  function fillVars(template, vars) {
    return template.replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? esc(vars[k]) : m;
    });
  }

  function conditionsRows(project) {
    var labels = Game.DATA.specLabels;
    var spec = [];
    for (var k in project.requiredSpec) {
      spec.push(labels[k] + " " + specValue(project.requiredSpec[k]));
    }
    return [
      ["발주기관", project.agency],
      ["품목·수량", project.item + " " + project.qty.toLocaleString("ko-KR") + unitOf(project)],
      ["예산 상한", won(project.budgetMax), "cond.budget"],
      ["필수 인증", project.requiredCerts.join(", ") || "없음", "cond.certs"],
      ["입찰 마감", project.deadline, "cond.deadline"],
      ["요구 사양", spec.join(" · "), "cond.spec"]
    ];
  }

  function fill(template, reason) {
    return template.replace("{name}", esc(reason.name)).replace("{desc}", esc(reason.desc));
  }

  Game.ui = {
    STAGE_W: 1920,
    STAGE_H: 1080,
    portrait: false,
    DOC_TABS: DOC_TABS,

    /** 창 크기에 맞춰 1920×1080 무대를 비율 유지(레터박스)로 스케일한다. */
    /*
     * 세로 화면(창 높이 > 폭, 휴대폰 세로)이면 1080×1920 세로 무대로 바꾼다 (GAME_SPEC 8장).
     * 화면 배치는 css의 #stage.is-portrait 규칙이 맡는다.
     */
    fitStage: function () {
      var portrait = window.innerHeight > window.innerWidth;
      this.portrait = portrait;
      this.STAGE_W = portrait ? 1080 : 1920;
      this.STAGE_H = portrait ? 1920 : 1080;
      var stage = $("stage");
      stage.classList.toggle("is-portrait", portrait);
      stage.style.setProperty("--stage-w", this.STAGE_W + "px");
      stage.style.setProperty("--stage-h", this.STAGE_H + "px");
      var scale = Math.min(window.innerWidth / this.STAGE_W, window.innerHeight / this.STAGE_H);
      this.scale = scale;     // 서류 끌기에서 화면 이동량 → 무대 좌표로 바꿀 때 사용
      $("stage").style.setProperty("--stage-scale", scale);
    },

    /** data-screen 이름으로 화면을 전환한다. */
    // ===== 조달 용어 사전 =====
    /** 사전 창을 그린다. selectedId: 설명을 보여 줄 카드 (없으면 안내). */
    renderGlossary: function (selectedId) {
      var G = Game.DATA.glossary, gl = Game.glossary;
      var entries = gl.entries();
      var c = gl.count();
      $("glossary-title").textContent = G.title;
      $("glossary-count").innerHTML = "<b>" + c.have + "</b> / " + c.total + " 모음" +
        (c.have >= c.total ? ' <span class="glossary-badge">🎓 ' + esc(G.complete) + "</span>" : "");

      $("glossary-list").innerHTML = Object.keys(G.groups).map(function (g) {
        var cards = entries.filter(function (e) { return e.group === g; }).map(function (e) {
          var on = gl.isUnlocked(e.id);
          return '<button type="button" class="g-card is-' + g + (on ? "" : " is-locked") + (e.id === selectedId ? " is-active" : "") +
            '" data-action="glossary-pick" data-entry="' + e.id + '"' + (on ? "" : ' aria-label="아직 못 모은 카드"') + ">" +
            esc(on ? e.name : G.lockedName) + "</button>";
        }).join("");
        return '<section class="g-group"><h4>' + esc(G.groups[g]) + "</h4><div class=\"g-cards\">" + cards + "</div></section>";
      }).join("");

      var sel = null;
      entries.forEach(function (e) { if (e.id === selectedId) sel = e; });
      var detail;
      if (!sel) {
        detail = c.have >= c.total ? '<p class="g-empty">' + esc(G.completeNote) + "</p>" : '<p class="g-empty">' + esc(G.pick) + "</p>";
      } else if (!gl.isUnlocked(sel.id)) {
        detail = '<p class="g-group-name">' + esc(G.groups[sel.group]) + '</p><h4 class="g-name">' + esc(G.lockedName) + "</h4>" +
          '<p class="g-desc">' + esc(G.lockedHint) + "</p>";
      } else {
        detail = '<p class="g-group-name">' + esc(G.groups[sel.group]) + '</p><h4 class="g-name">' + esc(sel.name) + "</h4>" +
          '<p class="g-desc">' + esc(sel.desc) + "</p>" +
          (sel.more ? '<p class="g-more">' + esc(sel.more) + "</p>" : "") +
          (sel.policy ? '<p class="review-policy"><span>연결 정책</span>' + esc(sel.policy) + "</p>" : "") +
          '<img class="g-narmi" src="assets/img/narmi_3d.png" alt="">';
      }
      $("glossary-detail").innerHTML = detail;
    },

    openGlossary: function () { this.renderGlossary(null); $("glossary-modal").hidden = false; },
    closeGlossary: function () { $("glossary-modal").hidden = true; },

    /** 화면 위쪽에 잠깐 알림 (새 용어 카드 등) */
    toast: function (html) {
      var t = $("toast");
      t.innerHTML = html;
      t.hidden = false;
      t.classList.remove("is-in");
      void t.offsetWidth;
      t.classList.add("is-in");
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
    },

    /** 타이틀의 이어하기 버튼 (n: 이어서 할 사업 번호) */
    renderContinue: function (canContinue, n, total) {
      var btn = $("continue-btn");
      btn.hidden = !canContinue;
      if (canContinue) btn.innerHTML = Game.DATA.continueLabel.replace("{n}", n).replace("{total}", total);
    },

    show: function (name) {
      var screens = document.querySelectorAll(".screen");
      for (var i = 0; i < screens.length; i++) {
        screens[i].classList.toggle("is-active", screens[i].getAttribute("data-screen") === name);
      }
    },

    // ===== 인트로 (달이 첫 출근) =====
    /** index번째 컷을 그린다. 말하는 캐릭터는 크게, 듣는 캐릭터는 작고 흐리게. */
    renderIntro: function (index) {
      var cuts = Game.DATA.intro;
      var cut = cuts[index];
      $("intro-name").textContent = Game.DATA.speakers[cut.speaker];
      $("intro-name").className = "intro-name is-" + cut.speaker;
      var text = $("intro-text");
      text.innerHTML = cut.text;          // data.js의 대사 (<b> 강조 포함)
      text.classList.remove("is-in");
      void text.offsetWidth;              // 등장 애니메이션 다시 시작
      text.classList.add("is-in");
      // 장면(집 → 출근길 → 조달청 → 업무 장소): 배경과 이름표를 바꾼다. 장면이 바뀔 때만 등장 연출.
      var screen = document.querySelector('[data-screen="intro"]');
      var scene = cut.scene || "office";
      if (screen.getAttribute("data-scene") !== scene || index === 0) {
        screen.setAttribute("data-scene", scene);
        screen.classList.remove("is-scene-in");
        void screen.offsetWidth;
        screen.classList.add("is-scene-in");
      }
      $("scene-tag").textContent = (Game.DATA.scenes && Game.DATA.scenes[scene]) || "";
      $("intro-dali").classList.toggle("is-speaking", cut.speaker === "dali");
      $("intro-narmi").classList.toggle("is-speaking", cut.speaker === "narmi");
      $("intro-narmi").classList.toggle("is-present", scene === "office");   // 나르미는 업무 장소에서 등장
      $("intro-dots").innerHTML = cuts.map(function (c, i) {
        return '<li class="' + (i === index ? "is-on" : (i < index ? "is-done" : "")) + '"></li>';
      }).join("");
    },

    // ===== 업무 장소 (사무실 — 책상을 누르면 공고 → 심사) =====
    /** first: 첫 사업이면 true (안내 문구가 다름). 책상 위에는 이번 사업 공고 카드가 놓인다. */
    renderOffice: function (first) {
      var O = Game.DATA.office;
      // 모니터 속 작은 바탕화면: 사업 폴더 (끝낸 건 완료 표시)
      $("pc-mini").innerHTML = Game.DATA.projects.map(function (p) {
        return folderIconHtml(Game.engine.isDone(p.id));
      }).join("");
      $("desk-label").textContent = O.pcLabel;
      $("shelf-label").textContent = Game.DATA.glossary.shelfLabel;
      $("office-prompt").textContent = first ? O.prompt.first : O.prompt.next;
      this.hideOfficeTip();
    },

    // ===== 컴퓨터 바탕화면 (사업 폴더 고르기) =====
    renderComputer: function () {
      var C = Game.DATA.computer;
      var E = Game.engine;
      $("pc-topbar").innerHTML = '<span class="pc-app">' + esc(C.title) + "</span>" +
        '<span class="pc-user">' + esc(C.user) + " · 남은 업무 " + (E.data.projects.length - E.state.done.length) + "건</span>";
      var gc = Game.glossary.count();
      var bookIcon = '<button type="button" class="pc-icon pc-icon-book" data-action="glossary">' +
        '<span class="pc-book" aria-hidden="true"><i></i></span><span class="pc-icon-name">' + esc(Game.DATA.glossary.open) + "</span>" +
        '<span class="pc-icon-badge is-book">' + gc.have + "/" + gc.total + "</span></button>";
      $("pc-icons").innerHTML = bookIcon + Game.DATA.projects.map(function (p) {
        var done = E.isDone(p.id);
        return '<button type="button" class="pc-icon' + (done ? " is-done" : "") + '" data-action="open-folder" data-project="' + p.id + '">' +
          folderIconHtml(done) + '<span class="pc-icon-name">' + esc(p.folder || p.title) + "</span>" +
          (done ? '<span class="pc-icon-badge">' + esc(C.doneBadge) + "</span>" : "") + "</button>";
      }).join("");
      $("pc-off").textContent = C.off;
      $("pc-help").textContent = C.help;
      $("pc-hint").textContent = C.hint;
      this.closeFolder();
    },

    /** 폴더 창: 입찰공고문 · 입찰 업체. 끝낸 사업이면 결과 한 줄. */
    openFolder: function (projectId) {
      var C = Game.DATA.computer;
      var E = Game.engine;
      var p = null;
      Game.DATA.projects.forEach(function (x) { if (x.id === projectId) p = x; });
      var done = E.isDone(p.id);
      var body;
      if (done) {
        var awardedId = E.state.awards[p.id];
        var awarded = awardedId ? findIn(p, awardedId) : null;
        body = '<p class="pc-window-note">' + C.doneNote.replace("{name}", esc(awarded ? awarded.name : C.failedName)) + "</p>";
      } else {
        // 이 사업을 열면 새로 소개될 사유가 있는지 (끝낸 사업에서 이미 본 건 빼고)
        var starting = Game.DATA.startingReasons || [];
        var hasNew = p.bidders.some(function (b) {
          return b.reason && starting.indexOf(b.reason) === -1 && E.state.seenReasons.indexOf(b.reason) === -1;
        });
        body = '<div class="pc-files">' +
            '<button type="button" class="pc-file" data-action="open-notice" data-project="' + p.id + '">' +
              '<span class="pc-doc"><i></i><i></i><i></i></span><span class="pc-icon-name">' + esc(C.noticeFile) + "</span></button>" +
            '<button type="button" class="pc-file" data-action="open-bidders" data-project="' + p.id + '">' +
              folderIconHtml(false) + '<span class="pc-icon-name">' + esc(C.biddersFile.replace("{n}", p.bidders.length)) + "</span></button>" +
            '<div class="pc-file-pic">' + itemPictureHtml(p, p.requiredSpec, "is-pc") + "</div>" +
          "</div>" +
          '<p class="pc-window-note">' + esc(C.folderNote) + (hasNew ? ' <b class="pc-new">' + esc(C.newReasonNote) + "</b>" : "") + "</p>";
      }
      var win = $("pc-window");
      win.innerHTML =
        '<header class="pc-window-bar">' + folderIconHtml(done) + '<span class="pc-window-title">' + esc(p.title) + "</span>" +
          '<button type="button" class="pc-window-close" data-action="close-folder" aria-label="폴더 닫기">×</button></header>' +
        '<div class="pc-window-body">' + body + "</div>";
      win.hidden = false;
      win.classList.remove("is-in");
      void win.offsetWidth;
      win.classList.add("is-in");
    },

    closeFolder: function () { $("pc-window").hidden = true; },

    /*
     * 바탕화면 둘러보기 한 단계. 비출 요소들의 영역을 합쳐 스포트라이트를 놓고,
     * 그 아래(자리가 없으면 위)에 나르미 말풍선. 비출 게 없으면 false (그 단계는 건너뜀).
     */
    renderTour: function (index) {
      var T = Game.DATA.computer.tour;
      var step = T.steps[index];
      var desk = $("pc-desktop");
      var els = desk.querySelectorAll(step.target);
      var shown = [];
      for (var i = 0; i < els.length; i++) if (els[i].offsetParent) shown.push(els[i]);
      if (!shown.length) return false;
      // 화면 좌표 → 바탕화면 좌표 (무대가 축소돼 있으므로 비율로 되돌린다)
      var d = desk.getBoundingClientRect();
      var k = desk.offsetWidth / d.width;
      var box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
      shown.forEach(function (el) {
        var r = el.getBoundingClientRect();
        box.l = Math.min(box.l, r.left); box.t = Math.min(box.t, r.top);
        box.r = Math.max(box.r, r.right); box.b = Math.max(box.b, r.bottom);
      });
      var PAD = 12;
      var x = (box.l - d.left) * k - PAD, y = (box.t - d.top) * k - PAD;
      var w = (box.r - box.l) * k + PAD * 2, h = (box.b - box.t) * k + PAD * 2;
      var spot = $("pc-tour-spot");
      spot.style.left = x + "px"; spot.style.top = y + "px";
      spot.style.width = w + "px"; spot.style.height = h + "px";

      $("pc-tour-text").innerHTML = step.text;    // data.js 문구 (<b> 강조 포함)
      $("pc-tour-count").textContent = T.counter.replace("{i}", index + 1).replace("{n}", T.steps.length);
      var last = index === T.steps.length - 1;
      $("pc-tour-next").textContent = last ? T.done : T.next;
      $("pc-tour-skip").textContent = T.skip;
      $("pc-tour-skip").hidden = last;

      var tour = $("pc-tour");
      tour.hidden = false;
      var bubble = $("pc-tour-bubble");
      bubble.classList.remove("is-in");
      var W = desk.offsetWidth, H = desk.offsetHeight, GAP = 24;
      var bw = bubble.offsetWidth, bh = bubble.offsetHeight;
      var by = y + h + GAP;
      if (by + bh > H - 10) by = y - GAP - bh;          // 아래 자리가 없으면 위로
      if (by < 10) by = Math.max(10, Math.min(H - bh - 10, y + h / 2 - bh / 2));
      var bx = Math.max(16, Math.min(W - bw - 16, x + w / 2 - bw / 2));
      bubble.style.left = bx + "px"; bubble.style.top = by + "px";
      void bubble.offsetWidth;
      bubble.classList.add("is-in");
      return true;
    },

    hideTour: function () { $("pc-tour").hidden = true; },

    /**
     * 이야기의 "업무 장소" 장면 배경 = 업무 장소 화면의 방을 복사 (두 곳 그림이 항상 같게).
     * 복사본은 장식용: 누를 수 없게, id 없이, 나르미는 이야기 쪽 캐릭터가 따로 나오므로 뺀다.
     */
    buildIntroRoom: function () {
      var room = $("office-room").cloneNode(true);
      room.removeAttribute("id");
      var narmi = room.querySelector(".room-narmi");
      if (narmi) narmi.parentNode.removeChild(narmi);
      var label = room.querySelector(".desk-label");
      if (label) label.parentNode.removeChild(label);
      var all = room.querySelectorAll("[id], [data-action], button");
      for (var i = 0; i < all.length; i++) {
        all[i].removeAttribute("id");
        all[i].removeAttribute("data-action");
        all[i].setAttribute("tabindex", "-1");
      }
      $("intro-room").innerHTML = "";
      $("intro-room").appendChild(room);
    },

    /** 문·창문·나르미를 눌렀을 때 그 근처에 말풍선 (html: data.js 문구) */
    showOfficeTip: function (spot, html) {
      var tip = $("office-tip");
      tip.innerHTML = html;
      tip.className = "office-tip is-" + spot;
      tip.hidden = false;
      void tip.offsetWidth;
      tip.classList.add("is-in");
    },

    hideOfficeTip: function () { $("office-tip").hidden = true; },

    // ===== ① 공고 =====
    renderNotice: function (project) {
      $("notice-card").innerHTML =
        '<div class="notice-head"><div>' +
          '<p class="notice-badge">입찰 공고 · 사업 ' + projectNo() + "</p>" +
          '<h2 class="notice-title">' + esc(project.title) + "</h2></div>" +
          itemPictureHtml(project, project.requiredSpec, "is-notice") + "</div>" +
        rowsHtml(conditionsRows(project)) +
        '<div class="notice-foot"><span>공정하고 투명한 조달</span>' +
        '<img class="pps-symbol" src="assets/img/pps_symbol_h.jpg" alt="조달청"></div>';
      var first = Game.engine.state.done.length === 0;
      $("notice-bubble").innerHTML = (first ? "첫 사업 공고가 도착했어요! " : "다음 사업 공고예요! ") +
        "업체 <b>" + project.bidders.length + "곳</b>이 입찰했대요. 조건을 잘 기억해 두세요.";

      // 나르미 안내는 심사 전에만: 새 확인 사항이 생긴 사업이면 그 설명(GAME_SPEC 5.3), 첫 사업이면 조작 방법
      var parts = [];
      if (first) parts.push(Game.DATA.narmi.howTo);
      // 이 사업에서 처음 만나는 사유 (어떤 순서로 골라도 처음 만날 때 소개)
      Game.engine.newReasons().forEach(function (code) {
        parts.push(fill(Game.DATA.narmi.newReason, Game.DATA.reasons[code]));
      });
      var note = parts.join("<br><br>");
      $("notice-narmi-bubble").innerHTML = note;
      $("notice-narmi").hidden = !note;
    },

    // ===== ②~④ 심사 데스크 =====
    /**
     * view: { project, bidder, index, docKey(맨 위 서류), papers(책상 위 서류), seen(앞서 본 업체들), stamps({id: verdict}) }
     * papers: [{ id, bidderId, docKey, x, y }] — 배열 순서 = 쌓인 순서(마지막이 맨 위)
     */

    /** 서류 탭: 펼쳐진 서류는 점 표시, 맨 위 서류는 강조. 견적서 비교 칩도 여기서. */
    renderTabs: function (view) {
      var b = view.bidder;
      var open = {};
      view.papers.forEach(function (pp) { if (pp.bidderId === b.id) open[pp.docKey] = true; });
      $("doc-tabs").innerHTML = DOC_TABS.map(function (t) {
        var cls = "doc-tab is-" + t.key + (open[t.key] ? " is-open" : "") + (t.key === view.docKey ? " is-active" : "");
        return '<button type="button" class="' + cls + '" data-action="tab" data-doc="' + t.key + '">' + esc(t.label) + "</button>";
      }).join("") + (view.seen.length ? '<span class="compare-label">견적서 비교</span>' + view.seen.map(function (s) {
        var on = view.papers.some(function (pp) { return pp.bidderId === s.id; });
        return '<button type="button" class="chip' + (on ? " is-active" : "") +
          '" data-action="compare" data-bidder="' + s.id + '">' + esc(s.name) + "</button>";
      }).join("") : "");
    },

    /** 책상 위 서류들을 그린다 (위치·쌓인 순서·형광펜). */
    renderPapers: function (view) {
      var p = view.project, b = view.bidder;
      var hint = Game.engine.hintOf(b.id);
      $("doc-area").innerHTML = view.papers.map(function (pp, i) {
        var owner = pp.bidderId === b.id ? b : findIn(p, pp.bidderId);
        // 나르미 힌트: 근거 서류에 형광펜. 담합이면 비교 중인 상대 견적서에도.
        var hl = [];
        if (hint && hint.docKey === pp.docKey && (owner === b || hint.code === "COLLUSION")) hl = hint.fields;
        return '<div class="desk-paper' + (owner !== b ? " is-other" : "") + '" data-paper="' + pp.id + '" ' +
          'style="left:' + pp.x + "px;top:" + pp.y + "px;z-index:" + (i + 1) + '">' +
          '<button type="button" class="paper-close" data-action="close-paper" data-paper="' + pp.id + '" aria-label="서류 닫기">×</button>' +
          docHtml(p, owner, pp.docKey, hl) + "</div>";
      }).join("") + (view.papers.length ? "" : '<p class="desk-empty">위의 서류 탭을 눌러 책상에 펼쳐 보세요.</p>');
      this.renderMarks(view);
    },

    // ===== 펜·형광펜 표시 (플레이어 메모 — 판정에는 영향 없음) =====
    /**
     * 서류마다 SVG 덧그림 층에 저장된 선을 그린다. paperId를 주면 그 서류만.
     * view.marks: { 서류id: [{ tool: "pen"|"marker", points: [[x, y], …] }] } — 좌표는 서류 종이(.paper) 기준.
     * 공고 조건표도 그릴 수 있는 면이다 (id "conditions", 좌표는 #conditions 기준).
     */
    renderMarks: function (view, paperId) {
      var targets = [];
      if (paperId !== "conditions") {
        var sel = paperId ? '.desk-paper[data-paper="' + paperId + '"]' : ".desk-paper";
        var els = document.querySelectorAll("#doc-area " + sel);
        for (var k = 0; k < els.length; k++) targets.push({ id: els[k].getAttribute("data-paper"), surface: els[k].querySelector(".paper") });
      }
      if (!paperId || paperId === "conditions") targets.push({ id: "conditions", surface: $("conditions") });
      for (var i = 0; i < targets.length; i++) {
        var paper = targets[i].surface;
        if (!paper) continue;
        var svg = paper.querySelector("svg.marks");
        if (!svg) {
          paper.insertAdjacentHTML("beforeend", '<svg class="marks" aria-hidden="true"></svg>');
          svg = paper.lastElementChild;
        }
        // 종이 전체(스크롤되는 부분 포함)를 덮는 크기
        svg.setAttribute("width", paper.scrollWidth);
        svg.setAttribute("height", paper.scrollHeight);
        var strokes = (view.marks && view.marks[targets[i].id]) || [];
        svg.innerHTML = strokes.map(strokeHtml).join("");
      }
    },

    /** 고른 도구 표시 (책상의 data-tool → 커서·터치 동작은 css가 맡음). */
    setTool: function (tool) {
      document.querySelector(".papers").setAttribute("data-tool", tool);
      $("conditions").setAttribute("data-tool", tool);
      var btns = document.querySelectorAll(".tool-btn[data-tool]");
      for (var i = 0; i < btns.length; i++) {
        var on = btns[i].getAttribute("data-tool") === tool;
        btns[i].classList.toggle("is-active", on);
        btns[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
    },

    /**
     * 서류와 공고 조건표 위에 그리기·지우기 (Pointer Events — 마우스·터치 공통).
     * h.tool(): 지금 도구 ("move"|"pen"|"marker"|"eraser"), h.marks(paperId): 그 서류의 선 배열(없으면 만들어 돌려줌),
     * h.changed(paperId): 지우개로 선이 지워졌을 때 (그 서류 표시를 다시 그림).
     * 서류 머리(잡는 곳)와 버튼은 건드리지 않는다 → 어느 도구든 서류를 옮길 수 있다.
     */
    enablePaperDraw: function (h) {
      var cur = null;     // { el, paper, id, tool, stroke, path }

      function local(e, paper) {
        var r = paper.getBoundingClientRect();
        var s = Game.ui.scale || 1;
        return [Math.round(((e.clientX - r.left) / s + paper.scrollLeft) * 10) / 10,
                Math.round(((e.clientY - r.top) / s + paper.scrollTop) * 10) / 10];
      }

      function erase(pt) {
        var list = h.marks(cur.id);
        var before = list.length;
        for (var i = list.length - 1; i >= 0; i--) {
          if (strokeNear(list[i], pt, ERASER_R)) list.splice(i, 1);
        }
        if (list.length !== before) h.changed(cur.id);
      }

      /** 누른 곳의 그리기 면: 책상 위 서류 종이 또는 공고 조건표. 없으면 null. */
      function surfaceAt(target) {
        var el = target.closest(".desk-paper");
        if (el) return { el: el, paper: el.querySelector(".paper"), id: el.getAttribute("data-paper") };
        el = target.closest("#conditions");
        if (el) return { el: el, paper: el, id: "conditions" };
        return null;
      }

      function down(e) {
        var tool = h.tool();
        if (tool === "move") return;
        if (e.target.closest("button") || e.target.closest(".paper-head")) return;
        var s = surfaceAt(e.target);
        if (!s) return;
        var el = s.el, paper = s.paper;
        e.preventDefault();
        cur = { el: el, paper: paper, id: s.id, tool: tool };
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
        var pt = local(e, paper);
        if (tool === "eraser") { erase(pt); return; }
        cur.stroke = { tool: tool, points: [pt] };
        var svg = paper.querySelector("svg.marks");
        svg.insertAdjacentHTML("beforeend", strokeHtml(cur.stroke));
        cur.path = svg.lastElementChild;
      }

      function move(e) {
        if (!cur) return;
        var pt = local(e, cur.paper);
        if (cur.tool === "eraser") { erase(pt); return; }
        var pts = cur.stroke.points, last = pts[pts.length - 1];
        if (Math.abs(pt[0] - last[0]) + Math.abs(pt[1] - last[1]) < 2) return;   // 너무 촘촘한 점은 건너뜀
        pts.push(pt);
        cur.path.setAttribute("d", strokeD(pts));
      }

      function end() {
        if (!cur) return;
        if (cur.stroke) h.marks(cur.id).push(cur.stroke);
        cur = null;
      }
      [$("doc-area"), $("conditions")].forEach(function (area) {
        area.addEventListener("pointerdown", down);
        area.addEventListener("pointermove", move);
        area.addEventListener("pointerup", end);
        area.addEventListener("pointercancel", end);
      });
    },

    /** 끌기 없이 쌓인 순서만 바꿀 때 (다시 그리지 않아 끌기가 끊기지 않음). */
    restack: function (view) {
      view.papers.forEach(function (pp, i) {
        var el = document.querySelector('.desk-paper[data-paper="' + pp.id + '"]');
        if (el) el.style.zIndex = i + 1;
      });
      this.renderTabs(view);
    },

    /**
     * 서류 끌기 (Pointer Events — 마우스·터치 공통). 서류 머리(.paper-head)를 잡고 끈다.
     * handlers.front(id): 서류를 눌렀을 때(맨 위로), handlers.moved(id, x, y): 다 옮겼을 때.
     */
    enablePaperDrag: function (handlers) {
      var area = $("doc-area");
      var drag = null;

      area.addEventListener("pointerdown", function (e) {
        var el = e.target.closest(".desk-paper");
        if (!el || e.target.closest("button")) return;
        handlers.front(el.getAttribute("data-paper"));
        if (!e.target.closest(".paper-head")) return;        // 끌기는 머리 부분만 (본문은 스크롤)
        e.preventDefault();
        drag = {
          el: el,
          id: el.getAttribute("data-paper"),
          startX: e.clientX,
          startY: e.clientY,
          x: el.offsetLeft,
          y: el.offsetTop,
          scale: Game.ui.scale || 1
        };
        el.classList.add("is-dragging");
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      });

      area.addEventListener("pointermove", function (e) {
        if (!drag) return;
        var pos = Game.ui.clampPaper(drag.el,
          drag.x + (e.clientX - drag.startX) / drag.scale,
          drag.y + (e.clientY - drag.startY) / drag.scale);
        drag.el.style.left = pos.x + "px";
        drag.el.style.top = pos.y + "px";
      });

      function end() {
        if (!drag) return;
        drag.el.classList.remove("is-dragging");
        handlers.moved(drag.id, drag.el.offsetLeft, drag.el.offsetTop);
        drag = null;
      }
      area.addEventListener("pointerup", end);
      area.addEventListener("pointercancel", end);
    },

    /** 서류가 책상 밖으로 나가지 않게 (머리 부분은 항상 보이게). */
    clampPaper: function (el, x, y) {
      var area = $("doc-area");
      var maxX = Math.max(0, area.clientWidth - el.offsetWidth);
      var maxY = Math.max(0, area.clientHeight - 64);
      return { x: Math.round(Math.min(Math.max(0, x), maxX)), y: Math.round(Math.min(Math.max(0, y), maxY)) };
    },

    renderDesk: function (view) {
      var p = view.project, b = view.bidder;

      $("desk-title").innerHTML = '<span class="desk-no">사업 ' + projectNo() + "</span>" + esc(p.title);
      $("desk-progress").innerHTML = view.bidders.map(function (x, i) {
        var cls = i === view.index ? "is-current" : (view.stamps[x.id] ? "is-" + view.stamps[x.id] : "");
        return '<li class="' + cls + '">' + (i + 1) + "</li>";
      }).join("");

      // 새 업체가 들어올 때만 등장 애니메이션 (탭 전환 등으로 다시 그릴 땐 생략)
      var entering = $("rep").getAttribute("data-bidder") !== b.id;
      $("rep").setAttribute("data-bidder", b.id);
      $("rep").innerHTML = npcHtml(p, b, "is-talking" + (entering ? " is-entering" : "")) +
        '<div class="rep-name">' + esc(b.name) + " 대표</div>";
      $("rep-bubble").textContent = b.pitch;

      this.renderTabs(view);
      this.renderPapers(view);

      // 세로 화면 전환 탭 (가로 화면에서는 css로 숨김)
      var pane = view.pane || "papers";
      document.querySelector('[data-screen="desk"]').setAttribute("data-pane", pane);
      var paneBtns = document.querySelectorAll(".pane-btn");
      for (var pi = 0; pi < paneBtns.length; pi++) {
        var on = paneBtns[pi].getAttribute("data-pane") === pane;
        paneBtns[pi].classList.toggle("is-active", on);
        paneBtns[pi].setAttribute("aria-selected", on ? "true" : "false");
      }
      var hint = Game.engine.hintOf(b.id);

      $("conditions").innerHTML = '<h3>공고 조건표</h3>' + rowsHtml(conditionsRows(p));
      this.renderMarks(view, "conditions");     // 조건표에 그린 표시는 다시 그려도 남는다

      // 심사 중 나르미는 조용히 — 힌트를 눌렀을 때만 그 업체의 힌트 한 줄
      var bubble = $("narmi-bubble");
      bubble.innerHTML = hint ? fillVars(Game.DATA.narmi.hints[hint.code || "none"], hint.vars) : "";
      bubble.hidden = !hint;

      var left = Game.engine.hintsLeft();
      var btn = $("hint-btn");
      btn.innerHTML = "힌트 <b>" + left + "</b>";
      btn.disabled = !!hint || left <= 0;
      btn.title = hint ? "이 업체에는 이미 힌트를 썼어요" : (left <= 0 ? "이번 사업의 힌트를 모두 썼어요" : "수상한 곳 한 군데를 알려 줘요");

      this.setStampsEnabled(true);
    },

    /** 도장 뒤 나르미가 진짜 사유를 알려 주는 창 (GAME_SPEC 4.2). */
    showReasonFix: function (code) {
      $("narmi-modal-text").innerHTML = fill(Game.DATA.narmi.reasonFix, Game.DATA.reasons[code]);
      $("narmi-modal").hidden = false;
    },

    closeNarmiModal: function () { $("narmi-modal").hidden = true; },

    setStampsEnabled: function (on) {
      var btns = document.querySelectorAll(".stamp-btn");
      for (var i = 0; i < btns.length; i++) btns[i].disabled = !on;
    },

    openReasons: function (codes, selected) {
      var reasons = Game.DATA.reasons;
      $("reason-list").innerHTML = codes.map(function (c) {
        return '<button type="button" class="reason' + (c === selected ? " is-active" : "") +
          '" data-action="pick-reason" data-reason="' + c + '">' +
          '<span class="reason-name">' + esc(reasons[c].name) + "</span>" +
          '<span class="reason-policy">' + esc(reasons[c].policy) + "</span></button>";
      }).join("");
      $("confirm-reject").disabled = !selected;
      $("reason-modal").hidden = false;
    },

    closeReasons: function () { $("reason-modal").hidden = true; },

    /** 도장 쾅 연출. 끝나면 done() 호출. */
    stamp: function (verdict, done) {
      var mark = $("stamp-mark");
      this.setStampsEnabled(false);
      // 세로 화면에서 조건표를 보다가 찍어도 도장이 보이게 서류 쪽으로 (도장 자국은 책상 위에 찍힌다)
      document.querySelector('[data-screen="desk"]').setAttribute("data-pane", "papers");
      mark.textContent = verdict === "ok" ? "적격" : "부적격";
      mark.className = "stamp-mark is-" + verdict;
      var desk = mark.parentNode;        // .papers (책상)
      desk.classList.remove("is-thud");
      void mark.offsetWidth;            // 애니메이션 재시작
      mark.classList.add("is-on");
      desk.classList.add("is-thud");    // 찍히는 순간 책상이 흔들림 (css 0.2초 지연)
      // 도장이 종이에 닿는 순간(애니메이션 20% ≈ 0.22초)에 "쾅" — 적격/부적격 같은 소리
      if (Game.sound) Game.sound.play("stamp", 0.2);
      setTimeout(function () {
        mark.className = "stamp-mark";
        desk.classList.remove("is-thud");
        done();
      }, 1100);
    },

    /** 소리 켜기/끄기 버튼 모양 */
    renderSoundButton: function (on) {
      var btn = $("sound-btn");
      if (!btn) return;
      btn.classList.toggle("is-off", !on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = on ? "소리 끄기" : "소리 켜기";
      btn.setAttribute("aria-label", btn.title);
    },

    // ===== ⑤ 낙찰 =====
    renderAward: function (project, candidates) {
      $("award-dilemma").textContent = project.dilemma || "";
      // 후보가 3곳 이상이면(부적격 업체를 통과시킨 경우) 카드를 작게 — css .is-many
      $("award-cards").classList.toggle("is-many", candidates.length > 2);
      $("award-cards").scrollTop = 0;
      $("award-cards").innerHTML = candidates.map(function (b) {
        var d = b.docs;
        return '<article class="award-card">' +
          '<div class="award-head">' + npcHtml(project, b, "is-small") + '<h3>' + esc(b.name) + "</h3></div>" +
          '<p class="award-pitch">“' + esc(b.pitch) + '”</p>' +
          rowsHtml([
            ["단가", won(d.quote.unitPrice)],
            ["총액", won(d.quote.total)],
            ["납품 실적", d.status.deliveries + "건"],
            ["직원 수", d.status.employees + "명"],
            ["비고", d.quote.note]
          ]) +
          '<button class="btn btn-primary" type="button" data-action="award" data-bidder="' + b.id + '">이 업체로 낙찰</button>' +
          "</article>";
      }).join("");
      // 플레이어가 통과시킨 업체 수로 말한다 (정답 수를 드러내지 않게)
      var N = Game.DATA.narmi;
      $("award-bubble").innerHTML = candidates.length === 1 ? N.awardTipOne
        : fillVars(N.awardTip, { count: candidates.length });
    },

    // ===== 임시 결과 =====
    /** 5건을 모두 마친 뒤의 전체 결과 (엔딩 신문·칭호 이슈 전까지 쓰는 임시 화면). */
    renderResult: function (summary) {
      function markOf(j) {
        if (j.mistake) return { mark: "✘", cls: "is-wrong" };
        if (j.reasonCorrect === false) return { mark: "△", cls: "is-partial" };
        return { mark: "✔", cls: "is-right" };
      }

      // 표시·틀린 줄을 누르면 판정 복기 (data-project·data-bidder)
      function reviewAttrs(p, j) {
        return ' data-action="review" data-project="' + p.id + '" data-bidder="' + j.bidderId + '"';
      }

      var rows = summary.projects.map(function (p) {
        var marks = p.judgments.map(function (j) {
          var m = markOf(j);
          var tip = j.name + ": " + verdictText(j.verdict, j.reason) + " → 정답 " + verdictText(j.expectedVerdict, j.expectedReason);
          return '<button type="button" class="mark ' + m.cls + '"' + reviewAttrs(p, j) + ' title="' + esc(tip) +
            '" aria-label="' + esc(tip + " — 복기 보기") + '">' + m.mark + "</button>";
        }).join("");
        var wrong = p.judgments.filter(function (j) { return j.mistake || j.reasonCorrect === false; }).map(function (j) {
          return '<li class="' + markOf(j).cls + '"><button type="button" class="result-wrong-btn"' + reviewAttrs(p, j) + ">" +
            esc(j.name) + ": " + esc(verdictText(j.verdict, j.reason)) +
            " → 정답 " + esc(verdictText(j.expectedVerdict, j.expectedReason)) + ' <span class="review-go">복기 ›</span></button></li>';
        }).join("");
        var news = p.news ? esc(p.news.head)
          : (p.awardedId === null ? "유찰 — 다시 공고를 내야 해요" : "조건에 맞지 않는 업체 낙찰 — 감사 지적 예정");
        return "<tr><td><strong>" + esc(p.title) + "</strong>" + (wrong ? '<ul class="result-wrong">' + wrong + "</ul>" : "") + "</td>" +
          '<td class="marks">' + marks + "</td>" +
          "<td>" + esc(p.awardedName || "유찰") + "</td>" +
          '<td class="result-news">' + news + "</td></tr>";
      }).join("");

      $("result-table").innerHTML =
        '<table class="result-table"><thead><tr><th>사업</th><th>판정</th><th>낙찰</th><th>1년 후 뉴스 (미리보기)</th></tr></thead>' +
        "<tbody>" + rows + "</tbody></table>" +
        '<p class="result-legend">✔ 정답 · △ 부적격은 맞지만 사유가 다름 · ✘ 판정 실수(감사 지적) — <b>표시를 누르면 판정을 복기할 수 있어요</b></p>';

      var labels = Game.DATA.tagLabels;
      var tags = Object.keys(labels).map(function (t) {
        return '<li><span>' + esc(labels[t]) + "</span><b>" + (summary.tags[t] || 0) + "</b></li>";
      }).join("");
      $("result-side").innerHTML =
        '<div class="result-award"><span>감사 지적</span><strong>' + summary.mistakes + "회</strong>" +
        '<span class="result-hints">나르미 힌트 ' + summary.hintsUsed + "회 사용</span></div>" +
        '<div class="result-tags"><h3>내가 고른 가치</h3><ul>' + tags + "</ul></div>";
    },

    /**
     * 판정 복기 창 (engine.review 결과). pos: { index, total } — 이전/다음 업체 버튼 상태.
     * 근거 서류(형광펜) + 공고 조건표(비교 칸 형광펜) + 나르미 설명.
     */
    renderReview: function (r, pos) {
      var D = Game.DATA, R = D.narmi.review, reasons = D.reasons;
      var p = null;
      D.projects.forEach(function (x) { if (x.id === r.projectId) p = x; });
      var b = findIn(p, r.bidderId);
      var vars = Object.assign({}, r.vars, {
        name: r.expectedReason ? reasons[r.expectedReason].name : "",
        picked: r.picked ? reasons[r.picked].name : ""
      });

      var marks = {
        right: ["✔", "is-right", "정답"],
        partial: ["△", "is-partial", "사유가 달라요"],
        wrong: ["✘", "is-wrong", "판정 실수"],
        none: ["–", "", "판정 안 함"]
      };
      var m = marks[r.status];

      var msg;
      if (r.status === "none") msg = R.none;
      else if (r.expectedVerdict === "ok") msg = r.status === "right" ? R.okRight : R.okWrong;
      else msg = r.status === "wrong" ? R.rejectWrong : (r.status === "partial" ? R.partial : R.rejectRight);

      var explain = "";
      if (r.expectedReason) {
        var why = (R.explain && R.explain[r.expectedReason]) || D.narmi.hints[r.expectedReason];
        var reason = reasons[r.expectedReason];
        explain = '<p class="review-why">' + fillVars(why, vars) + "</p>" +
          '<p class="review-desc">' + esc(reason.desc) + "</p>" +
          '<p class="review-policy"><span>연결 정책</span>' + esc(reason.policy) + "</p>";
      }

      // 근거 서류가 없으면(서류에 문제없는 적격 업체) 견적서를 보여 준다
      var papers = r.papers.length ? r.papers : [{ bidderId: b.id, docKey: "quote", fields: [] }];
      var papersHtml = papers.map(function (pp) {
        return docHtml(p, findIn(p, pp.bidderId), pp.docKey, pp.fields);
      }).join("");

      $("review-body").innerHTML =
        '<header class="review-head">' +
          '<p class="review-project">' + esc(r.projectTitle) + "</p>" +
          "<h3>" + esc(r.name) + ' <span class="review-mark ' + m[1] + '">' + m[0] + " " + esc(m[2]) + "</span></h3>" +
          '<p class="review-verdicts"><span>내 판정 <b>' + esc(verdictText(r.verdict, r.picked)) + "</b></span>" +
          "<span>정답 <b>" + esc(verdictText(r.expectedVerdict, r.expectedReason)) + "</b></span></p>" +
        "</header>" +
        '<div class="review-grid">' +
          '<div class="review-papers' + (papers.length > 1 ? " is-pair" : "") + '">' + papersHtml + "</div>" +
          '<div class="review-side">' +
            '<section class="conditions review-conditions"><h3>공고 조건표</h3>' + rowsHtml(conditionsRows(p), r.condFields) + "</section>" +
            '<div class="review-narmi"><img src="assets/img/narmi_3d.png" alt="나르미">' +
              '<div class="bubble bubble-left"><p>' + fillVars(msg, vars) + "</p>" + explain + "</div></div>" +
          "</div>" +
        "</div>";

      $("review-pos").textContent = (pos.index + 1) + " / " + pos.total;
      $("review-prev").disabled = pos.index <= 0;
      $("review-next").disabled = pos.index >= pos.total - 1;
    },

    // ===== 엔딩 ① 1년 후 조달 뉴스 (GAME_SPEC 7.1) =====
    renderNews: function (ending) {
      var E = Game.DATA.ending;
      $("news-mast").innerHTML =
        '<div class="news-mast-top"><span>' + esc(E.paperDate) + "</span><span>" + esc(E.paperSlogan) + "</span></div>" +
        '<h1 class="news-name">' + esc(E.paperName) + "</h1>";

      function article(a, lead) {
        var cls = "news-article is-" + a.kind + (lead ? " is-lead" : "");
        return '<section class="' + cls + '">' +
          '<p class="news-kicker">' + esc(a.title) + "</p>" +
          '<h2 class="news-article-head">' + esc(a.head) + "</h2>" +
          '<p class="news-article-sub">' + esc(a.sub) + "</p>" +
          (a.correction ? '<p class="news-correction">' + esc(a.correction) + "</p>" : "") +
          "</section>";
      }

      var list = ending.articles;
      $("news-lead").innerHTML = list.length ? article(list[0], true) : "";
      $("news-grid").innerHTML = list.slice(1).map(function (a) { return article(a, false); }).join("");
    },

    // ===== 엔딩 ② 칭호 카드 (GAME_SPEC 7.2) =====
    renderEnding: function (ending) {
      var labels = Game.DATA.tagLabels;
      var max = 0;
      Object.keys(labels).forEach(function (t) { max = Math.max(max, ending.tags[t] || 0); });

      var bars = Object.keys(labels).map(function (t) {
        var v = ending.tags[t] || 0;
        var w = max ? Math.round(v / max * 100) : 0;
        return '<li><span class="bar-label">' + esc(labels[t]) + '</span>' +
          '<span class="bar"><i style="width:' + w + '%"></i></span><b>' + v + "</b></li>";
      }).join("");

      $("ending-card").innerHTML =
        '<p class="ending-game">달이의 조달 창구</p>' +
        '<p class="ending-label">1년 차 신입 조달관 달이의 칭호</p>' +
        '<h2 class="ending-title' + (ending.perfect ? " is-perfect" : "") + '">' + esc(ending.title) + "</h2>" +
        '<p class="ending-blurb">' + esc(ending.blurb) + "</p>" +
        '<div class="ending-stats">' +
          '<div><span>감사 지적</span><strong>' + ending.mistakes + "회</strong></div>" +
          '<div><span>나르미 힌트</span><strong>' + ending.hintsUsed + "회</strong></div>" +
        "</div>" +
        '<ul class="ending-bars">' + bars + "</ul>" +
        '<p class="ending-message">“' + esc(ending.finalMessage) + '”</p>' +
        '<img class="pps-symbol ending-symbol" src="assets/img/pps_symbol_h.jpg" alt="조달청">';
    }
  };
})();
