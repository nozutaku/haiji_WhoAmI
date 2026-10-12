// 人物当てクイズのロジック（ブラウザ・Node 両対応の純粋関数群）
(function (root) {
  'use strict';

  var CHOICE_COUNT = 4;
  var IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

  // "テストA_02.jpg" -> { file, person: "テストA" }。最初の「_」より後ろは名前に含めない。画像以外は null
  function parsePhotoName(file) {
    if (!IMAGE_EXT.test(file)) return null;
    var base = file.replace(IMAGE_EXT, '');
    var person = base.split(/[_＿]/)[0].trim();
    if (person === '') return null;
    return { file: file, person: person };
  }

  function uniquePeople(photos) {
    var seen = {};
    var list = [];
    photos.forEach(function (p) {
      if (!seen[p.person]) {
        seen[p.person] = true;
        list.push(p.person);
      }
    });
    return list;
  }

  // Fisher-Yates。元の配列は変更しない
  function shuffle(array, rng) {
    var a = array.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // 正解 + 他の人物から選んだ不正解で 4 択を作り、並びをシャッフルして返す
  function makeChoices(correct, people, rng) {
    var others = people.filter(function (n) { return n !== correct; });
    if (others.length < CHOICE_COUNT - 1) {
      throw new Error('選択肢を作るには少なくとも ' + CHOICE_COUNT + ' 人の写真が必要です');
    }
    var picked = shuffle(others, rng).slice(0, CHOICE_COUNT - 1);
    return shuffle(picked.concat([correct]), rng);
  }

  // photos: [{file, person, url?}]。写真をランダムに count 枚選んで問題にする
  function buildQuestions(photos, count, rng) {
    var people = uniquePeople(photos);
    if (people.length < CHOICE_COUNT) {
      throw new Error('選択肢を作るには少なくとも ' + CHOICE_COUNT + ' 人の写真が必要です');
    }
    var n = Math.min(count, photos.length);
    return shuffle(photos, rng).slice(0, n).map(function (p) {
      return {
        file: p.file,
        url: p.url,
        answer: p.person,
        choices: makeChoices(p.person, people, rng)
      };
    });
  }

  // 間違えた問題だけで出題し直す。選択肢は新しく作り直す
  // answers: [{file, url?, answer, ok}]
  function retryQuestions(answers, people, rng) {
    return answers
      .filter(function (a) { return !a.ok; })
      .map(function (a) {
        return { file: a.file, url: a.url, answer: a.answer, choices: makeChoices(a.answer, people, rng) };
      });
  }

  var POINTS_PER_QUESTION = 10;

  // 結果集計。正答率は小数点以下を四捨五入した % 、得点は 1 問 10 点
  function summarize(correct, total) {
    if (!(total > 0) || correct < 0 || correct > total) {
      throw new Error('不正な集計値です: ' + correct + ' / ' + total);
    }
    return {
      correct: correct,
      total: total,
      percent: Math.round((correct / total) * 100),
      points: correct * POINTS_PER_QUESTION,
      maxPoints: total * POINTS_PER_QUESTION
    };
  }

  var api = {
    CHOICE_COUNT: CHOICE_COUNT,
    POINTS_PER_QUESTION: POINTS_PER_QUESTION,
    summarize: summarize,
    retryQuestions: retryQuestions,
    parsePhotoName: parsePhotoName,
    uniquePeople: uniquePeople,
    shuffle: shuffle,
    makeChoices: makeChoices,
    buildQuestions: buildQuestions
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Quiz = api;
})(typeof window !== 'undefined' ? window : globalThis);
