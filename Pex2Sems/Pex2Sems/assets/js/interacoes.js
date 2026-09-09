/* ============================================================
   Camada de interação

   1. Campo de estrelas com parallax de scroll (o "preto espaço").
   2. Luz que segue o cursor, tingida pelo acento da seção atual.
   3. Botões magnéticos: elementos próximos do cursor são atraídos.
   4. Brilho que segue o cursor dentro dos cartões.

   Tudo é desligado em `prefers-reduced-motion` e em telas de toque,
   onde não existe cursor para seguir.
   ============================================================ */
(function () {
  'use strict';

  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var toque = window.matchMedia('(hover: none)').matches;
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ==========================================================
     1. Campo de estrelas
     ========================================================== */
  var cv = document.getElementById('estrelas');
  if (cv) {
    var ctx = cv.getContext('2d');
    var estrelas = [];
    var W = 0, H = 0, dpr = 1;

    function semear() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* densidade proporcional à área, com teto para telas grandes */
      var n = Math.min(260, Math.round((W * H) / 9000));
      estrelas = [];
      for (var i = 0; i < n; i++) {
        var camada = i % 3;                 /* 0 = fundo, 2 = frente */
        estrelas.push({
          x: Math.random() * W,
          y: Math.random() * (H * 2),       /* área dobrada: sobra para o parallax */
          r: 0.4 + camada * 0.45 + Math.random() * 0.5,
          o: 0.18 + camada * 0.16 + Math.random() * 0.2,
          p: 0.04 + camada * 0.07,          /* fator de parallax */
          f: Math.random() * 6.283          /* fase do cintilar */
        });
      }
    }

    function pintarEstrelas(y, tempo) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < estrelas.length; i++) {
        var e = estrelas[i];
        /* o deslocamento vertical é módulo 2H, então o campo nunca acaba */
        var ey = (e.y - y * e.p) % (H * 2);
        if (ey < 0) ey += H * 2;
        if (ey > H + 4) continue;

        var cintila = reduzido ? 1 : 0.75 + Math.sin(tempo * 0.0016 + e.f) * 0.25;
        ctx.beginPath();
        ctx.arc(e.x, ey, e.r, 0, 6.283);
        ctx.fillStyle = 'rgba(226,232,255,' + (e.o * cintila) + ')';
        ctx.fill();
      }
    }

    semear();
    window.addEventListener('resize', semear);
  }

  /* ==========================================================
     2. Luz que segue o cursor
     ========================================================== */
  var luz = document.getElementById('luz-cursor');
  var brilhoHero = document.querySelector('.hero-glow');

  var ponteiroX = window.innerWidth / 2, ponteiroY = window.innerHeight * 0.4;
  var luzX = ponteiroX, luzY = ponteiroY;
  var ativo = false;

  if (!toque && !reduzido) {
    window.addEventListener('pointermove', function (e) {
      ponteiroX = e.clientX;
      ponteiroY = e.clientY;
      if (!ativo) { ativo = true; if (luz) luz.classList.add('on'); }
    }, { passive: true });

    document.addEventListener('pointerleave', function () {
      ativo = false;
      if (luz) luz.classList.remove('on');
    });
  }

  /* ==========================================================
     3. Botões magnéticos
     ========================================================== */
  var imas = [];
  if (!toque && !reduzido) {
    imas = Array.prototype.slice.call(
      document.querySelectorAll('.btn, .clima-fab, .chips span, .brand, .nav-cta')
    ).map(function (el) {
      return { el: el, x: 0, y: 0, alcance: el.classList.contains('clima-fab') ? 110 : 90 };
    });
  }

  function moverImas() {
    for (var i = 0; i < imas.length; i++) {
      var m = imas[i];
      var r = m.el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > window.innerHeight + 100) continue;

      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dx = ponteiroX - cx;
      var dy = ponteiroY - cy;
      var d = Math.sqrt(dx * dx + dy * dy);

      var alvoX = 0, alvoY = 0;
      if (ativo && d < r.width / 2 + m.alcance) {
        /* atração cai com a distância: forte junto, nula na borda do alcance */
        var f = 1 - d / (r.width / 2 + m.alcance);
        alvoX = dx * f * 0.32;
        alvoY = dy * f * 0.42;
      }

      m.x = lerp(m.x, alvoX, 0.16);
      m.y = lerp(m.y, alvoY, 0.16);

      if (Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05) {
        if (m.el.style.getPropertyValue('--ima-x') !== '0px') {
          m.el.style.setProperty('--ima-x', '0px');
          m.el.style.setProperty('--ima-y', '0px');
        }
      } else {
        m.el.style.setProperty('--ima-x', m.x.toFixed(2) + 'px');
        m.el.style.setProperty('--ima-y', m.y.toFixed(2) + 'px');
      }
    }
  }

  /* ==========================================================
     4. Laço único
     ========================================================== */
  var ultimoY = -1;
  function quadro(tempo) {
    requestAnimationFrame(quadro);
    var y = window.scrollY || window.pageYOffset;

    if (cv && (!reduzido || y !== ultimoY)) {
      pintarEstrelas(y, tempo);
      ultimoY = y;
    }

    if (!toque && !reduzido) {
      luzX = lerp(luzX, ponteiroX, 0.09);
      luzY = lerp(luzY, ponteiroY, 0.09);

      if (luz) {
        luz.style.transform = 'translate3d(' + (luzX - 300) + 'px,' + (luzY - 300) + 'px,0)';
      }
      /* o halo do hero acompanha de longe, com atraso maior */
      if (brilhoHero) {
        var r = brilhoHero.parentNode.getBoundingClientRect();
        if (r.bottom > 0) {
          brilhoHero.style.marginLeft = ((luzX - window.innerWidth / 2) * 0.16).toFixed(1) + 'px';
          brilhoHero.style.marginTop = ((luzY - r.height / 2) * 0.10).toFixed(1) + 'px';
        }
      }
      moverImas();
    }
  }
  requestAnimationFrame(quadro);
})();
