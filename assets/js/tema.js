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

  /* id da seção -> [acento 1, acento 2, acento 3, fundo]
   *
   * Toda a família fica no mesmo registro sóbrio — verde sálvia, azul
   * petróleo e cinza ardósia. A variação entre seções é sutil de
   * propósito: serve para dar orientação espacial na rolagem, não para
   * chamar atenção. Nada de neon nem de salto de matiz.
   */
  var TEMAS = {
    top:        [[138, 174, 150], [111, 153, 170], [154, 167, 180], [16, 20, 24]],
    numeros:    [[132, 168, 152], [111, 153, 170], [154, 167, 180], [16, 20, 24]],
    recarga:    [[126, 168, 142], [122, 158, 168], [150, 165, 176], [15, 20, 23]],
    dashboards: [[118, 155, 168], [136, 170, 152], [150, 164, 178], [16, 20, 25]],
    mapa:       [[111, 153, 170], [130, 166, 150], [148, 163, 178], [15, 20, 25]],
    modelos:    [[164, 156, 132], [130, 158, 160], [156, 164, 172], [20, 20, 22]],
    categorias: [[140, 160, 168], [134, 168, 148], [152, 166, 178], [17, 20, 24]],
    servicos:   [[120, 152, 166], [138, 170, 152], [150, 164, 176], [16, 20, 25]],
    fontes:     [[134, 164, 156], [116, 150, 168], [152, 166, 178], [16, 20, 24]],
    time:       [[150, 152, 148], [128, 160, 162], [158, 166, 172], [18, 20, 23]],
    faq:        [[116, 152, 168], [138, 170, 152], [150, 164, 178], [15, 19, 23]],
    politicas:  [[144, 158, 168], [124, 156, 164], [154, 166, 176], [16, 20, 24]],
    contato:    [[138, 174, 150], [111, 153, 170], [154, 167, 180], [17, 21, 25]]
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
