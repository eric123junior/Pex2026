/* ============================================================
   Botao flutuante "Ver Clima"

   Inspirado no clima.html do repositorio SustAmbiTech, com duas
   diferencas deliberadas:
     - usa a Open-Meteo em vez da OpenWeatherMap, porque nao exige
       chave de API (nada de segredo exposto no front-end de um site
       estatico publicado no GitHub Pages);
     - a localizacao so e pedida quando o usuario clica no botao, nunca
       no carregamento da pagina.

   APIs (ambas gratuitas, sem cadastro):
     geocoding-api.open-meteo.com  nome da cidade -> coordenadas
     api.open-meteo.com            condicoes atuais + indice UV
   ============================================================ */
(function () {
  'use strict';

  var fab = document.getElementById('clima-fab');
  var painel = document.getElementById('clima-painel');
  if (!fab || !painel) return;

  var elFechar = document.getElementById('clima-fechar');
  var elForm = document.getElementById('clima-form');
  var elInput = document.getElementById('clima-cidade');
  var elGeo = document.getElementById('clima-geo');
  var elCorpo = document.getElementById('clima-corpo');
  var elErro = document.getElementById('clima-erro');
  var CHAVE = 'sustambi:clima';

  /* codigos WMO -> rotulo e simbolo */
  var WMO = {
    0: ['Céu limpo', '☀'], 1: ['Predominantemente limpo', '🌤'],
    2: ['Parcialmente nublado', '⛅'], 3: ['Nublado', '☁'],
    45: ['Névoa', '🌫'], 48: ['Névoa com geada', '🌫'],
    51: ['Garoa fraca', '🌦'], 53: ['Garoa', '🌦'], 55: ['Garoa forte', '🌦'],
    61: ['Chuva fraca', '🌧'], 63: ['Chuva', '🌧'], 65: ['Chuva forte', '🌧'],
    66: ['Chuva congelante', '🌧'], 67: ['Chuva congelante forte', '🌧'],
    71: ['Neve fraca', '🌨'], 73: ['Neve', '🌨'], 75: ['Neve forte', '🌨'],
    77: ['Grãos de neve', '🌨'],
    80: ['Pancadas fracas', '🌦'], 81: ['Pancadas', '🌧'], 82: ['Pancadas fortes', '⛈'],
    85: ['Pancadas de neve', '🌨'], 86: ['Pancadas de neve fortes', '🌨'],
    95: ['Trovoada', '⛈'], 96: ['Trovoada com granizo', '⛈'],
    99: ['Trovoada com granizo forte', '⛈']
  };

  function abrir(v) {
    painel.classList.toggle('aberto', v);
    fab.setAttribute('aria-expanded', String(v));
    painel.hidden = !v;
    if (v && elInput) setTimeout(function () { elInput.focus(); }, 260);
  }

  fab.addEventListener('click', function () { abrir(!painel.classList.contains('aberto')); });
  if (elFechar) elFechar.addEventListener('click', function () { abrir(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && painel.classList.contains('aberto')) abrir(false);
  });

  function erro(msg) {
    elErro.textContent = msg || '';
    elErro.hidden = !msg;
  }

  function carregando(v) {
    painel.classList.toggle('carregando', v);
  }

  /* ---------- consultas ---------- */
  function buscarCidade(nome) {
    var url = 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&format=json' +
              '&name=' + encodeURIComponent(nome);
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.results || !d.results.length) throw new Error('Cidade não encontrada.');
      var c = d.results[0];
      return {
        lat: c.latitude, lon: c.longitude,
        rotulo: [c.name, c.admin1, c.country_code].filter(Boolean).join(', ')
      };
    });
  }

  function buscarClima(local) {
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + local.lat + '&longitude=' + local.lon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,' +
      'weather_code,wind_speed_10m,uv_index' +
      '&daily=temperature_2m_max,temperature_2m_min' +
      '&forecast_days=1&timezone=auto';
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.current) throw new Error('Sem dados para este local.');
      return { local: local, atual: d.current, dia: d.daily };
    });
  }

  function mostrar(res) {
    var a = res.atual;
    var wmo = WMO[a.weather_code] || ['—', '🌡'];
    var max = res.dia && res.dia.temperature_2m_max ? Math.round(res.dia.temperature_2m_max[0]) : null;
    var min = res.dia && res.dia.temperature_2m_min ? Math.round(res.dia.temperature_2m_min[0]) : null;

    elCorpo.innerHTML =
      '<div class="clima-topo">' +
        '<span class="clima-icone">' + wmo[1] + '</span>' +
        '<div>' +
          '<b class="clima-temp">' + Math.round(a.temperature_2m) + '°</b>' +
          '<span class="clima-desc">' + wmo[0] + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="clima-local">' + res.local.rotulo + '</p>' +
      '<dl class="clima-grid">' +
        item('Sensação', Math.round(a.apparent_temperature) + '°') +
        item('Umidade', a.relative_humidity_2m + '%') +
        item('Vento', Math.round(a.wind_speed_10m) + ' km/h') +
        item('Índice UV', a.uv_index == null ? '—' : a.uv_index.toFixed(1)) +
        (max !== null ? item('Máx / Mín', max + '° / ' + min + '°') : '') +
      '</dl>' +
      '<p class="clima-fonte">Open-Meteo · atualizado ' +
        String(a.time).replace('T', ' ') + '</p>';
    elCorpo.hidden = false;

    try { localStorage.setItem(CHAVE, JSON.stringify(res.local)); } catch (e) { /* modo privado */ }
  }

  function item(rotulo, valor) {
    return '<div><dt>' + rotulo + '</dt><dd>' + valor + '</dd></div>';
  }

  function fluxo(promessa) {
    erro('');
    carregando(true);
    promessa
      .then(buscarClima)
      .then(mostrar)
      .catch(function (e) { erro(e.message || 'Não foi possível consultar o clima.'); })
      .then(function () { carregando(false); });
  }

  /* ---------- eventos ---------- */
  elForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var nome = elInput.value.trim();
    if (!nome) { erro('Digite o nome de uma cidade.'); return; }
    fluxo(buscarCidade(nome));
  });

  elGeo.addEventListener('click', function () {
    if (!navigator.geolocation) {
      erro('Este navegador não oferece geolocalização.');
      return;
    }
    erro('');
    carregando(true);
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        carregando(false);
        fluxo(Promise.resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          rotulo: 'Sua localização'
        }));
      },
      function (err) {
        carregando(false);
        erro(err.code === 1
          ? 'Permissão de localização negada — busque pela cidade.'
          : 'Não foi possível obter sua localização.');
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  });

  /* ultima cidade escolhida volta sozinha na proxima visita */
  try {
    var salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (salvo && salvo.lat) fluxo(Promise.resolve(salvo));
  } catch (e) { /* sem storage, sem problema */ }
})();
