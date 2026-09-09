/* ============================================================
   Campo de partículas do hero

   Discreto de propósito: pontos de 1–2 px em branco de baixa opacidade,
   deriva lenta e um raio de interação pequeno (120 px). A ideia é dar
   textura ao fundo sem competir com a leitura dos números.

   Perto do cursor os pontos se afastam de leve e se ligam por linhas
   finas. Fora desse raio, nada acontece.

   Sem dependências. Pausa quando o hero sai da tela e respeita
   prefers-reduced-motion.
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('particulas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var hero = canvas.closest('section') || document.body;
  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- parâmetros ---------- */
  var DENSIDADE = 12000;   // 1 partícula a cada N px² de tela
  var MAX = 140;           // teto de partículas, para telas grandes
  var RAIO_MOUSE = 120;    // raio de interação, em px
  var RAIO_LINHA = 130;    // distância máxima para ligar dois pontos
  var VELOCIDADE = 0.16;   // px por quadro

  var particulas = [];
  var L = 0, A = 0, dpr = 1;
  var mouseX = null, mouseY = null;

  /* ---------- dimensionamento ---------- */
  function dimensionar() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    L = canvas.clientWidth;
    A = canvas.clientHeight;
    canvas.width = Math.round(L * dpr);
    canvas.height = Math.round(A * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    semear();
  }

  function semear() {
    var alvo = Math.min(MAX, Math.round((L * A) / DENSIDADE));
    particulas = [];
    for (var i = 0; i < alvo; i++) {
      var angulo = Math.random() * Math.PI * 2;
      particulas.push({
        x: Math.random() * L,
        y: Math.random() * A,
        vx: Math.cos(angulo) * VELOCIDADE,
        vy: Math.sin(angulo) * VELOCIDADE,
        r: 0.8 + Math.random() * 1.2,          // 1 a 2 px
        o: 0.18 + Math.random() * 0.22         // opacidade base
      });
    }
  }

  /* ---------- ponteiro ---------- */
  function aoMover(e) {
    var r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  }
  function aoSair() { mouseX = mouseY = null; }

  window.addEventListener('pointermove', aoMover, { passive: true });
  window.addEventListener('pointerleave', aoSair, { passive: true });
  window.addEventListener('blur', aoSair);

  /* ---------- desenho ---------- */
  function desenhar() {
    ctx.clearRect(0, 0, L, A);

    for (var i = 0; i < particulas.length; i++) {
      var p = particulas[i];

      if (!reduzido) {
        p.x += p.vx;
        p.y += p.vy;

        /* atravessa a borda e reaparece do outro lado */
        if (p.x < -5) p.x = L + 5; else if (p.x > L + 5) p.x = -5;
        if (p.y < -5) p.y = A + 5; else if (p.y > A + 5) p.y = -5;
      }

      var px = p.x, py = p.y, brilho = p.o;

      /* repulsão suave: só dentro do raio, e proporcional à proximidade */
      if (mouseX !== null) {
        var dx = p.x - mouseX;
        var dy = p.y - mouseY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < RAIO_MOUSE && dist > 0.01) {
          var forca = (1 - dist / RAIO_MOUSE);
          px += (dx / dist) * forca * 14;
          py += (dy / dist) * forca * 14;
          brilho = Math.min(0.55, p.o + forca * 0.3);
        }
      }
      p.px = px;
      p.py = py;

      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(226, 232, 240, ' + brilho.toFixed(3) + ')';
      ctx.fill();
    }

    /* ---------- linhas: só entre pontos próximos do cursor ----------
       Ligar tudo com tudo viraria a teia de aranha genérica e pesaria
       O(n²). Aqui só entram os pontos sob influência do ponteiro. */
    if (mouseX !== null) {
      var perto = [];
      for (var j = 0; j < particulas.length; j++) {
        var q = particulas[j];
        var qx = q.px - mouseX, qy = q.py - mouseY;
        if (qx * qx + qy * qy < RAIO_MOUSE * RAIO_MOUSE) perto.push(q);
      }

      ctx.lineWidth = 1;
      for (var a = 0; a < perto.length; a++) {
        for (var b = a + 1; b < perto.length; b++) {
          var lx = perto[a].px - perto[b].px;
          var ly = perto[a].py - perto[b].py;
          var d2 = lx * lx + ly * ly;
          if (d2 > RAIO_LINHA * RAIO_LINHA) continue;
          var alfa = (1 - Math.sqrt(d2) / RAIO_LINHA) * 0.16;
          ctx.strokeStyle = 'rgba(226, 232, 240, ' + alfa.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(perto[a].px, perto[a].py);
          ctx.lineTo(perto[b].px, perto[b].py);
          ctx.stroke();
        }
      }
    }
  }

  /* ---------- laço ---------- */
  var visivel = true;
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (e) {
      visivel = e[0].isIntersecting;
    }, { threshold: 0 }).observe(hero);
  }

  function quadro() {
    requestAnimationFrame(quadro);
    if (!visivel || document.visibilityState !== 'visible') return;
    desenhar();
  }

  window.addEventListener('resize', dimensionar);
  dimensionar();

  /* O laço roda mesmo com prefers-reduced-motion: o que a preferência
     desliga é a deriva automática (tratada em desenhar), não a resposta
     ao ponteiro, que é uma ação do próprio usuário. */
  requestAnimationFrame(quadro);
})();
