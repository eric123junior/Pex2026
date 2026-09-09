/* ============================================================
   Seção de dashboards

   Duas camadas:

   1. Gráficos próprios, desenhados em SVG a partir de assets/data/
      estatisticas.json — sem biblioteca, e por isso seguem o tema
      cromático do scroll como qualquer outro elemento da página.

   2. Painéis oficiais da ABVE, incorporados por iframe. São relatórios
      Power BI publicados com "Publicar na web" pela própria associação,
      então não enviam `x-frame-options` e aceitam incorporação — ao
      contrário do mapa do carregados.com.br, que recusa.

   Os iframes só são criados quando a aba é aberta: cinco relatórios
   Power BI carregados de uma vez pesariam vários MB à toa.
   ============================================================ */
(function () {
  'use strict';

  var fmt = new Intl.NumberFormat('pt-BR');

  /* ==========================================================
     1. Gráficos próprios
     ========================================================== */
  /* JetBrains Mono e monoespacada: a 12px cada caractere avanca ~7,25px.
     Isso permite dimensionar as colunas de texto sem medir no DOM. */
  var AVANCO = 7.25;
  var TRILHO_MIN = 90;     /* abaixo disso a barra deixa de comunicar */

  function barras(alvo, itens, opcoes) {
    if (!alvo || !itens || !itens.length) return;
    opcoes = opcoes || {};

    /* O viewBox usa unidades proximas de pixels e o SVG escala
       uniformemente (sem preserveAspectRatio="none"), senao o texto
       deformaria junto com a largura do cartao. */
    var LARG = 320;
    var LINHA = 26;

    /* As colunas de texto acompanham o conteudo. Com largura fixa, um
       rotulo como "Tupinamba" ou "Acima de 150" passava por baixo da
       barra — que era exatamente o defeito visivel no grafico de redes. */
    var maxRotulo = 0, maxValor = 0;
    itens.forEach(function (it) {
      maxRotulo = Math.max(maxRotulo, String(it.rotulo).length);
      maxValor = Math.max(maxValor, fmt.format(it.valor).length);
    });

    var VALOR = maxValor * AVANCO + 6;
    /* o rotulo cede espaco antes do trilho: nunca o contrario */
    var ROTULO = Math.min(maxRotulo * AVANCO + 8, LARG - VALOR - TRILHO_MIN);
    var TRILHO = LARG - ROTULO - VALOR;

    /* quantos caracteres cabem de fato na coluna que sobrou */
    var cabem = Math.max(3, Math.floor((ROTULO - 8) / AVANCO));

    var maior = Math.max.apply(null, itens.map(function (i) { return i.valor; })) || 1;

    var partes = itens.map(function (it, i) {
      var y = i * LINHA;
      var w = Math.max(2, (it.valor / maior) * TRILHO);
      var cor = opcoes.alternar && i % 2
        ? 'rgb(var(--a2-rgb))' : 'rgb(var(--a1-rgb))';
      var rotulo = String(it.rotulo);
      var curto = rotulo.length > cabem ? rotulo.slice(0, cabem - 1) + '…' : rotulo;

      return '' +
        '<text x="0" y="' + (y + 14) + '" class="g-rot">' + escapar(curto) +
          (curto !== rotulo ? '<title>' + escapar(rotulo) + '</title>' : '') + '</text>' +
        '<rect x="' + ROTULO.toFixed(1) + '" y="' + (y + 5) + '" width="' + TRILHO.toFixed(1) +
              '" height="11" rx="5.5" class="g-trilho"/>' +
        '<rect x="' + ROTULO.toFixed(1) + '" y="' + (y + 5) + '" width="' + w.toFixed(1) +
              '" height="11" rx="5.5" fill="' + cor + '" class="g-barra" ' +
              'style="--atraso:' + (i * 60) + 'ms;--origem:' + ROTULO.toFixed(1) + 'px"/>' +
        '<text x="' + LARG + '" y="' + (y + 14) + '" class="g-val" text-anchor="end">' +
          fmt.format(it.valor) + '</text>';
    }).join('');

    alvo.innerHTML = '<svg viewBox="0 0 ' + LARG + ' ' + alto(itens, LINHA) + '" class="g-svg" ' +
      'role="img" aria-label="' + escapar(opcoes.titulo || 'gráfico de barras') + '">' +
      partes + '</svg>';
  }

  function alto(itens, linha) { return itens.length * linha; }

  function escapar(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  fetch('assets/data/estatisticas.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (s) {
      /* eletropostos por estado */
      barras(document.getElementById('g-uf'),
        (s.ranking_uf || []).slice(0, 10).map(function (u) {
          return { rotulo: u.uf, valor: u.total };
        }), { titulo: 'Eletropostos por estado' });

      /* redes com mais pontos — o nome inteiro vai para o gráfico, que
         corta sozinho se não couber e guarda o original num <title> */
      barras(document.getElementById('g-redes'),
        (s.redes || []).slice(0, 8).map(function (r) {
          return { rotulo: r.nome, valor: r.total };
        }), { titulo: 'Maiores redes', alternar: true });

      /* faixas de potência: rótulos curtos para sobrar trilho */
      var pot = s.potencias || {};
      barras(document.getElementById('g-potencia'),
        Object.keys(pot).map(function (k) {
          return {
            rotulo: k.replace('Até ', '≤ ').replace('Acima de ', '> ').replace(' kW', ''),
            valor: pot[k]
          };
        }), { titulo: 'Distribuição de potência' });

      /* rodapés com números */
      texto('g-uf-nota', (s.total_eletropostos ? fmt.format(s.total_eletropostos) : '—') +
        ' pontos em ' + (s.ufs_cobertas || '—') + ' estados');
      texto('g-redes-nota', (s.redes || []).length + ' redes identificadas');
      texto('g-potencia-nota', s.sem_potencia
        ? fmt.format(s.sem_potencia) + ' pontos sem potência declarada' : '');

      var f = s.fontes || {};
      texto('g-fontes', Object.keys(f).map(function (k) {
        return fmt.format(f[k]) + ' · ' + k;
      }).join('   |   '));
    })
    .catch(function () { /* os gráficos simplesmente não aparecem */ });

  function texto(id, txt) {
    var el = document.getElementById(id);
    if (el) el.textContent = txt;
  }


  /* ==========================================================
     2. Painéis oficiais da ABVE (Power BI)
     ========================================================== */
  var abas = Array.prototype.slice.call(document.querySelectorAll('.bi-aba'));
  var palco = document.getElementById('bi-palco');
  if (!abas.length || !palco) return;

  var carregados = {};

  function abrir(aba) {
    abas.forEach(function (b) {
      var ativa = b === aba;
      b.classList.toggle('ativa', ativa);
      b.setAttribute('aria-selected', String(ativa));
    });

    var url = aba.dataset.url;
    Object.keys(carregados).forEach(function (u) {
      carregados[u].hidden = u !== url;
    });

    if (!carregados[url]) {
      var quadro = document.createElement('iframe');
      quadro.className = 'bi-quadro';
      quadro.src = url;
      quadro.title = aba.textContent.trim() + ' — painel da ABVE';
      quadro.loading = 'lazy';
      quadro.allowFullscreen = true;
      quadro.setAttribute('frameborder', '0');
      palco.appendChild(quadro);
      carregados[url] = quadro;
    }

    var creditoUrl = aba.dataset.origem;
    var credito = document.getElementById('bi-credito');
    if (credito && creditoUrl) {
      credito.innerHTML = 'Painel publicado pela <a href="' + creditoUrl +
        '" target="_blank" rel="noopener">ABVE</a> — Associação Brasileira do ' +
        'Veículo Elétrico. Os dados e o relatório são de autoria dela.';
    }
  }

  abas.forEach(function (aba) {
    aba.addEventListener('click', function () { abrir(aba); });
  });

  /* Só monta o primeiro iframe quando a seção chega perto da tela.
     O observador é o caminho normal; a varredura no scroll é a rede de
     segurança para o caso de ele não disparar (aba em segundo plano,
     por exemplo), para o palco nunca ficar vazio. */
  var montado = false;
  function montarPrimeiro() {
    if (montado) return;
    var r = palco.getBoundingClientRect();
    if (r.top > window.innerHeight + 250 || r.bottom < -250) return;
    montado = true;
    window.removeEventListener('scroll', montarPrimeiro);
    abrir(abas[0]);
  }

  if (window.IntersectionObserver) {
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { observador.disconnect(); montarPrimeiro(); }
      });
    }, { rootMargin: '250px' });
    observador.observe(palco);
  }
  window.addEventListener('scroll', montarPrimeiro, { passive: true });
  montarPrimeiro();
})();
