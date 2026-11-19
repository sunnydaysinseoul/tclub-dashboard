/* 체육관 전광판 - 설치 없이 브라우저만으로 동작 */
(function () {
  'use strict';

  var BASE_W = 1920;                       // 모든 px 값은 1920px 너비 화면 기준
  var CFG = window.BOARD_CONFIG || {};
  var HTML_FIELDS = ['missionDate', 'missionTitle', 'missionBody', 'lessonDate', 'lessonTitle', 'lessonBody'];
  var SINGLE_LINE = { missionDate: 1, missionTitle: 1, lessonDate: 1, lessonTitle: 1 };
  var WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

  var DEFAULT_BOARD = {
    missionDate: '11월 16일~27일',
    missionTitle: '이번주 미션',
    missionBody: '<div><span style="font-weight:700">- 3km 달리기 인증 시 뽑기 3회</span></div><div><span style="font-weight:700;color:#FFD400">- 매일 참여 가능</span></div>',
    lessonDate: '',
    lessonTitle: '오늘의 수업',
    lessonBody: '<div><span style="font-weight:700">1. 워밍업</span> : 줄넘기 3라운드 + 쉐도우 2라운드</div>' +
      '<div><span style="font-weight:700">2. 미트 트레이닝</span> : 원투 - 레프트 훅 - 로우킥</div>' +
      '<div><span style="font-weight:700">3. 샌드백</span> : 콤비네이션 3분 4라운드</div>' +
      '<div><span style="font-weight:700;color:#FFD400">4. 마무리 체력</span><span style="color:#FFD400"> : 버피 30회 + 플랭크 3분</span></div>',
    notice: '12월 25일 체육관 휴관합니다.'
  };

  var $ = function (id) { return document.getElementById(id); };
  var MOBILE = document.body.classList.contains('mobile');   // mobile.html (휴대폰 편집 화면)
  var dirty = false;                                          // 휴대폰 화면에서 아직 저장 안 한 수정이 있는지
  var stage = $('stage'), toolbar = $('toolbar'), statusEl = $('status');

  var board = clone(DEFAULT_BOARD);  // 마지막으로 저장된 내용
  var editing = false;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* =========================================================
   * 화면 크기 맞추기: 1920px 기준 화면을 모니터 크기에 맞게 확대/축소
   * (가로 비율이 달라도 세로 길이는 화면에 맞게 늘어나거나 줄어듦)
   * ======================================================= */
  function fit() {
    if (MOBILE) {
      // 휴대폰: 대시보드 한쪽(960px)을 화면 너비에 맞게 줄여서 실제와 똑같이 미리 보기
      Array.prototype.forEach.call(document.querySelectorAll('.m-frame'), function (fr) {
        var p = fr.firstElementChild;
        if (p) p.style.zoom = fr.clientWidth / 960;
      });
      return;
    }
    // 편집 중에도 실제 전광판과 똑같은 비율로 보이도록 전체 화면 기준 크기를 유지
    var top = editing ? toolbar.offsetHeight : 0;
    var full = window.innerWidth / BASE_W;
    var h = window.innerHeight / full;
    var s = Math.min(full, (window.innerHeight - top) / h);
    stage.style.top = top + 'px';
    stage.style.left = ((window.innerWidth - BASE_W * s) / 2) + 'px';
    stage.style.height = h + 'px';
    stage.style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', function () { fit(); checkOverflow(); });

  /* =========================================================
   * 서식 모델
   * 편집 영역의 내용을 "줄 > 글자(글자별 서식)" 구조로 읽은 뒤
   * 항상 같은 모양의 깔끔한 HTML로 다시 그립니다.
   * 그래서 크기/색을 몇 번을 바꿔도 태그가 겹겹이 꼬이지 않고,
   * 글자 크기는 항상 정확한 px 값 하나만 남습니다.
   * 저장된 HTML을 화면에 넣을 때도 이 과정을 거치므로
   * 허용된 서식(크기, 굵기, 밑줄, 색) 외의 코드는 모두 걸러집니다.
   * ======================================================= */
  var BLOCK = /^(DIV|P|LI|UL|OL|H[1-6]|BLOCKQUOTE|SECTION|ARTICLE|TR|PRE)$/;

  function safeColor(c) {
    c = String(c || '').trim();
    if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c)) return c.toUpperCase();
    var m = c.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (m) {
      return '#' + [m[1], m[2], m[3]].map(function (n) {
        return ('0' + Math.min(255, +n).toString(16)).slice(-2);
      }).join('').toUpperCase();
    }
    return null;
  }

  function readStyle(el, st) {
    var s = { size: st.size, weight: st.weight, underline: st.underline, color: st.color };
    var tag = el.tagName;
    if (tag === 'B' || tag === 'STRONG') s.weight = 700;
    if (tag === 'U') s.underline = true;
    if (tag === 'FONT' && el.getAttribute('color')) { var fc = safeColor(el.getAttribute('color')); if (fc) s.color = fc; }
    var cs = el.style;
    if (!cs) return s;
    if (cs.fontSize && /px$/.test(cs.fontSize)) {
      var v = Math.round(parseFloat(cs.fontSize));
      if (v > 0) s.size = v;
    }
    if (cs.fontWeight) {
      var fw = cs.fontWeight === 'bold' ? 700 : cs.fontWeight === 'normal' ? 400 : parseInt(cs.fontWeight, 10);
      if (fw) s.weight = fw >= 600 ? 700 : 400;
    }
    var td = cs.textDecorationLine || cs.textDecoration;
    if (td) { if (td.indexOf('underline') >= 0) s.underline = true; else if (td.indexOf('none') >= 0) s.underline = null; }
    if (cs.color) { var c = safeColor(cs.color); if (c) s.color = c; }
    return s;
  }

  // root 안의 내용을 줄 배열로 읽기. sel이 있으면 선택 위치도 [줄, 글자] 로 변환
  function readModel(root, sel) {
    var lines = [[]], atStart = true, pos = { start: null, end: null };
    var EMPTY = { size: null, weight: null, underline: null, color: null };

    function cur() { return lines[lines.length - 1]; }
    function brk() { lines.push([]); atStart = true; }
    function mark(node, off) {
      if (!sel) return;
      if (node === sel.sc && off === sel.so && !pos.start) pos.start = [lines.length - 1, cur().length];
      if (node === sel.ec && off === sel.eo && !pos.end) pos.end = [lines.length - 1, cur().length];
    }

    function walk(n, st) {
      if (n.nodeType === 3) {
        var t = n.nodeValue;
        for (var i = 0; i < t.length; i++) {
          mark(n, i);
          var ch = t.charAt(i);
          if (ch === '\n') { brk(); continue; }
          if (ch === '\r' || ch === '​' || ch === '﻿') continue;
          if (ch === ' ') ch = ' ';
          cur().push({ c: ch, s: st });
          atStart = false;
        }
        mark(n, t.length);
        return;
      }
      if (n.nodeType !== 1) return;
      var tag = n.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE') return;
      if (tag === 'BR') {
        var p = n.parentNode;
        if (!n.nextSibling && p && p !== root && BLOCK.test(p.tagName)) atStart = false; // 블록 끝의 <br>은 빈 줄 표시용
        else brk();
        return;
      }
      var isBlock = n !== root && BLOCK.test(tag);
      var st2 = n === root ? st : readStyle(n, st);
      if (isBlock && !atStart) brk();
      for (var k = 0; k < n.childNodes.length; k++) { mark(n, k); walk(n.childNodes[k], st2); }
      mark(n, n.childNodes.length);
      if (isBlock && !atStart) brk();
    }

    walk(root, EMPTY);
    if (lines.length > 1 && cur().length === 0) {
      // 마지막 빈 줄 제거 (선택 위치가 걸려 있으면 앞 줄 끝으로)
      var last = lines.length - 1, prevLen = lines[last - 1].length;
      lines.pop();
      ['start', 'end'].forEach(function (k) {
        if (pos[k] && pos[k][0] === last) pos[k] = [last - 1, prevLen];
      });
    }
    return { lines: lines, pos: pos };
  }

  function styleKey(s) { return [s.size, s.weight, s.underline, s.color].join('|'); }
  function styleCss(s) {
    var css = [];
    if (s.size) css.push('font-size:' + s.size + 'px');
    if (s.weight) css.push('font-weight:' + s.weight);
    if (s.underline) css.push('text-decoration:underline');
    if (s.color) css.push('color:' + s.color);
    return css.join(';');
  }

  // 줄 배열을 깔끔한 HTML로 다시 그림. pos가 있으면 선택 영역을 되살림
  function writeModel(host, lines, pos) {
    host.innerHTML = '';
    var pts = { start: null, end: null };
    var onlyEmpty = lines.length === 1 && lines[0].length === 0;
    if (onlyEmpty) return pts;

    lines.forEach(function (line, li) {
      var div = document.createElement('div');
      if (!line.length) {
        div.appendChild(document.createElement('br'));
        ['start', 'end'].forEach(function (k) { if (pos && pos[k] && pos[k][0] === li && !pts[k]) pts[k] = [div, 0]; });
      } else {
        var i = 0;
        while (i < line.length) {
          var key = styleKey(line[i].s), j = i, text = '';
          while (j < line.length && styleKey(line[j].s) === key) { text += line[j].c; j++; }
          var tn = document.createTextNode(text), css = styleCss(line[i].s);
          if (css) { var sp = document.createElement('span'); sp.setAttribute('style', css); sp.appendChild(tn); div.appendChild(sp); }
          else div.appendChild(tn);
          for (var k2 = 0, ks = ['start', 'end']; k2 < 2; k2++) {
            var k = ks[k2];
            if (pos && pos[k] && !pts[k] && pos[k][0] === li && pos[k][1] >= i && pos[k][1] <= j) pts[k] = [tn, pos[k][1] - i];
          }
          i = j;
        }
      }
      host.appendChild(div);
    });
    return pts;
  }

  // 저장된 HTML을 정리해서 영역에 넣기
  function setHtml(host, html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = String(html || '');
    var m = readModel(tmp);
    if (SINGLE_LINE[host.id]) m.lines = [Array.prototype.concat.apply([], m.lines)];
    writeModel(host, m.lines);
  }
  // 영역 내용을 정리한 HTML로 꺼내기
  function getHtml(host) {
    var m = readModel(host);
    if (SINGLE_LINE[host.id]) m.lines = [Array.prototype.concat.apply([], m.lines)];
    writeModel(host, m.lines);
    return host.textContent.trim() ? host.innerHTML : '';
  }
  function plainText(html) {
    var tmp = document.createElement('div');
    var m = readModel((tmp.innerHTML = String(html || ''), tmp));
    return m.lines.map(function (l) { return l.map(function (x) { return x.c; }).join(''); }).join('\n').trim();
  }

  /* =========================================================
   * 화면 그리기
   * ======================================================= */
  function todayLabel() {
    var d = new Date();
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WEEKDAYS[d.getDay()];
  }

  function render() {
    HTML_FIELDS.forEach(function (f) { setHtml($(f), board[f]); });
    if (!editing && !plainText(board.lessonDate)) $('lessonDate').textContent = todayLabel();
    $('noticeEdit').textContent = board.notice || '';
    buildTicker();
  }

  function buildTicker() {
    var track = $('tickerTrack'), view = $('tickerView');
    if (!track || !view) return;
    var text = (board.notice || '').replace(/\s+/g, ' ').trim();
    track.style.animation = 'none';
    track.innerHTML = '';
    if (!text) return;
    var one = document.createElement('span');
    one.textContent = text;
    track.appendChild(one);
    var unit = one.offsetWidth || 1, need = view.offsetWidth || BASE_W;
    var copies = Math.max(1, Math.ceil(need / unit));
    track.innerHTML = '';
    for (var i = 0; i < copies * 2; i++) {
      var s = document.createElement('span');
      s.textContent = text;
      track.appendChild(s);
    }
    var speed = 140; // 1초에 움직이는 거리(px, 1920 기준)
    var dist = unit * copies;
    void track.offsetWidth;
    track.style.animation = 'tick ' + (dist / speed).toFixed(2) + 's linear infinite';
  }

  // 날짜가 바뀌면 자동 날짜 갱신
  var lastDay = new Date().getDate();
  setInterval(function () {
    if (new Date().getDate() !== lastDay) {
      lastDay = new Date().getDate();
      if (!editing) render();
    }
  }, 30000);

  // 매일 새벽 4시에 새로고침 (오래 켜 두는 PC 대비)
  (function scheduleReload() {
    if (MOBILE) return;
    var now = new Date(), t = new Date(now);
    t.setHours(4, 0, 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    setTimeout(function tryReload() {
      if (editing) { setTimeout(tryReload, 10 * 60 * 1000); return; }
      location.reload();
    }, t - now);
  })();

  // 마우스를 3초간 움직이지 않으면 커서와 편집 버튼 숨김
  var idleTimer = null;
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { if (!editing) document.body.classList.add('idle'); }, 3000);
  }
  ['mousemove', 'mousedown', 'touchstart', 'keydown'].forEach(function (e) { document.addEventListener(e, wake, { passive: true }); });
  wake();

  /* =========================================================
   * 저장소: Firebase가 설정되어 있으면 Firestore,
   * 아니면 이 브라우저의 localStorage (미리보기 모드)
   * ======================================================= */
  var store = (function () {
    var fb = CFG.firebase;
    var ok = fb && fb.apiKey && typeof firebase !== 'undefined';
    if (ok) {
      try {
        firebase.initializeApp(fb);
        var auth = firebase.auth(), db = firebase.firestore();
        db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
        var boardRef = db.collection('board').doc('main');
        return {
          mode: 'firebase',
          subscribe: function (cb) {
            boardRef.onSnapshot(function (d) { if (d.exists) cb(d.data()); },
              function (e) { console.warn('[전광판] 불러오기 실패', e); });
          },
          save: function (data) { return boardRef.set(data); },
          listArchive: function () {
            return db.collection('archive').orderBy('usedAt', 'desc').limit(500).get()
              .then(function (q) { return q.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); });
          },
          putArchive: function (id, item) { return db.collection('archive').doc(id).set(item, { merge: true }); },
          delArchive: function (id) { return db.collection('archive').doc(id).delete(); },
          isAuthed: function () { return !!auth.currentUser; },
          onAuth: function (cb) { auth.onAuthStateChanged(cb); },
          signIn: function (pw) { return auth.signInWithEmailAndPassword(CFG.adminEmail, pw); },
          signOut: function () { return auth.signOut(); }
        };
      } catch (e) {
        console.error('[전광판] Firebase 설정 오류, 미리보기 모드로 실행합니다.', e);
      }
    }
    var KB = 'gymboard.board', KA = 'gymboard.archive';
    function get(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
    function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    return {
      mode: 'local',
      subscribe: function (cb) {
        var b = get(KB, null); if (b) cb(b);
        window.addEventListener('storage', function (e) { if (e.key === KB) { var v = get(KB, null); if (v) cb(v); } });
      },
      save: function (data) { put(KB, data); return Promise.resolve(); },
      listArchive: function () {
        var a = get(KA, {});
        return Promise.resolve(Object.keys(a).map(function (id) { var o = a[id]; o.id = id; return o; })
          .sort(function (x, y) { return (y.usedAt || 0) - (x.usedAt || 0); }));
      },
      putArchive: function (id, item) {
        var a = get(KA, {}); a[id] = Object.assign(a[id] || {}, item); put(KA, a); return Promise.resolve();
      },
      delArchive: function (id) { var a = get(KA, {}); delete a[id]; put(KA, a); return Promise.resolve(); },
      isAuthed: function () { return true; },
      onAuth: function () {},
      signIn: function () { return Promise.resolve(); },
      signOut: function () { return Promise.resolve(); }
    };
  })();

  // 마지막 내용 캐시 (인터넷이 잠깐 끊겨도 화면 유지)
  var CACHE = 'gymboard.cache';
  try { var cached = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (cached) board = Object.assign(clone(DEFAULT_BOARD), cached); } catch (e) {}

  function onBoard(data) {
    board = Object.assign(clone(DEFAULT_BOARD), data);
    delete board.updatedAt;
    try { localStorage.setItem(CACHE, JSON.stringify(board)); } catch (e) {}
    if (!editing || (MOBILE && !dirty)) { render(); checkOverflow(); }
  }

  /* =========================================================
   * 편집 모드
   * ======================================================= */
  var editables = HTML_FIELDS.map($).concat([$('noticeEdit')]);

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = kind || '';
  }
  function modeNote() {
    return store.mode === 'local'
      ? '미리보기 모드: Firebase가 아직 연결되지 않아 이 브라우저에만 저장됩니다.'
      : '글자를 드래그해서 선택한 뒤 크기, 굵게, 밑줄, 색을 바꾸세요. 다 고치면 "저장 및 적용"을 눌러 주세요.';
  }

  function enterEdit() {
    editing = true;
    document.body.classList.add('editing');
    document.body.classList.remove('idle');
    toolbar.hidden = false;
    render();
    editables.forEach(function (el) { el.setAttribute('contenteditable', 'true'); el.spellcheck = false; });
    setStatus(modeNote(), store.mode === 'local' ? 'warn' : '');
    fit();
    checkOverflow();
  }

  function exitEdit() {
    if (MOBILE) {
      // 휴대폰 화면은 항상 편집 상태: 마지막 저장 내용으로 다시 그리기만 함
      dirty = false;
      savedRange = null;
      paintSaved();
      render();
      checkOverflow();
      return;
    }
    editing = false;
    document.body.classList.remove('editing');
    toolbar.hidden = true;
    editables.forEach(function (el) { el.removeAttribute('contenteditable'); el.classList.remove('overflow'); });
    savedRange = null;
    paintSaved();
    fit();
    render();
    wake();
  }

  if ($('editBtn')) $('editBtn').addEventListener('click', function () {
    if (store.isAuthed()) enterEdit();
    else openModal('loginModal');
  });

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = $('pwInput').value;
    $('loginErr').textContent = '';
    if (!CFG.adminEmail) { $('loginErr').textContent = 'config.js에 관리자 이메일(adminEmail)이 비어 있어요.'; return; }
    store.signIn(pw).then(function () {
      $('pwInput').value = '';
      closeModal('loginModal');
      enterEdit();
    }).catch(function (err) {
      var code = err && err.code || '';
      $('loginErr').textContent = /wrong-password|invalid-credential|invalid-login/.test(code) ? '비밀번호가 맞지 않아요.'
        : /too-many-requests/.test(code) ? '시도가 너무 많아요. 잠시 뒤 다시 해 주세요.'
        : /network/.test(code) ? '인터넷 연결을 확인해 주세요.'
        : '로그인하지 못했어요. (' + code + ')';
    });
  });

  $('btnLogout').addEventListener('click', function () {
    store.signOut().then(function () {
      if (MOBILE) { openModal('loginModal'); return; }
      exitEdit();
    });
  });

  $('btnCancel').addEventListener('click', function () { exitEdit(); });

  $('btnSave').addEventListener('click', function () {
    var data = {};
    HTML_FIELDS.forEach(function (f) { data[f] = getHtml($(f)); });
    data.notice = $('noticeEdit').innerText.replace(/\s+/g, ' ').trim();
    var btn = this;
    btn.disabled = true;
    setStatus('저장하는 중...');
    var payload = Object.assign({}, data, { updatedAt: Date.now() });
    store.save(payload).then(function () {
      board = Object.assign(clone(DEFAULT_BOARD), data);
      try { localStorage.setItem(CACHE, JSON.stringify(board)); } catch (e) {}
      return archiveCurrent(data).catch(function (e) { console.warn('[전광판] 보관 실패', e); });
    }).then(function () {
      btn.disabled = false;
      exitEdit();
      if (MOBILE) setStatus('저장했어요. 대시보드 화면에 바로 반영됩니다.');
    }).catch(function (e) {
      btn.disabled = false;
      setStatus('저장하지 못했어요. 인터넷 연결이나 로그인 상태를 확인해 주세요. (' + (e && e.code || e) + ')', 'bad');
    });
  });

  $('btnToday').addEventListener('click', function () {
    setHtml($('lessonDate'), todayLabel());
    dirty = true;
    setStatus('오른쪽 날짜에 오늘 날짜를 넣었어요. (날짜 칸을 비워 두면 매일 자동으로 바뀝니다)');
  });

  // 붙여넣기는 글자만 (다른 곳 서식이 섞이지 않게)
  editables.forEach(function (el) {
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
      if (SINGLE_LINE[el.id] || el.id === 'noticeEdit') t = t.replace(/\s*\n\s*/g, ' ');
      document.execCommand('insertText', false, t);
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (SINGLE_LINE[el.id] || el.id === 'noticeEdit')) e.preventDefault();
    });
    el.addEventListener('input', function () { dirty = true; checkOverflow(); });
  });

  function checkOverflow() {
    if (!editing) return;
    var over = false;
    ['missionBody', 'lessonBody'].forEach(function (id) {
      var el = $(id), o = el.scrollHeight > el.clientHeight + 2;
      el.classList.toggle('overflow', o);
      over = over || o;
    });
    if (over) setStatus('빨간 점선 영역은 내용이 화면 아래로 넘쳐요. 글자를 줄이거나 내용을 나눠 주세요.', 'warn');
  }

  /* ---------- 선택 영역 기억 (도구 버튼을 눌러도 선택이 유지되도록) ---------- */
  var savedRange = null;
  function hostOf(node) {
    while (node && node !== document.body) {
      if (node.nodeType === 1 && node.classList && node.classList.contains('ed')) return node;
      node = node.parentNode;
    }
    return null;
  }
  document.addEventListener('selectionchange', function () {
    if (!editing) return;
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    // 입력창/색 선택창 등으로 포커스가 옮겨 가는 순간에는 선택을 덮어쓰지 않음
    if (!hostOf(document.activeElement)) return;
    var r = sel.getRangeAt(0);
    var h = hostOf(r.startContainer);
    if (h && h === hostOf(r.endContainer)) {
      savedRange = r.cloneRange();
      clearTimeout(sizeTimer);   // 다른 글자를 고르면 아직 적용 안 된 숫자 입력은 취소
      paintSaved();
      var el = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer;
      var px = Math.round(parseFloat(getComputedStyle(el).fontSize));
      if (document.activeElement !== $('sizeInput') && px) $('sizeInput').value = px;
    }
  });

  // 입력창을 누르면 실제 선택 표시는 사라지므로, 기억해 둔 선택을 색으로 계속 보여 줌
  var canPaint = !!(window.CSS && CSS.highlights && window.Highlight);
  function paintSaved() {
    if (!canPaint) return;
    if (savedRange && !savedRange.collapsed && editing) CSS.highlights.set('saved-sel', new Highlight(savedRange));
    else CSS.highlights.delete('saved-sel');
  }

  // 도구 막대 버튼을 눌러도 글자 선택이 풀리지 않게
  toolbar.addEventListener('mousedown', function (e) {
    if (e.target.tagName === 'BUTTON') e.preventDefault();
  });

  function applyFormat(mutate, keepFocus) {
    if (!savedRange) { setStatus('먼저 바꿀 글자를 마우스로 드래그해서 선택해 주세요.', 'warn'); return; }
    var host = hostOf(savedRange.startContainer);
    if (!host || !host.contains(savedRange.endContainer)) return;
    if (savedRange.collapsed) { setStatus('먼저 바꿀 글자를 마우스로 드래그해서 선택해 주세요.', 'warn'); return; }

    var m = readModel(host, { sc: savedRange.startContainer, so: savedRange.startOffset, ec: savedRange.endContainer, eo: savedRange.endOffset });
    var s = m.pos.start, e = m.pos.end;
    if (!s || !e) return;
    var chars = [];
    for (var li = s[0]; li <= e[0]; li++) {
      var from = li === s[0] ? s[1] : 0, to = li === e[0] ? e[1] : m.lines[li].length;
      for (var i = from; i < to; i++) chars.push(m.lines[li][i]);
    }
    if (!chars.length) return;
    var base = getComputedStyle(host);
    mutate(chars, { weight: parseInt(base.fontWeight, 10) || 400 });

    var pts = writeModel(host, m.lines, m.pos);
    dirty = true;
    if (pts.start && pts.end) {
      var r = document.createRange();
      r.setStart(pts.start[0], pts.start[1]);
      r.setEnd(pts.end[0], pts.end[1]);
      if (!keepFocus) {
        host.focus();
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
      savedRange = r.cloneRange();
      paintSaved();
    }
    checkOverflow();
  }

  function setProp(prop, val) {
    return function (chars) {
      chars.forEach(function (x) { var n = Object.assign({}, x.s); n[prop] = val; x.s = n; });
    };
  }

  function applySize(px, keepFocus) {
    px = Math.round(Number(px));
    if (!(px >= 8 && px <= 400)) { setStatus('글자 크기는 8~400px 사이로 넣어 주세요.', 'warn'); return; }
    clearTimeout(sizeTimer);
    if (!keepFocus) $('sizeInput').value = px;
    applyFormat(setProp('size', px), keepFocus);
    setStatus('글자 크기를 ' + px + 'px로 바꿨어요.');
  }

  Array.prototype.forEach.call(toolbar.querySelectorAll('[data-size]'), function (b) {
    b.addEventListener('click', function () { applySize(b.getAttribute('data-size')); });
  });
  $('sizeApply').addEventListener('click', function () { applySize($('sizeInput').value); });
  $('sizeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); applySize(this.value, true); }
  });
  // 스핀 버튼(▲▼)이나 키보드 화살표로 숫자를 바꾸면 바로 적용, 직접 입력은 잠깐 멈추면 적용
  var sizeTimer = null;
  $('sizeInput').addEventListener('input', function () {
    var v = this.value;
    clearTimeout(sizeTimer);
    if (v === '' || Number(v) < 8) return;
    sizeTimer = setTimeout(function () { applySize(v, true); }, 350);
  });

  $('btnBold').addEventListener('click', function () {
    applyFormat(function (chars, base) {
      var allBold = chars.every(function (x) { return (x.s.weight || base.weight) >= 600; });
      setProp('weight', allBold ? 400 : 700)(chars);
    });
  });
  $('btnUnderline').addEventListener('click', function () {
    applyFormat(function (chars) {
      var all = chars.every(function (x) { return x.s.underline; });
      setProp('underline', all ? null : true)(chars);
    });
  });
  Array.prototype.forEach.call(toolbar.querySelectorAll('[data-color]'), function (b) {
    b.addEventListener('click', function () { applyFormat(setProp('color', b.getAttribute('data-color'))); });
  });
  $('colorInput').addEventListener('change', function () {
    var c = safeColor(this.value);
    if (c) applyFormat(setProp('color', c));
  });
  $('btnClear').addEventListener('click', function () {
    applyFormat(function (chars) {
      chars.forEach(function (x) { x.s = { size: null, weight: null, underline: null, color: null }; });
    });
    setStatus('선택한 글자의 서식을 기본값으로 되돌렸어요.');
  });

  /* =========================================================
   * 수업 보관함
   * ======================================================= */
  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function archiveCurrent(data) {
    var now = Date.now(), jobs = [];
    [['lesson', data.lessonBody, data.lessonDate || todayLabel()],
     ['mission', data.missionBody, data.missionDate]].forEach(function (a) {
      var text = plainText(a[1]);
      if (!text) return;
      var id = a[0] + '_' + hash(a[1]);
      jobs.push(store.putArchive(id, {
        type: a[0], html: a[1], text: text.slice(0, 500),
        label: plainText(a[2]) || '', usedAt: now
      }));
    });
    return Promise.all(jobs);
  }

  var arcItems = [];
  function openArchive() {
    openModal('archiveModal');
    $('arcList').innerHTML = '<div class="arc-empty">불러오는 중...</div>';
    store.listArchive().then(function (items) { arcItems = items; drawArchive(); })
      .catch(function (e) { $('arcList').innerHTML = '<div class="arc-empty">보관함을 불러오지 못했어요. (' + (e && e.code || e) + ')</div>'; });
  }

  function fmtDate(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
  }

  function drawArchive() {
    var q = $('arcSearch').value.trim().toLowerCase(), type = $('arcType').value;
    var list = $('arcList');
    list.innerHTML = '';
    var shown = arcItems.filter(function (it) {
      if (type !== 'all' && it.type !== type) return false;
      return !q || ((it.label || '') + ' ' + (it.text || '')).toLowerCase().indexOf(q) >= 0;
    });
    if (!shown.length) {
      list.innerHTML = '<div class="arc-empty">' + (arcItems.length ? '찾는 내용이 없어요.' : '아직 보관된 내용이 없어요. 저장하면 자동으로 쌓입니다.') + '</div>';
      return;
    }
    shown.forEach(function (it) {
      var row = document.createElement('div'); row.className = 'arc-item';
      var top = document.createElement('div'); top.className = 'arc-top';
      var tp = document.createElement('span'); tp.className = 'arc-type ' + it.type; tp.textContent = it.type === 'lesson' ? '수업' : '미션';
      var tt = document.createElement('span'); tt.className = 'arc-title'; tt.textContent = it.label || (it.text || '').split('\n')[0];
      var wh = document.createElement('span'); wh.className = 'arc-when'; wh.textContent = '마지막 사용 ' + fmtDate(it.usedAt);
      var btns = document.createElement('span'); btns.className = 'arc-btns';
      var load = document.createElement('button'); load.type = 'button';
      load.textContent = it.type === 'lesson' ? '오늘의 수업에 불러오기' : '이번주 미션에 불러오기';
      load.addEventListener('click', function () {
        setHtml($(it.type === 'lesson' ? 'lessonBody' : 'missionBody'), it.html);
        dirty = true;
        closeModal('archiveModal');
        setStatus('보관함에서 불러왔어요. "저장 및 적용"을 눌러야 전광판에 반영됩니다.', 'warn');
        checkOverflow();
      });
      var del = document.createElement('button'); del.type = 'button'; del.className = 'danger'; del.textContent = '삭제';
      del.addEventListener('click', function () {
        if (del.getAttribute('data-sure')) {
          store.delArchive(it.id).then(function () {
            arcItems = arcItems.filter(function (x) { return x.id !== it.id; });
            drawArchive();
          });
        } else {
          del.setAttribute('data-sure', '1'); del.textContent = '한 번 더 누르면 삭제';
          setTimeout(function () { del.removeAttribute('data-sure'); del.textContent = '삭제'; }, 3000);
        }
      });
      btns.appendChild(load); btns.appendChild(del);
      top.appendChild(tp); top.appendChild(tt); top.appendChild(wh); top.appendChild(btns);
      var pv = document.createElement('div'); pv.className = 'arc-prev'; pv.textContent = it.text || '';
      row.appendChild(top); row.appendChild(pv);
      list.appendChild(row);
    });
  }
  $('arcSearch').addEventListener('input', drawArchive);
  $('arcType').addEventListener('change', drawArchive);
  $('btnArchive').addEventListener('click', openArchive);

  /* ---------- 대화상자 공통 ---------- */
  function openModal(id) {
    $(id).hidden = false;
    var f = $(id).querySelector('input');
    if (f) setTimeout(function () { f.focus(); }, 0);
  }
  function closeModal(id) { $(id).hidden = true; }
  Array.prototype.forEach.call(document.querySelectorAll('.modal'), function (m) {
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.hasAttribute('data-close')) closeModal(m.id);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') Array.prototype.forEach.call(document.querySelectorAll('.modal'), function (m) { m.hidden = true; });
  });

  /* ---------- 시작 ---------- */
  fit();
  render();
  store.subscribe(onBoard);
  if (MOBILE) {
    if (store.mode === 'local') enterEdit();
    else store.onAuth(function (u) {
      if (u) { closeModal('loginModal'); if (!editing) enterEdit(); }
      else openModal('loginModal');
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!editing) buildTicker(); });

  // 테스트용으로 내부 함수 노출
  window.__board = { readModel: readModel, writeModel: writeModel, setHtml: setHtml, getHtml: getHtml };
})();
