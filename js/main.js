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

  /** 용어 카드를 열고, 새로 얻은 게 있으면 알림 */
  function unlockCards(ids) {
    var fresh = Game.glossary.unlock(ids);
    if (fresh.length) {
      ui.toast('<b>' + Game.DATA.glossary.got + "</b> " + fresh.map(function (e) { return e.name; }).join(" · "));
      sound.play("hint");
    }
  }
  /** 지금까지 진행에 맞는 카드 (처음 카드 + 소개된 사유 + 끝낸 사업 정책) — 이어하기·새 게임 때 */
  function syncCards() {
    unlockCards(Game.glossary.starterIds()
      .concat(engine.state.seenReasons.map(function (c) { return "reason-" + c; }))
      .concat(engine.state.done.map(function (id) { return "policy-" + id; })));
  }

  // ===== 이어하기 (GAME_SPEC 9장: localStorage는 try/catch, 실패해도 게임 진행) =====
  var SAVE_KEY = "pps-game-save";
  function readSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeSave() {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(engine.exportSave())); } catch (e) { /* 저장 못 해도 진행 */ }
  }
  function clearSave() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
  }
  /** 타이틀의 이어하기 버튼: 이어할 수 있는 저장이 있을 때만 */
  function showTitle() {
    var save = readSave();
    var ok = false, n = 0;
    if (save) {
      engine.reset();
      ok = engine.importSave(save);
      if (ok) n = engine.projectNumber();
      engine.reset();
      if (!ok) clearSave();    // 깨졌거나 시나리오가 바뀐 저장은 지움
    }
    ui.renderContinue(ok, n, Game.DATA.projects.length);
    ui.show("title");
  }

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
    noticeRead = {};
    syncCards();
    var errors = engine.validateData();
    if (errors.length) console.warn("[Game] 시나리오 데이터 검증 오류", errors);
    showOffice(true);
  }

  /** 업무 장소(사무실). 책상 위에 이번 사업 공고가 놓여 있고, 책상을 누르면 공고 → 심사. */
  var narmiTipIndex = 0;
  function showOffice(first) {
    view = null;
    ui.renderOffice(first);
    ui.show("office");
  }

  /** 컴퓨터 바탕화면 (사업 폴더 고르기) */
  var noticeRead = {};      // 공고문을 읽은 사업 (업체 폴더를 바로 열면 공고문부터 보여 줌)
  function showComputer() {
    ui.renderComputer();
    ui.show("computer");
    if (!tourSeen()) startTour();      // 처음 켰을 때만 자동으로 둘러보기
  }

  // ===== 바탕화면 둘러보기 (튜토리얼). 한 번 보면 이 브라우저에서는 자동으로 안 나온다 =====
  var TOUR_KEY = "pps-game-pc-tour";
  var tourIndex = -1;          // 진행 중인 단계 (-1이면 안 하는 중)
  var tourOpened = false;      // 둘러보기가 폴더를 열었는지 (끝나면 닫는다)
  var tourTimer = null;
  function tourSeen() {
    try { return window.localStorage.getItem(TOUR_KEY) === "1"; } catch (e) { return false; }
  }
  function startTour() {
    ui.closeFolder();
    tourOpened = false;
    tourIndex = -1;
    nextTour();
  }
  function nextTour() {
    var steps = Game.DATA.computer.tour.steps;
    clearTimeout(tourTimer);
    tourIndex++;
    if (tourIndex >= steps.length) { endTour(); return; }
    var step = steps[tourIndex];
    var winOpen = !$pcWindow().hidden;
    if (step.folder && !winOpen) {
      // 남은 첫 사업 폴더를 열어 보여 준다 (창이 뜨는 연출이 끝난 뒤 위치를 잰다)
      var p = Game.DATA.projects.filter(function (x) { return !engine.isDone(x.id); })[0];
      if (!p) { nextTour(); return; }
      ui.openFolder(p.id);
      tourOpened = true;
      ui.hideTour();
      tourTimer = setTimeout(function () { if (!ui.renderTour(tourIndex)) nextTour(); }, 260);
      return;
    }
    if (!step.folder && winOpen && tourOpened) { ui.closeFolder(); tourOpened = false; }
    if (!ui.renderTour(tourIndex)) nextTour();
  }
  function endTour() {
    clearTimeout(tourTimer);
    tourIndex = -1;
    ui.hideTour();
    if (tourOpened) ui.closeFolder();
    tourOpened = false;
    try { window.localStorage.setItem(TOUR_KEY, "1"); } catch (e) { /* 저장 못 해도 진행 */ }
  }
  function $pcWindow() { return document.getElementById("pc-window"); }

  function openNotice(projectId) {
    engine.selectProject(projectId);
    noticeRead[projectId] = true;
    ui.renderNotice(project());
    ui.show("notice");
    // 이 사업에서 처음 소개되는 사유 카드
    unlockCards(engine.newReasons().map(function (c) { return "reason-" + c; }));
  }

  function enterBidder(index) {
    var p = project();
    var bidders = engine.orderedBidders();   // 판마다 섞인 순서
    view = {
      project: p,
      bidders: bidders,
      index: index,
      bidder: bidders[index],
      docKey: "application",
      papers: [],              // 책상 위 서류 (새 업체가 오면 신청서 한 장부터)
      pane: "papers",          // 세로 화면에서 보이는 쪽: "papers"(서류) | "conditions"(조건표)
      // 펜·형광펜 표시 { 서류id: [선…] } — 새 업체가 오면 빈 책상. 공고 조건표 표시는 같은 사업 동안 남긴다.
      marks: { conditions: (view && view.marks.conditions) || [] },
      seen: bidders.slice(0, index),
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
    if (next < view.bidders.length) {
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
    var finished = project();
    engine.nextProject();
    unlockCards(["policy-" + finished.id]);   // 끝낸 사업의 정책 카드
    if (engine.isFinished()) {
      clearSave();       // 다 끝났으면 이어할 게 없음
      showResult();
      return;
    }
    writeSave();         // 사업 하나 끝낼 때마다 저장
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

  // 판정 복기: 심사 기록의 모든 업체를 차례로 넘겨 볼 수 있다
  var reviewList = [], reviewIndex = 0;
  function showReview() {
    var it = reviewList[reviewIndex];
    ui.renderReview(engine.review(it.projectId, it.bidderId), { index: reviewIndex, total: reviewList.length });
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
    /** 저장된 곳부터: 사무실로 (진행 중이던 사업은 처음부터) */
    "continue": function () {
      engine.reset();
      if (!engine.importSave(readSave())) { clearSave(); showTitle(); return; }
      noticeRead = {};
      syncCards();
      showOffice(false);
    },
    "intro-next": nextIntro,
    "intro-skip": function () {
      introIndex = -1;
      startGame();
    },

    /** 사무실 책상 위 컴퓨터 → 바탕화면 */
    "office-pc": showComputer,
    "pc-off": function () { endTour(); showOffice(false); },
    "tour-start": startTour,
    "tour-next": nextTour,
    "tour-skip": endTour,
    "open-folder": function (el) { ui.openFolder(el.getAttribute("data-project")); },
    "close-folder": function () { ui.closeFolder(); },
    "open-notice": function (el) { openNotice(el.getAttribute("data-project")); },
    /** 업체 폴더: 공고문을 읽었으면 바로 심사, 아니면 공고문부터 */
    "open-bidders": function (el) {
      var id = el.getAttribute("data-project");
      if (!noticeRead[id]) { openNotice(id); return; }
      engine.selectProject(id);
      view = null;
      enterBidder(0);
    },
    "back-to-pc": showComputer,

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

    /** 심사 기록의 판정 표시 → 판정 복기 창 */
    "review": function (el) {
      reviewList = [];
      engine.summary().projects.forEach(function (p) {
        p.judgments.forEach(function (j) { reviewList.push({ projectId: p.id, bidderId: j.bidderId }); });
      });
      reviewIndex = 0;
      for (var i = 0; i < reviewList.length; i++) {
        if (reviewList[i].projectId === el.getAttribute("data-project") &&
            reviewList[i].bidderId === el.getAttribute("data-bidder")) reviewIndex = i;
      }
      showReview();
      document.getElementById("review-modal").hidden = false;
    },
    "review-prev": function () { if (reviewIndex > 0) { reviewIndex--; showReview(); } },
    "review-next": function () { if (reviewIndex < reviewList.length - 1) { reviewIndex++; showReview(); } },
    "close-review": function () { document.getElementById("review-modal").hidden = true; },

    /** 칭호 카드를 PNG로 저장하고 미리보기를 띄운다 (GAME_SPEC 7.2 공유용) */
    "save-card": function (el) {
      if (el.disabled) return;
      el.disabled = true;
      Game.card.save(engine.ending()).then(function (r) {
        el.disabled = false;
        document.getElementById("card-preview-img").src = r.dataUrl;
        document.getElementById("card-modal").hidden = false;
      }, function (err) {
        el.disabled = false;
        console.warn("[Game] 칭호 카드 저장 실패", err);
      });
    },

    "close-card": function () { document.getElementById("card-modal").hidden = true; },

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

    "restart": showTitle,

    "glossary": function () { ui.openGlossary(); },
    "glossary-pick": function (el) { ui.renderGlossary(el.getAttribute("data-entry")); },
    "close-glossary": function () { ui.closeGlossary(); },

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
    "continue": "click",
    "intro-next": "pop",
    "intro-skip": "click",
    "begin-review": "paper",
    "office-pc": "click",
    "pc-off": "click",
    "tour-start": "pop",
    "tour-next": "pop",
    "tour-skip": "click",
    "open-folder": "paper",
    "close-folder": "click",
    "open-notice": "paper",
    "open-bidders": "paper",
    "back-to-pc": "click",
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
    "review": "paper",
    "review-prev": "paper",
    "review-next": "paper",
    "close-review": "click",
    "save-card": "paper",
    "close-card": "click",
    "glossary": "paper",
    "glossary-pick": "pop",
    "close-glossary": "click",
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
    if (tourIndex >= 0) ui.renderTour(tourIndex);
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
  showTitle();
})();
