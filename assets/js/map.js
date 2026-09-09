/* ============================================================
   Mapa de eletropostos — MapLibre GL + OpenFreeMap

   Por que nao um iframe do carregados.com.br: aquele site responde com
   `x-frame-options: SAMEORIGIN` e `frame-ancestors 'self'`, entao o
   navegador recusa a incorporacao ("a conexao foi recusada"). Nao ha
   parametro que contorne isso — o mapa precisa ser nosso.

   Os pontos vem de assets/data/eletropostos.json, gerado pelo ETL a
   partir do OpenStreetMap.
   ============================================================ */
(function () {
  'use strict';

  var alvo = document.getElementById('mapa-gl');
  if (!alvo) return;

  var SP = [-46.633, -23.55];          /* Sao Paulo, centro padrao */
  var elStatus = document.getElementById('mapa-status');
  var elFiltro = document.getElementById('mapa-uf');
  var elBusca = document.getElementById('mapa-busca');
  var elTotal = document.getElementById('mapa-total');

  var mapa = null, dados = null, todos = [];

  function aviso(txt, erro) {
    if (!elStatus) return;
    elStatus.textContent = txt;
    elStatus.classList.toggle('erro', !!erro);
  }

  /* ---------- carregar os dados ---------- */
  fetch('assets/data/eletropostos.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (d) {
      dados = d;
      todos = d.postos.map(function (p) {
        return {
          nome: p[0], operador: p[1], uf: p[2], cidade: p[3],
          lat: p[4], lon: p[5], kw: p[6], ccs2: p[7], type2: p[8], chademo: p[9]
        };
      });
      preencherFiltro(d.por_uf);
      geojson();                 /* ja mostra a contagem, mesmo antes do mapa pintar */
      aviso(d.total.toLocaleString('pt-BR') + ' eletropostos · ' +
            (d.fonte || 'fontes abertas') + ' · ' + d.atualizado_em);
      agendarMapa();
    })
    .catch(function (e) {
      aviso(location.protocol === 'file:'
        ? 'A página foi aberta como arquivo (file://) e o navegador bloqueia o '
          + 'carregamento dos dados. Sirva a pasta por HTTP para ver o mapa.'
        : 'Não foi possível carregar os eletropostos (' + e.message + ').', true);
    });

  function preencherFiltro(porUf) {
    if (!elFiltro || !porUf) return;
    porUf.forEach(function (u) {
      var o = document.createElement('option');
      o.value = u.uf;
      o.textContent = u.nome + ' (' + u.total + ')';
      elFiltro.appendChild(o);
    });
  }

  /* ---------- GeoJSON a partir do filtro corrente ---------- */
  function geojson() {
    var uf = elFiltro ? elFiltro.value : '';
    var termo = (elBusca ? elBusca.value : '').trim().toLowerCase();

    var lista = todos.filter(function (p) {
      if (uf && p.uf !== uf) return false;
      if (termo) {
        var alvo_ = ((p.nome || '') + ' ' + (p.operador || '') + ' ' +
                     (p.cidade || '')).toLowerCase();
        if (alvo_.indexOf(termo) === -1) return false;
      }
      return true;
    });

    if (elTotal) {
      elTotal.textContent = lista.length.toLocaleString('pt-BR');
    }

    return {
      lista: lista,
      fc: {
        type: 'FeatureCollection',
        features: lista.map(function (p) {
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
            properties: {
              nome: p.nome || 'Eletroposto',
              operador: p.operador || '—',
              cidade: p.cidade || '',
              uf: p.uf,
              kw: Number(p.kw) || 0,
              conectores: [p.ccs2 && 'CCS2', p.type2 && 'Type 2',
                           p.chademo && 'CHAdeMO'].filter(Boolean).join(' · ') || 'não informado'
            }
          };
        })
      }
    };
  }

  /* ---------- so monta o mapa quando a secao entra em cena ----------
     Alem de economizar tiles e CPU, isso evita iniciar o MapLibre com a
     aba em segundo plano: ele adia todo o trabalho enquanto a pagina esta
     oculta, e o mapa ficaria preso em "carregando". */
  function agendarMapa() {
    var iniciado = false;
    function tentar() {
      if (iniciado || document.visibilityState !== 'visible') return;
      var r = alvo.getBoundingClientRect();
      if (r.top > window.innerHeight * 1.5 || r.bottom < 0) return;
      iniciado = true;
      window.removeEventListener('scroll', tentar);
      document.removeEventListener('visibilitychange', tentar);
      iniciarMapa();
    }
    window.addEventListener('scroll', tentar, { passive: true });
    document.addEventListener('visibilitychange', tentar);
    tentar();
  }

  /* ---------- mapa ---------- */
  function iniciarMapa() {
    if (typeof maplibregl === 'undefined') {
      aviso('A biblioteca do mapa não carregou. Verifique a conexão.', true);
      return;
    }

    mapa = new maplibregl.Map({
      container: 'mapa-gl',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: SP,
      zoom: 9,
      pitch: 45,                 /* inclinacao 3D, combinando com o resto do site */
      bearing: -14,
      attributionControl: false
    });

    mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    mapa.addControl(new maplibregl.AttributionControl({
      compact: true,
      customAttribution: '© OpenStreetMap (ODbL) · OpenFreeMap'
    }), 'bottom-right');

    /* ao voltar para a aba, o MapLibre precisa de um empurrao para repintar */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && mapa) {
        mapa.resize();
        mapa.triggerRepaint();
      }
    });

    var carregou = false;
    setTimeout(function () {
      if (!carregou) {
        aviso('O mapa demorou a responder. Verifique a conexão com tiles.openfreemap.org ' +
              'e recarregue a página — a lista por estado abaixo continua válida.', true);
      }
    }, 15000);

    mapa.on('error', function (e) {
      aviso('Erro ao carregar o mapa: ' + ((e.error && e.error.message) || 'desconhecido'), true);
    });

    mapa.on('load', function () {
      carregou = true;
      var g = geojson();
      mapa.addSource('postos', {
        type: 'geojson',
        data: g.fc,
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 12
      });

      /* aglomerados */
      mapa.addLayer({
        id: 'clusters', type: 'circle', source: 'postos',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#19e08a',
          'circle-opacity': 0.82,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 40, 30],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(4,16,13,.75)'
        }
      });
      mapa.addLayer({
        id: 'clusters-num', type: 'symbol', source: 'postos',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 13
        },
        paint: { 'text-color': '#04100d' }
      });

      /* pontos individuais, coloridos pela potencia */
      mapa.addLayer({
        id: 'postos', type: 'circle', source: 'postos',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 7,
          'circle-color': ['case',
            ['>=', ['get', 'kw'], 100], '#3ddcff',
            ['>=', ['get', 'kw'], 22], '#19e08a',
            '#c7f94b'],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(4,16,13,.8)'
        }
      });

      /* popup */
      mapa.on('click', 'postos', function (e) {
        var p = e.features[0].properties;
        new maplibregl.Popup({ offset: 14, closeButton: false })
          .setLngLat(e.features[0].geometry.coordinates)
          .setHTML(
            '<strong>' + escapar(p.nome) + '</strong>' +
            '<span>' + escapar(p.operador) + '</span>' +
            '<span>' + escapar([p.cidade, p.uf].filter(Boolean).join(' — ')) + '</span>' +
            '<span>Conectores: ' + escapar(p.conectores) + '</span>' +
            (Number(p.kw) > 0 ? '<span>Potência: ' + Number(p.kw) + ' kW</span>' : '')
          )
          .addTo(mapa);
      });

      mapa.on('click', 'clusters', function (e) {
        var id = e.features[0].properties.cluster_id;
        mapa.getSource('postos').getClusterExpansionZoom(id).then(function (z) {
          mapa.easeTo({ center: e.features[0].geometry.coordinates, zoom: z });
        });
      });

      ['postos', 'clusters'].forEach(function (l) {
        mapa.on('mouseenter', l, function () { mapa.getCanvas().style.cursor = 'pointer'; });
        mapa.on('mouseleave', l, function () { mapa.getCanvas().style.cursor = ''; });
      });

      aviso(dados.total.toLocaleString('pt-BR') + ' eletropostos · ' +
            (dados.fonte || 'fontes abertas') + ' · ' + dados.atualizado_em);
    });
  }

  function escapar(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- filtros ---------- */
  function atualizar(voar) {
    if (!mapa || !mapa.getSource('postos')) return;
    var g = geojson();
    mapa.getSource('postos').setData(g.fc);

    if (voar && g.lista.length) {
      var b = new maplibregl.LngLatBounds();
      g.lista.forEach(function (p) { b.extend([p.lon, p.lat]); });
      mapa.fitBounds(b, { padding: 60, maxZoom: 11, duration: 900 });
    }
  }

  if (elFiltro) {
    elFiltro.addEventListener('change', function () {
      if (!elFiltro.value) {
        mapa.flyTo({ center: SP, zoom: 9, pitch: 45, bearing: -14, duration: 900 });
        atualizar(false);
      } else {
        atualizar(true);
      }
    });
  }
  if (elBusca) {
    var t = null;
    elBusca.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { atualizar(false); }, 250);
    });
  }

  /* botao "voltar para Sao Paulo" */
  var elSP = document.getElementById('mapa-sp');
  if (elSP) {
    elSP.addEventListener('click', function () {
      if (!mapa) return;
      if (elFiltro) elFiltro.value = 'SP';
      atualizar(false);
      mapa.flyTo({ center: SP, zoom: 10, pitch: 50, bearing: -14, duration: 1100 });
    });
  }
})();
