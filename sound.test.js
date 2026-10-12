// 実行: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSound, FREQ, VOL, FANFARE } = require('./sound.js');

// 生成された発振器を記録する偽の AudioContext
function makeFakeAudio() {
  const log = { oscillators: [], contexts: 0 };
  class FakeAudioContext {
    constructor() {
      log.contexts++;
      this.currentTime = 0;
      this.state = 'running';
      this.destination = {};
    }
    createOscillator() {
      const o = { type: '', frequency: { value: 0 }, started: null, stoppedAt: null, peak: null, connect() {}, start(t) { this.started = t; }, stop(t) { this.stoppedAt = t; } };
      log.oscillators.push(o);
      return o;
    }
    createGain() {
      // 直前に作った発振器の最大音量を記録する
      const osc = log.oscillators[log.oscillators.length - 1];
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime(v) { if (osc.peak === null) osc.peak = v; } },
        connect() {},
      };
    }
  }
  return { FakeAudioContext, log };
}

// 手動で進められるタイマー
function makeFakeTimers() {
  const t = { fns: new Map(), nextId: 1 };
  t.setInterval = (fn) => { const id = t.nextId++; t.fns.set(id, fn); return id; };
  t.clearInterval = (id) => { t.fns.delete(id); };
  t.tick = () => t.fns.forEach((fn) => fn());
  return t;
}

test('correct: 高い音のあと低い音の「ピンポーン」になる', () => {
  const { FakeAudioContext, log } = makeFakeAudio();
  createSound(FakeAudioContext, makeFakeTimers()).correct();
  assert.deepEqual(log.oscillators.map((o) => o.frequency.value), [FREQ.correctHigh, FREQ.correctLow]);
  assert.ok(FREQ.correctHigh > FREQ.correctLow);
  assert.ok(log.oscillators[1].started > log.oscillators[0].started);
  log.oscillators.forEach((o) => assert.equal(o.type, 'sine'));
});

test('wrong: 低いノコギリ波を2回鳴らす「ブッブー」で、ピンポーンとは別の音', () => {
  const { FakeAudioContext, log } = makeFakeAudio();
  createSound(FakeAudioContext, makeFakeTimers()).wrong();
  assert.equal(log.oscillators.length, 2);
  log.oscillators.forEach((o) => {
    assert.equal(o.frequency.value, FREQ.wrong);
    assert.equal(o.type, 'sawtooth');
  });
  assert.ok(FREQ.wrong < FREQ.correctLow);
  assert.ok(log.oscillators[1].started > log.oscillators[0].started);
});

test('wrong: 最後の「ブー」は最初の「ブッ」より長く、1秒以上続く', () => {
  const { FakeAudioContext, log } = makeFakeAudio();
  createSound(FakeAudioContext, makeFakeTimers()).wrong();
  const len = (o) => o.stoppedAt - o.started - 0.05; // stop は終了 +0.05 秒で呼ばれる
  const [first, last] = log.oscillators;
  assert.ok(len(last) > len(first) * 3, `last=${len(last)} first=${len(first)}`);
  assert.ok(len(last) >= 1.0);
});

test('音量: 正解・不正解は十分大きく、時計音はそれより控えめ', () => {
  const { FakeAudioContext, log } = makeFakeAudio();
  const s = createSound(FakeAudioContext, makeFakeTimers());
  s.correct();
  s.wrong();
  const peaks = log.oscillators.map((o) => o.peak);
  assert.deepEqual(peaks, [VOL.correct, VOL.correct, VOL.wrong, VOL.wrong]);
  peaks.forEach((p) => assert.ok(p >= 0.6 && p <= 1));
  assert.ok(VOL.tick < VOL.correct);
});

test('fanfare: 定義した全ての音を、指定した音程・種類・開始時刻で鳴らす', () => {
  const { FakeAudioContext, log } = makeFakeAudio();
  createSound(FakeAudioContext, makeFakeTimers()).fanfare();
  assert.equal(log.oscillators.length, FANFARE.length);
  FANFARE.forEach((n, i) => {
    assert.equal(log.oscillators[i].frequency.value, n.freq);
    assert.equal(log.oscillators[i].type, n.type);
    assert.equal(log.oscillators[i].started, n.start);
  });
});

test('fanfare: 約3秒続き、音が多層で、きらめく高音を含む（華やかさの条件）', () => {
  const end = Math.max(...FANFARE.map((n) => n.start + n.dur));
  assert.ok(end >= 2.8, `end=${end}`);
  assert.ok(FANFARE.length >= 30);
  assert.ok(new Set(FANFARE.map((n) => n.type)).size >= 3);
  assert.ok(Math.max(...FANFARE.map((n) => n.freq)) >= 4000);
});

test('fanfare: 最後の和音は C ドミソド を同時に鳴らし、低音も加わる', () => {
  const chordStart = 1.4;
  const freqs = FANFARE.filter((n) => n.start === chordStart).map((n) => n.freq);
  [262, 523, 659, 784, 1047].forEach((f) => assert.ok(freqs.includes(f), `missing ${f}`));
});

test('fanfare: 同時に鳴る音の音量合計が 2 を超えない（音割れ防止の目安）', () => {
  const times = [...new Set(FANFARE.map((n) => n.start))];
  times.forEach((t) => {
    const sum = FANFARE.filter((n) => n.start <= t && t < n.start + n.dur).reduce((a, n) => a + n.vol, 0);
    assert.ok(sum <= 2.0, `t=${t} sum=${sum}`);
  });
});

test('ミュート中は音を鳴らさず、解除すると鳴る', () => {
  const { FakeAudioContext, log } = makeFakeAudio();
  const s = createSound(FakeAudioContext, makeFakeTimers());
  s.setMuted(true);
  assert.equal(s.isMuted(), true);
  s.correct(); s.wrong(); s.fanfare();
  assert.equal(log.oscillators.length, 0);
  s.setMuted(false);
  s.correct();
  assert.equal(log.oscillators.length, 2);
});

test('シンキングタイム: 1秒ごとに高低交互の時計音が鳴り、stop で止まる', () => {
  const { FakeAudioContext, log } = makeFakeAudio();
  const timers = makeFakeTimers();
  const s = createSound(FakeAudioContext, timers);
  s.startThinking();
  assert.equal(s.isThinking(), true);
  assert.equal(log.oscillators.length, 0);
  timers.tick(); timers.tick(); timers.tick();
  assert.deepEqual(log.oscillators.map((o) => o.frequency.value), [880, 660, 880]);
  s.stopThinking();
  assert.equal(s.isThinking(), false);
  timers.tick();
  assert.equal(log.oscillators.length, 3);
});

test('シンキングタイム: 二重に開始してもタイマーは1つだけ', () => {
  const { FakeAudioContext } = makeFakeAudio();
  const timers = makeFakeTimers();
  const s = createSound(FakeAudioContext, timers);
  s.startThinking();
  s.startThinking();
  assert.equal(timers.fns.size, 1);
});

test('AudioContext が使えない環境でも例外を出さない', () => {
  const s = createSound(undefined, makeFakeTimers());
  assert.doesNotThrow(() => { s.unlock(); s.correct(); s.wrong(); s.fanfare(); s.startThinking(); s.stopThinking(); });
});
