/* ============================================================
   Cena de recarga dirigida pelo scroll.

   Uma unica linha do tempo 0 -> 1, amarrada ao progresso do scroll dentro
   da secao sticky. Nada aqui usa @keyframes: cada quadro e desenhado a
   partir do progresso, entao a cena anda para frente e para tras junto
   com o dedo do usuario.

   Fases:
     0.00 - 0.30  o carro entra e freia
     0.22 - 0.40  o totem de recarga sobe do chao
     0.38 - 0.55  o cabo se estica e o plugue encaixa
     0.52 - 0.92  energia corre pelo cabo, a bateria enche, os numeros sobem
     0.88 - 1.00  o carro se acende e a legenda final aparece
   ============================================================ */
(function () {
  'use strict';

  var secao = document.getElementById('recarga');
  if (!secao) return;

  var svg = document.getElementById('cena');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var el = {
    carro: document.getElementById('c-carro'),
    roda1: document.getElementById('c-roda1'),
    roda2: document.getElementById('c-roda2'),
    totem: document.getElementById('c-totem'),
    cabo: document.getElementById('c-cabo'),
    fluxo: document.getElementById('c-fluxo'),
    plugue: document.getElementById('c-plugue'),
    bateria: document.getElementById('c-bateria-nivel'),
    brilho: document.getElementById('c-brilho'),
    farol: document.getElementById('c-farol'),
    chao: document.getElementById('c-chao'),
    tela: document.getElementById('c-tela'),
    pct: document.getElementById('c-pct'),
    kwh: document.getElementById('kwh'),
    km: document.getElementById('km'),
    min: document.getElementById('min'),
    legendas: Array.prototype.slice.call(document.querySelectorAll('.chg-step'))
  };

  /* ---- utilidades de interpolacao ---- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function faixa(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function suave(t) { return t * t * (3 - 2 * t); }              /* smoothstep */
  function saida(t) { return 1 - Math.pow(1 - t, 3); }           /* ease-out cubico */
  function mix(a, b, t) { return a + (b - a) * t; }

  var COMPRIMENTO_CABO = el.cabo ? el.cabo.getTotalLength() : 0;
  if (el.cabo) {
    el.cabo.style.strokeDasharray = COMPRIMENTO_CABO;
    el.cabo.style.strokeDashoffset = COMPRIMENTO_CABO;
  }
  if (el.fluxo) {
    el.fluxo.style.strokeDasharray = '18 26';
  }

  /* ---------------------------------------------------------- */
  function desenhar(p) {
    /* --- 1. o carro entra vindo da esquerda e freia --- */
    var tEntrada = saida(faixa(p, 0, 0.30));
    var x = mix(-620, 0, tEntrada);
    el.carro.setAttribute('transform', 'translate(' + x.toFixed(1) + ',0)');

    /* rodas giram proporcionalmente a distancia percorrida */
    var giro = (x + 620) * 1.9;
    el.roda1.setAttribute('transform', 'rotate(' + giro.toFixed(1) + ' 352 372)');
    el.roda2.setAttribute('transform', 'rotate(' + giro.toFixed(1) + ' 636 372)');

    /* o chao corre enquanto o carro se move, e para junto */
    var velocidade = 1 - tEntrada;
    el.chao.setAttribute('transform', 'translate(' + (-(x + 620) * 0.6 % 120).toFixed(1) + ',0)');
    el.chao.style.opacity = 0.25 + velocidade * 0.5;

    /* --- 2. o totem sobe do chao --- */
    var tTotem = suave(faixa(p, 0.22, 0.42));
    el.totem.setAttribute('transform', 'translate(0,' + mix(150, 0, tTotem).toFixed(1) + ')');
    el.totem.style.opacity = tTotem;

    /* a telinha do totem so acende depois que ele sobe */
    el.tela.style.opacity = faixa(p, 0.36, 0.46);

    /* --- 3. o cabo se estica e o plugue encaixa --- */
    var tCabo = suave(faixa(p, 0.38, 0.56));
    el.cabo.style.strokeDashoffset = COMPRIMENTO_CABO * (1 - tCabo);
    el.cabo.style.opacity = tCabo > 0 ? 1 : 0;

    if (COMPRIMENTO_CABO) {
      var ponto = el.cabo.getPointAtLength(COMPRIMENTO_CABO * tCabo);
      el.plugue.setAttribute('transform',
        'translate(' + ponto.x.toFixed(1) + ',' + ponto.y.toFixed(1) + ')');
      el.plugue.style.opacity = tCabo > 0.02 ? 1 : 0;
    }

    /* --- 4. energia correndo e bateria enchendo --- */
    var carregando = faixa(p, 0.52, 0.92);
    el.fluxo.style.opacity = carregando > 0 && carregando < 1 ? 0.95 : (carregando >= 1 ? 0.35 : 0);
    /* o tracejado escorre do totem para o carro */
    el.fluxo.style.strokeDashoffset = (-carregando * 620).toFixed(1);

    var nivel = carregando;                     /* 0 -> 1 */
    var ALTURA = 54;
    el.bateria.setAttribute('height', (ALTURA * nivel).toFixed(1));
    el.bateria.setAttribute('y', (150 + ALTURA * (1 - nivel)).toFixed(1));
    /* style (e nao setAttribute) porque so a propriedade CSS resolve var() */
    el.bateria.style.fill = nivel < 0.35 ? '#ffd166' : 'rgb(var(--a1-rgb))';

    var pct = Math.round(mix(12, 100, nivel));
    el.pct.textContent = pct + '%';

    /* contadores da legenda lateral */
    el.kwh.textContent = (mix(0, 58.4, nivel)).toFixed(1);
    el.km.textContent = Math.round(mix(48, 427, nivel));
    el.min.textContent = Math.round(mix(38, 0, nivel));

    /* pulso de luz sob o carro enquanto carrega */
    var pulso = carregando > 0 && carregando < 1
      ? 0.35 + Math.sin(p * 90) * 0.18
      : carregando >= 1 ? 0.5 : 0;
    el.brilho.style.opacity = Math.max(0, pulso);

    /* --- 5. carro carregado: farol acende --- */
    var tFim = faixa(p, 0.88, 1);
    el.farol.style.opacity = tFim;

    /* --- legendas: uma por vez, conforme a fase --- */
    var atual = p < 0.34 ? 0 : p < 0.56 ? 1 : p < 0.9 ? 2 : 3;
    for (var i = 0; i < el.legendas.length; i++) {
      el.legendas[i].classList.toggle('on', i === atual);
    }
  }

  /* ---------------------------------------------------------- */
  var alvo = 0, atual = 0, rodando = false;

  function progresso() {
    var r = secao.getBoundingClientRect();
    var total = secao.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp(-r.top / total, 0, 1);
  }

  function loop() {
    /* suavizacao: o desenho persegue o scroll em vez de colar nele.
       E o que da a sensacao de peso das animacoes da Apple. */
    atual += (alvo - atual) * 0.12;
    if (Math.abs(alvo - atual) < 0.0002) { atual = alvo; rodando = false; }
    else { requestAnimationFrame(loop); }
    desenhar(atual);
  }

  function aoRolar() {
    alvo = progresso();
    if (reduced) { atual = alvo; desenhar(atual); return; }
    if (!rodando) { rodando = true; requestAnimationFrame(loop); }
  }

  window.addEventListener('scroll', aoRolar, { passive: true });
  window.addEventListener('resize', aoRolar);
  aoRolar();
  desenhar(alvo);
})();
