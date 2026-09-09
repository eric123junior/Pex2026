/* ============================================================
   SustAmbiTech BI — motor de scroll 3D
   ============================================================ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(hover: none)').matches;
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---------- aberto por duplo clique (file://)? ----------
     Nesse modo o navegador trata cada arquivo como origem opaca e bloqueia
     todo fetch(), entao mapa, tabela de modelos e graficos ficam vazios.
     Nao ha contorno no codigo: a pagina precisa ser servida por HTTP. */
  if (location.protocol === 'file:') {
    var aviso = document.createElement('div');
    aviso.className = 'aviso-arquivo';
    aviso.innerHTML =
      '<b>Abra pelo servidor local, não pelo arquivo.</b>' +
      '<span>Neste modo (<code>file://</code>) o navegador bloqueia o carregamento ' +
      'dos dados, então mapa, modelos e gráficos aparecem vazios. Na pasta do ' +
      'projeto, rode <code>python -m http.server 5173</code> e acesse ' +
      '<a href="http://localhost:5173">http://localhost:5173</a>.</span>';
    document.body.appendChild(aviso);
  }

  document.getElementById('yr').textContent = new Date().getFullYear();
  requestAnimationFrame(function () { document.body.classList.add('loaded'); });

  /* ---------- menu mobile ---------- */
  var burger = document.getElementById('burger');
  var links = document.getElementById('navLinks');
  burger.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    /* A classe no body permite esconder o que flutua sobre a pagina.
       Subir o z-index do menu nao bastaria: ele vive dentro do .nav, que
       ja e um contexto de empilhamento proprio — entao o botao de clima,
       irmao do .nav, continuaria por cima. */
    document.body.classList.toggle('menu-aberto', open);
  });
  links.addEventListener('click', function (e) {
    if (e.target.tagName === 'A' && links.classList.contains('open')) burger.click();
  });

  /* ---------- reveal (varredura no rAF: nunca perde um elemento) ---------- */
  var pending = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  function show(el) {
    var sibs = Array.prototype.slice.call(el.parentNode.children).filter(function (n) {
      return n.classList.contains('reveal');
    });
    el.style.transitionDelay = Math.min(sibs.indexOf(el), 6) * 0.07 + 's';
    el.classList.add('in');
    countUp(el);
  }

  /* observador principal */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var k = pending.indexOf(en.target);
      if (k > -1) { pending.splice(k, 1); show(en.target); }
      io.unobserve(en.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  pending.forEach(function (el) { io.observe(el); });

  /* rede de segurança: varredura periódica no loop de animação */
  function sweepReveals(vh) {
    for (var i = pending.length - 1; i >= 0; i--) {
      var r = pending[i].getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) {
        io.unobserve(pending[i]);
        show(pending[i]);
        pending.splice(i, 1);
      }
    }
  }

  /* ---------- contadores ---------- */
  function countUp(scope) {
    scope.querySelectorAll('.num[data-count]').forEach(function (el) {
      var target = parseInt(el.dataset.count, 10);
      var dur = 1500, t0 = performance.now();
      (function step(now) {
        var p = clamp((now - t0) / dur, 0, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('pt-BR');
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  /* ---------- nav ativa + progresso ---------- */
  var nav = document.getElementById('nav');
  var bar = document.getElementById('progressBar');
  var sections = Array.prototype.slice.call(document.querySelectorAll('section[id]'));
  var navAnchors = Array.prototype.slice.call(links.querySelectorAll('a'));

  /* ---------- scroll ---------- */
  var mapPlane = document.getElementById('mapPlane');
  var target = { y: 0 }, current = { y: 0 };

  function onScroll() { target.y = window.scrollY || window.pageYOffset; }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var tick = 0;
  function frame() {
    current.y = reduced ? target.y : lerp(current.y, target.y, 0.11);
    var y = current.y;
    var vh = window.innerHeight;

    /* progresso */
    var max = document.documentElement.scrollHeight - vh;
    bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';

    /* nav fixa */
    nav.classList.toggle('stuck', y > 40);

    /* revelações */
    if (pending.length && (tick++ % 6 === 0)) sweepReveals(vh);

    /* mapa isométrico reage ao scroll */
    if (mapPlane && !reduced) {
      var r = mapPlane.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        var p = 1 - (r.top + r.height / 2) / vh;      /* -1 .. 1 */
        var sc = window.innerWidth < 900 ? 0.8 : 1;    /* cabe na tela em telas menores */
        mapPlane.style.transform =
          'rotateX(' + (52 - p * 26) + 'deg) rotateZ(' + (-28 + p * 18) + 'deg) translateZ(' + (p * 30) + 'px) scale(' + sc + ')';
      }
    }

    /* link ativo */
    var cur = null;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop - vh * 0.35 <= y) cur = sections[i].id;
    }
    navAnchors.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + cur);
    });

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- tilt 3D nos cartões ---------- */
  if (!coarse && !reduced) {
    document.querySelectorAll('.tilt').forEach(function (card) {
      var rx = 0, ry = 0, tx = 0, ty = 0, raf = null;

      function loop() {
        rx = lerp(rx, tx, 0.14); ry = lerp(ry, ty, 0.14);
        card.style.transform = 'perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateZ(14px)';
        if (Math.abs(rx - tx) > 0.05 || Math.abs(ry - ty) > 0.05) raf = requestAnimationFrame(loop);
        else raf = null;
      }
      function start() { if (!raf) raf = requestAnimationFrame(loop); }

      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        tx = (0.5 - py) * 14; ty = (px - 0.5) * 16;
        card.style.setProperty('--mx', px * 100 + '%');
        card.style.setProperty('--my', py * 100 + '%');
        start();
      });
      card.addEventListener('pointerleave', function () { tx = 0; ty = 0; start(); });
    });
  }

  /* ---------- virada por clique, toque e teclado ----------
     O hover cobre o mouse, mas sozinho deixa de fora quem navega por
     teclado ou toque. Cada cartao e um controle com role/aria proprios. */
  document.querySelectorAll('.flip').forEach(function (f) {
    function alternar() {
      var virado = f.classList.toggle('flipped');
      f.setAttribute('aria-expanded', String(virado));
    }
    f.addEventListener('click', alternar);
    f.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();      /* espaco rolaria a pagina */
        alternar();
      }
    });
  });

  /* ---------- barras do gráfico com delay em cascata ---------- */
  document.querySelectorAll('.panel-chart span').forEach(function (s, i) {
    s.style.setProperty('--i', i + 1);
  });

})();
