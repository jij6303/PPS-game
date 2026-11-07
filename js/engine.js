/*
 * 게임 엔진: 상태 관리, 판정 로직, 점수/태그 누적.
 * 화면(DOM)에는 손대지 않는다. 판정 로직은 다음 이슈에서 채운다.
 */
window.Game = window.Game || {};

Game.engine = {
  state: null,

  reset: function () {
    this.state = {
      projectIndex: 0
    };
    return this.state;
  }
};
