# SustAmbiTech BI

Plataforma aberta de inteligência de dados sobre mobilidade elétrica no Brasil:
eletropostos georreferenciados, preços reais de veículos eletrificados e um banco
relacional reproduzível que alimenta tanto o site quanto o Power BI.

O site é estático — HTML, CSS e JavaScript puros, sem build e sem framework — e os
dados vêm de um pipeline em Python que qualquer pessoa consegue rodar do zero.

---

## O que tem aqui

| Seção | O que faz |
|---|---|
| **Hero** | Campo de partículas discreto em canvas, com deriva lenta e um raio pequeno de interação com o cursor. Métricas principais ancoradas logo abaixo da chamada. |
| **Recarga** | Animação guiada pelo scroll: o carro chega, o cabo conecta, a bateria enche. Cada quadro é desenhado a partir do progresso do scroll, então a cena anda para frente e para trás com o gesto. |
| **Mapa** | Mapa próprio em MapLibre GL sobre tiles do OpenFreeMap, com 12 mil pontos clusterizados, filtro por estado, busca e popup. Abre centralizado em São Paulo. |
| **Dashboards** | Gráficos SVG gerados do banco local (por estado, por rede, por faixa de potência) mais os cinco painéis Power BI oficiais da ABVE, incorporados em abas. |
| **Modelos** | 113 modelos consolidados a partir de 890 ofertas reais, com preço médio em reais e referência internacional em dólar convertida pela cotação do dia. |
| **Clima** | Botão flutuante que consulta a Open-Meteo por cidade digitada ou por geolocalização, com temperatura, sensação, umidade, vento, índice UV e máx/mín. |
| **FAQ** | Respostas sobre procedência dos dados, limitações conhecidas e como reproduzir tudo. |

## Números da coleta atual

```
12.164  eletropostos georreferenciados nas 27 UFs
        (12.009 do carregados.com.br + 155 exclusivos do OpenStreetMap)
890  ofertas de veículos eletrificados
113  modelos distintos
R$ 192.921  preço médio das ofertas
USD → BRL 5,1060  (AwesomeAPI)
```

Cada execução do pipeline grava uma linha datada na tabela `snapshots`, e a data da
coleta vigente aparece no rodapé do site.

---

## Identidade visual

Modo escuro sóbrio, pensado para leitura de dados e não para chamar atenção:
fundo em ardósia neutra (`rgb(16,20,24)`) e acentos em **verde sálvia**, **azul
petróleo** e **cinza ardósia**. Cores sólidas e opacas — sem gradiente em texto,
sem halo neon, sem botão brilhante.

O texto corrido usa `#b3bcc4`, que dá contraste de **9,6:1** sobre o fundo (o
mínimo da WCAG para AAA é 7:1).

As cores variam levemente por seção: cada uma declara uma paleta em
`assets/js/tema.js` e, conforme a página rola, os acentos são interpolados entre
a seção atual e a próxima. A variação é discreta de propósito — serve como
orientação espacial na rolagem, não como efeito. A troca acontece reescrevendo
quatro custom properties em `:root` (`--a1-rgb`, `--a2-rgb`, `--a3-rgb`,
`--bg-rgb`); como a folha inteira referencia esses tokens, tudo acompanha
sozinho. Para mudar a identidade de uma seção, edite a linha dela em `TEMAS`.

As posições das seções ficam em cache e são remedidas por um `ResizeObserver`,
então o cálculo por evento de scroll é só aritmética — sem forçar recálculo de layout.

### Efeitos deliberadamente ausentes

Foram removidos por serem ruído visual num produto de BI: a esfera de pontos que
perseguia o cursor no hero, a luz radial que seguia o mouse pela página, o campo
de estrelas com parallax e o magnetismo dos botões.

O que ficou no lugar é `assets/js/particulas.js`: pontos de 1–2 px em branco de
baixa opacidade, deriva lenta e raio de interação de 120 px. Perto do cursor eles
se afastam de leve e se ligam por linhas finas; fora desse raio, nada acontece.
O laço pausa quando o hero sai da tela e a deriva automática respeita
`prefers-reduced-motion` (a resposta ao ponteiro continua, por ser ação do
próprio usuário).

## Fontes de dados

