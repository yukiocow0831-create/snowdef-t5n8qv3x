/**
 * 同窓会アンケート（福岡・2027年10〜11月）
 * スプレッドシートに紐づくウェブアプリ。
 * 実行: setup() を一度。公開: デプロイ > ウェブアプリ。
 * ブラウザからは GET ?action=get と、JSONを text/plain で POST する。
 */
var MAX_NAME = 30;
var MAX_LABEL = 60;
var MAX_NOTE = 100;
var MAX_OPTIONS = 40;
var HEADER_OPTIONS = ['id', 'category', 'label', 'note', 'addedBy', 'createdAt'];
var HEADER_VOTES = ['category', 'optionId', 'voterName', 'value', 'updatedAt'];

function seedOptions_() {
  var now = '2026-01-01T00:00:00.000Z';
  var rows = [
    ['venue-oriental', 'venue', 'オリエンタルホテル福岡 博多ステーション', '筑紫口徒歩1分、同窓会プラン1人10,000円', 'はじめから', now],
    ['venue-clio', 'venue', 'ホテルクリオコート博多', '博多駅徒歩30秒、7,000〜9,000円', 'はじめから', now],
    ['venue-with', 'venue', 'WITH THE STYLE FUKUOKA', '貸切、8,800〜11,800円、客室16室のみ', 'はじめから', now],
    ['date-20271002', 'date', '10/2(土)', '2027年', 'はじめから', now],
    ['date-20271009', 'date', '10/9(土・3連休)', '2027年', 'はじめから', now],
    ['date-20271016', 'date', '10/16(土)', '2027年', 'はじめから', now],
    ['date-20271023', 'date', '10/23(土)', '2027年', 'はじめから', now],
    ['date-20271030', 'date', '10/30(土)', '2027年', 'はじめから', now],
    ['date-20271106', 'date', '11/6(土)', '2027年', 'はじめから', now],
    ['date-20271113', 'date', '11/13(土)', '2027年', 'はじめから', now],
    ['date-20271120', 'date', '11/20(土)', '2027年', 'はじめから', now],
    ['date-20271127', 'date', '11/27(土)', '2027年', 'はじめから', now],
    ['golfplan-zenjitsu', 'golfPlan', '前日ゴルフで2泊', '', 'はじめから', now],
    ['golfplan-toujitsu', 'golfPlan', '当日朝ゴルフで夕方合流', '', 'はじめから', now],
    ['golfplan-nashi', 'golfPlan', 'ゴルフはしない', '', 'はじめから', now],
    ['course-saitozaki', 'golfCourse', '西戸崎シーサイドカントリークラブ', '', 'はじめから', now],
    ['course-ito', 'golfCourse', '伊都ゴルフ倶楽部', '', 'はじめから', now],
    ['course-wakamiya', 'golfCourse', 'トライアルゴルフ若宮コース', '', 'はじめから', now]
  ];
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    out.push({
      id: rows[i][0], category: rows[i][1], label: rows[i][2], note: rows[i][3],
      addedBy: rows[i][4], createdAt: rows[i][5]
    });
  }
  return out;
}

function trimText_(value) {
  return String(value == null ? '' : value).replace(/^\s+|\s+$/g, '');
}

function checkText_(value, max, emptyOk) {
  var text = trimText_(value);
  if (!text) {
    if (emptyOk) return {ok: true, value: ''};
    return {ok: false, error: '空欄は送れません'};
  }
  if (text.length > max) return {ok: false, error: max + '文字までにしてください'};
  return {ok: true, value: text};
}

function isCategory_(category) {
  return category === 'venue' || category === 'date' || category === 'golfPlan' || category === 'golfCourse';
}

function canAddCategory_(category) {
  return category === 'venue' || category === 'date' || category === 'golfCourse';
}

function nowIso_() {
  return new Date().toISOString();
}

function newId_() {
  var rand = Math.random().toString(36).slice(2, 8);
  return 'u' + Date.now().toString(36) + rand;
}

function copyOptions_(list) {
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var o = list[i];
    out.push({
      id: String(o.id), category: String(o.category), label: String(o.label),
      note: String(o.note || ''), addedBy: String(o.addedBy || ''), createdAt: String(o.createdAt || '')
    });
  }
  return out;
}

function copyVotes_(list) {
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var v = list[i];
    out.push({
      category: String(v.category), optionId: String(v.optionId), voterName: String(v.voterName),
      value: String(v.value), updatedAt: String(v.updatedAt || '')
    });
  }
  return out;
}

