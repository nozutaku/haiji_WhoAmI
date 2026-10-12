// 実行: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const Quiz = require('./quiz.js');

// 再現性のある疑似乱数 (mulberry32)
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PHOTOS = [
  { file: 'テストA_01.jpg', person: 'テストA' },
  { file: 'テストA_02.jpg', person: 'テストA' },
  { file: 'テストB_01.jpg', person: 'テストB' },
  { file: 'テストC_01.jpg', person: 'テストC' },
  { file: 'テストD_01.jpg', person: 'テストD' },
  { file: 'テストE_01.jpg', person: 'テストE' },
  { file: 'テストF_01.jpg', person: 'テストF' },
];

test('parsePhotoName: 連番付きファイル名から人物名を取り出す', () => {
  assert.deepEqual(Quiz.parsePhotoName('テストA_02.jpg'), { file: 'テストA_02.jpg', person: 'テストA' });
  assert.equal(Quiz.parsePhotoName('テストK_01.JPG').person, 'テストK');
  assert.equal(Quiz.parsePhotoName('テストH_10.png').person, 'テストH');
});

test('parsePhotoName: 最初の _ より後ろは、連番以外の文字でも名前に含めない', () => {
  assert.equal(Quiz.parsePhotoName('テストH_01 copy.jpg').person, 'テストH');
  assert.equal(Quiz.parsePhotoName('taro_jr_03.jpg').person, 'taro');
  assert.equal(Quiz.parsePhotoName('テストA_旅行_2020.png').person, 'テストA');
  assert.equal(Quiz.parsePhotoName('テストJ＿01.jpg').person, 'テストJ');
});

test('parsePhotoName: 名前に数字を含んでいても、_ の前までは残す', () => {
  assert.equal(Quiz.parsePhotoName('テストJ2_01.jpg').person, 'テストJ2');
});

test('parsePhotoName: 連番なしはファイル名全体を人物名とする', () => {
  assert.equal(Quiz.parsePhotoName('テストI.jpeg').person, 'テストI');
});

test('parsePhotoName: 画像以外・人物名が空のものは null', () => {
  assert.equal(Quiz.parsePhotoName('memo.txt'), null);
  assert.equal(Quiz.parsePhotoName('_01.jpg'), null);
  assert.equal(Quiz.parsePhotoName('.jpg'), null);
});

test('uniquePeople: 同じ人物の複数写真を1人として数える', () => {
  assert.deepEqual(Quiz.uniquePeople(PHOTOS), ['テストA', 'テストB', 'テストC', 'テストD', 'テストE', 'テストF']);
});

test('shuffle: 全要素を保持し、元の配列を変更しない', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const copy = src.slice();
  const out = Quiz.shuffle(src, seeded(1));
  assert.deepEqual(src, copy);
  assert.deepEqual(out.slice().sort((a, b) => a - b), copy);
  assert.notDeepEqual(out, copy);
});

test('shuffle: 空配列・1要素でも動く', () => {
  assert.deepEqual(Quiz.shuffle([], seeded(1)), []);
  assert.deepEqual(Quiz.shuffle(['a'], seeded(1)), ['a']);
});

test('makeChoices: 4択で重複がなく、正解を必ず1つ含む（多数回試行）', () => {
  const people = Quiz.uniquePeople(PHOTOS);
  for (let seed = 0; seed < 200; seed++) {
    const choices = Quiz.makeChoices('テストB', people, seeded(seed));
    assert.equal(choices.length, 4);
    assert.equal(new Set(choices).size, 4);
    assert.equal(choices.filter((c) => c === 'テストB').length, 1);
    choices.forEach((c) => assert.ok(people.includes(c)));
  }
});

test('makeChoices: 正解の位置が試行によってばらける', () => {
  const people = Quiz.uniquePeople(PHOTOS);
  const positions = new Set();
  for (let seed = 0; seed < 100; seed++) {
    positions.add(Quiz.makeChoices('テストA', people, seeded(seed)).indexOf('テストA'));
  }
  assert.deepEqual([...positions].sort(), [0, 1, 2, 3]);
});

