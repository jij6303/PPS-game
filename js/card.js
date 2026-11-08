/*
 * 칭호 카드 이미지 저장 (GAME_SPEC 7.2 — 캡처·공유하기 좋게 한 장).
 * 화면의 칭호 카드를 Canvas에 직접 다시 그려 PNG로 저장한다 (외부 라이브러리 없음).
 * 이미지는 Game.CARD_IMAGES(data URI)만 쓴다 → file://에서도 캔버스가 오염되지 않아 저장된다.
 */
window.Game = window.Game || {};

(function () {
  var W = 1080, H = 1350;               // 세로 4:5 — SNS에 올리기 좋은 비율
  var FONT = '"Pretendard", system-ui, -apple-system, "Malgun Gothic", sans-serif';
  var C = {
    bg: "#fdf6ec", paper: "#ffffff", ink: "#2d3142", soft: "#6b7083",
    primary: "#4f8cf7", primaryDark: "#3a6fd1", mint: "#bfe8d9", sky: "#cfe3ff", peach: "#ffd8c2",
    barBg: "#f0ebe2", gold: "#c98a00"
  };
  var FILE_NAME = "달이의조달창구_칭호.png";

  function font(weight, size) { return weight + " " + size + "px " + FONT; }

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };   // 그림이 없어도 카드는 저장
      img.src = src;
    });
  }

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load(font(400, 32), "가"),
      document.fonts.load(font(700, 32), "가")
    ]).catch(function () { /* 폰트가 없으면 기본 글꼴로 */ });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** 가로 maxW 안에 들어가게 줄을 나눈다 (띄어쓰기 우선, 긴 낱말은 글자 단위). */
  function wrap(ctx, text, maxW) {
    var lines = [], line = "";
    String(text).split(" ").forEach(function (word) {
      var test = line ? line + " " + word : word;
      if (ctx.measureText(test).width <= maxW) { line = test; return; }
      if (line) lines.push(line);
      line = "";
      for (var i = 0; i < word.length; i++) {
        if (ctx.measureText(line + word[i]).width > maxW && line) { lines.push(line); line = ""; }
        line += word[i];
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawLines(ctx, lines, x, y, lh) {
    lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * lh); });
    return y + lines.length * lh;
  }

  /** 글자가 maxW를 넘으면 크기를 줄여 한 줄에 맞춘다. */
  function fitText(ctx, text, weight, size, maxW) {
    ctx.font = font(weight, size);
    while (size > 40 && ctx.measureText(text).width > maxW) {
      size -= 4;
      ctx.font = font(weight, size);
    }
  }

  function drawBlob(ctx, x, y, r, color) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(253,246,236,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function draw(ctx, ending, imgs) {
    // 배경: 화면의 칭호 화면처럼 크림 바탕에 파스텔 동그라미
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    drawBlob(ctx, W * 0.12, H * 0.88, 420, C.mint);
    drawBlob(ctx, W * 0.88, H * 0.12, 480, C.sky);
    drawBlob(ctx, W * 0.82, H * 0.94, 380, C.peach);

    // 카드
    var cx = 70, cy = 60, cw = W - 140, ch = 1090;
    ctx.save();
    ctx.shadowColor = "rgba(45,49,66,0.14)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    roundRect(ctx, cx, cy, cw, ch, 48);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.restore();
    roundRect(ctx, cx, cy, cw, ch, 48);
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.primary;
    ctx.stroke();

    var mid = W / 2, inner = cw - 140;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = C.primaryDark;
    ctx.font = font(700, 32);
    ctx.fillText("달이의 조달 창구", mid, 140);

    ctx.fillStyle = C.soft;
    ctx.font = font(400, 34);
    ctx.fillText("1년 차 신입 조달관 달이의 칭호", mid, 205);

    ctx.fillStyle = ending.perfect ? C.gold : C.ink;
    fitText(ctx, ending.title, 700, 100, inner);
    ctx.fillText(ending.title, mid, 320);

    var y = 390;
    if (ending.blurb) {
      ctx.fillStyle = C.soft;
      ctx.font = font(400, 34);
      y = drawLines(ctx, wrap(ctx, ending.blurb, inner), mid, y, 48);
    }

    // 감사 지적 · 나르미 힌트
    y += 40;
    var stats = [["감사 지적", ending.mistakes + "회"], ["나르미 힌트", ending.hintsUsed + "회"]];
    stats.forEach(function (s, i) {
      var sx = mid + (i === 0 ? -170 : 170);
      ctx.textAlign = "right";
      ctx.fillStyle = C.soft;
      ctx.font = font(400, 30);
      ctx.fillText(s[0], sx + 10, y);
      ctx.textAlign = "left";
      ctx.fillStyle = C.ink;
      ctx.font = font(700, 44);
      ctx.fillText(s[1], sx + 26, y + 2);
    });

    // 성향 막대
    var labels = Game.DATA.tagLabels;
    var keys = Object.keys(labels);
    var max = 0;
    keys.forEach(function (t) { max = Math.max(max, ending.tags[t] || 0); });
    var bx = 290, bw = 560, rowH = 52;
    y += 60;
    keys.forEach(function (t, i) {
      var ry = y + i * rowH;
      var v = ending.tags[t] || 0;
      ctx.textAlign = "left";
      ctx.fillStyle = C.ink;
      ctx.font = font(400, 30);
      ctx.fillText(labels[t], 160, ry + 11);
      roundRect(ctx, bx, ry - 12, bw, 24, 12);
      ctx.fillStyle = C.barBg;
      ctx.fill();
      if (v > 0 && max > 0) {
        roundRect(ctx, bx, ry - 12, Math.max(24, bw * v / max), 24, 12);
        ctx.fillStyle = C.primary;
        ctx.fill();
      }
      ctx.textAlign = "right";
      ctx.fillStyle = C.primaryDark;
      ctx.font = font(700, 30);
      ctx.fillText(String(v), 920, ry + 11);
    });

    // 마지막 메시지
    y += keys.length * rowH + 50;
    ctx.textAlign = "center";
    ctx.fillStyle = C.ink;
    ctx.font = font(700, 36);
    drawLines(ctx, wrap(ctx, "“" + ending.finalMessage + "”", inner - 40), mid, y, 54);

    // 아래: 달이·나르미와 조달청 상징 (마스코트는 크기만 조절 — GAME_SPEC 3장)
    var mh = 330;
    if (imgs.dali) ctx.drawImage(imgs.dali, 20, H - mh, imgs.dali.width * mh / imgs.dali.height, mh);
    if (imgs.narmi) {
      var nw = imgs.narmi.width * mh / imgs.narmi.height;
      ctx.drawImage(imgs.narmi, W - 20 - nw, H - mh, nw, mh);
    }
    if (imgs.symbol) {
      var sh = 64, sw = imgs.symbol.width * sh / imgs.symbol.height;
      roundRect(ctx, mid - sw / 2 - 18, H - 140, sw + 36, sh + 28, 18);
      ctx.fillStyle = C.paper;
      ctx.fill();
      ctx.drawImage(imgs.symbol, mid - sw / 2, H - 126, sw, sh);
    }
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      try {
        canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error("toBlob 실패")); }, "image/png");
      } catch (e) { reject(e); }
    });
  }

  Game.card = {
    fileName: FILE_NAME,

    /** 칭호 카드를 그린 캔버스를 돌려준다 (Promise). */
    render: function (ending) {
      var src = Game.CARD_IMAGES || {};
      return Promise.all([loadFonts(), loadImage(src.dali), loadImage(src.narmi), loadImage(src.symbol)])
        .then(function (r) {
          var canvas = document.createElement("canvas");
          canvas.width = W;
          canvas.height = H;
          draw(canvas.getContext("2d"), ending, { dali: r[1], narmi: r[2], symbol: r[3] });
          return canvas;
        });
    },

    /**
     * PNG로 저장한다. 내려받기가 되면 { downloaded: true },
     * 내려받기를 못 하는 환경을 대비해 항상 미리보기용 dataUrl도 돌려준다.
     */
    save: function (ending) {
      return this.render(ending).then(function (canvas) {
        var dataUrl = canvas.toDataURL("image/png");
        return toBlob(canvas).then(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = FILE_NAME;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          return { downloaded: true, dataUrl: dataUrl };
        }, function () {
          return { downloaded: false, dataUrl: dataUrl };
        });
      });
    }
  };
})();