function publicBody_(result) {
  var body = {ok: !!result.ok};
  if (!result.ok) body.error = result.error || 'できませんでした';
  if (result.options) body.options = copyOptions_(result.options);
  if (result.votes) body.votes = copyVotes_(result.votes);
  return body;
}

function findOption_(store, category, optionId) {
  for (var i = 0; i < store.options.length; i++) {
    var o = store.options[i];
    if (o.category === category && o.id === optionId) return o;
  }
  return null;
}

function dispatch_(store, action, body) {
  if (!store.options) store.options = [];
  if (!store.votes) store.votes = [];
  if (action === 'get') {
    return {ok: true, options: store.options, votes: store.votes, changed: false};
  }
  if (action === 'vote') return applyVote_(store, body || {});
  if (action === 'voteBatch') return applyVoteBatch_(store, body || {});
  if (action === 'addOption') return applyAddOption_(store, body || {});
  return {ok: false, error: '不明な操作です', changed: false};
}

function applyVote_(store, body) {
  var name = checkText_(body.voterName, MAX_NAME, false);
  if (!name.ok) return {ok: false, error: '名前は' + MAX_NAME + '文字までです', changed: false};
  var category = trimText_(body.category);
  if (!isCategory_(category)) return {ok: false, error: '種類が正しくありません', changed: false};
  var optionId = trimText_(body.optionId);
  if (!findOption_(store, category, optionId)) return {ok: false, error: 'その候補は見当たりません', changed: false};
  var value = trimText_(body.value);
  if (category === 'golfPlan') {
    if (value !== 'maru') return {ok: false, error: 'ゴルフの予定は、どれか一つを選んでください', changed: false};
    var kept = [];
    for (var i = 0; i < store.votes.length; i++) {
      var old = store.votes[i];
      if (!(old.category === 'golfPlan' && old.voterName === name.value)) kept.push(old);
    }
    kept.push({
      category: 'golfPlan', optionId: optionId, voterName: name.value, value: 'maru', updatedAt: nowIso_()
    });
    store.votes = kept;
    return {ok: true, options: store.options, votes: store.votes, changed: true};
  }
  if (value !== 'maru' && value !== 'sankaku' && value !== 'batsu') {
    return {ok: false, error: '○△×のどれかを選んでください', changed: false};
  }
  var next = [];
  var replaced = false;
  for (var j = 0; j < store.votes.length; j++) {
    var vote = store.votes[j];
    var same = vote.category === category && vote.optionId === optionId && vote.voterName === name.value;
    if (!same) {
      next.push(vote);
      continue;
    }
    if (vote.value === value) {
      replaced = true;
      continue;
    }
    next.push({
      category: category, optionId: optionId, voterName: name.value, value: value, updatedAt: nowIso_()
    });
    replaced = true;
  }
  if (!replaced) {
    next.push({
      category: category, optionId: optionId, voterName: name.value, value: value, updatedAt: nowIso_()
    });
  }
  store.votes = next;
  return {ok: true, options: store.options, votes: store.votes, changed: true};
}

function applyVoteBatch_(store, body) {
  var name = checkText_(body.voterName, MAX_NAME, false);
  if (!name.ok) return {ok: false, error: '名前は' + MAX_NAME + '文字までです', changed: false};
  var items = body.votes;
  if (!items || typeof items.length !== 'number') return {ok: false, error: '送信の形が正しくありません', changed: false};
  if (items.length > 80) return {ok: false, error: '回答が多すぎます', changed: false};
  var clean = [];
  var seenGolf = false;
  var seenKey = {};
  for (var i = 0; i < items.length; i++) {
    var item = items[i] || {};
    var category = trimText_(item.category);
    if (!isCategory_(category)) return {ok: false, error: '種類が正しくありません', changed: false};
    var optionId = trimText_(item.optionId);
    if (!findOption_(store, category, optionId)) return {ok: false, error: 'その候補は見当たりません', changed: false};
    var value = trimText_(item.value);
    if (category === 'golfPlan') {
      if (value !== 'maru') return {ok: false, error: 'ゴルフの予定は、どれか一つを選んでください', changed: false};
      if (seenGolf) return {ok: false, error: 'ゴルフの予定は、どれか一つを選んでください', changed: false};
      seenGolf = true;
    } else if (value !== 'maru' && value !== 'sankaku' && value !== 'batsu') {
      return {ok: false, error: '○△×のどれかを選んでください', changed: false};
    }
    var key = category + '\n' + optionId;
    if (seenKey[key]) return {ok: false, error: '同じ候補が重なっています', changed: false};
    seenKey[key] = true;
    clean.push({
      category: category, optionId: optionId, voterName: name.value, value: value, updatedAt: nowIso_()
    });
  }
  var kept = [];
  for (var j = 0; j < store.votes.length; j++) {
    if (store.votes[j].voterName !== name.value) kept.push(store.votes[j]);
  }
  store.votes = kept.concat(clean);
  return {ok: true, options: store.options, votes: store.votes, changed: true};
}

