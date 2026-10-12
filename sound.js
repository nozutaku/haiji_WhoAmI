// 効果音（Web Audio で合成。音声ファイル不要）。ブラウザ・Node 両対応
(function (root) {
  'use strict';

  var FREQ = {
    correctHigh: 1319, // ピン (E6)
    correctLow: 1047,  // ポーン (C6)
    wrong: 140         // ブッ
  };

  // 音量 (0〜1)。高齢の方でも聞き取りやすいよう大きめにしている
  var VOL = { correct: 0.8, wrong: 0.7, tick: 0.2 };

  // 満点のファンファーレ（約3秒）。{ freq, start, dur, type, vol }
  //  1) 駆け上がるアルペジオ  2) タタタ・ターン  3) 厚い和音 + 低音  4) きらめく高音
  var FANFARE = (function () {
    var n = [];
    function add(freq, start, dur, type, vol) { n.push({ freq: freq, start: start, dur: dur, type: type, vol: vol }); }
    [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { // C5 E5 G5 C6 E6 G6
      add(f, i * 0.08, 0.2, 'square', 0.25);
      add(f, i * 0.08, 0.2, 'triangle', 0.35);
    });
    [0.75, 0.95, 1.15].forEach(function (t) { // ターン前の「タ・タ・タ」
      add(784, t, 0.16, 'sawtooth', 0.3);
      add(1047, t, 0.16, 'square', 0.2);
    });
    add(1047, 1.4, 1.7, 'sawtooth', 0.28); // 最後の「ターン」
    [523, 659, 784].forEach(function (f) { add(f, 1.4, 1.7, 'sawtooth', 0.2); });
    add(262, 1.4, 1.7, 'triangle', 0.3);   // 低音 C4
    add(1319, 1.4, 1.7, 'triangle', 0.2);
    [2093, 2637, 3136, 4186].forEach(function (f, i) { // きらめく高音 C7 E7 G7 C8
      add(f, 1.5 + i * 0.12, 0.2, 'sine', 0.22);
    });
    [3136, 2637, 3136, 4186].forEach(function (f, i) {
      add(f, 2.2 + i * 0.12, i === 3 ? 0.7 : 0.2, 'sine', 0.22);
    });
    return n;
  })();

  // AudioCtx: AudioContext クラス。timers: { setInterval, clearInterval }（テスト用に差し替え可）
  function createSound(AudioCtx, timers) {
    var t = timers || {};
    var setIv = t.setInterval || root.setInterval.bind(root);
    var clearIv = t.clearInterval || root.clearInterval.bind(root);
    var ctx = null;
    var muted = false;
    var tickTimer = null;
    var tickCount = 0;

    function ensure() {
      if (!AudioCtx) return null;
      if (!ctx) ctx = new AudioCtx();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return ctx;
    }

    function tone(freq, start, dur, type, vol) {
      if (muted) return;
      var c = ensure();
      if (!c) return;
      var o = c.createOscillator();
      var g = c.createGain();
      var at = c.currentTime + start;
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(at);
      o.stop(at + dur + 0.05);
    }

    function stopThinking() {
      if (tickTimer !== null) {
        clearIv(tickTimer);
        tickTimer = null;
      }
    }

    return {
      // ユーザー操作の中で呼ぶ（ブラウザの自動再生制限の解除）
      unlock: function () { ensure(); },
      // ピンポーン！
      correct: function () {
        tone(FREQ.correctHigh, 0, 0.35, 'sine', VOL.correct);
        tone(FREQ.correctLow, 0.3, 0.9, 'sine', VOL.correct);
      },
      // ブッブー
      wrong: function () {
        tone(FREQ.wrong, 0, 0.28, 'sawtooth', VOL.wrong);
        tone(FREQ.wrong, 0.4, 1.2, 'sawtooth', VOL.wrong); // 最後の「ブー」を長く
      },
      // 満点のファンファーレ
      fanfare: function () {
        FANFARE.forEach(function (n) { tone(n.freq, n.start, n.dur, n.type, n.vol); });
      },
      // シンキングタイム: 1 秒ごとに「カチ・コチ」と静かに時計の音
      startThinking: function () {
        stopThinking();
        tickCount = 0;
        tickTimer = setIv(function () {
          tickCount++;
          tone(tickCount % 2 ? 880 : 660, 0, 0.08, 'sine', VOL.tick);
        }, 1000);
      },
      stopThinking: stopThinking,
      isThinking: function () { return tickTimer !== null; },
      setMuted: function (m) {
        muted = !!m;
      },
      isMuted: function () { return muted; }
    };
  }

  var api = { createSound: createSound, FREQ: FREQ, VOL: VOL, FANFARE: FANFARE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SoundFx = api;
})(typeof window !== 'undefined' ? window : globalThis);
