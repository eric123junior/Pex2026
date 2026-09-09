/* ============================================================
   Tema cromático guiado pelo scroll

   Cada seção declara uma paleta. Conforme a página rola, as três cores
   de acento e o tom do fundo são interpolados entre a seção atual e a
   próxima — não há corte, a cor vira continuamente.

   A troca acontece escrevendo as custom properties --a1-rgb, --a2-rgb,
   --a3-rgb e --bg-rgb em :root. Como toda a folha de estilo referencia
   esses tokens, o site inteiro (bordas, brilhos, gradientes, botões,
   mapa, tabela) acompanha sozinho.

   Para mudar a identidade de uma seção, edite só a linha dela em TEMAS.
   ============================================================ */
(function () {
  'use strict';

  /* id da seção -> [acento 1, acento 2, acento 3, fundo] */
  var TEMAS = {
    top:        [[124,  92, 255], [ 34, 211, 238], [183, 140, 255], [  5,  6, 14]],
    numeros:    [[109, 139, 255], [ 34, 211, 238], [124,  92, 255], [  6,  7, 18]],
    recarga:    [[ 25, 224, 138], [124, 246, 255], [199, 249,  75], [  4, 12, 16]],
    dashboards: [[ 76, 141, 255], [ 34, 211, 238], [124,  92, 255], [  6,  8, 20]],
    mapa:       [[ 34, 211, 238], [ 74, 222, 128], [125, 211, 252], [  5, 10, 20]],
    modelos:    [[255, 122, 182], [167, 139, 250], [255, 209, 102], [ 12,  6, 20]],
    categorias: [[167, 139, 250], [ 34, 211, 238], [199, 249,  75], [  8,  6, 20]],
    servicos:   [[ 56, 189, 248], [129, 140, 248], [125, 211, 252], [  5,  8, 20]],
    fontes:     [[129, 140, 248], [ 34, 211, 238], [167, 139, 250], [  6,  7, 18]],
    time:       [[244, 114, 182], [167, 139, 250], [251, 191,  36], [ 10,  6, 18]],
    faq:        [[ 34, 211, 238], [129, 140, 248], [125, 211, 252], [  5,  7, 16]],
    politicas:  [[148, 163, 255], [ 34, 211, 238], [167, 139, 250], [  5,  6, 14]],
    contato:    [[124,  92, 255], [ 34, 211, 238], [255, 122, 182], [  7,  6, 18]]
  };

  var raiz = document.documentElement;
  var metaCor = document.querySelector('meta[name="theme-color"]');

  /* só as seções que existem na página, na ordem em que aparecem */
  var trilha = Array.prototype.slice
    .call(document.querySelectorAll('section[id]'))
    .filter(function (s) { return TEMAS[s.id]; })
    .map(function (s) { return { el: s, tema: TEMAS[s.id], topo: 0 }; });

  if (trilha.length < 2) return;

  /* As posições são medidas uma vez (e a cada resize), nunca durante o scroll.
     Ler offsetTop no meio do scroll forçaria recálculo de layout a cada evento,
     justamente o que torna esse tipo de efeito pesado. */
  function medir() {
    for (var i = 0; i < trilha.length; i++) trilha[i].topo = trilha[i].el.offsetTop;
  }

  function mistura(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  var anterior = '';

  function aplicar() {
    var alvoY = window.scrollY + window.innerHeight * 0.45;

    /* acha o par de seções que envolve o ponto de referência */
    var i = 0;
    for (var k = 0; k < trilha.length; k++) {
      if (trilha[k].topo <= alvoY) i = k;
    }
    var atual = trilha[i];
    var proxima = trilha[Math.min(i + 1, trilha.length - 1)];

    var inicio = atual.topo;
    var fim = proxima.topo;
    var t = fim > inicio ? (alvoY - inicio) / (fim - inicio) : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    /* suaviza para a cor "assentar" no miolo da seção e virar na borda */
    t = t * t * (3 - 2 * t);

    var cores = [
      mistura(atual.tema[0], proxima.tema[0], t),
      mistura(atual.tema[1], proxima.tema[1], t),
      mistura(atual.tema[2], proxima.tema[2], t),
      mistura(atual.tema[3], proxima.tema[3], t)
    ];

    var assinatura = cores.join('|');
    if (assinatura === anterior) return;   /* nada mudou: não mexe no CSSOM */
    anterior = assinatura;

    raiz.style.setProperty('--a1-rgb', cores[0].join(','));
    raiz.style.setProperty('--a2-rgb', cores[1].join(','));
    raiz.style.setProperty('--a3-rgb', cores[2].join(','));
    raiz.style.setProperty('--bg-rgb', cores[3].join(','));

    /* a barra do navegador no celular acompanha o fundo */
    if (metaCor) {
      metaCor.setAttribute('content', 'rgb(' + cores[3].join(',') + ')');
    }

    /* disponível para quem quiser reagir à cor corrente (ex.: o globo) */
    window.__temaAtual = cores;
  }

  /* Com as posições em cache, aplicar() é só aritmética e quatro
     setProperty — barato o bastante para rodar direto no evento de
     scroll, sem passar por requestAnimationFrame. */
  window.addEventListener('scroll', aplicar, { passive: true });
  window.addEventListener('resize', function () { medir(); aplicar(); });
  window.addEventListener('load', function () { medir(); aplicar(); });

  /* Conteúdo que chega depois (tabela de modelos, mapa, fontes da web)
     muda a altura da página e desloca todas as seções. Sem remedir, a
     cor descolaria da seção que está na tela. */
  if (window.ResizeObserver) {
    var alturaAnterior = 0;
    new ResizeObserver(function () {
      var h = document.body.scrollHeight;
      if (Math.abs(h - alturaAnterior) < 4) return;
      alturaAnterior = h;
      medir();
      aplicar();
    }).observe(document.body);
  }

  medir();
  aplicar();
})();
