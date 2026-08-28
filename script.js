/* ============================================================
   FORGE/KAEL — interactions
   Vanilla JS only. No frameworks, no build step, no mercy.
   ============================================================ */
(function () {
  'use strict';

  /* Flag that JS is alive. CSS only hides .reveal content under
     html.js — so if this file never executes, the full page
     stays visible (just static). */
  document.documentElement.classList.add('js');

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Scroll lock helper ---------- */
  let locks = 0;
  function lockScroll(on) {
    locks = Math.max(0, locks + (on ? 1 : -1));
    document.documentElement.classList.toggle('no-scroll', locks > 0);
  }

  /* ============================================================
     1 · HEADER — solid glass once scrolled
     ============================================================ */
  const header = $('#siteHeader');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ============================================================
     2 · MOBILE DRAWER
     ============================================================ */
  const drawer      = $('#drawer');
  const drawerBack  = $('#drawerBackdrop');
  const burger      = $('#hamburger');
  const drawerClose = $('#drawerClose');

  function openDrawer() {
    drawer.classList.add('open');
    drawerBack.classList.add('open');
    burger.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    lockScroll(true);
    drawerClose.focus();
  }
  function closeDrawer() {
    if (!drawer.classList.contains('open')) return;
    drawer.classList.remove('open');
    drawerBack.classList.remove('open');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    lockScroll(false);
  }
  burger.addEventListener('click', () =>
    drawer.classList.contains('open') ? closeDrawer() : openDrawer()
  );
  drawerClose.addEventListener('click', closeDrawer);
  drawerBack.addEventListener('click', closeDrawer);
  $$('.drawer-nav a').forEach(a => a.addEventListener('click', closeDrawer));

  /* ============================================================
     3 · ACTIVE NAV LINK highlighting
     ============================================================ */
  const linkMap = {};
  $$('.nav-link').forEach(l => { linkMap[l.getAttribute('href').slice(1)] = l; });

  const navIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting && linkMap[en.target.id]) {
        $$('.nav-link').forEach(l => l.classList.remove('active'));
        linkMap[en.target.id].classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  ['bmi', 'programs', 'results', 'schedule'].forEach(id => {
    const el = document.getElementById(id);
    if (el) navIO.observe(el);
  });

  /* ============================================================
     4 · REVEAL ON SCROLL (with graceful fallback)
     ============================================================ */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const revealIO = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => revealIO.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ============================================================
     5 · HERO STAT COUNTERS
     HTML already holds the final values, so nothing is lost
     if this never runs; countUp simply animates 0 → target.
     ============================================================ */
  function countUp(el) {
    const target = parseInt(el.dataset.count, 10) || 0;
    const suffix = el.dataset.suffix || '';
    const comma  = el.dataset.format === 'comma';
    const fmt = v => (comma ? v.toLocaleString('en-US') : String(v)) + suffix;
    if (REDUCE) { el.textContent = fmt(target); return; }
    const dur = 1800, t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  const statsEl = $('.hero-stats');
  if (statsEl) {
    const cio = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { $$('[data-count]').forEach(countUp); cio.disconnect(); }
      });
    }, { threshold: 0.4 });
    cio.observe(statsEl);
  }

  /* ============================================================
     6 · BMI CALCULATOR + DIAL GAUGE
     ============================================================ */
  const hIn = $('#bmiHeight'), wIn = $('#bmiWeight');
  const bmiValue = $('#bmiValue'), bmiCat = $('#bmiCat'), bmiNote = $('#bmiNote');
  const needle = $('#bmiNeedle');
  const segs = $$('.seg'), chips = $$('.bmi-chip');
  const BMI_MIN = 14, BMI_MAX = 40;

  const CATS = [
    { key: 'under', max: 18.5, name: 'Underweight',
      note: 'Lean-gain territory. We build mass with a calculated surplus and progressive overload — no dirty bulks, ever.' },
    { key: 'normal', max: 25, name: 'Normal range',
      note: 'Solid base. Now we chase performance — first pull-up, first 100 kg squat, first race. The aesthetics follow.' },
    { key: 'over', max: 30, name: 'Overweight',
      note: 'Nothing dramatic required. A modest deficit, three lifting days and a step target you\u2019ll actually hit.' },
    { key: 'obese', max: Infinity, name: 'Obese',
      note: 'Exactly what structured coaching exists for. We start gently, protect your joints, and let consistency compound.' }
  ];

  function setFieldError(input, msg) {
    const field = input.closest('.field');
    if (!field) return;
    const err = field.querySelector('.field-err');
    if (err) err.textContent = msg || '';
    field.classList.toggle('invalid', !!msg);
  }

  function validateNum(input, min, max, label) {
    const raw = input.value.trim();
    if (raw === '') return 'Enter your ' + label + ' first.';
    const v = parseFloat(raw);
    if (!isFinite(v)) return 'That doesn\u2019t look like a number.';
    if (v < min || v > max) return label + ' should be between ' + min + ' and ' + max + '.';
    return '';
  }

  function setGauge(bmi) {
    const clamped = Math.max(BMI_MIN, Math.min(BMI_MAX, bmi));
    const deg = -90 + ((clamped - BMI_MIN) / (BMI_MAX - BMI_MIN)) * 180;
    needle.style.transform = 'rotate(' + deg + 'deg)';
  }

  function updateBMI() {
    const hErr = validateNum(hIn, 100, 250, 'height');
    const wErr = validateNum(wIn, 30, 300, 'weight');
    setFieldError(hIn, hErr);
    setFieldError(wIn, wErr);
    if (hErr || wErr) return;

    const h = parseFloat(hIn.value), w = parseFloat(wIn.value);
    const bmi = w / Math.pow(h / 100, 2);
    const cat = CATS.find(c => bmi < c.max);

    bmiValue.textContent = bmi.toFixed(1);
    bmiCat.textContent = cat.name;
    bmiCat.className = 'bmi-cat c-' + cat.key;
    bmiNote.textContent = cat.note;
    setGauge(bmi);

    segs.forEach(s => s.classList.toggle('on', s.dataset.key === cat.key));
    chips.forEach(c => c.classList.toggle('on', c.dataset.key === cat.key));
  }
  if (hIn && wIn) {
    hIn.addEventListener('input', updateBMI);
    wIn.addEventListener('input', updateBMI);
  }

  /* ============================================================
     7 · PRICING — monthly / yearly toggle
     ============================================================ */
  const pill = $('#billingPill');
  const billingNote = $('#billingNote');

  function animatePrice(el, to) {
    if (REDUCE) { el.textContent = String(to); return; }
    const from = parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
    const dur = 450, t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  $$('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      $$('.toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
      const yearly = btn.dataset.cycle === 'yearly';
      pill.classList.toggle('yearly', yearly);
      billingNote.textContent = yearly
        ? 'Billed yearly — two months free, rate locked in.'
        : 'Billed monthly · cancel anytime, no hard feelings.';
      $$('.plan-price').forEach(p =>
        animatePrice(p, parseInt(yearly ? p.dataset.y : p.dataset.m, 10))
      );
      $$('.plan-cycle').forEach(p =>
        p.textContent = yearly ? p.dataset.y : p.dataset.m
      );
    });
  });

  /* ============================================================
     8 · BEFORE / AFTER — drag comparator + client switcher
     ============================================================ */
  const CLIENTS = [
    {
      name: 'Maja L.', age: 34, months: 9,
      stat: '\u221218 kg', stats: ['\u221218 kg', '34% \u2192 22% BF', '9 months'],
      teaser: 'I came in to lose a bit. I stayed to deadlift 120.',
      quote: 'I walked in to \u201close a bit\u201d. Nine months later I deadlift 120 kg and my back pain is gone. Turns out I needed a coach, not another diet.',
      before: 'https://picsum.photos/seed/forge-before-maja/1000/800.jpg',
      after:  'https://picsum.photos/seed/forge-after-maja/1000/800.jpg'
    },
    {
      name: 'Tobias R.', age: 41, months: 6,
      stat: '+7 kg lean', stats: ['+7 kg lean mass', 'First strict pull-up', '6 months'],
      teaser: 'First strict pull-up at 41. Then six more.',
      quote: 'Forty-one years old and I did my first dead-hang pull-up — then six more. Dominik rebuilt my shoulders and my ego, in that order.',
      before: 'https://picsum.photos/seed/forge-before-tobias/1000/800.jpg',
      after:  'https://picsum.photos/seed/forge-after-tobias/1000/800.jpg'
    },
    {
      name: 'Priya S.', age: 28, months: 12,
      stat: '\u221239 min marathon', stats: ['\u22129 kg', 'Marathon 4:31 \u2192 3:52', '12 months'],
      teaser: '39 minutes off my marathon — from lifting, not running more.',
      quote: 'I thought lifting would slow my running. I was wrong. Strong hamstrings took 39 minutes off my marathon and I finally stopped getting injured.',
      before: 'https://picsum.photos/seed/forge-before-priya/1000/800.jpg',
      after:  'https://picsum.photos/seed/forge-after-priya/1000/800.jpg'
    }
  ];

  const slider = $('#baSlider'), baHandle = $('#baHandle');
  const baName = $('#baName'), baStats = $('#baStats'), baQuote = $('#baQuote');
  const clientList = $('#clientList');
  const noteEl = $('.client-note');
  let baPos = 50, dragging = false;

  function setPos(p) {
    baPos = Math.max(3, Math.min(97, p));
    slider.style.setProperty('--pos', baPos + '%');
    baHandle.setAttribute('aria-valuenow', Math.round(baPos));
  }
  function posFromEvent(e) {
    const r = slider.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  }
  slider.addEventListener('pointerdown', e => {
    dragging = true;
    slider.setPointerCapture(e.pointerId);
    setPos(posFromEvent(e));
  });
  slider.addEventListener('pointermove', e => { if (dragging) setPos(posFromEvent(e)); });
  ['pointerup', 'pointercancel'].forEach(ev =>
    slider.addEventListener(ev, () => { dragging = false; })
  );
  baHandle.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { setPos(baPos - 3); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setPos(baPos + 3); e.preventDefault(); }
  });

  /* Build the client selector cards, in order, above the note. */
  const clientButtons = CLIENTS.map((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'client-card';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML =
      '<span class="cc-top"><strong>' + c.name + ' \u00b7 ' + c.age + '</strong>' +
      '<span class="cc-months">' + c.months + ' months</span></span>' +
      '<span class="cc-stat">' + c.stat + '</span>' +
      '<span class="cc-line">\u201c' + c.teaser + '\u201d</span>';
    b.addEventListener('click', () => selectClient(i));
    clientList.insertBefore(b, noteEl);
    return b;
  });

  const bImg = $('#baBefore'), aImg = $('#baAfter');

  function selectClient(i) {
    clientButtons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    const c = CLIENTS[i];
    baName.textContent = c.name + ' \u00b7 ' + c.age;
    baStats.innerHTML = c.stats.map(s => '<span class="stat-chip">' + s + '</span>').join('');
    baQuote.textContent = '\u201c' + c.quote + '\u201d';

    slider.classList.add('switching');
    
    let loaded = 0;
    const done = () => {
      loaded++;
      if (loaded >= 2) {
        slider.classList.remove('switching');
        // Clean up event listeners to prevent memory leaks
        bImg.onload = null; bImg.onerror = null;
        aImg.onload = null; aImg.onerror = null;
      }
    };
    
    bImg.onload = done; bImg.onerror = done;
    aImg.onload = done; aImg.onerror = done;
    
    bImg.src = c.before;
    aImg.src = c.after;
    
    setPos(50);
  }
  selectClient(0);

  /* ============================================================
     9 · SCHEDULE — filter + reserve
     ============================================================ */
  const filterRow = $('#filterRow');
  const filterChips = $$('.chip', filterRow);

  // Fill live session counts into the chips
  filterChips.forEach(ch => {
    const f = ch.dataset.filter;
    const n = f === 'all'
      ? $$('.session').length
      : $$('.session[data-cat="' + f + '"]').length;
    const badge = ch.querySelector('span');
    if (badge) badge.textContent = n;
  });

  function applyFilter(f) {
    $$('.session').forEach(s => {
      const show = f === 'all' || s.dataset.cat === f;
      s.classList.toggle('is-hidden', !show);
      if (show) {
        s.classList.remove('pop');
        void s.offsetWidth; // restart animation
        s.classList.add('pop');
      }
    });
    $$('.day').forEach(d => {
      const visible = d.querySelectorAll('.session:not(.is-hidden)').length;
      d.classList.toggle('is-empty', visible === 0);
    });
  }
  filterChips.forEach(ch => {
    ch.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.toggle('active', c === ch));
      applyFilter(ch.dataset.filter);
    });
  });

  /* ============================================================
     10 · BOOKING MODAL — open/close, focus trap, validation
     ============================================================ */
  const backdrop    = $('#modalBackdrop');
  const modal       = $('.modal', backdrop);
  const modalClose  = $('#modalClose');
  const formWrap    = $('#modalFormWrap');
  const successPane = $('#modalSuccess');
  const form        = $('#bookingForm');
  const bkName = $('#bkName'), bkEmail = $('#bkEmail');
  const bkGoal = $('#bkGoal'), bkSlot = $('#bkSlot'), bkNote = $('#bkNote');
  const bkSubmit = $('#bkSubmit');

  let modalOpen = false, lastFocus = null;

  function openModal(prefill) {
    if (modalOpen) return; // Prevent multiple triggers from stacking scroll locks
    
    closeDrawer(); // never stack modal over the mobile drawer
    
    // Reset to form view if it was left on success screen
    if (formWrap.hidden) {
      successPane.hidden = true;
      formWrap.hidden = false;
    }
    
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    modalOpen = true;
    lockScroll(true);
    lastFocus = document.activeElement;
    if (prefill && prefill.note) bkNote.value = prefill.note;
    setTimeout(() => { (formWrap.hidden ? modalClose : bkName).focus(); }, 80);
  }
  
  function closeModal() {
    if (!modalOpen) return;
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
    modalOpen = false;
    lockScroll(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  
  modalClose.addEventListener('click', closeModal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

  function focusables() {
    return $$('button, input, select, textarea, a[href]', modal)
      .filter(el => !el.disabled && el.offsetParent !== null);
  }
  
  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (modalOpen) closeModal();
      else if (drawer.classList.contains('open')) closeDrawer();
    }
    if (e.key === 'Tab' && modalOpen) trapFocus(e);
  });

  // Global open triggers (header, hero, plans, CTA band, drawer, schedule)
  document.addEventListener('click', e => {
    const reserver = e.target.closest('.js-reserve');
    if (reserver) {
      openModal({ note: 'Reserving a spot in: ' + reserver.dataset.session });
      return;
    }
    const opener = e.target.closest('.js-open-modal');
    if (opener) {
      openModal(opener.dataset.plan ? { note: 'Interested in: ' + opener.dataset.plan } : {});
    }
  });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validateField(el, msg) {
    setFieldError(el, msg);
    return !msg;
  }
  
  function validateForm() {
    let ok = true, firstBad = null;
    const nameOk = validateField(bkName,
      bkName.value.trim().length < 2 ? 'Tell me your name — at least 2 characters.' : '');
    const emailOk = validateField(bkEmail,
      EMAIL_RE.test(bkEmail.value.trim()) ? '' : 'That email doesn\u2019t look right.');
    const goalOk = validateField(bkGoal, bkGoal.value ? '' : 'Pick a goal — \u201call of the above\u201d isn\u2019t an option yet.');
    const slotOk = validateField(bkSlot, bkSlot.value ? '' : 'When could you actually show up?');
    
    [ [bkName, nameOk], [bkEmail, emailOk], [bkGoal, goalOk], [bkSlot, slotOk] ]
      .forEach(pair => {
        if (!pair[1]) { ok = false; if (!firstBad) firstBad = pair[0]; }
      });
    if (firstBad) firstBad.focus();
    return ok;
  }

  [bkName, bkEmail].forEach(el => el.addEventListener('input', () => setFieldError(el, '')));
  [bkGoal, bkSlot].forEach(el => el.addEventListener('change', () => setFieldError(el, '')));

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm()) return;

    bkSubmit.classList.add('loading');
    bkSubmit.disabled = true;

    setTimeout(() => {
      bkSubmit.classList.remove('loading');
      bkSubmit.disabled = false;

      $('#successName').textContent  = bkName.value.trim().split(/\s+/)[0];
      $('#successGoal').textContent  = bkGoal.value;
      $('#successEmail').textContent = bkEmail.value.trim();

      formWrap.hidden = true;
      successPane.hidden = false;
      $('#successReset').focus();
    }, 1200);
  });

  $('#successReset').addEventListener('click', () => {
    successPane.hidden = true;
    formWrap.hidden = false;
    form.reset();
    $$('.field', form).forEach(f => {
      f.classList.remove('invalid');
      const err = f.querySelector('.field-err');
      if (err) err.textContent = '';
    });
    bkName.focus();
  });

  /* ============================================================
     11 · FOOTER YEAR
     ============================================================ */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
