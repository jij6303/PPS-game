/*
 * 진입점: 초기화, 버튼 동작 연결, 화면 전환 흐름.
 * 흐름: 타이틀 → 인트로 → [공고 → 심사 데스크(업체 5곳) → 낙찰] × 사업 5건 → 1년 후 뉴스 → 칭호
 */
window.Game = window.Game || {};

(function () {
  var ui = Game.ui;
  var engine = Game.engine;
  var sound = Game.sound;

  // 화면 진행 상태 (판정 결과 자체는 engine.state에 있다)
  var view = null;
  var pendingReason = null;
  var busy = false;          // 도장 애니메이션 중 입력 막기

  var introIndex = -1;       // 인트로 진행 중인 컷 (-1이면 인트로 아님)
  var tool = "move";         // 책상 표시 도구: "move" | "pen" | "marker" | "eraser" (업체가 바뀌어도 유지)

  function project() { return engine.currentProject(); }

  function startIntro() {
    introIndex = 0;
    ui.renderIntro(0);
    ui.show("intro");
  }

  function nextIntro() {
    if (introIndex < 0) return;
    introIndex++;
    if (introIndex >= Game.DATA.intro.length) {
      introIndex = -1;
      startGame();
      return;
    }
    ui.renderIntro(introIndex);
  }

  function startGame() {
    engine.reset();
    var errors = engine.validateData();
    if (errors.length) console.warn("[Game] 시나리오 데이터 검증 오류", errors);
    showOffice(true);
  }

  /** 업무 장소(사무실). 책상 위에 이번 사업 공고가 놓여 있고, 책상을 누르면 공고 → 심사. */
  var narmiTipIndex = 0;
  function showOffice(first) {
    view = null;
    ui.renderOffice(project(), first);
    ui.show("office");
  }

  function enterBidder(index) {
    var p = project();
    view = {
      project: p,
      index: index,
      bidder: p.bidders[index],
      docKey: "application",
      papers: [],              // 책상 위 서류 (새 업체가 오면 신청서 한 장부터)
      pane: "papers",          // 세로 화면에서 보이는 쪽: "papers"(서류) | "conditions"(조건표)
      marks: {},               // 펜·형광펜 표시 { 서류id: [선…] } — 새 업체가 오면 빈 책상
      seen: p.bidders.slice(0, index),
      stamps: view ? view.stamps : {}
    };
    openPaper(view.bidder.id, "application");
    ui.renderDesk(view);
    ui.show("desk");
    sound.play("enter", 0.1);   // 새 업체가 창구에 "띵동"
  }

  function afterStamp() {
    busy = false;
    var next = view.index + 1;
    if (next < project().bidders.length) {
      enterBidder(next);
      return;
    }
    var candidates = engine.awardCandidates();
    if (candidates.length) {
      ui.renderAward(project(), candidates);
      ui.show("award");
    } else {
      engine.award(null);   // 유찰
      nextProjectOrFinish();
    }
  }

  /** 다음 사업 공고로, 마지막 사업이면 전체 결과로. 판정 결과는 끝날 때까지 공개하지 않는다 (GAME_SPEC 4.2). */
  function nextProjectOrFinish() {
    engine.nextProject();
    if (engine.isFinished()) {
      showResult();
      return;
    }
    showOffice(false);   // 사무실로 돌아오면 다음 공고가 책상 위에
  }

  function doJudge(verdict, reason) {
    if (busy) return;
    busy = true;
    var record = engine.judge(view.bidder.id, verdict, reason);
    view.stamps[view.bidder.id] = verdict;
    ui.stamp(verdict, function () {
      // 부적격은 맞췄지만 사유가 틀렸으면 나르미가 진짜 사유를 알려 준다 (GAME_SPEC 4.2).
      // 적격/부적격 자체를 틀린 경우(감사 지적)는 끝날 때까지 알려 주지 않는다.
      if (record.verdictCorrect && record.reasonCorrect === false) {
        ui.showReasonFix(record.expectedReason);
        sound.play("pop");
        return;   // "알겠어요"를 누르면 afterStamp
      }
      afterStamp();
    });
  }

  /** 담합 힌트일 때, 앞서 본 업체 중 견적이 같은 곳이 있으면 바로 나란히 비교해 준다. */
  function colludingSeen() {
    var q = view.bidder.docs.quote;
    for (var i = 0; i < view.seen.length; i++) {
      var o = view.seen[i].docs.quote;
      if (o.unitPrice === q.unitPrice && o.note === q.note) return view.seen[i];
    }
    return null;
  }

  /** 5건이 끝나면 엔딩: 1년 후 조달 뉴스 → 칭호 카드 (GAME_SPEC 7장). */
  function showResult() {
    ui.renderNews(engine.ending());
    ui.show("news");
    sound.play("flip", 0.45);   // 낙찰 소리 뒤에 신문이 "촤악"
  }

  function findSeen(id) {
    for (var i = 0; i < view.seen.length; i++) if (view.seen[i].id === id) return view.seen[i];
    return null;
  }

  // ===== 책상 위 서류 (펼치기·겹치기·끌기, GAME_SPEC 8장) =====

  /*
   * 서류 놓는 자리. 가로 화면: 서류 폭 460 → 비교 견적서는 오른쪽 옆.
   * 세로 화면: 서류 폭 720(글씨를 크게) → 가로로 두 장이 안 들어가 비교 견적서는 아래.
   */
  function paperLayout() {
    return ui.portrait
      ? { stepX: 60, stepY: 70, compare: { x: 0, y: 600 } }
      : { stepX: 110, stepY: 44, compare: { x: 500, y: 0 } };   // 새 서류는 머리의 표식이 보이게 비켜 놓음
  }

  function paperId(bidderId, docKey) { return bidderId + ":" + docKey; }

  function findPaper(id) {
    for (var i = 0; i < view.papers.length; i++) if (view.papers[i].id === id) return i;
    return -1;
  }

  /** 맨 위 서류 중 지금 업체의 것 → 탭 강조·나르미 안내에 쓴다. */
  function syncTopDoc() {
    for (var i = view.papers.length - 1; i >= 0; i--) {
      if (view.papers[i].bidderId === view.bidder.id) { view.docKey = view.papers[i].docKey; return; }
    }
    view.docKey = null;
  }

  /** 서류를 맨 위로. 없으면 펼친다. pos를 주면 그 자리에, 아니면 조금씩 비켜서. */
  function openPaper(bidderId, docKey, pos) {
    var id = paperId(bidderId, docKey);
    var i = findPaper(id);
    var paper;
    if (i === -1) {
      var n = view.papers.filter(function (pp) { return pp.bidderId === view.bidder.id; }).length;
      paper = { id: id, bidderId: bidderId, docKey: docKey,
        x: pos ? pos.x : (n % 5) * paperLayout().stepX, y: pos ? pos.y : (n % 5) * paperLayout().stepY };
    } else {
      paper = view.papers.splice(i, 1)[0];
      if (pos) { paper.x = pos.x; paper.y = pos.y; }
    }
    view.papers.push(paper);
    syncTopDoc();
  }

  function closePaper(id) {
    var i = findPaper(id);
    if (i !== -1) view.papers.splice(i, 1);
    syncTopDoc();
  }

  // 끌기: 누르면 맨 위로(다시 그리지 않고 순서만), 다 옮기면 위치 저장
  ui.enablePaperDrag({
    front: function (id) {
      var i = findPaper(id);
      if (i === -1 || i === view.papers.length - 1) return;
      view.papers.push(view.papers.splice(i, 1)[0]);
      syncTopDoc();
      ui.restack(view);
    },
    moved: function (id, x, y) {
      var i = findPaper(id);
      if (i !== -1) { view.papers[i].x = x; view.papers[i].y = y; }
    }
  });

  // 펜·형광펜·지우개 (플레이어 메모 — 판정에는 영향 없음)
  ui.enablePaperDraw({
    tool: function () { return tool; },
    marks: function (id) { return view.marks[id] || (view.marks[id] = []); },
    changed: function (id) { ui.renderMarks(view, id); }
  });

  // data-action 버튼 → 동작. 마우스·터치 모두 click으로 들어온다.
  var actions = {
    "start": startIntro,
    "intro-next": nextIntro,
    "intro-skip": function () {
      introIndex = -1;
      startGame();
    },

    /** 사무실 책상 → 사업 공고 */
    "office-desk": function () {
      ui.renderNotice(project());
      ui.show("notice");
    },

    /** 사무실의 문·창문·나르미 → 말풍선 (나르미는 누를 때마다 다음 안내) */
    "office-spot": function (el) {
      var spot = el.getAttribute("data-spot");
      var S = Game.DATA.office.spots;
      var html;
      if (spot === "narmi") {
        html = S.narmi[narmiTipIndex % S.narmi.length];
        narmiTipIndex++;
      } else {
        html = S[spot];
      }
      ui.showOfficeTip(spot, html);
    },

    "begin-review": function () {
      view = null;
      enterBidder(0);
    },

    "hint": function () {
      if (busy || engine.hintsLeft() <= 0 || engine.hintOf(view.bidder.id)) return;
      var hint = engine.useHint(view.bidder.id);
      view.pane = "papers";      // 세로 화면: 형광펜이 보이게 서류 쪽으로
      if (hint.docKey) {
        if (hint.code === "COLLUSION" && colludingSeen()) {
          // 담합: 지금 업체 견적서와 같은 견적의 업체 견적서를 나란히
          openPaper(colludingSeen().id, "quote", paperLayout().compare);
          openPaper(view.bidder.id, "quote", { x: 0, y: 0 });
        } else {
          openPaper(view.bidder.id, hint.docKey);
        }
      }
      ui.renderDesk(view);
    },

    "show-title": function () {
      ui.renderEnding(engine.ending());
      ui.show("ending");
    },

    "show-record": function () {
      ui.renderResult(engine.summary());
      ui.show("result");
    },

    "back-to-ending": function () { ui.show("ending"); },

    "narmi-ok": function () {
      ui.closeNarmiModal();
      afterStamp();
    },

    "tab": function (el) {
      openPaper(view.bidder.id, el.getAttribute("data-doc"));
      ui.renderDesk(view);
    },

    /** 앞서 본 업체의 견적서를 오른쪽에 펼침 (다시 누르면 닫음) */
    "compare": function (el) {
      var other = findSeen(el.getAttribute("data-bidder"));
      if (!other) return;
      var id = paperId(other.id, "quote");
      if (findPaper(id) !== -1) {
        closePaper(id);
      } else {
        openPaper(other.id, "quote", paperLayout().compare);
        openPaper(view.bidder.id, "quote", { x: 0, y: 0 });   // 내 견적서도 왼쪽에 맨 위로
      }
      ui.renderDesk(view);
    },

    /** 세로 화면: 서류 ↔ 조건표 전환 */
    "pane": function (el) {
      view.pane = el.getAttribute("data-pane");
      ui.renderDesk(view);
    },

    /** 표시 도구 고르기 */
    "tool": function (el) {
      tool = el.getAttribute("data-tool");
      ui.setTool(tool);
    },

    /** 지금 업체 책상의 표시 모두 지우기 */
    "clear-marks": function () {
      view.marks = {};
      ui.renderMarks(view);
    },

    "close-paper": function (el) {
      closePaper(el.getAttribute("data-paper"));
      ui.renderDesk(view);
    },

    "stamp-ok": function () { doJudge("ok"); },

    "stamp-reject": function () {
      if (busy) return;
      pendingReason = null;
      ui.openReasons(engine.availableReasons(), null);
    },

    "pick-reason": function (el) {
      pendingReason = el.getAttribute("data-reason");
      ui.openReasons(engine.availableReasons(), pendingReason);
    },

    "cancel-reject": function () {
      pendingReason = null;
      ui.closeReasons();
    },

    "confirm-reject": function () {
      if (!pendingReason) return;
      ui.closeReasons();
      doJudge("reject", pendingReason);
      pendingReason = null;
    },

    "award": function (el) {
      engine.award(el.getAttribute("data-bidder"));
      nextProjectOrFinish();
    },

    "restart": function () { ui.show("title"); },

    "toggle-sound": function () {
      sound.setEnabled(!sound.enabled);
      ui.renderSoundButton(sound.enabled);
    }
  };

  /*
   * 버튼마다 나는 효과음. 도장("쾅")은 ui.stamp(), 업체 입장("띵동")은 enterBidder()에서 따로 낸다.
   * 판정 결과에 따라 소리가 달라지지 않는다 (GAME_SPEC 4.2).
   */
  var ACTION_SOUNDS = {
    "start": "click",
    "intro-next": "pop",
    "intro-skip": "click",
    "begin-review": "paper",
    "office-desk": "paper",
    "office-spot": "pop",
    "tab": "paper",
    "compare": "paper",
    "close-paper": "paper",
    "tool": "click",
    "clear-marks": "paper",
    "pane": "click",
    "stamp-reject": "click",
    "pick-reason": "click",
    "cancel-reject": "click",
    "hint": "hint",
    "narmi-ok": "click",
    "award": "success",
    "show-title": "fanfare",
    "show-record": "paper",
    "back-to-ending": "click",
    "restart": "click"
  };

  document.addEventListener("click", function (e) {
    sound.unlock();           // 브라우저 정책: 첫 클릭 뒤에야 소리 장치를 켤 수 있다
    var target = e.target.closest("[data-action]");
    if (!target || target.disabled) return;
    var name = target.getAttribute("data-action");
    var fn = actions[name];
    if (!fn) return;
    if (ACTION_SOUNDS[name]) sound.play(ACTION_SOUNDS[name]);
    fn(target);
  });

  // 인트로는 Enter·Space로도 넘길 수 있다 (시연영상 녹화용)
  document.addEventListener("keydown", function (e) {
    sound.unlock();
    if (introIndex >= 0 && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      sound.play("pop");
      nextIntro();
    }
  });

  window.addEventListener("resize", function () {
    var was = ui.portrait;
    ui.fitStage();
    // 화면을 돌리면 책상 크기·서류 폭이 바뀌니 서류를 책상 안으로 다시 맞춘다
    if (was !== ui.portrait && view && document.querySelector('[data-screen="desk"].is-active')) {
      ui.renderDesk(view);
      view.papers.forEach(function (pp) {
        var el = document.querySelector('.desk-paper[data-paper="' + pp.id + '"]');
        if (!el || !el.offsetParent) return;    // 조건표를 보는 중(서류가 숨겨짐)이면 그대로 둔다
        var pos = ui.clampPaper(el, pp.x, pp.y);
        pp.x = pos.x; pp.y = pos.y;
      });
      ui.renderDesk(view);
    }
  });

  ui.fitStage();
  ui.setTool(tool);
  ui.buildIntroRoom();
  ui.renderSoundButton(sound.enabled);
  ui.show("title");
})();
