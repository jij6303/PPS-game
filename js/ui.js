/*
 * 화면 렌더링, 화면 전환, 무대 스케일.
 * 드래그·도장 애니메이션은 이후 이슈에서 추가한다.
 */
window.Game = window.Game || {};

Game.ui = {
  STAGE_W: 1920,
  STAGE_H: 1080,

  /** 창 크기에 맞춰 1920×1080 무대를 비율 유지(레터박스)로 스케일한다. */
  fitStage: function () {
    var scale = Math.min(
      window.innerWidth / this.STAGE_W,
      window.innerHeight / this.STAGE_H
    );
    document.getElementById("stage").style.setProperty("--stage-scale", scale);
  },

  /** data-screen 이름으로 화면을 전환한다. */
  show: function (name) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.toggle("is-active", screens[i].getAttribute("data-screen") === name);
    }
  }
};
