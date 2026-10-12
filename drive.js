// Google ドライブの共有フォルダから、クイズ用の写真一覧を取得する。ブラウザ・Node 両対応
// 写真は「名前_連番.jpg」の形式で置く（名前の決め方は quiz.js の parsePhotoName と同じ）
(function (root) {
  'use strict';

  var API = 'https://www.googleapis.com/drive/v3/files';
  var Quiz = (typeof module !== 'undefined' && module.exports) ? require('./quiz.js') : root.Quiz;

  // フォルダ ID は英数字・_・- のみ（検索条件に埋め込むため、それ以外は拒否する）
  function isValidFolderId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{10,}$/.test(id);
  }

  function buildListUrl(folderId, apiKey, pageToken) {
    var q = "'" + folderId + "' in parents and trashed = false and mimeType contains 'image/'";
    var params = [
      'q=' + encodeURIComponent(q),
      'fields=' + encodeURIComponent('nextPageToken,files(id,name)'),
      'pageSize=1000',
      'orderBy=name',
      'key=' + encodeURIComponent(apiKey)
    ];
    if (pageToken) params.push('pageToken=' + encodeURIComponent(pageToken));
    return API + '?' + params.join('&');
  }

  // 共有された写真の表示用 URL（幅 width px の縮小画像）
  function imageUrl(fileId, width) {
    return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w' + (width || 1000);
  }

  function httpErrorMessage(status) {
    if (status === 400) return 'APIキーが正しくありません。config.js の apiKey を確認してください。';
    if (status === 403) return 'フォルダを読み取れません。共有設定（リンクを知っている全員が閲覧可）と、Drive API の有効化・APIキーの制限を確認してください。';
    if (status === 404) return 'フォルダが見つかりません。config.js の driveFolderId を確認してください。';
    return 'Google ドライブから写真を取得できませんでした（エラー ' + status + '）。';
  }

  // config: { driveFolderId, apiKey }。fetchFn: fetch 互換関数（テスト用に差し替え可）
  // 戻り値: Promise<[{ file, person, url }]>。名前の付け方が違う・画像でないファイルは除く
  async function listPhotos(config, fetchFn) {
    if (!config || !isValidFolderId(config.driveFolderId)) {
      throw new Error('driveFolderId が正しくありません。config.js を確認してください。');
    }
    if (!config.apiKey) {
      throw new Error('apiKey が設定されていません。config.js を確認してください。');
    }
    var photos = [];
    var pageToken = '';
    do {
      var res = await fetchFn(buildListUrl(config.driveFolderId, config.apiKey, pageToken));
      if (!res.ok) throw new Error(httpErrorMessage(res.status));
      var body = await res.json();
      (body.files || []).forEach(function (f) {
        var parsed = Quiz.parsePhotoName(f.name);
        if (parsed) photos.push({ file: f.name, person: parsed.person, url: imageUrl(f.id) });
      });
      pageToken = body.nextPageToken || '';
    } while (pageToken);
    return photos;
  }

  var api = {
    isValidFolderId: isValidFolderId,
    buildListUrl: buildListUrl,
    imageUrl: imageUrl,
    httpErrorMessage: httpErrorMessage,
    listPhotos: listPhotos
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DriveSource = api;
})(typeof window !== 'undefined' ? window : globalThis);
