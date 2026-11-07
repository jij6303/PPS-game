/*
 * 진입점: 초기화, 버튼 동작 연결, 화면 전환 흐름.
 */
window.Game = window.Game || {};

(function () {
  var ui = Game.ui;

  // data-action 버튼 → 동작. 마우스·터치 모두 click으로 들어온다.
  var actions = {
    "start": function () {
      Game.engine.reset();
      ui.show("placeholder");
    },
    "back-to-title": function () {
      ui.show("title");
    }
  };

  document.addEventListener("click", function (e) {
    var target = e.target.closest("[data-action]");
    if (!target) return;
    var fn = actions[target.getAttribute("data-action")];
    if (fn) fn(target);
  });

  window.addEventListener("resize", function () { ui.fitStage(); });

  ui.fitStage();
  ui.show("title");
})();
