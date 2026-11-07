/*
 * 진입점: 초기화, 버튼 동작 연결, 화면 전환 흐름.
 * 흐름: 타이틀 → 공고 → 심사 데스크(업체 5곳) → 낙찰 → 임시 결과
 */
window.Game = window.Game || {};

(function () {
  var ui = Game.ui;
  var engine = Game.engine;

  // 화면 진행 상태 (판정 결과 자체는 engine.state에 있다)
  var view = null;
  var pendingReason = null;
  var busy = false;          // 도장 애니메이션 중 입력 막기

  function project() { return engine.currentProject(); }

  function startGame() {
    engine.reset();
    var errors = engine.validateData();
    if (errors.length) console.warn("[Game] 시나리오 데이터 검증 오류", errors);
    ui.renderNotice(project());
    ui.show("notice");
  }

  function enterBidder(index) {
    var p = project();
    view = {
      project: p,
      index: index,
      bidder: p.bidders[index],
      docKey: "application",
      compareWith: null,
      seen: p.bidders.slice(0, index),
      stamps: view ? view.stamps : {}
    };
    ui.renderDesk(view);
    ui.show("desk");
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
    view = null;
    ui.renderNotice(project());
    ui.show("notice");
  }

  function doJudge(verdict, reason) {
    if (busy) return;
    busy = true;
    engine.judge(view.bidder.id, verdict, reason);
    view.stamps[view.bidder.id] = verdict;
    ui.stamp(verdict, afterStamp);
  }

  function showResult() {
    ui.renderResult(engine.summary());
    ui.show("result");
  }

  function findSeen(id) {
    for (var i = 0; i < view.seen.length; i++) if (view.seen[i].id === id) return view.seen[i];
    return null;
  }

  // data-action 버튼 → 동작. 마우스·터치 모두 click으로 들어온다.
  var actions = {
    "start": startGame,

    "begin-review": function () {
      view = null;
      enterBidder(0);
    },

    "tab": function (el) {
      view.docKey = el.getAttribute("data-doc");
      if (view.docKey !== "quote") view.compareWith = null;
      ui.renderDesk(view);
    },

    "compare": function (el) {
      var other = findSeen(el.getAttribute("data-bidder"));
      view.compareWith = (view.compareWith && other && view.compareWith.id === other.id) ? null : other;
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

    "restart": function () { ui.show("title"); }
  };

  document.addEventListener("click", function (e) {
    var target = e.target.closest("[data-action]");
    if (!target || target.disabled) return;
    var fn = actions[target.getAttribute("data-action")];
    if (fn) fn(target);
  });

  window.addEventListener("resize", function () { ui.fitStage(); });

  ui.fitStage();
  ui.show("title");
})();
