// 写真の取得元の設定。手順は SETUP.md を参照。
// driveFolderId と apiKey の両方を入れると、Google ドライブの写真を使います。
// 空のままなら、このフォルダの data/ にある写真（manifest.js）を使います。
window.QUIZ_CONFIG = {
  driveFolderId: '17B4ycxLAngHEy56FrLdA6phkZssvGDq-', // Google ドライブのフォルダ URL の末尾 (…/folders/ここ)
  apiKey: 'AIzaSyAXIgGSA12FCEDpZ6qoIfX_t9e1QYlGT5E'         // Google Cloud で作成した API キー（Drive API のみに制限したもの）
};
