/*
 * 화면 렌더링, 화면 전환, 무대 스케일.
 * 게임 상태는 바꾸지 않는다 — 판정·낙찰은 main.js가 Game.engine을 통해 처리하고, 여기서는 그리기만 한다.
 */
window.Game = window.Game || {};

(function () {
  var DOC_TABS = [
    { key: "application", label: "입찰참가 신청서" },
    { key: "quote", label: "견적서" },
    { key: "certs", label: "인증서" },
    { key: "spec", label: "제품 사양서" },
    { key: "status", label: "업체 현황" }
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

  function repIcon(bidder) {
    return '<div class="rep-icon">' + esc(bidder.name.charAt(0)) + "</div>";
  }

  /** 서류 한 장의 HTML. hl: 형광펜 칠할 항목 키 목록 (힌트가 없으면 빈 배열). */
  function docHtml(project, bidder, key, hl) {
    var d = bidder.docs;
    var labels = Game.DATA.specLabels;
    var title = "";
    var body = "";
    hl = hl || [];

    for (var i = 0; i < DOC_TABS.length; i++) if (DOC_TABS[i].key === key) title = DOC_TABS[i].label;

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
    return '<article class="paper' + (whole ? " is-hl" : "") + '">' +
      '<header class="paper-head"><span class="paper-title">' + esc(title) + "</span>" +
      '<span class="paper-company">' + esc(bidder.name) + "</span></header>" +
      body + "</article>";
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
    DOC_TABS: DOC_TABS,

    /** 창 크기에 맞춰 1920×1080 무대를 비율 유지(레터박스)로 스케일한다. */
    fitStage: function () {
      var scale = Math.min(window.innerWidth / this.STAGE_W, window.innerHeight / this.STAGE_H);
      $("stage").style.setProperty("--stage-scale", scale);
    },

    /** data-screen 이름으로 화면을 전환한다. */
    show: function (name) {
      var screens = document.querySelectorAll(".screen");
      for (var i = 0; i < screens.length; i++) {
        screens[i].classList.toggle("is-active", screens[i].getAttribute("data-screen") === name);
      }
    },

    // ===== ① 공고 =====
    renderNotice: function (project) {
      $("notice-card").innerHTML =
        '<p class="notice-badge">입찰 공고 · 사업 ' + projectNo() + "</p>" +
        '<h2 class="notice-title">' + esc(project.title) + "</h2>" +
        rowsHtml(conditionsRows(project)) +
        '<p class="notice-foot">조달청 · 공정하고 투명한 조달</p>';
      var first = Game.engine.state.projectIndex === 0;
      $("notice-bubble").innerHTML = (first ? "첫 사업 공고가 도착했어요! " : "다음 사업 공고예요! ") +
        "업체 <b>" + project.bidders.length + "곳</b>이 입찰했대요. 조건을 잘 기억해 두세요.";
    },

    // ===== ②~④ 심사 데스크 =====
    /**
     * view: { project, bidder, index, docKey, compareWith(업체|null), seen(앞서 본 업체들), stamps({id: verdict}) }
     */
    renderDesk: function (view) {
      var p = view.project, b = view.bidder;

      $("desk-title").innerHTML = '<span class="desk-no">사업 ' + projectNo() + "</span>" + esc(p.title);
      $("desk-progress").innerHTML = p.bidders.map(function (x, i) {
        var cls = i === view.index ? "is-current" : (view.stamps[x.id] ? "is-" + view.stamps[x.id] : "");
        return '<li class="' + cls + '">' + (i + 1) + "</li>";
      }).join("");

      $("rep").innerHTML = repIcon(b) + '<div class="rep-name">' + esc(b.name) + " 대표</div>";
      $("rep-bubble").textContent = b.pitch;

      $("doc-tabs").innerHTML = DOC_TABS.map(function (t) {
        return '<button type="button" class="doc-tab' + (t.key === view.docKey ? " is-active" : "") +
          '" data-action="tab" data-doc="' + t.key + '">' + esc(t.label) + "</button>";
      }).join("");

      var area = "";
      if (view.docKey === "quote" && view.seen.length) {
        area += '<div class="compare-bar"><span>견적서 비교</span>' + view.seen.map(function (s) {
          var on = view.compareWith && view.compareWith.id === s.id;
          return '<button type="button" class="chip' + (on ? " is-active" : "") +
            '" data-action="compare" data-bidder="' + s.id + '">' + esc(s.name) + "</button>";
        }).join("") + "</div>";
      }
      // 나르미 힌트: 지금 업체에 쓴 힌트가 있으면 해당 서류의 근거 항목에 형광펜
      var hint = Game.engine.hintOf(b.id);
      var hl = hint && hint.docKey === view.docKey ? hint.fields : [];

      if (view.docKey === "quote" && view.compareWith) {
        area += '<div class="paper-pair">' + docHtml(p, b, "quote", hl) + docHtml(p, view.compareWith, "quote", hl) + "</div>";
      } else {
        area += docHtml(p, b, view.docKey, hl);
      }
      $("doc-area").innerHTML = area;

      $("conditions").innerHTML = '<h3>공고 조건표</h3>' + rowsHtml(conditionsRows(p));

      var reasons = Game.DATA.reasons;
      var narmi = Game.DATA.narmi;
      var newCode = view.index === 0 ? Game.engine.newReason() : null;
      var tip;
      if (hint) tip = fillVars(narmi.hints[hint.code || "none"], hint.vars);
      else if (newCode) tip = fill(narmi.newReason, reasons[newCode]);
      else tip = esc(view.docKey === "quote" && view.seen.length ? narmi.compareTip : narmi.deskTip);
      $("narmi-bubble").innerHTML = tip;

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
      mark.textContent = verdict === "ok" ? "적격" : "부적격";
      mark.className = "stamp-mark is-" + verdict;
      void mark.offsetWidth;            // 애니메이션 재시작
      mark.classList.add("is-on");
      setTimeout(function () {
        mark.className = "stamp-mark";
        done();
      }, 900);
    },

    // ===== ⑤ 낙찰 =====
    renderAward: function (project, candidates) {
      $("award-dilemma").textContent = project.dilemma || "";
      $("award-cards").innerHTML = candidates.map(function (b) {
        var d = b.docs;
        return '<article class="award-card">' +
          '<div class="award-head">' + repIcon(b) + '<h3>' + esc(b.name) + "</h3></div>" +
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
    }
  };
})();
