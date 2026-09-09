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

  /* ---------- parallax hero + mapa 3D ---------- */
  var depthEls = Array.prototype.slice.call(document.querySelectorAll('[data-depth]'));
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

    /* parallax do hero (só enquanto visível) */
    if (!reduced && y < vh * 1.2) {
      var now = performance.now() / 1000;
      depthEls.forEach(function (el, idx) {
        var d = parseFloat(el.dataset.depth) || 0.2;
        var tz = -y * d * 0.55;
        var op = clamp(1 - (y / (vh * 0.85)) * d * 1.1, 0, 1);
        /* cartões flutuantes ganham uma oscilação senoidal própria */
        var bob = el.classList.contains('fcard') ? Math.sin(now * 0.9 + idx * 1.7) * 14 : 0;
        el.style.transform = 'translate3d(0,' + (-y * d * 0.28 + bob) + 'px,' + tz + 'px)';
        el.style.opacity = op;
      });
    }

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

  /* ============================================================
     Globo de pontos 3D em canvas (hero) — projeção própria, sem libs
     ============================================================ */
  var cv = document.getElementById('globe');
  if (cv) {
    var ctx = cv.getContext('2d');
    var pts = [], W = 0, H = 0, dpr = 1;
    var N = 900;
    var RAIO_INFL = 190;        /* raio de influencia do cursor, em px */

    /* distribuicao fibonacci na esfera */
    for (var i = 0; i < N; i++) {
      var k = i + 0.5;
      var phi = Math.acos(1 - 2 * k / N);
      var theta = Math.PI * (1 + Math.sqrt(5)) * k;
      pts.push({
        x: Math.cos(theta) * Math.sin(phi),
        y: Math.sin(theta) * Math.sin(phi),
        z: Math.cos(phi),
        s: Math.random() < 0.06 ? 2 : 1
      });
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (alvoX === null) { alvoX = W / 2; alvoY = H / 2; segX = alvoX; segY = alvoY; }
    }

    /* ---- ponteiro ----
       alvoX/alvoY guardam a posicao crua; segX/segY perseguem com atraso,
       que e o que faz a esfera parecer ter inercia em vez de grudar no mouse. */
    var alvoX = null, alvoY = null, segX = 0, segY = 0, temPonteiro = false;

    window.addEventListener('resize', resize);
    resize();

    window.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      alvoX = e.clientX - r.left;
      alvoY = e.clientY - r.top;
      temPonteiro = true;
    }, { passive: true });

    window.addEventListener('pointerleave', function () { temPonteiro = false; }, { passive: true });

    /* clique solta uma onda que percorre a esfera */
    var onda = null;
    cv.parentNode.addEventListener('pointerdown', function (e) {
      var r = cv.getBoundingClientRect();
      onda = { x: e.clientX - r.left, y: e.clientY - r.top, t0: performance.now() };
    });

    /* cores vivas: acompanham o tema que o scroll estiver aplicando */
    var padraoA1 = [124, 92, 255], padraoA2 = [34, 211, 238];
    function acentos() {
      var t = window.__temaAtual;
      return t ? [t[0], t[1]] : [padraoA1, padraoA2];
    }

    var t = 0;
    var vizinhos = [];          /* pontos sob influencia do cursor, reaproveitado */

    function draw() {
      if (!reduced) requestAnimationFrame(draw);
      if (current.y > window.innerHeight * 1.15) return;   /* pausa fora da tela */

      ctx.clearRect(0, 0, W, H);
      if (!reduced) t += 0.0025;

      /* sem ponteiro (toque, ou mouse fora), a esfera volta devagar ao centro */
      if (alvoX === null) { alvoX = W / 2; alvoY = H / 2; }
      var destinoX = temPonteiro ? alvoX : W / 2;
      var destinoY = temPonteiro ? alvoY : H / 2;
      segX = lerp(segX, destinoX, 0.10);
      segY = lerp(segY, destinoY, 0.10);

      var normX = (segX / W - 0.5);        /* -0.5 .. 0.5 */
      var normY = (segY / H - 0.5);

      var R = Math.min(W, H) * (W < 720 ? 0.21 : 0.19);
      /* o centro da esfera se desloca na direcao do cursor, sem colar nele */
      var cx = W / 2 + normX * Math.min(W, H) * 0.55;
      var cy = H / 2 + normY * Math.min(W, H) * 0.40 + current.y * 0.18;

      /* e ela tambem gira para "olhar" para o cursor */
      var ay = t + normX * 1.5;
      var ax = -0.35 + normY * 1.0 + current.y * 0.0009;
      var ca = Math.cos(ay), sa = Math.sin(ay);
      var cb = Math.cos(ax), sb = Math.sin(ax);

      var cores = acentos();
      var c1 = cores[0], c2 = cores[1];

      /* onda do clique: raio cresce e some */
      var ondaR = -1, ondaForca = 0;
      if (onda) {
        var dt = (performance.now() - onda.t0) / 900;
        if (dt >= 1) { onda = null; }
        else { ondaR = dt * Math.max(W, H) * 0.75; ondaForca = 1 - dt; }
      }

      vizinhos.length = 0;

      for (var j = 0; j < pts.length; j++) {
        var p = pts[j];
        /* rotacao Y depois X */
        var x1 = p.x * ca - p.z * sa;
        var z1 = p.x * sa + p.z * ca;
        var y1 = p.y * cb - z1 * sb;
        var z2 = p.y * sb + z1 * cb;

        var persp = 1 / (2.2 - z2);
        var sx = cx + x1 * R * persp * 2.2;
        var sy = cy + y1 * R * persp * 2.2;
        var depth = (z2 + 1) / 2;                       /* 0 fundo .. 1 frente */

        /* ---- reacao ao cursor ---- */
        var dx = sx - segX, dy = sy - segY;
        var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        var forca = dist < RAIO_INFL ? 1 - dist / RAIO_INFL : 0;
        if (forca > 0) {
          var empurra = forca * forca * 30;
          sx += (dx / dist) * empurra;
          sy += (dy / dist) * empurra;
          if (forca > 0.34 && vizinhos.length < 70) vizinhos.push(sx, sy, forca);
        }

        /* ---- onda do clique ---- */
        var pulso = 0;
        if (ondaR > 0) {
          var dOnda = Math.abs(dist - ondaR);
          if (dOnda < 70) pulso = (1 - dOnda / 70) * ondaForca;
        }

        var brilho = forca * 0.75 + pulso * 0.9;
        var alpha = Math.min(1, 0.08 + depth * 0.6 + brilho);
        var size = p.s * 0.9 + depth * 1.5 + forca * 2.4 + pulso * 2.6;
        var cor = (p.s === 2 || brilho > 0.35) ? c2 : c1;
        var op = p.s === 2 ? alpha : alpha * 0.85;

        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, 6.283);
        ctx.fillStyle = 'rgba(' + cor[0] + ',' + cor[1] + ',' + cor[2] + ',' + op + ')';
        ctx.fill();
      }

      /* ---- constelacao: liga os pontos que estao perto do cursor ----
         So os vizinhos entram no laco, entao o custo fica limitado
         mesmo com 900 pontos na esfera. */
      if (vizinhos.length > 5) {
        ctx.lineWidth = 1;
        for (var a = 0; a < vizinhos.length; a += 3) {
          for (var b = a + 3; b < vizinhos.length; b += 3) {
            var lx = vizinhos[a] - vizinhos[b];
            var ly = vizinhos[a + 1] - vizinhos[b + 1];
            var d2 = lx * lx + ly * ly;
            if (d2 > 4900) continue;                      /* > 70px: ignora */
            var forcaLinha = (1 - Math.sqrt(d2) / 70) *
                             Math.min(vizinhos[a + 2], vizinhos[b + 2]);
            ctx.strokeStyle = 'rgba(' + c2[0] + ',' + c2[1] + ',' + c2[2] + ',' +
                              (forcaLinha * 0.5) + ')';
            ctx.beginPath();
            ctx.moveTo(vizinhos[a], vizinhos[a + 1]);
            ctx.lineTo(vizinhos[b], vizinhos[b + 1]);
            ctx.stroke();
          }
        }
      }
    }
    draw();
    window.addEventListener('resize', function () { if (reduced) draw(); });
  }
})();
