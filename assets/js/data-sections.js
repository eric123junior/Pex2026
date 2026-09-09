/* ============================================================
   Preenche as secoes que dependem do banco gerado pelo ETL:
   estatisticas do topo, ranking por UF e tabela de modelos.

   O HTML ja traz valores estaticos como fallback, entao a pagina
   continua legivel se o fetch falhar (ex.: aberta via file://).
   ============================================================ */
(function () {
  'use strict';

  var fmt = new Intl.NumberFormat('pt-BR');
  var brl = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0
  });

  function json(caminho) {
    /* no-cache: revalida com o servidor para pegar a coleta mais recente */
    return fetch(caminho, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* ---------- estatisticas + ranking ---------- */
  json('assets/data/estatisticas.json').then(function (s) {
    definir('st-eletropostos', s.total_eletropostos);
    definir('st-ufs', s.ufs_cobertas);
    definir('st-modelos', s.total_modelos);
    definir('st-ofertas', s.total_ofertas);
    definir('st-conectores', Object.keys(s.conectores || {}).length);
    definir('st-categorias', Object.keys(s.categorias || {}).length);

    var elPreco = document.getElementById('st-preco');
    if (elPreco && s.preco_medio_brl) {
      elPreco.textContent = brl.format(s.preco_medio_brl);
      elPreco.removeAttribute('data-count');
    }

    var elData = document.querySelectorAll('[data-atualizado]');
    Array.prototype.forEach.call(elData, function (e) { e.textContent = s.data; });

    /* métricas do hero: mesmo número da coleta, sem contador animado */
    document.querySelectorAll('[data-metrica]').forEach(function (el) {
      var v = s[el.dataset.metrica];
      if (v != null) el.textContent = fmt.format(v);
    });

    ranking(s.ranking_uf);
    categorias(s.por_categoria);
  }).catch(function () { /* mantem os valores estaticos do HTML */ });

  /* ---------- retrato de cada categoria ABVE ---------- */
  function categorias(dados) {
    if (!dados) return;
    Object.keys(dados).forEach(function (cat) {
      var d = dados[cat];
      var frente = document.querySelector('[data-cat-dados="' + cat + '"]');
      var verso = document.querySelector('[data-cat-verso="' + cat + '"]');

      /* Categoria sem oferta na coleta e dito com todas as letras, em vez
         de mostrar um zero que pareceria dado faltando. */
      if (!d.ofertas) {
        if (frente) {
          frente.innerHTML = '<span class="vazio-cat">sem ofertas nesta coleta</span>';
        }
        return;
      }

      if (frente) {
        frente.innerHTML =
          linha('Ofertas', fmt.format(d.ofertas)) +
          linha('Preço médio', d.preco_medio_brl ? brl.format(d.preco_medio_brl) : '—');
      }
      if (verso) {
        verso.innerHTML =
          linha('Modelos', fmt.format(d.modelos)) +
          (d.autonomia_media_km ? linha('Autonomia', d.autonomia_media_km + ' km') : '') +
          (d.conector ? linha('Conector', d.conector) : '');
      }
    });
  }

  function linha(rotulo, valor) {
    return '<div><dt>' + rotulo + '</dt><dd>' + valor + '</dd></div>';
  }

  function definir(id, valor) {
    var el = document.getElementById(id);
    if (!el || valor == null) return;
    /* o contador animado de main.js le data-count */
    el.setAttribute('data-count', valor);
    if (!el.closest('.reveal.in')) el.textContent = '0';
    else el.textContent = fmt.format(valor);
  }

  function ranking(lista) {
    var alvo = document.getElementById('rank-uf');
    if (!alvo || !lista || !lista.length) return;
    var topo = lista.slice(0, 6);
    var maior = topo[0].total || 1;
    alvo.innerHTML = topo.map(function (u) {
      return '<li>' +
        '<span>' + u.uf + '</span>' +
        '<b>' + u.nome + '</b>' +
        '<i style="--p:' + Math.round((u.total / maior) * 100) + '%"></i>' +
        '<u>' + fmt.format(u.total) + '</u>' +
      '</li>';
    }).join('');
  }

  /* ---------- modelos e precos ---------- */
  var elTabela = document.getElementById('modelos-corpo');
  if (!elTabela) return;

  var POR_PAGINA = 12;

  json('assets/data/modelos.json').then(function (d) {
    var cambio = document.getElementById('modelos-cambio');
    if (cambio) {
      cambio.textContent = 'US$ 1 = ' +
        d.cambio_usd_brl.toFixed(4).replace('.', ',') + ' BRL · ' +
        d.cambio_fonte + ' · ' + (d.cambio_atualizado_em || d.atualizado_em);
    }

    var modelos = d.modelos;
    var filtro = document.getElementById('modelos-filtro');
    var busca = document.getElementById('modelos-busca');
    var rodape = document.getElementById('modelos-paginacao');
    var pagina = 1;

    function filtrados() {
      var cat = filtro ? filtro.value : '';
      var termo = (busca ? busca.value : '').trim().toLowerCase();
      return modelos.filter(function (m) {
        if (cat && m.categoria !== cat) return false;
        if (termo && (m.marca + ' ' + m.modelo).toLowerCase().indexOf(termo) === -1) return false;
        return true;
      });
    }

    function render() {
      var lista = filtrados();
      var paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
      if (pagina > paginas) pagina = paginas;

      var inicio = (pagina - 1) * POR_PAGINA;
      var fatia = lista.slice(inicio, inicio + POR_PAGINA);

      if (!fatia.length) {
        elTabela.innerHTML =
          '<tr><td colspan="7" class="vazio">Nenhum modelo encontrado.</td></tr>';
        if (rodape) rodape.innerHTML = '';
        return;
      }

      elTabela.innerHTML = fatia.map(function (m) {
        return '<tr>' +
          '<td><b>' + cap(m.marca) + '</b><span>' + cap(m.modelo) + '</span></td>' +
          '<td><span class="pill cat-' + m.categoria + '">' + m.categoria + '</span></td>' +
          '<td class="mono">' + (m.conector || '—') + '</td>' +
          '<td class="mono">' + (m.autonomia_km ? m.autonomia_km + ' km' : '—') + '</td>' +
          '<td class="cel-num">' + brl.format(m.preco_medio_brl) + '</td>' +
          '<td class="cel-num sub">' + (m.preco_ref_usd_em_brl
              ? brl.format(m.preco_ref_usd_em_brl) : '—') + '</td>' +
          '<td class="cel-num mono">' + m.ofertas + '</td>' +
        '</tr>';
      }).join('');

      desenharPaginacao(lista.length, paginas, inicio, fatia.length);
    }

    /* Paginacao compacta: primeira, ultima, a atual e uma vizinha de cada
       lado. As faixas omitidas viram reticencias, entao a barra nao cresce
       junto com o numero de paginas. */
    function desenharPaginacao(total, paginas, inicio, mostrados) {
      if (!rodape) return;
      if (paginas <= 1) {
        rodape.innerHTML = '<p class="pag-info">' + total + ' modelo' +
          (total === 1 ? '' : 's') + '</p>';
        return;
      }

      var numeros = [];
      for (var i = 1; i <= paginas; i++) {
        if (i === 1 || i === paginas || Math.abs(i - pagina) <= 1) {
          numeros.push(i);
        } else if (numeros[numeros.length - 1] !== '…') {
          numeros.push('…');
        }
      }

      rodape.innerHTML =
        '<p class="pag-info">' + (inicio + 1) + '–' + (inicio + mostrados) +
          ' de ' + total + ' modelos</p>' +
        '<div class="pag-botoes">' +
          botao('‹', pagina - 1, pagina === 1, 'Página anterior') +
          numeros.map(function (n) {
            return n === '…'
              ? '<span class="pag-gap">…</span>'
              : botao(n, n, false, 'Página ' + n, n === pagina);
          }).join('') +
          botao('›', pagina + 1, pagina === paginas, 'Próxima página') +
        '</div>';

      Array.prototype.forEach.call(rodape.querySelectorAll('button[data-pag]'),
        function (b) {
          b.addEventListener('click', function () {
            pagina = parseInt(b.dataset.pag, 10);
            render();
            /* volta para o topo da tabela, senao a troca de pagina passa
               despercebida em telas menores */
            document.querySelector('.tabela-rolagem')
              .scrollIntoView({ block: 'nearest' });
          });
        });
    }

    function botao(rotulo, destino, desativado, titulo, ativo) {
      return '<button type="button" class="pag-btn' + (ativo ? ' ativo' : '') + '"' +
        (desativado ? ' disabled' : ' data-pag="' + destino + '"') +
        ' aria-label="' + titulo + '"' + (ativo ? ' aria-current="page"' : '') +
        '>' + rotulo + '</button>';
    }

    function reiniciar() { pagina = 1; render(); }

    if (filtro) filtro.addEventListener('change', reiniciar);
    if (busca) busca.addEventListener('input', reiniciar);
    render();
  }).catch(function (e) {
    elTabela.innerHTML = '<tr><td colspan="7" class="vazio">' + (
      location.protocol === 'file:'
        ? 'A página foi aberta como arquivo (file://): o navegador bloqueia o '
          + 'carregamento dos dados. Sirva a pasta por HTTP.'
        : 'Não foi possível carregar os modelos (' + e.message + '). '
          + 'Rode <code>python etl/build_db.py</code> para gerar os dados.'
    ) + '</td></tr>';
  });

  function cap(s) {
    return String(s || '').replace(/\b([a-zà-ú])/g, function (m) { return m.toUpperCase(); });
  }
})();