| Fonte | O que fornece | Licença / condição |
|---|---|---|
| [carregados.com.br](https://carregados.com.br) — API pública de mapa | base principal de eletropostos: coordenadas, rede, potência, confiabilidade | base proprietária; uso acadêmico com crédito, ver abaixo |
| [OpenStreetMap](https://www.openstreetmap.org) via Overpass API | eletropostos complementares, com conectores e horários | ODbL 1.0 — exige atribuição |
| [ABVE](https://abve.org.br/abve-data/) | painéis Power BI oficiais do setor, incorporados no site | publicados pela associação com “Publicar na web” |
| [IBGE malhas territoriais](https://servicodados.ibge.gov.br) | polígonos das UFs, usados para atribuir o estado de cada ponto | dados públicos |
| [carregados.com.br](https://carregados.com.br/carros) | ofertas de veículos: marca, modelo, ano, preço | lido do bloco `schema.org/Vehicle` que a própria página publica; `robots.txt` permite rastreamento |
| [AwesomeAPI](https://docs.awesomeapi.com.br) | cotação USD→BRL | gratuita, sem chave |
| [Open-Meteo](https://open-meteo.com) | clima e geocodificação | gratuita, sem chave |

**Nenhuma chave de API é necessária** para rodar o projeto inteiro.

---

## Como reproduzir os dados

Requer apenas Python 3 (sem dependências externas — o pipeline usa a biblioteca
padrão e o `curl` do sistema).

```bash
python etl/fetch_carregados.py     # base principal, ~437 chamadas de API  (~6 min)
python etl/fetch_eletropostos.py   # OpenStreetMap + IBGE  (~1 min)
python etl/fetch_carros.py         # 56 páginas, 1,5s entre elas  (~2 min)
python etl/fetch_cambio.py         # cotação do dia
python etl/build_db.py             # consolida tudo
```

O `build_db.py` gera:

```
data/sustambitech.db     SQLite pronto para consultar
data/schema.sql          DDL portável (PostgreSQL, MySQL 8, SQLite)
data/seed.sql            INSERTs completos
data/csv/*.csv           importação no Power BI e em planilhas
assets/data/*.json       o que o site consome no navegador
```

Para servir o site localmente:

```bash
python -m http.server 5173
```

---

## Estrutura

```
index.html
assets/
  css/styles.css          tokens de cor, hero, tipografia, grid
  css/components.css      cena de recarga, mapa, tabela, widget de clima
  js/tema.js              paleta que muda conforme o scroll
  js/particulas.js        campo de partículas do hero
  js/main.js              scroll engine, tilt 3D, revelações, contadores
  js/charging-scene.js    animação de recarga guiada pelo scroll
  js/map.js               MapLibre + OpenFreeMap
  js/weather.js           botão flutuante de clima
  js/data-sections.js     preenche números, ranking e tabela de modelos
  js/dashboards.js        gráficos SVG do banco + abas dos painéis da ABVE
  data/*.json             saída do ETL consumida pelo navegador
etl/
  http_util.py            camada HTTP com retry (usa curl do sistema)
  geo_uf.py               atribuição de UF por ponto-em-polígono (IBGE)
  fetch_carregados.py     varredura em quadtree da API pública de mapa
  fetch_eletropostos.py   Overpass + malha do IBGE
  fetch_carros.py         leitor do JSON-LD de carregados.com.br
  fetch_cambio.py         cotação USD→BRL
  ref_modelos.py          ficha técnica de referência por modelo
  build_db.py             consolidação e geração dos artefatos
data/                     banco, SQL e CSV gerados
docs/
  BANCO.md                subir o banco num serviço gratuito
  POWERBI.md              republicar o relatório sobre o banco novo
```

---

## Limitações conhecidas

Vale registrar o que **não** foi possível fazer, e por quê:

**O mapa não pode ser um iframe do carregados.com.br.**
O portal responde com `x-frame-options: SAMEORIGIN` e
`content-security-policy: frame-ancestors 'self'`. São cabeçalhos que mandam o
navegador recusar a página dentro de um `<iframe>` de outro domínio — é a origem
exata da mensagem "a conexão com carregados.com.br foi recusada". Nenhum parâmetro
contorna a política; por isso o mapa foi reconstruído aqui.

**A base do Power BI publicado não é extraível.**
Um relatório publicado com "Publicar na web" expõe o visual renderizado, não o
modelo semântico. Ler o dataset exige autenticação no workspace e uso da API do
Power BI ou do endpoint XMLA, o que só o dono do relatório pode fazer com as
próprias credenciais. O caminho viável é o inverso: publicar um relatório novo
sobre o banco aberto deste repositório — ver `docs/POWERBI.md`.

**Os eletropostos vêm de uma base proprietária, usada em contexto acadêmico.**
A base principal (12.009 pontos) é do carregados.com.br, obtida pela API pública de
mapa do próprio portal — o `robots.txt` declara `Allow: /` e
`Content-Signal: ai-train=yes, search=yes, ai-input=yes`. A coleta é para este
projeto de extensão universitária, sem fim comercial, com crédito à fonte em todas
as telas e o link de origem guardado em cada registro. **Não é dado aberto**: quem
quiser reaproveitar deve procurar o portal. A coluna `fonte` separa esse conjunto do
subconjunto do OpenStreetMap, que é ODbL e exige atribuição e compartilhamento igual —
os dois nunca se misturam. Pedidos de correção ou remoção via GitHub Issues serão
atendidos.

A varredura usa quadtree: como a API devolve no máximo 400 estações por consulta,
o coletor divide o país em quadrantes e desce um nível sempre que um deles volta no
teto. Foram 437 chamadas em ~6 minutos, com pausa de 0,35 s entre elas.

**A ficha técnica dos modelos é estimativa.**
Os preços são reais, lidos dos anúncios. Já autonomia, capacidade de bateria e tipo
de conector vêm de uma tabela de referência (`etl/ref_modelos.py`) compilada de
material público dos fabricantes, para permitir o cruzamento por categoria ABVE.
Não são medições próprias nem ficha técnica oficial.

---

## Licença

Código sob **Licença MIT**.

Os dados de eletropostos derivam do OpenStreetMap e permanecem sob **ODbL 1.0**:
qualquer redistribuição precisa manter a atribuição e a mesma licença para bases
derivadas.

As ofertas de veículos são de terceiros e ficam armazenadas com o link de origem.
Pedidos de correção ou remoção podem ser feitos via GitHub Issues.
