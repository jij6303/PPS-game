/*
 * 게임 엔진: 상태 관리, 판정 로직, 점수/태그 누적.
 * 화면(DOM)에는 손대지 않는다. 시나리오 데이터는 Game.DATA(js/data.js)에서만 읽는다.
 *
 * 사업 1건의 흐름 (GAME_SPEC 4장)
 *   reset() → selectProject(id) → judge(...) × 업체 수 → awardCandidates() → award(id) → nextProject()
 *   사업은 아무 순서로나 고를 수 있다 (컴퓨터 바탕화면의 폴더). selectProject를 안 부르면 남은 사업 중 첫 번째.
 *   모든 사업이 끝나면 isFinished() === true, summary()로 결과를 받는다.
 */
window.Game = window.Game || {};

(function () {
  // ===== 서류 자동 검사 ======================================================

  function uniq(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (out.indexOf(list[i]) === -1) out.push(list[i]);
    }
    return out;
  }

  function findCert(docs, type) {
    var certs = docs.certs || [];
    for (var i = 0; i < certs.length; i++) {
      if (certs[i].type === type) return certs[i];
    }
    return null;
  }

  /** 두 업체의 견적이 담합으로 보일 만큼 같은가 (단가와 비고 문구가 모두 동일). */
  function quotesCollude(a, b) {
    var qa = a.docs.quote, qb = b.docs.quote;
    return qa.unitPrice === qb.unitPrice && qa.note === qb.note;
  }

  /**
   * 서류만 보고 찾을 수 있는 문제 코드 목록을 돌려준다 (GAME_SPEC 5.1·5.2).
   * 정답 데이터(verdict/reason)는 보지 않는다 — 나르미 힌트와 데이터 검증에 같이 쓴다.
   */
  function inspect(project, bidder) {
    var d = bidder.docs;
    var issues = [];
    var i;

    // 예산 초과: 견적 총액 > 예산 상한
    if (d.quote.total > project.budgetMax) issues.push("OVER_BUDGET");

    // 마감 후 제출: 날짜는 YYYY-MM-DD 문자열이라 사전순 비교가 곧 날짜 비교
    if (d.application.submitDate > project.deadline) issues.push("LATE");

    // 필수 인증 누락 / 만료 (마감일 전에 유효기간이 끝났으면 만료)
    for (i = 0; i < project.requiredCerts.length; i++) {
      var cert = findCert(d, project.requiredCerts[i]);
      if (!cert) issues.push("CERT_MISSING");
      else if (cert.validUntil < project.deadline) issues.push("CERT_EXPIRED");
    }

    // 요구 사양 불일치
    var req = project.requiredSpec || {};
    for (var key in req) {
      if (Object.prototype.hasOwnProperty.call(req, key) && d.spec[key] !== req[key]) {
        issues.push("SPEC_MISMATCH");
        break;
      }
    }

    // 서류 간 정보 불일치: 사업자번호·업체명이 서류마다 같아야 한다
    var bizNos = [d.application.bizNo, d.quote.bizNo, d.status.bizNo];
    for (i = 0; i < (d.certs || []).length; i++) bizNos.push(d.certs[i].bizNo);
    if (uniq(bizNos).length > 1 || d.application.company !== d.quote.company) {
      issues.push("INFO_MISMATCH");
    }

    // 담합 의심: 같은 사업의 다른 업체와 견적이 같음
    for (i = 0; i < project.bidders.length; i++) {
      var other = project.bidders[i];
      if (other.id !== bidder.id && quotesCollude(bidder, other)) {
        issues.push("COLLUSION");
        break;
      }
    }

    // 실체 없는 업체: 사무실·공장이 모두 없거나 직원이 1명 이하
    var s = d.status;
    if ((!s.hasOffice && !s.hasFactory) || s.employees <= 1) issues.push("BROKER");

    // 중대재해 이력
    if (s.seriousAccidents > 0) issues.push("SAFETY");

    return uniq(issues);
  }

  // ===== 힌트: 문제의 근거가 서류 어디에 있는지 =================================

  var DOC_NAMES = { quote: "견적서", certs: "인증서", status: "업체 현황" };

  /* 판정 복기: 사유마다 확인할 서류(근거를 못 찾을 때·적격 업체를 반려했을 때)와 공고 조건표에서 비교할 칸 */
  var REASON_DOC = {
    OVER_BUDGET: "quote", LATE: "application", CERT_MISSING: "certs", CERT_EXPIRED: "certs",
    SPEC_MISMATCH: "spec", INFO_MISMATCH: "application", COLLUSION: "quote", BROKER: "status", SAFETY: "status"
  };
  var COND_FIELDS = {
    OVER_BUDGET: ["cond.budget"], LATE: ["cond.deadline"], CERT_MISSING: ["cond.certs"],
    CERT_EXPIRED: ["cond.certs", "cond.deadline"], SPEC_MISMATCH: ["cond.spec"]
  };

  /**
   * 문제 코드 하나의 근거 위치를 찾는다 (GAME_SPEC 5.3 형광펜 표시용).
   * docKey: 펼칠 서류 탭, fields: 형광펜 칠할 항목("quote.total", "certs.0.validUntil" …),
   * vars: 나르미 문구에 넣을 값.
   */
  function locate(project, bidder, code) {
    var d = bidder.docs;
    var i;

    switch (code) {
      case "OVER_BUDGET":
        return { docKey: "quote", fields: ["quote.total"], vars: { budget: project.budgetMax.toLocaleString("ko-KR") + "원" } };

      case "LATE":
        return { docKey: "application", fields: ["application.submitDate"], vars: { deadline: project.deadline } };

      case "CERT_MISSING":
      case "CERT_EXPIRED":
        for (i = 0; i < project.requiredCerts.length; i++) {
          var type = project.requiredCerts[i];
          var idx = -1;
          for (var j = 0; j < (d.certs || []).length; j++) if (d.certs[j].type === type) idx = j;
          if (code === "CERT_MISSING" && idx === -1) {
            return { docKey: "certs", fields: ["certs"], vars: { cert: type } };
          }
          if (code === "CERT_EXPIRED" && idx !== -1 && d.certs[idx].validUntil < project.deadline) {
            return { docKey: "certs", fields: ["certs." + idx + ".validUntil"], vars: { cert: type, deadline: project.deadline } };
          }
        }
        break;

      case "SPEC_MISMATCH":
        for (var key in project.requiredSpec) {
          if (Object.prototype.hasOwnProperty.call(project.requiredSpec, key) && d.spec[key] !== project.requiredSpec[key]) {
            return { docKey: "spec", fields: ["spec." + key], vars: { spec: (Game.DATA.specLabels || {})[key] || key } };
          }
        }
        break;

      case "INFO_MISMATCH":
        var base = d.application.bizNo;
        if (d.quote.bizNo !== base || d.quote.company !== d.application.company) {
          return { docKey: "quote", fields: d.quote.bizNo !== base ? ["quote.bizNo"] : ["quote.company"], vars: { doc: DOC_NAMES.quote } };
        }
        for (i = 0; i < (d.certs || []).length; i++) {
          if (d.certs[i].bizNo !== base) return { docKey: "certs", fields: ["certs." + i + ".bizNo"], vars: { doc: DOC_NAMES.certs } };
        }
        if (d.status.bizNo !== base) return { docKey: "status", fields: ["status.bizNo"], vars: { doc: DOC_NAMES.status } };
        break;

      case "COLLUSION":
        return { docKey: "quote", fields: ["quote.unitPrice", "quote.note"], vars: {} };

      case "BROKER":
        return { docKey: "status", fields: ["status.hasOffice", "status.hasFactory", "status.employees"], vars: {} };

      case "SAFETY":
        return { docKey: "status", fields: ["status.seriousAccidents"], vars: {} };
    }
    return null;
  }

  /**
   * 업체 하나에 대한 힌트. 정답 사유의 근거를 먼저 보여 주고,
   * 없으면 지금 쓸 수 있는 다른 문제, 문제가 없으면 code: null("수상한 곳 없음").
   */
  function hintFor(project, bidder, available) {
    var issues = inspect(project, bidder).filter(function (c) { return available.indexOf(c) !== -1; });
    if (bidder.reason && issues.indexOf(bidder.reason) !== -1) {
      issues.splice(issues.indexOf(bidder.reason), 1);
      issues.unshift(bidder.reason);
    }
    for (var i = 0; i < issues.length; i++) {
      var spot = locate(project, bidder, issues[i]);
      if (spot) return { code: issues[i], docKey: spot.docKey, fields: spot.fields, vars: spot.vars };
    }
    return { code: null, docKey: null, fields: [], vars: {} };
  }

  /**
   * 업체가 창구에 오는 순서를 섞는다 (판마다 다르게).
   * 단, 담합 업체는 담합 상대보다 뒤에 와야 한다 — 앞서 본 견적서와 나란히 비교해야 찾을 수 있으므로.
   */
  function shuffledOrder(project, random) {
    var ids = project.bidders.map(function (b) { return b.id; });
    function valid(order) {
      return project.bidders.every(function (b) {
        return !b.collusionWith || order.indexOf(b.collusionWith) < order.indexOf(b.id);
      });
    }
    for (var t = 0; t < 50; t++) {
      var order = ids.slice();
      for (var i = order.length - 1; i > 0; i--) {
        var k = Math.floor(random() * (i + 1));
        var tmp = order[i]; order[i] = order[k]; order[k] = tmp;
      }
      if (valid(order)) return order;
    }
    return ids;   // 못 찾으면 데이터 순서 (데이터 순서는 항상 조건을 만족)
  }

  /** 이 사업의 부적격 업체들이 쓰는 사유 중 기본 사유가 아닌 것 (사업을 처음 열 때 나르미가 소개). */
  function projectReasons(project, starting) {
    var codes = [];
    project.bidders.forEach(function (b) {
      if (b.verdict === "reject" && b.reason && starting.indexOf(b.reason) === -1 && codes.indexOf(b.reason) === -1) {
        codes.push(b.reason);
      }
    });
    return codes;
  }

  var SAVE_VERSION = 1;   // 저장 형식이 바뀌면 올린다 (옛 저장은 무시)

  // ===== 데이터 검증 =========================================================

  /**
   * 시나리오 데이터가 "정답이 있는 퍼즐"인지 검사한다 (GAME_SPEC 4.1).
   * 오류 메시지 배열을 돌려준다. 빈 배열이면 통과.
   */
  function validateData(data) {
    var errors = [];
    var reasonCodes = Object.keys(data.reasons);

    function err(where, msg) { errors.push(where + ": " + msg); }

    (data.startingReasons || []).forEach(function (code) {
      if (reasonCodes.indexOf(code) === -1) err("startingReasons", "알 수 없는 사유 " + code);
    });

    var projectIds = data.projects.map(function (p) { return p.id; });
    if (uniq(projectIds).length !== projectIds.length) err("projects", "사업 id 중복");

    data.projects.forEach(function (p) {
      var where = "사업 " + p.id;
      var ids = p.bidders.map(function (b) { return b.id; });
      var okCount = 0;

      if (uniq(ids).length !== ids.length) err(where, "업체 id 중복");

      p.bidders.forEach(function (b) {
        var bw = where + " / " + b.name + "(" + b.id + ")";
        var issues = inspect(p, b);
        var q = b.docs.quote;

        if (q.unitPrice * q.qty !== q.total) err(bw, "견적 단가×수량이 총액과 다름");
        if (q.qty !== p.qty) err(bw, "견적 수량이 공고 수량과 다름");

        if (b.verdict === "ok") {
          okCount++;
          if (issues.length) err(bw, "적격 업체인데 서류에서 문제 발견: " + issues.join(", "));
          if (!b.tag) err(bw, "적격 업체에 성향 태그(tag)가 없음");
          if (!p.news || !p.news[b.id]) err(bw, "적격 업체의 뉴스 문구가 없음");
        } else if (b.verdict === "reject") {
          if (reasonCodes.indexOf(b.reason) === -1) err(bw, "알 수 없는 사유 " + b.reason);
          else if (!locate(p, b, b.reason)) err(bw, "정답 사유 " + b.reason + "의 근거 위치를 힌트로 찾을 수 없음");
          else if (issues.indexOf(b.reason) === -1) {
            err(bw, "정답 사유 " + b.reason + "의 근거가 서류에 없음 (발견: " + (issues.join(", ") || "없음") + ")");
          }
          if (b.reason === "COLLUSION" && ids.indexOf(b.collusionWith) === -1) {
            err(bw, "담합 상대 collusionWith가 없음");
          }
        } else {
          err(bw, "verdict는 ok 또는 reject여야 함");
        }
      });

      if (okCount < 1) err(where, "적격 업체가 없음");
    });

    return errors;
  }

  // ===== 게임 상태 ===========================================================

  function findBidder(project, bidderId) {
    for (var i = 0; i < project.bidders.length; i++) {
      if (project.bidders[i].id === bidderId) return project.bidders[i];
    }
    return null;
  }

  Game.engine = {
    state: null,

    inspect: inspect,
    locate: locate,
    hintFor: hintFor,
    validateData: function (data) { return validateData(data || Game.DATA); },

    /** 새 게임을 시작한다. data를 넘기면 그 데이터로(테스트용), 아니면 Game.DATA로. */
    reset: function (data) {
      this.data = data || Game.DATA;
      this.state = {
        projectIndex: 0,  // 지금 고른 사업 (data.projects 위치). 다 끝나면 projects.length
        done: [],         // 끝낸 사업 id (끝낸 순서)
        seenReasons: [],  // 끝낸 사업에서 이미 소개된 사유 (기본 사유 제외)
        bidderOrder: {},  // { projectId: [업체 id…] } — 창구에 오는 순서, 사업을 처음 열 때 섞음
        judgments: {},   // { projectId: { bidderId: 판정 기록 } }
        awards: {},      // { projectId: bidderId | null(유찰) }
        tags: {},        // { tag: 점수 }
        mistakes: 0,     // 감사 지적 = 판정 실수 (GAME_SPEC 4.2). 엔딩 뉴스·칭호에 반영
        hints: {}        // { projectId: { bidderId: 힌트 } } — 사업당 hintsPerProject회
      };
      return this.state;
    },

    /** 이 사업에서 남은 힌트 횟수 (GAME_SPEC 5.3). */
    hintsLeft: function () {
      var p = this.currentProject();
      if (!p) return 0;
      var used = Object.keys(this.state.hints[p.id] || {}).length;
      return Math.max(0, (this.data.hintsPerProject || 0) - used);
    },

    /** 이미 받은 힌트 (없으면 null). */
    hintOf: function (bidderId) {
      var p = this.currentProject();
      var h = p && this.state.hints[p.id];
      return (h && h[bidderId]) || null;
    },

    /**
     * 힌트를 쓴다. 같은 업체에 다시 쓰면 횟수를 차감하지 않고 같은 힌트를 돌려준다.
     * 돌려주는 값: { code(문제 코드|null), docKey, fields, vars }
     */
    useHint: function (bidderId) {
      var p = this.currentProject();
      if (!p) throw new Error("진행 중인 사업이 없습니다.");
      var b = findBidder(p, bidderId);
      if (!b) throw new Error("업체를 찾을 수 없습니다: " + bidderId);
      var cached = this.hintOf(bidderId);
      if (cached) return cached;
      if (this.hintsLeft() <= 0) throw new Error("이 사업의 힌트를 모두 썼습니다.");

      var hint = hintFor(p, b, this.availableReasons());
      if (!this.state.hints[p.id]) this.state.hints[p.id] = {};
      this.state.hints[p.id][b.id] = hint;
      return hint;
    },

    currentProject: function () {
      return this.data.projects[this.state.projectIndex] || null;
    },

    /** 업체를 창구에 오는 순서대로 (판마다 섞인 순서). projectId를 안 주면 지금 사업. */
    orderedBidders: function (projectId) {
      var p = projectId ? null : this.currentProject();
      if (projectId) this.data.projects.forEach(function (x) { if (x.id === projectId) p = x; });
      if (!p) return [];
      var order = this.state.bidderOrder[p.id];
      if (!order) order = this.state.bidderOrder[p.id] = shuffledOrder(p, this.random || Math.random);
      return order.map(function (id) { return findBidder(p, id); });
    },

    isFinished: function () {
      return this.state.done.length >= this.data.projects.length;
    },

    isDone: function (projectId) {
      return this.state.done.indexOf(projectId) !== -1;
    },

    /** 몇 번째로 하는 사업인지 (1부터). 화면의 "사업 n/5" 표시용. */
    projectNumber: function () {
      return Math.min(this.state.done.length + 1, this.data.projects.length);
    },

    /** 심사를 시작했지만(판정 1곳 이상) 아직 안 끝낸 사업 id. 없으면 null. 이 사업을 끝내기 전엔 다른 사업을 못 고른다. */
    activeProjectId: function () {
      var cur = this.currentProject();
      if (!cur || this.isDone(cur.id)) return null;
      return Object.keys(this.judgmentsOf(cur.id)).length ? cur.id : null;
    },

    /**
     * 할 사업을 고른다 (바탕화면 폴더). 끝낸 사업이나, 심사를 시작한 다른 사업이 있으면 고를 수 없다.
     */
    selectProject: function (projectId) {
      var idx = -1;
      for (var i = 0; i < this.data.projects.length; i++) if (this.data.projects[i].id === projectId) idx = i;
      if (idx === -1) throw new Error("사업을 찾을 수 없습니다: " + projectId);
      if (this.isDone(projectId)) throw new Error("이미 끝낸 사업입니다: " + projectId);
      var active = this.activeProjectId();
      if (active && active !== projectId) {
        throw new Error("심사 중인 사업을 먼저 끝내야 합니다: " + active);
      }
      this.state.projectIndex = idx;
      return this.currentProject();
    },

    /** 지금 쓸 수 있는 부적격 사유 코드 (도장 선택지): 기본 + 끝낸 사업에서 소개된 것 + 이 사업에 필요한 것. */
    availableReasons: function () {
      var codes = (this.data.startingReasons || []).slice();
      this.state.seenReasons.concat(this.newReasons()).forEach(function (c) {
        if (codes.indexOf(c) === -1) codes.push(c);
      });
      return codes;
    },

    /** 이 사업에서 처음 보는 사유들 (나르미 자동 설명용). 어떤 순서로 사업을 골라도 처음 만날 때 소개된다. */
    newReasons: function () {
      var p = this.currentProject();
      if (!p) return [];
      var seen = this.state.seenReasons;
      return projectReasons(p, this.data.startingReasons || []).filter(function (c) { return seen.indexOf(c) === -1; });
    },

    /** newReasons의 첫 번째 (없으면 null). */
    newReason: function () {
      return this.newReasons()[0] || null;
    },

    judgmentsOf: function (projectId) {
      var id = projectId || this.currentProject().id;
      return this.state.judgments[id] || {};
    },

    isJudged: function (bidderId) {
      return Object.prototype.hasOwnProperty.call(this.judgmentsOf(), bidderId);
    },

    allJudged: function () {
      var p = this.currentProject();
      var self = this;
      return p.bidders.every(function (b) { return self.isJudged(b.id); });
    },

    /**
     * 업체 하나를 판정한다 (GAME_SPEC 4장 ④).
     * verdict: "ok" | "reject", reason: 부적격일 때 사유 코드.
     * 부적격 사유는 정답 사유가 아니어도 서류에 실제로 있는 문제면 맞은 것으로 본다.
     */
    judge: function (bidderId, verdict, reason) {
      var p = this.currentProject();
      if (!p) throw new Error("진행 중인 사업이 없습니다.");
      var b = findBidder(p, bidderId);
      if (!b) throw new Error("업체를 찾을 수 없습니다: " + bidderId);
      if (this.isJudged(bidderId)) throw new Error("이미 판정한 업체입니다: " + b.name);
      if (verdict !== "ok" && verdict !== "reject") throw new Error("판정은 ok 또는 reject여야 합니다.");
      if (verdict === "reject") {
        if (!reason) throw new Error("부적격 판정에는 사유가 필요합니다.");
        if (this.availableReasons().indexOf(reason) === -1) throw new Error("아직 쓸 수 없는 사유입니다: " + reason);
      }

      var issues = inspect(p, b);
      var verdictCorrect = verdict === b.verdict;
      var reasonCorrect = null;
      if (verdict === "reject" && b.verdict === "reject") {
        reasonCorrect = reason === b.reason || issues.indexOf(reason) !== -1;
      }

      var record = {
        bidderId: b.id,
        verdict: verdict,
        reason: verdict === "reject" ? reason : null,
        verdictCorrect: verdictCorrect,
        reasonCorrect: reasonCorrect,
        mistake: !verdictCorrect,          // 4.2 제안: 적격/부적격을 틀린 경우만 실수
        expectedVerdict: b.verdict,
        expectedReason: b.reason || null,
        issues: issues
      };

      if (!this.state.judgments[p.id]) this.state.judgments[p.id] = {};
      this.state.judgments[p.id][b.id] = record;
      if (record.mistake) this.state.mistakes++;
      return record;
    },

    /** 낙찰 후보: 플레이어가 적격으로 통과시킨 업체들 (GAME_SPEC 4장 ⑤). */
    awardCandidates: function () {
      var p = this.currentProject();
      var j = this.judgmentsOf(p.id);
      return this.orderedBidders().filter(function (b) { return j[b.id] && j[b.id].verdict === "ok"; });
    },

    /**
     * 낙찰 업체를 고른다. 후보가 없으면 null(유찰)만 허용.
     * 정답 적격 업체를 고르면 그 업체의 성향 태그 +1 (GAME_SPEC 6장).
     */
    award: function (bidderId) {
      var p = this.currentProject();
      if (!p) throw new Error("진행 중인 사업이 없습니다.");
      if (!this.allJudged()) throw new Error("모든 업체를 판정한 뒤에 낙찰할 수 있습니다.");
      if (Object.prototype.hasOwnProperty.call(this.state.awards, p.id)) throw new Error("이미 낙찰을 마친 사업입니다.");

      var candidates = this.awardCandidates();
      if (bidderId === null) {
        if (candidates.length) throw new Error("낙찰 후보가 있으면 유찰할 수 없습니다.");
        this.state.awards[p.id] = null;
        return null;
      }

      var b = findBidder(p, bidderId);
      if (!b || candidates.indexOf(b) === -1) throw new Error("낙찰 후보가 아닌 업체입니다: " + bidderId);

      this.state.awards[p.id] = b.id;
      if (b.verdict === "ok" && b.tag) {
        this.state.tags[b.tag] = (this.state.tags[b.tag] || 0) + 1;
      }
      return b;
    },

    /**
     * 지금 사업을 끝낸다 (낙찰 또는 유찰을 마쳐야 한다). 소개된 사유를 기억하고,
     * 남은 사업 중 첫 번째를 기본으로 골라 둔다 (바탕화면에서 다른 폴더를 고르면 바뀐다).
     */
    nextProject: function () {
      var p = this.currentProject();
      if (!p || this.isFinished()) throw new Error("모든 사업이 끝났습니다.");
      if (!Object.prototype.hasOwnProperty.call(this.state.awards, p.id)) {
        throw new Error("낙찰을 마친 뒤 다음 사업으로 넘어갈 수 있습니다.");
      }
      var seen = this.state.seenReasons;
      this.newReasons().forEach(function (c) { seen.push(c); });
      this.state.done.push(p.id);
      var next = this.data.projects.length;
      for (var i = 0; i < this.data.projects.length; i++) {
        if (!this.isDone(this.data.projects[i].id)) { next = i; break; }
      }
      this.state.projectIndex = next;
      return this.currentProject();
    },

    /**
     * 이어하기용 저장 데이터 (사업을 끝낸 직후에 부른다). 진행 중인 사업의 판정·힌트는 빼서
     * 이어하면 그 사업을 처음부터 하게 한다.
     */
    exportSave: function () {
      var st = JSON.parse(JSON.stringify(this.state));
      var done = st.done;
      ["judgments", "hints", "awards", "bidderOrder"].forEach(function (k) {
        Object.keys(st[k]).forEach(function (pid) { if (done.indexOf(pid) === -1) delete st[k][pid]; });
      });
      return { v: SAVE_VERSION, projectIds: this.data.projects.map(function (p) { return p.id; }), state: st };
    },

    /**
     * 저장 데이터로 이어한다. 형식이 다르거나 시나리오가 바뀌었으면 false (저장 무시).
     * 끝낸 사업이 하나도 없거나 전부 끝냈으면 이어할 게 없으므로 false.
     */
    importSave: function (save) {
      var ids = this.data.projects.map(function (p) { return p.id; });
      if (!save || save.v !== SAVE_VERSION || !save.state || !Array.isArray(save.state.done)) return false;
      if (JSON.stringify(save.projectIds) !== JSON.stringify(ids)) return false;
      var st = save.state;
      if (!st.done.length || st.done.length >= ids.length) return false;
      if (!st.done.every(function (id) { return ids.indexOf(id) !== -1; })) return false;
      var base = { judgments: {}, hints: {}, awards: {}, tags: {}, bidderOrder: {}, seenReasons: [], mistakes: 0 };
      for (var k in base) if (st[k] === undefined) st[k] = base[k];
      this.state = st;
      // 남은 사업 중 첫 번째를 기본으로
      this.state.projectIndex = ids.length;
      for (var i = 0; i < ids.length; i++) if (st.done.indexOf(ids[i]) === -1) { this.state.projectIndex = i; break; }
      return true;
    },

    /** 가장 높은 성향 태그. 없거나 동점이면 "balanced" (GAME_SPEC 7.2 제안). */
    topTag: function () {
      var best = null, bestScore = 0, tie = false;
      for (var tag in this.state.tags) {
        var s = this.state.tags[tag];
        if (s > bestScore) { best = tag; bestScore = s; tie = false; }
        else if (s === bestScore) tie = true;
      }
      return (!best || tie) ? "balanced" : best;
    },

    /** 진행한 사업들의 결과 요약 (임시 결과 화면·엔딩 뉴스용). */
    /**
     * 판정 복기 (심사 기록에서 업체 하나를 눌렀을 때). 화면은 이 값을 그리기만 한다.
     * status: "right"(정답) | "partial"(부적격은 맞지만 사유가 다름) | "wrong"(판정 실수) | "none"(판정 안 함)
     * papers: [{ bidderId, docKey, fields }] — 보여 줄 근거 서류와 형광펜 칸 (담합은 두 업체 견적서)
     * condFields: 공고 조건표에서 함께 칠할 칸 ("cond.budget" 등)
     * vars: 나르미 설명 문구({budget} 등)에 넣을 값
     */
    review: function (projectId, bidderId) {
      var p = null;
      for (var i = 0; i < this.data.projects.length; i++) if (this.data.projects[i].id === projectId) p = this.data.projects[i];
      var b = p && findBidder(p, bidderId);
      if (!b) throw new Error("복기할 업체를 찾을 수 없습니다: " + projectId + "/" + bidderId);
      var j = (this.state.judgments[p.id] || {})[b.id] || null;

      var status = "none";
      if (j) status = j.mistake ? "wrong" : (j.reasonCorrect === false ? "partial" : "right");

      var code = b.verdict === "reject" ? b.reason : null;
      var picked = j && j.verdict === "reject" ? j.reason : null;
      var papers = [], vars = {};

      if (code) {
        var spot = locate(p, b, code) || { docKey: REASON_DOC[code], fields: [], vars: {} };
        vars = Object.assign({}, spot.vars);
        papers.push({ bidderId: b.id, docKey: spot.docKey, fields: spot.fields });
        if (code === "COLLUSION") {
          var other = findBidder(p, b.collusionWith);
          if (other) {
            papers.unshift({ bidderId: other.id, docKey: "quote", fields: spot.fields });
            vars.other = other.name;
          }
        } else if (code === "INFO_MISMATCH" && spot.docKey !== "application") {
          // 기준이 되는 신청서의 사업자번호와 나란히
          papers.unshift({ bidderId: b.id, docKey: "application", fields: ["application.bizNo"] });
        }
      } else if (picked && REASON_DOC[picked]) {
        // 적격 업체를 반려했을 때: 고른 사유와 관련된 서류를 보여 주며 "여긴 문제없어요"
        papers.push({ bidderId: b.id, docKey: REASON_DOC[picked], fields: [] });
      }

      return {
        projectId: p.id,
        projectTitle: p.title,
        bidderId: b.id,
        name: b.name,
        status: status,
        verdict: j ? j.verdict : null,
        picked: picked,
        expectedVerdict: b.verdict,
        expectedReason: code,
        papers: papers,
        condFields: COND_FIELDS[code || picked] || [],
        vars: vars
      };
    },

    summary: function () {
      var self = this;
      var projects = [];
      // 끝낸 순서대로, 그다음 진행 중인 사업 (뉴스·심사 기록도 플레이한 순서)
      var done = this.state.done;
      var ordered = this.data.projects.slice().sort(function (a, b) {
        var ia = done.indexOf(a.id), ib = done.indexOf(b.id);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      ordered.forEach(function (p) {
        if (!self.state.judgments[p.id] && !self.state.hints[p.id]) return;
        var j = self.state.judgments[p.id] || {};
        var awardedId = Object.prototype.hasOwnProperty.call(self.state.awards, p.id) ? self.state.awards[p.id] : undefined;
        var awarded = awardedId ? findBidder(p, awardedId) : null;
        projects.push({
          id: p.id,
          title: p.title,
          judgments: self.orderedBidders(p.id).map(function (b) {   // 창구에 온 순서
            var r = j[b.id];
            return r ? Object.assign({ name: b.name }, r) : { bidderId: b.id, name: b.name, verdict: null };
          }),
          mistakes: p.bidders.filter(function (b) { return j[b.id] && j[b.id].mistake; }).length,
          hintsUsed: Object.keys(self.state.hints[p.id] || {}).length,
          awardedId: awardedId === undefined ? undefined : awardedId,
          awardedName: awarded ? awarded.name : null,
          news: awarded && p.news ? (p.news[awarded.id] || null) : null
        });
      });
      return {
        projects: projects,
        mistakes: this.state.mistakes,
        hintsUsed: projects.reduce(function (n, x) { return n + x.hintsUsed; }, 0),
        tags: Object.assign({}, this.state.tags),
        topTag: this.topTag()
      };
    },

    /**
     * 칭호 (GAME_SPEC 7.2). 같은 칭호를 가진 태그(stable·quality 등)는 점수를 합친다.
     * 최고 점수 칭호가 하나면 그 칭호, 없거나 동점이면 balanced. 감사 지적 0회면 앞에 "완벽한".
     */
    title: function () {
      var titles = this.data.titles;
      var prefix = (this.data.ending && this.data.ending.perfectPrefix) || "";
      var scores = {}, keyOf = {};
      for (var tag in this.state.tags) {
        var name = titles[tag];
        if (!name) continue;
        scores[name] = (scores[name] || 0) + this.state.tags[tag];
        if (!keyOf[name]) keyOf[name] = tag;
      }
      var best = null, bestScore = 0, tie = false;
      for (var n in scores) {
        if (scores[n] > bestScore) { best = n; bestScore = scores[n]; tie = false; }
        else if (scores[n] === bestScore) tie = true;
      }
      var base = (!best || tie) ? titles.balanced : best;
      var group = (!best || tie) ? ["balanced"] : Object.keys(titles).filter(function (k) { return titles[k] === base; });
      var perfect = this.state.mistakes === 0;
      return {
        base: base,
        full: (perfect && prefix ? prefix + " " : "") + base,
        perfect: perfect,
        keys: group,          // 이 칭호에 해당하는 태그들 (설명 문구 찾기용)
        scores: scores
      };
    },

    /**
     * 엔딩 데이터 (GAME_SPEC 7장): 칭호 + 1년 후 뉴스 기사 목록.
     * 기사: 적격 업체 낙찰 → 그 업체 뉴스 / 유찰 → 재공고 / 조건 미달 업체 낙찰 → 감사 지적 기사.
     * 감사 지적이 있던 사업엔 정정 기사(correction)를 붙인다.
     */
    ending: function () {
      var E = this.data.ending || {};
      var s = this.summary();
      var t = this.title();

      function fillIn(text, p) {
        return String(text || "").replace("{title}", p.title).replace("{n}", p.mistakes);
      }

      var articles = s.projects.map(function (p) {
        var a = { projectId: p.id, title: p.title, kind: "news", head: "", sub: "", correction: null };
        if (p.awardedId === null) {
          a.kind = "failed";
          a.head = fillIn(E.failed && E.failed.head, p);
          a.sub = fillIn(E.failed && E.failed.sub, p);
        } else if (p.news) {
          a.head = p.news.head;
          a.sub = p.news.sub;
        } else {
          a.kind = "badAward";
          a.head = fillIn(E.badAward && E.badAward.head, p);
          a.sub = fillIn(E.badAward && E.badAward.sub, p);
        }
        if (p.mistakes > 0) a.correction = fillIn(E.correction, p);
        return a;
      });

      var blurb = "";
      for (var i = 0; i < t.keys.length && !blurb; i++) blurb = (E.titleBlurb || {})[t.keys[i]] || "";

      return {
        title: t.full,
        titleBase: t.base,
        perfect: t.perfect,
        blurb: blurb,
        mistakes: s.mistakes,
        hintsUsed: s.hintsUsed,
        tags: s.tags,
        articles: articles,
        finalMessage: E.finalMessage || ""
      };
    }
  };
})();
