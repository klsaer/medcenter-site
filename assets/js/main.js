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
    '08:00–20:00', // пн
    '08:00–20:00', // вт
    '08:00–20:00', // ср
    '08:00–20:00', // чт
    '08:00–20:00', // пт
    '09:00–18:00', // сб
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
      var raw = box.getAttribute('data-until');
      if (!raw) return;

      var until = new Date(raw + 'T00:00:00');
      if (isNaN(until.getTime())) return;

      var dateEl = $('.accr__date', box);
      var chip = $('.accr__chip', box);
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

  /* ---------- Форма записи (демо: без отправки) ---------- */
  (function form() {
    var f = $('#appForm');
    if (!f) return;
    var status = $('#formStatus');

    f.addEventListener('submit', function (e) {
      e.preventDefault();

      var bad = null;
      $$('input, textarea', f).forEach(function (el) {
        if (!el.required) return;
        var ok = el.type === 'checkbox' ? el.checked : el.value.trim().length > 1;
        el.setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (!ok && !bad) bad = el;
      });

      if (bad) {
        status.className = 'form__status is-err';
        status.textContent = 'Заполните обязательные поля и подтвердите согласие.';
        bad.focus();
        return;
      }

      status.className = 'form__status is-ok';
      status.textContent = 'Заявка принята. Администратор перезвонит в рабочее время.';
      f.reset();
      $$('[aria-invalid]', f).forEach(function (el) { el.removeAttribute('aria-invalid'); });
    });
  })();

  /* ---------- Режим «показать заглушки» ---------- */
  (function fillMode() {
    var btn = $('#fillToggle');
    if (!btn) return;

    var n = $$('[data-fill]').length;
    btn.textContent = 'Показать заглушки (' + n + ')';

    btn.addEventListener('click', function () {
      var on = document.body.classList.toggle('show-fill');
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = (on ? 'Скрыть заглушки (' : 'Показать заглушки (') + n + ')';
    });
  })();

  /* ---------- Год в подвале ---------- */
  (function year() {
    var el = $('#year');
    if (el) el.textContent = new Date().getFullYear();
  })();

})();