test('makeChoices: ちょうど4人なら全員が選択肢になる（境界値）', () => {
  const choices = Quiz.makeChoices('A', ['A', 'B', 'C', 'D'], seeded(3));
  assert.deepEqual(choices.slice().sort(), ['A', 'B', 'C', 'D']);
});

test('makeChoices: 3人以下ならエラー', () => {
  assert.throws(() => Quiz.makeChoices('A', ['A', 'B', 'C'], seeded(1)), /4 人/);
});

test('summarize: 7/10 問正解なら 70%・70 点（満点 100 点）', () => {
  assert.deepEqual(Quiz.summarize(7, 10), {
    correct: 7, total: 10, percent: 70, points: 70, maxPoints: 100,
  });
});

test('summarize: 全問正解は 100%、全問不正解は 0%（境界値）', () => {
  assert.equal(Quiz.summarize(10, 10).percent, 100);
  assert.equal(Quiz.summarize(10, 10).points, 100);
  assert.equal(Quiz.summarize(0, 10).percent, 0);
  assert.equal(Quiz.summarize(0, 10).points, 0);
});

test('summarize: 正答率は四捨五入、問題数が10でなくても満点は問題数×10点', () => {
  assert.equal(Quiz.summarize(1, 3).percent, 33);
  assert.equal(Quiz.summarize(2, 3).percent, 67);
  assert.equal(Quiz.summarize(2, 3).maxPoints, 30);
  assert.equal(Quiz.summarize(2, 3).points, 20);
});

test('summarize: 問題数 0・正解数が範囲外ならエラー', () => {
  assert.throws(() => Quiz.summarize(0, 0), /不正/);
  assert.throws(() => Quiz.summarize(-1, 10), /不正/);
  assert.throws(() => Quiz.summarize(11, 10), /不正/);
});

test('retryQuestions: 間違えた問題だけを、新しい4択で出題し直す', () => {
  const people = Quiz.uniquePeople(PHOTOS);
  const answers = [
    { file: 'テストA_01.jpg', answer: 'テストA', picked: 'テストB', ok: false },
    { file: 'テストB_01.jpg', answer: 'テストB', picked: 'テストB', ok: true },
    { file: 'テストE_01.jpg', answer: 'テストE', picked: 'テストC', ok: false },
  ];
  const qs = Quiz.retryQuestions(answers, people, seeded(5));
  assert.deepEqual(qs.map((q) => q.file), ['テストA_01.jpg', 'テストE_01.jpg']);
  qs.forEach((q) => {
    assert.equal(q.choices.length, 4);
    assert.equal(new Set(q.choices).size, 4);
    assert.ok(q.choices.includes(q.answer));
  });
});

test('retryQuestions: 全問正解なら空配列', () => {
  const people = Quiz.uniquePeople(PHOTOS);
  const answers = [{ file: 'テストA_01.jpg', answer: 'テストA', picked: 'テストA', ok: true }];
  assert.deepEqual(Quiz.retryQuestions(answers, people, seeded(1)), []);
});

test('buildQuestions: 指定数の問題を、同じ写真を重複させずに作る', () => {
  const qs = Quiz.buildQuestions(PHOTOS, 5, seeded(7));
  assert.equal(qs.length, 5);
  assert.equal(new Set(qs.map((q) => q.file)).size, 5);
});

test('buildQuestions: answer は写真ファイルの人物と一致し、選択肢に含まれる', () => {
  const personOf = Object.fromEntries(PHOTOS.map((p) => [p.file, p.person]));
  Quiz.buildQuestions(PHOTOS, 7, seeded(11)).forEach((q) => {
    assert.equal(q.answer, personOf[q.file]);
    assert.ok(q.choices.includes(q.answer));
    assert.equal(q.choices.length, 4);
  });
});

test('buildQuestions: 写真数より多い問題数を指定すると写真数に切り詰める', () => {
  assert.equal(Quiz.buildQuestions(PHOTOS, 100, seeded(1)).length, PHOTOS.length);
});

test('buildQuestions: 3人分しか写真がなければエラー', () => {
  const few = PHOTOS.filter((p) => ['テストA', 'テストB', 'テストC'].includes(p.person));
  assert.throws(() => Quiz.buildQuestions(few, 3, seeded(1)), /4 人/);
});
