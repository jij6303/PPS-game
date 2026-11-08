/*
 * 조달 용어 사전 — 게임에서 만난 용어·부적격 사유·조달 정책을 카드로 모은다.
 * 카드 목록은 data.js(Game.DATA.glossary, reasons)에서 만들고, 모은 카드는 판이 바뀌어도 남는다 (localStorage).
 * localStorage는 try/catch — 저장이 막혀도 이번 판 동안은 모은 카드가 보인다 (GAME_SPEC 9장).
 */
window.Game = window.Game || {};

(function () {
  var KEY = "pps-game-glossary";
  var unlocked = load();

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(unlocked)); } catch (e) { /* 저장 못 해도 진행 */ }
  }

  Game.glossary = {
    /**
     * 카드 전체 (분류 순서대로). 사유 카드는 reasons 설명을 그대로 쓴다.
     * { id, group, name, desc, more, policy }
     */
    entries: function () {
      var G = Game.DATA.glossary, R = Game.DATA.reasons;
      var list = [];
      G.basics.forEach(function (e) { list.push({ id: e.id, group: "basics", name: e.name, desc: e.desc, more: e.more || "" }); });
      Object.keys(R).forEach(function (code) {
        list.push({ id: "reason-" + code, group: "reasons", name: R[code].name, desc: R[code].desc, more: (G.reasonMore || {})[code] || "", policy: R[code].policy });
      });
      G.policies.forEach(function (e) { list.push({ id: "policy-" + e.project, group: "policies", name: e.name, desc: e.desc, more: e.more || "" }); });
      return list;
    },

    isUnlocked: function (id) { return unlocked.indexOf(id) !== -1; },

    count: function () {
      var ids = this.entries().map(function (e) { return e.id; });
      return { have: unlocked.filter(function (id) { return ids.indexOf(id) !== -1; }).length, total: ids.length };
    },

    /** 카드를 연다. 새로 얻은 카드 목록을 돌려준다 (알림용). */
    unlock: function (ids) {
      var all = this.entries();
      var fresh = [];
      ids.forEach(function (id) {
        if (unlocked.indexOf(id) !== -1) return;
        for (var i = 0; i < all.length; i++) {
          if (all[i].id === id) { unlocked.push(id); fresh.push(all[i]); return; }
        }
      });
      if (fresh.length) save();
      return fresh;
    },

    /** 처음부터 가진 카드: 기본 용어 + 기본 사유 */
    starterIds: function () {
      return Game.DATA.glossary.basics.map(function (e) { return e.id; })
        .concat((Game.DATA.startingReasons || []).map(function (c) { return "reason-" + c; }));
    },

    /** 테스트용: 모은 카드 모두 지우기 */
    resetAll: function () { unlocked = []; save(); }
  };
})();
