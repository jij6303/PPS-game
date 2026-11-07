/*
 * 효과음: Web Audio API로 직접 합성한다 (외부 음원 파일 없음 → 저작권 걱정 없음, file://에서도 동작).
 *
 *   Game.sound.play("stamp")      — 재생 (꺼져 있거나 소리 장치가 없으면 조용히 무시)
 *   Game.sound.setEnabled(false)  — 끄기 (브라우저에 저장, 저장이 막혀도 게임은 진행)
 *   Game.sound.render("stamp")    — 테스트용: OfflineAudioContext로 미리 렌더링한 AudioBuffer (Promise)
 *
 * 판정이 맞았는지 틀렸는지는 소리로 알려주지 않는다 (감사 지적은 엔딩에서 공개 — GAME_SPEC 4.2).
 */
window.Game = window.Game || {};

(function () {
  var STORAGE_KEY = "pps-game.sound";
  var MASTER_GAIN = 0.8;

  // ===== 소리 재료 =====================================================

  /** 음 하나: 주파수(끝 주파수로 미끄러질 수 있음) + 짧게 올라가고 지수로 사라지는 음량. */
  function tone(ctx, dest, t, o) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    var dur = o.dur;
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** 하얀 잡음 버퍼 (컨텍스트마다 한 번만 만든다). */
  function noiseBuffer(ctx) {
    if (ctx.__ppsNoise) return ctx.__ppsNoise;
    var len = Math.floor(ctx.sampleRate * 1.0);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    var seed = 12345;                       // 매번 같은 잡음 (테스트 결과가 흔들리지 않게)
    for (var i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    ctx.__ppsNoise = buf;
    return buf;
  }

  /** 필터를 거친 잡음: 종이 소리·도장 충격 등. */
  function noise(ctx, dest, t, o) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    var f = ctx.createBiquadFilter();
    f.type = o.filter || "bandpass";
    f.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.dur);
    f.Q.value = o.q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + o.dur + 0.02);
  }

  function arpeggio(ctx, dest, t, freqs, step, o) {
    for (var i = 0; i < freqs.length; i++) {
      tone(ctx, dest, t + i * step, { freq: freqs[i], dur: o.dur, type: o.type, gain: o.gain });
    }
  }

  // ===== 효과음 정의 (길이는 render()에서 쓰는 초 단위) ===================

  var SOUNDS = {
    /** 도장 "쾅": 떨어지는 저음 + 짧은 충격 잡음 */
    stamp: { len: 0.4, fn: function (ctx, d, t) {
      tone(ctx, d, t, { freq: 150, freqEnd: 45, dur: 0.28, gain: 0.9, attack: 0.004 });
      noise(ctx, d, t, { filter: "lowpass", freq: 1200, dur: 0.09, gain: 0.55, attack: 0.002 });
      tone(ctx, d, t, { freq: 320, freqEnd: 180, dur: 0.05, type: "triangle", gain: 0.25, attack: 0.002 });
    } },

    /** 종이 "사락" */
    paper: { len: 0.25, fn: function (ctx, d, t) {
      noise(ctx, d, t, { freq: 2600, freqEnd: 4200, q: 0.9, dur: 0.17, gain: 0.35, attack: 0.02 });
    } },

    /** 버튼 "톡" */
    click: { len: 0.12, fn: function (ctx, d, t) {
      tone(ctx, d, t, { freq: 900, freqEnd: 650, dur: 0.07, type: "triangle", gain: 0.22 });
    } },

    /** 업체 입장 "띵동" */
    enter: { len: 0.7, fn: function (ctx, d, t) {
      tone(ctx, d, t, { freq: 988, dur: 0.35, gain: 0.22 });
      tone(ctx, d, t + 0.17, { freq: 784, dur: 0.5, gain: 0.22 });
    } },

    /** 힌트 "반짝" */
    hint: { len: 0.45, fn: function (ctx, d, t) {
      arpeggio(ctx, d, t, [1319, 1568, 2093], 0.07, { dur: 0.22, gain: 0.16 });
    } },

    /** 나르미 "뿅" */
    pop: { len: 0.15, fn: function (ctx, d, t) {
      tone(ctx, d, t, { freq: 520, freqEnd: 980, dur: 0.1, gain: 0.25 });
    } },

    /** 낙찰 "딴따단" */
    success: { len: 0.75, fn: function (ctx, d, t) {
      arpeggio(ctx, d, t, [523, 659, 784, 1047], 0.09, { dur: 0.32, type: "triangle", gain: 0.24 });
    } },

    /** 신문 펼침 "촤악" */
    flip: { len: 0.6, fn: function (ctx, d, t) {
      noise(ctx, d, t, { freq: 700, freqEnd: 3200, q: 0.7, dur: 0.5, gain: 0.4, attack: 0.06 });
    } },

    /** 칭호 팡파르 */
    fanfare: { len: 1.2, fn: function (ctx, d, t) {
      arpeggio(ctx, d, t, [523, 659, 784], 0.11, { dur: 0.22, type: "triangle", gain: 0.22 });
      tone(ctx, d, t + 0.33, { freq: 1047, dur: 0.8, type: "triangle", gain: 0.26 });
      tone(ctx, d, t + 0.33, { freq: 1319, dur: 0.8, gain: 0.12 });
      arpeggio(ctx, d, t + 0.45, [2093, 2637], 0.08, { dur: 0.25, gain: 0.08 });
    } }
  };

  // ===== 저장된 설정 =====================================================

  function loadEnabled() {
    try { return window.localStorage.getItem(STORAGE_KEY) !== "off"; } catch (e) { return true; }
  }
  function saveEnabled(on) {
    try { window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off"); } catch (e) { /* 저장 불가해도 진행 */ }
  }

  // ===== 공개 API =======================================================

  Game.sound = {
    NAMES: Object.keys(SOUNDS),
    enabled: loadEnabled(),
    ctx: null,
    master: null,

    /** 소리 장치를 준비한다. 브라우저 정책상 사용자 클릭 이후에 불러야 소리가 난다. */
    unlock: function () {
      try {
        if (!this.ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return false;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = MASTER_GAIN;
          this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") this.ctx.resume();
        return true;
      } catch (e) {
        return false;
      }
    },

    play: function (name, delay) {
      if (!this.enabled || !SOUNDS[name]) return;
      try {
        if (!this.unlock()) return;
        SOUNDS[name].fn(this.ctx, this.master, this.ctx.currentTime + (delay || 0) + 0.01);
      } catch (e) { /* 소리가 안 나도 게임은 진행 */ }
    },

    setEnabled: function (on) {
      this.enabled = !!on;
      saveEnabled(this.enabled);
      if (this.enabled) this.play("click");
    },

    /** 테스트용: 효과음 하나를 오프라인으로 렌더링한 AudioBuffer (Promise). */
    render: function (name, sampleRate) {
      var sr = sampleRate || 44100;
      var def = SOUNDS[name];
      var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var ctx = new Off(1, Math.ceil(sr * def.len), sr);
      var master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
      def.fn(ctx, master, 0);
      return ctx.startRendering();
    }
  };
})();
