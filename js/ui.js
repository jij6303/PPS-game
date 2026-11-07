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

  /** "사업 2/5" 같은 진행 표시. */
  function projectNo() {
    return (Game.engine.state.projectIndex + 1) + "/" + Game.engine.data.projects.length;
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
      body = rowsHtml(rows, hl);
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

  function findIn(project, bidderId) {
    for (var i = 0; i < project.bidders.length; i++) if (project.bidders[i].id === bidderId) return project.bidders[i];
    return null;
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
      ["예산 상한", won(project.budgetMax)],
      ["필수 인증", project.requiredCerts.join(", ") || "없음"],
      ["입찰 마감", project.deadline],
      ["요구 사양", spec.join(" · ")]
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
      $("intro-dali").classList.toggle("is-speaking", cut.speaker === "dali");
      $("intro-narmi").classList.toggle("is-speaking", cut.speaker === "narmi");
      $("intro-narmi").classList.toggle("is-present", index > 0);   // 나르미는 2컷부터 등장
      $("intro-dots").innerHTML = cuts.map(function (c, i) {
        return '<li class="' + (i === index ? "is-on" : (i < index ? "is-done" : "")) + '"></li>';
      }).join("");
    },

    // ===== ① 공고 =====
    renderNotice: function (project) {
      $("notice-card").innerHTML =
        '<p class="notice-badge">입찰 공고 · 사업 ' + projectNo() + "</p>" +
        '<h2 class="notice-title">' + esc(project.title) + "</h2>" +
        rowsHtml(conditionsRows(project)) +
        '<div class="notice-foot"><span>공정하고 투명한 조달</span>' +
        '<img class="pps-symbol" src="assets/img/pps_symbol_h.jpg" alt="조달청"></div>';
      var first = Game.engine.state.projectIndex === 0;
      $("notice-bubble").innerHTML = (first ? "첫 사업 공고가 도착했어요! " : "다음 사업 공고예요! ") +
        "업체 <b>" + project.bidders.length + "곳</b>이 입찰했대요. 조건을 잘 기억해 두세요.";

      // 나르미 안내는 심사 전에만: 새 확인 사항이 생긴 사업이면 그 설명(GAME_SPEC 5.3), 첫 사업이면 조작 방법
      var code = Game.engine.newReason();
      var parts = [];
      if (first) parts.push(Game.DATA.narmi.howTo);
      if (code) parts.push(fill(Game.DATA.narmi.newReason, Game.DATA.reasons[code]));
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
      $("desk-progress").innerHTML = p.bidders.map(function (x, i) {
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
      void mark.offsetWidth;            // 애니메이션 재시작
      mark.classList.add("is-on");
      // 도장이 종이에 닿는 순간(애니메이션 25% ≈ 0.22초)에 "쾅" — 적격/부적격 같은 소리
      if (Game.sound) Game.sound.play("stamp", 0.2);
      setTimeout(function () {
        mark.className = "stamp-mark";
        done();
      }, 900);
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
      $("award-bubble").textContent = Game.DATA.narmi.awardTip;
    },

    // ===== 임시 결과 =====
    /** 5건을 모두 마친 뒤의 전체 결과 (엔딩 신문·칭호 이슈 전까지 쓰는 임시 화면). */
    renderResult: function (summary) {
      var reasons = Game.DATA.reasons;

      function verdictText(v, reason) {
        if (v === "ok") return "적격";
        return "부적격" + (reason ? "(" + reasons[reason].name + ")" : "");
      }

      function markOf(j) {
        if (j.mistake) return { mark: "✘", cls: "is-wrong" };
        if (j.reasonCorrect === false) return { mark: "△", cls: "is-partial" };
        return { mark: "✔", cls: "is-right" };
      }

      var rows = summary.projects.map(function (p) {
        var marks = p.judgments.map(function (j) {
          var m = markOf(j);
          var tip = j.name + ": " + verdictText(j.verdict, j.reason) + " → 정답 " + verdictText(j.expectedVerdict, j.expectedReason);
          return '<span class="mark ' + m.cls + '" title="' + esc(tip) + '">' + m.mark + "</span>";
        }).join("");
        var wrong = p.judgments.filter(function (j) { return j.mistake || j.reasonCorrect === false; }).map(function (j) {
          return '<li class="' + markOf(j).cls + '">' + esc(j.name) + ": " + esc(verdictText(j.verdict, j.reason)) +
            " → 정답 " + esc(verdictText(j.expectedVerdict, j.expectedReason)) + "</li>";
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
        '<p class="result-legend">✔ 정답 · △ 부적격은 맞지만 사유가 다름 · ✘ 판정 실수(감사 지적)</p>';

      var labels = Game.DATA.tagLabels;
      var tags = Object.keys(labels).map(function (t) {
        return '<li><span>' + esc(labels[t]) + "</span><b>" + (summary.tags[t] || 0) + "</b></li>";
      }).join("");
      $("result-side").innerHTML =
        '<div class="result-award"><span>감사 지적</span><strong>' + summary.mistakes + "회</strong>" +
        '<span class="result-hints">나르미 힌트 ' + summary.hintsUsed + "회 사용</span></div>" +
        '<div class="result-tags"><h3>내가 고른 가치</h3><ul>' + tags + "</ul></div>";
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
