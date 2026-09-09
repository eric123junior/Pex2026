/* ============================================================
   Cena de recarga dirigida pelo scroll.

   Uma unica linha do tempo 0 -> 1, amarrada ao progresso do scroll dentro
   da secao sticky. Nada aqui usa @keyframes: cada quadro e desenhado a
   partir do progresso, entao a cena anda para frente e para tras junto
   com o dedo do usuario.

   Fases:
     0.00 - 0.26  a picape entra e freia
     0.20 - 0.40  o totem de recarga sobe do chao
     0.36 - 0.52  o cabo se estica e o plugue encaixa
     0.50 - 0.78  energia corre pelo cabo, a bateria enche, os numeros sobem
     0.78 - 0.86  o cabo se recolhe e o plugue volta ao totem
     0.82 - 0.90  a picape liga: luz de cortesia e as duas barras de luz
     0.90 - 1.00  ela parte para a direita
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
    interior: document.getElementById('c-interior'),
    barraFrente: document.getElementById('c-barra-frente'),
    barraTras: document.getElementById('c-barra-tras'),
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
  function entrada(t) { return t * t * t; }                      /* ease-in cubico */
  function mix(a, b, t) { return a + (b - a) * t; }

  /* ---- enquadramento ----
     No desktop cabe a cena inteira. Em tela estreita as margens vazias
     custam caro: recortando para a area util, a picape renderiza ~40%
     maior sem mudar uma coordenada do desenho. */
  var ENQUADRE_AMPLO = '0 0 1200 500';
  var ENQUADRE_ESTREITO = '120 120 830 340';

  function enquadrar() {
    if (!svg) return;
    svg.setAttribute('viewBox',
      window.innerWidth < 700 ? ENQUADRE_ESTREITO : ENQUADRE_AMPLO);
  }
  window.addEventListener('resize', enquadrar);
  enquadrar();

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
    /* --- 1. chegada e partida ---
       Um unico eixo X cobre as duas: entra pela esquerda com desaceleracao
       e, no fim, arranca para a direita com aceleracao. Como x cresce
       sempre, as rodas podem girar em funcao dele. */
    var tEntrada = saida(faixa(p, 0, 0.26));
    var tSaida = entrada(faixa(p, 0.90, 1));
    var x = mix(-900, 0, tEntrada) + tSaida * 900;
    el.carro.setAttribute('transform', 'translate(' + x.toFixed(1) + ',0)');

    /* Rodas: giram proporcionalmente a distancia percorrida. O sinal e
       negativo porque elas estao dentro do grupo espelhado — ali um angulo
       positivo apareceria girando ao contrario do sentido de marcha. */
    var percorrido = x + 900;
    var giro = -percorrido * 1.6;
    el.roda1.setAttribute('transform', 'rotate(' + giro.toFixed(1) + ' 360 370)');
    el.roda2.setAttribute('transform', 'rotate(' + giro.toFixed(1) + ' 690 370)');

    /* o chao corre enquanto ela se move, para junto e volta a correr na saida */
    var velocidade = Math.max(1 - tEntrada, tSaida);
    el.chao.setAttribute('transform', 'translate(' + (-percorrido * 0.6 % 120).toFixed(1) + ',0)');
    el.chao.style.opacity = 0.25 + velocidade * 0.5;

    /* --- 2. o totem sobe do chao --- */
    var tTotem = suave(faixa(p, 0.20, 0.40));
    el.totem.setAttribute('transform', 'translate(0,' + mix(150, 0, tTotem).toFixed(1) + ')');
    el.totem.style.opacity = tTotem;

    /* a telinha do totem so acende depois que ele sobe */
    el.tela.style.opacity = faixa(p, 0.34, 0.44);

    /* --- 3. o cabo se estica, encaixa e depois se recolhe ---
       Uma unica variavel percorre o cabo: sobe de 0 a 1 na conexao e volta
       a 0 na desconexao, e o plugue apenas segue esse ponto no traçado. */
    var tCabo = suave(faixa(p, 0.36, 0.52)) * (1 - suave(faixa(p, 0.78, 0.86)));
    el.cabo.style.strokeDashoffset = COMPRIMENTO_CABO * (1 - tCabo);
    el.cabo.style.opacity = tCabo > 0.01 ? 1 : 0;

    if (COMPRIMENTO_CABO) {
      var ponto = el.cabo.getPointAtLength(COMPRIMENTO_CABO * tCabo);
      el.plugue.setAttribute('transform',
        'translate(' + ponto.x.toFixed(1) + ',' + ponto.y.toFixed(1) + ')');
      el.plugue.style.opacity = tCabo > 0.02 ? 1 : 0;
    }

    /* --- 4. energia correndo e bateria enchendo --- */
    var carregando = faixa(p, 0.50, 0.78);
    el.fluxo.style.opacity = carregando > 0 && carregando < 1 ? 0.95 : 0;
    /* o tracejado escorre do totem para o veiculo */
    el.fluxo.style.strokeDashoffset = (-carregando * 620).toFixed(1);

    var nivel = carregando;                     /* 0 -> 1 */
    var ALTURA = 54;
    el.bateria.setAttribute('height', (ALTURA * nivel).toFixed(1));
    el.bateria.setAttribute('y', (122 + ALTURA * (1 - nivel)).toFixed(1));
    /* style (e nao setAttribute) porque so a propriedade CSS resolve var() */
    el.bateria.style.fill = nivel < 0.35 ? '#ffd166' : 'rgb(var(--a1-rgb))';

    var pct = Math.round(mix(12, 100, nivel));
    el.pct.textContent = pct + '%';

    /* contadores da legenda lateral */
    el.kwh.textContent = (mix(0, 58.4, nivel)).toFixed(1);
    el.km.textContent = Math.round(mix(48, 547, nivel));
    el.min.textContent = Math.round(mix(38, 0, nivel));

    /* pulso de luz sob o veiculo enquanto carrega */
    var pulso = carregando > 0 && carregando < 1
      ? 0.35 + Math.sin(p * 90) * 0.18
      : 0;
    el.brilho.style.opacity = Math.max(0, pulso);

    /* --- 5. a partida: cabine e barras de luz acendem --- */
    var ligada = suave(faixa(p, 0.82, 0.90));
    el.interior.style.opacity = ligada * 0.9;
    /* as barras saem de um brilho residual (.25) para acesas */
    el.barraFrente.style.opacity = mix(0.25, 1, ligada);
    el.barraTras.style.opacity = mix(0.25, 0.95, ligada);
    /* o feixe do farol so aparece depois que ela liga */
    el.farol.style.opacity = ligada * 0.85;

    /* --- legendas: uma por vez, conforme a fase --- */
    var atual = p < 0.34 ? 0 : p < 0.52 ? 1 : p < 0.82 ? 2 : 3;
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
