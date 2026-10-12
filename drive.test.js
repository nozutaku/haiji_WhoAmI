// 実行: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const Quiz = require('./quiz.js');
const Drive = require('./drive.js');

const FOLDER = '1AbCdEfGhIjKlMnOpQrStUvWxYz_-012';
const CONFIG = { driveFolderId: FOLDER, apiKey: 'KEY123' };

// 渡された URL を記録し、用意した応答を順に返す偽の fetch
function fakeFetch(responses) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const r = responses[calls.length - 1];
    return { ok: r.status === undefined || r.status === 200, status: r.status || 200, json: async () => r.body };
  };
  fn.calls = calls;
  return fn;
}

test('isValidFolderId: 英数字・_・- のフォルダ ID だけを受け付ける', () => {
  assert.equal(Drive.isValidFolderId(FOLDER), true);
  assert.equal(Drive.isValidFolderId(''), false);
  assert.equal(Drive.isValidFolderId('short'), false);
  assert.equal(Drive.isValidFolderId("abc' or name contains 'x"), false); // 検索条件の注入を防ぐ
  assert.equal(Drive.isValidFolderId(undefined), false);
});

test('buildListUrl: フォルダ内の画像・ゴミ箱以外を指定し、キーとページを付ける', () => {
  const u = new URL(Drive.buildListUrl(FOLDER, 'KEY123', 'TOKEN_2'));
  assert.equal(u.origin + u.pathname, 'https://www.googleapis.com/drive/v3/files');
  assert.equal(u.searchParams.get('key'), 'KEY123');
  assert.equal(u.searchParams.get('pageToken'), 'TOKEN_2');
  const q = u.searchParams.get('q');
  assert.ok(q.includes(`'${FOLDER}' in parents`));
  assert.ok(q.includes('trashed = false'));
  assert.ok(q.includes("mimeType contains 'image/'"));
});

test('buildListUrl: ページトークンがなければ pageToken を付けない', () => {
  assert.equal(new URL(Drive.buildListUrl(FOLDER, 'K')).searchParams.has('pageToken'), false);
});

test('imageUrl: ファイル ID と幅を含む表示用 URL を作る', () => {
  assert.equal(Drive.imageUrl('abc123', 800), 'https://drive.google.com/thumbnail?id=abc123&sz=w800');
  assert.equal(Drive.imageUrl('abc123'), 'https://drive.google.com/thumbnail?id=abc123&sz=w1000');
});

test('listPhotos: ファイル名から人物名を取り出し、表示用 URL を付ける', async () => {
  const f = fakeFetch([{ body: { files: [
    { id: 'id1', name: 'テストA_01.jpg' },
    { id: 'id2', name: 'テストB_02.png' },
  ] } }]);
  const photos = await Drive.listPhotos(CONFIG, f);
  assert.deepEqual(photos, [
    { file: 'テストA_01.jpg', person: 'テストA', url: 'https://drive.google.com/thumbnail?id=id1&sz=w1000' },
    { file: 'テストB_02.png', person: 'テストB', url: 'https://drive.google.com/thumbnail?id=id2&sz=w1000' },
  ]);
});

test('listPhotos: 「_」以降は名前に含めない（ローカルの写真と同じ規則）', async () => {
  const f = fakeFetch([{ body: { files: [{ id: 'i', name: 'テストH_01 copy.jpg' }] } }]);
  const [p] = await Drive.listPhotos(CONFIG, f);
  assert.equal(p.person, 'テストH');
  assert.equal(p.person, Quiz.parsePhotoName(p.file).person);
});

test('listPhotos: 画像でない名前のファイルは除く', async () => {
  const f = fakeFetch([{ body: { files: [
    { id: 'a', name: 'memo.txt' },
    { id: 'b', name: 'テストE_01.jpg' },
  ] } }]);
  const photos = await Drive.listPhotos(CONFIG, f);
  assert.deepEqual(photos.map((p) => p.person), ['テストE']);
});

test('listPhotos: 複数ページを最後まで取得する', async () => {
  const f = fakeFetch([
    { body: { files: [{ id: '1', name: 'テストA_01.jpg' }], nextPageToken: 'P2' } },
    { body: { files: [{ id: '2', name: 'テストA_02.jpg' }], nextPageToken: 'P3' } },
    { body: { files: [{ id: '3', name: 'テストB_01.jpg' }] } },
  ]);
  const photos = await Drive.listPhotos(CONFIG, f);
  assert.equal(photos.length, 3);
  assert.equal(f.calls.length, 3);
  assert.equal(new URL(f.calls[1]).searchParams.get('pageToken'), 'P2');
  assert.equal(new URL(f.calls[2]).searchParams.get('pageToken'), 'P3');
});

test('listPhotos: フォルダが空なら空配列', async () => {
  assert.deepEqual(await Drive.listPhotos(CONFIG, fakeFetch([{ body: {} }])), []);
});

test('listPhotos: HTTP エラーはステータスに応じた日本語メッセージで失敗する', async () => {
  await assert.rejects(Drive.listPhotos(CONFIG, fakeFetch([{ status: 403, body: {} }])), /共有設定/);
  await assert.rejects(Drive.listPhotos(CONFIG, fakeFetch([{ status: 404, body: {} }])), /フォルダが見つかりません/);
  await assert.rejects(Drive.listPhotos(CONFIG, fakeFetch([{ status: 400, body: {} }])), /APIキー/);
  await assert.rejects(Drive.listPhotos(CONFIG, fakeFetch([{ status: 500, body: {} }])), /500/);
});

test('listPhotos: フォルダ ID・APIキーが未設定／不正なら、通信せずに失敗する', async () => {
  const f = fakeFetch([]);
  await assert.rejects(Drive.listPhotos({ driveFolderId: '', apiKey: 'K' }, f), /driveFolderId/);
  await assert.rejects(Drive.listPhotos({ driveFolderId: FOLDER, apiKey: '' }, f), /apiKey/);
  await assert.rejects(Drive.listPhotos(undefined, f), /driveFolderId/);
  assert.equal(f.calls.length, 0);
});

test('quiz との連携: ドライブの写真から作った問題が url を保持し、再出題でも引き継ぐ', async () => {
  const names = ['テストA', 'テストB', 'テストC', 'テストE', 'テストG'];
  const f = fakeFetch([{ body: { files: names.map((n, i) => ({ id: 'id' + i, name: `${n}_01.jpg` })) } }]);
  const photos = await Drive.listPhotos(CONFIG, f);
  const qs = Quiz.buildQuestions(photos, 5, () => 0.3);
  qs.forEach((q) => {
    const src = photos.find((p) => p.file === q.file);
    assert.equal(q.url, src.url);
    assert.ok(q.url.startsWith('https://drive.google.com/thumbnail?id='));
  });
  const answers = qs.map((q) => ({ file: q.file, url: q.url, answer: q.answer, ok: false }));
  const retry = Quiz.retryQuestions(answers, Quiz.uniquePeople(photos), () => 0.3);
  assert.deepEqual(retry.map((q) => q.url), qs.map((q) => q.url));
});
