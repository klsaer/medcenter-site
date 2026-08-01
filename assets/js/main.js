/* ==========================================================================
   Медицинский центр — интерактив шаблона
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     НАСТРОЙКА · график работы
     Индекс 0 = понедельник … 6 = воскресенье. null — выходной.
     Отсюда берётся строка «Сегодня» в верхней панели.
     ---------------------------------------------------------------------- */
  var SCHEDULE = [
    '09:00–17:00', // пн
    '09:00–17:00', // вт
    '09:00–17:00', // ср
    '09:00–17:00', // чт
    '09:00–17:00', // пт
    null,          // сб
    null           // вс
  ];

  /* За сколько дней до окончания аккредитации показывать предупреждение */
  var ACCR_WARN_DAYS = 180;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* Русское склонение: plural(3, ['день','дня','дней']) → 'дня' */
  function plural(n, forms) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function ruDate(d) { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); }

  /* ---------- Тема ---------- */
  (function theme() {
    var btn = $('#themeBtn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var root = document.documentElement;
      /* Основная тема — светлая; без атрибута страница всегда светлая */
      var current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('mc-theme', next); } catch (e) {}
    });
  })();

  /* ---------- Версия для слабовидящих ----------
     Приказ Минздрава № 118н, приложение 2, п. 2. Состояние живёт
     в атрибутах data-vi-* на <html>; скрипт в <head> восстанавливает их
     до отрисовки, здесь только переключение и запоминание. */
  (function visuallyImpaired() {
    var btn = $('#viBtn'), panel = $('#viPanel'), off = $('#viOff');
    if (!btn || !panel) return;

    var root = document.documentElement;
    var DEFAULTS = { size: '1', scheme: 'wb', space: '0', img: 'on' };

    function save(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

    function sync() {
      var on = root.hasAttribute('data-vi');
      panel.hidden = !on;
      btn.setAttribute('aria-expanded', String(on));
      $$('[data-vi-key]', panel).forEach(function (b) {
        var k = b.getAttribute('data-vi-key');
        var cur = root.getAttribute('data-vi-' + k) || DEFAULTS[k];
        b.setAttribute('aria-pressed', String(cur === b.getAttribute('data-vi-val')));
      });
    }

    function enable() {
      root.setAttribute('data-vi', '');
      Object.keys(DEFAULTS).forEach(function (k) {
        if (!root.getAttribute('data-vi-' + k)) root.setAttribute('data-vi-' + k, DEFAULTS[k]);
      });
      save('mc-vi', 'on');
      sync();
    }

    function disable() {
      root.removeAttribute('data-vi');
      save('mc-vi', 'off');
      sync();
    }

    btn.addEventListener('click', function () {
      root.hasAttribute('data-vi') ? disable() : enable();
    });

    if (off) off.addEventListener('click', function () { disable(); btn.focus(); });

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vi-key]');
      if (!b) return;
      var k = b.getAttribute('data-vi-key'), v = b.getAttribute('data-vi-val');
      root.setAttribute('data-vi-' + k, v);
      save('mc-vi-' + k, v);
      sync();
    });

    sync();
  })();

  /* ---------- Поиск по сайту ----------
     Приказ № 118н, приложение 2, п. 2. Страница одна, поэтому индекс
     строится прямо из DOM — при первом открытии, а не при загрузке. */
  (function siteSearch() {
    var openBtn = $('#searchBtn'), box = $('#srch'), inp = $('#srchInput'),
        list = $('#srchList'), count = $('#srchCount'), closeBtn = $('#srchClose');
    if (!openBtn || !box || !inp || !list) return;

    var MAX = 12;
    var index = null;
    var marked = null;

    function esc(s) {
      return s.replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }

    function build() {
      if (index) return index;
      index = [];
      /* Карта сайта — это перечень ссылок на те же разделы; в выдаче
         она давала бы дубль к каждому реальному попаданию. */
      $$('main .sec:not(#sitemap)').forEach(function (sec) {
        var head = $('.sec__h', sec) || $('.orgcard__h', sec) || $('.cta__h', sec);
        var name = head ? head.textContent.replace(/\s+/g, ' ').trim() : 'Раздел';

        $$('h3, h4, p, li, dd, summary, td', sec).forEach(function (el) {
          /* берём только листья: иначе абзац попадёт и сам, и внутри <li> */
          if (el.querySelector('h3, h4, p, li, dd, summary, td')) return;
          /* надстрочник «02 Врачи и аккредитация» дублирует название раздела */
          if (el.classList.contains('eyebrow')) return;

          /* innerText, а не textContent: соседние блочные строки внутри
             карточки иначе слипаются в «специалистаМатвеев А. А.» */
          var text = (el.innerText || el.textContent).replace(/\s+/g, ' ').trim();
          if (text.length < 8) return;
          index.push({ el: el, sec: name, text: text, low: text.toLowerCase() });
        });
      });
      return index;
    }

    function snippet(item, needle) {
      var i = item.low.indexOf(needle);
      var from = Math.max(0, i - 45);
      var to = Math.min(item.text.length, i + needle.length + 80);
      var head = item.text.slice(from, i);
      var hit = item.text.substr(i, needle.length);
      var tail = item.text.slice(i + needle.length, to);
      return (from > 0 ? '…' : '') + esc(head) + '<mark>' + esc(hit) + '</mark>' +
             esc(tail) + (to < item.text.length ? '…' : '');
    }

    function render() {
      var needle = inp.value.trim().toLowerCase();
      list.innerHTML = '';

      if (needle.length < 2) {
        count.textContent = 'Введите запрос — поиск идёт по всему тексту страницы';
        return;
      }

      var hits = build().filter(function (it) { return it.low.indexOf(needle) !== -1; });

      count.textContent = hits.length
        ? 'Найдено ' + hits.length + ' ' + plural(hits.length, ['совпадение', 'совпадения', 'совпадений']) +
          (hits.length > MAX ? ', показаны первые ' + MAX : '')
        : 'Ничего не найдено';

      hits.slice(0, MAX).forEach(function (it) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#';
        a.innerHTML = '<span class="srch__sec">' + esc(it.sec) + '</span>' +
                      '<span class="srch__txt">' + snippet(it, needle) + '</span>';
        a.addEventListener('click', function (e) {
          e.preventDefault();
          hide();
          go(it.el);
        });
        li.appendChild(a);
        list.appendChild(li);
      });
    }

    function go(el) {
      if (marked) marked.classList.remove('srch-hit');
      /* details не прокрутить к содержимому, пока он закрыт */
      var det = el.closest('details');
      if (det) det.open = true;
      /* строка прейскуранта могла быть скрыта фильтром той же таблицы */
      if (el.hidden) el.hidden = false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('srch-hit');
      marked = el;
      setTimeout(function () { if (marked === el) el.classList.remove('srch-hit'); }, 2400);
    }

    function show() {
      box.hidden = false;
      document.body.classList.add('srch-open');
      inp.focus();
      inp.select();
    }

    function hide() {
      box.hidden = true;
      document.body.classList.remove('srch-open');
    }

    openBtn.addEventListener('click', show);
    if (closeBtn) closeBtn.addEventListener('click', function () { hide(); openBtn.focus(); });
    inp.addEventListener('input', render);

    box.addEventListener('mousedown', function (e) {
      if (e.target === box) { hide(); openBtn.focus(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !box.hidden) { hide(); openBtn.focus(); }
    });
  })();

  /* ---------- Мобильная навигация ---------- */
  (function nav() {
    var burger = $('#burger');
    var rail = $('#railnav');
    if (!burger || !rail) return;

    var scrim = null;

    function close() {
      rail.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
      if (scrim) { scrim.remove(); scrim = null; }
    }

    function open() {
      rail.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('nav-open');
      scrim = document.createElement('button');
      scrim.className = 'scrim';
      scrim.setAttribute('aria-label', 'Закрыть меню');
      scrim.addEventListener('click', close);
      document.body.appendChild(scrim);
    }

    burger.addEventListener('click', function () {
      rail.classList.contains('is-open') ? close() : open();
    });

    rail.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && rail.classList.contains('is-open')) { close(); burger.focus(); }
    });

    window.matchMedia('(min-width: 1060px)').addEventListener('change', function (m) {
      if (m.matches) close();
    });
  })();

  /* ---------- Подсветка активного раздела ---------- */
  (function spy() {
    var links = $$('.rail__list a');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var targets = [];

    links.forEach(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) { map[el.id] = a; targets.push(el); }
    });

    var visible = {};

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });

      var active = null;
      for (var i = 0; i < targets.length; i++) {
        if (visible[targets[i].id]) { active = targets[i].id; break; }
      }
      if (!active) return;

      links.forEach(function (a) { a.classList.remove('is-active'); });
      if (map[active]) map[active].classList.add('is-active');
    }, { rootMargin: '-88px 0px -55% 0px', threshold: 0 });

    targets.forEach(function (t) { io.observe(t); });
  })();

  /* ---------- Аккредитация: дата и статус из одного атрибута data-until ---------- */
  (function accreditation() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    $$('.accr').forEach(function (box) {
      var raw = (box.getAttribute('data-until') || '').trim();
      var dateEl = $('.accr__date', box);
      var chip = $('.accr__chip', box);

      /* дата ещё не предоставлена — показываем это явно, а не пустым прочерком */
      if (!raw) {
        box.classList.add('accr--none');
        if (dateEl) dateEl.textContent = 'не указана';
        if (chip) chip.textContent = 'Ожидается';
        return;
      }

      var until = new Date(raw + 'T00:00:00');
      if (isNaN(until.getTime())) return;

      var days = Math.round((until - today) / 86400000);

      if (dateEl) dateEl.textContent = ruDate(until);
      if (!chip) return;

      box.classList.remove('accr--warn', 'accr--bad');

      if (days < 0) {
        box.classList.add('accr--bad');
        chip.textContent = 'Истекла';
        $('.accr__lbl', box).textContent = 'Аккредитация истекла';
      } else if (days <= ACCR_WARN_DAYS) {
        box.classList.add('accr--warn');
        chip.textContent = 'Осталось ' + days + ' ' + plural(days, ['день', 'дня', 'дней']);
      } else {
        chip.textContent = 'Действует';
      }
    });
  })();

  /* ---------- График: строка «Сегодня» ---------- */
  (function todayHours() {
    var el = $('#todayHours');
    if (!el) return;
    var idx = (new Date().getDay() + 6) % 7; // JS: вс=0 → наш индекс: пн=0
    el.textContent = SCHEDULE[idx] || 'выходной';
  })();

  /* ---------- Поиск по прейскуранту ---------- */
  (function priceSearch() {
    var input = $('#priceSearch');
    var table = $('.price');
    if (!input || !table) return;

    var counter = $('#priceCount');
    var empty = $('#priceEmpty');
    var groups = $$('tbody', table);

    var rows = groups.map(function (g) {
      return {
        body: g,
        items: $$('tr:not(.price__grp)', g).map(function (tr) {
          return { tr: tr, text: tr.textContent.toLowerCase().replace(/\s+/g, ' ') };
        })
      };
    });

    var total = rows.reduce(function (n, g) { return n + g.items.length; }, 0);

    function render(q) {
      var needle = q.trim().toLowerCase();
      var shown = 0;

      rows.forEach(function (g) {
        var hits = 0;
        g.items.forEach(function (it) {
          var ok = !needle || it.text.indexOf(needle) !== -1;
          it.tr.hidden = !ok;
          if (ok) hits++;
        });
        g.body.hidden = hits === 0;
        shown += hits;
      });

      if (empty) empty.hidden = shown !== 0;
      if (counter) {
        counter.textContent = needle
          ? 'Найдено ' + shown + ' ' + plural(shown, ['услуга', 'услуги', 'услуг']) + ' из ' + total
          : 'Всего ' + total + ' ' + plural(total, ['услуга', 'услуги', 'услуг']);
      }
    }

    input.addEventListener('input', function () { render(input.value); });
    render('');
  })();

  /* ---------- Карта: включаем взаимодействие только по щелчку ----------
     Иначе на телефоне палец внутри карты тянет карту, а не страницу,
     и посетитель застревает на этом блоке. */
  (function map() {
    var box = $('#mapbox'), btn = $('#mapUnlock');
    if (!box || !btn) return;

    btn.addEventListener('click', function () {
      box.classList.add('is-active');
    });
  })();

  /* ---------- Год в подвале ---------- */
  (function year() {
    var el = $('#year');
    if (el) el.textContent = new Date().getFullYear();
  })();

})();
