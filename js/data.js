/*
 * 시나리오 데이터 (GAME_SPEC 9.2)
 * 사업·업체·서류·뉴스·칭호 문구는 전부 여기에 둔다. 엔진 코드에 하드코딩하지 않는다.
 * 사업 데이터는 다음 이슈(M1 데이터·판정 엔진)에서 채운다.
 */
window.Game = window.Game || {};

Game.DATA = {
  projects: [],
  reasons: {},
  titles: {}
};