function applyAddOption_(store, body) {
  var category = trimText_(body.category);
  if (!canAddCategory_(category)) return {ok: false, error: 'この欄には候補を追加できません', changed: false};
  var label = checkText_(body.label, MAX_LABEL, false);
  if (!label.ok) return {ok: false, error: '候補の名前は' + MAX_LABEL + '文字までです', changed: false};
  var note = checkText_(body.note, MAX_NOTE, true);
  if (!note.ok) return {ok: false, error: 'メモは' + MAX_NOTE + '文字までです', changed: false};
  var who = checkText_(body.addedBy, MAX_NAME, false);
  if (!who.ok) return {ok: false, error: '名前は' + MAX_NAME + '文字までです', changed: false};
  var count = 0;
  for (var i = 0; i < store.options.length; i++) if (store.options[i].category === category) count++;
  if (count >= MAX_OPTIONS) return {ok: false, error: '候補はこれ以上追加できません', changed: false};
  store.options.push({
    id: newId_(), category: category, label: label.value, note: note.value,
    addedBy: who.value, createdAt: nowIso_()
  });
  return {ok: true, options: store.options, votes: store.votes, changed: true};
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  if (typeof LockService === 'undefined') return fn();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function ensureSheet_(ss, name, header) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(header);
  return sheet;
}

function asText_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    try { return value.toISOString(); } catch (e) { return String(value); }
  }
  return value == null ? '' : String(value);
}

function readSheet_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var head = values[0];
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var item = {};
    var any = false;
    for (var c = 0; c < head.length; c++) {
      item[String(head[c])] = asText_(values[r][c]);
      if (item[String(head[c])]) any = true;
    }
    if (any) rows.push(item);
  }
  return rows;
}

function writeSheet_(sheet, header, rows) {
  var width = header.length;
  var last = Math.max(sheet.getLastRow(), 1);
  if (last > 1) sheet.getRange(2, 1, last - 1, width).clearContent();
  if (!rows.length) return;
  var grid = [];
  for (var i = 0; i < rows.length; i++) {
    var line = [];
    for (var c = 0; c < width; c++) line.push(rows[i][header[c]] == null ? '' : String(rows[i][header[c]]));
    grid.push(line);
  }
  sheet.getRange(2, 1, grid.length, width).setValues(grid);
}

function loadStore_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var optionsSheet = ensureSheet_(ss, 'options', HEADER_OPTIONS);
  var votesSheet = ensureSheet_(ss, 'votes', HEADER_VOTES);
  if (optionsSheet.getLastRow() < 2) {
    var seeded = seedOptions_();
    writeSheet_(optionsSheet, HEADER_OPTIONS, seeded);
  }
  return {options: readSheet_(optionsSheet), votes: readSheet_(votesSheet)};
}

function saveStore_(store) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  writeSheet_(ensureSheet_(ss, 'options', HEADER_OPTIONS), HEADER_OPTIONS, store.options);
  writeSheet_(ensureSheet_(ss, 'votes', HEADER_VOTES), HEADER_VOTES, store.votes);
}

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var optionsSheet = ensureSheet_(ss, 'options', HEADER_OPTIONS);
  ensureSheet_(ss, 'votes', HEADER_VOTES);
  if (optionsSheet.getLastRow() < 2) writeSheet_(optionsSheet, HEADER_OPTIONS, seedOptions_());
}

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  try {
    var result = withLock_(function() {
      var store = loadStore_();
      return dispatch_(store, action || 'get', {});
    });
    return json_(publicBody_(result));
  } catch (err) {
    return json_({ok: false, error: '読み込めませんでした。もう一度押してください。'});
  }
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '{}');
  } catch (err) {
    return json_({ok: false, error: '送信の形が正しくありません'});
  }
  if (!body || typeof body !== 'object') return json_({ok: false, error: '送信の形が正しくありません'});
  try {
    var result = withLock_(function() {
      var store = loadStore_();
      var out = dispatch_(store, body.action, body);
      if (out.changed) saveStore_(store);
      return out;
    });
    return json_(publicBody_(result));
  } catch (err2) {
    return json_({ok: false, error: '保存できませんでした。もう一度押してください。'});
  }
}
