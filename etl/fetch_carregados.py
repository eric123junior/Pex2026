# -*- coding: utf-8 -*-
"""Coleta a rede de eletropostos do carregados.com.br.

FONTE
    API publica de mapa do proprio portal, descoberta no manifesto da
    aplicacao (`routes/api+/mobile.v1.map.stations`):

        GET /api/mobile/v1/map/stations?north=&south=&east=&west=

    Responde um FeatureCollection GeoJSON com coordenadas, nome, rede,
    potencia maxima, numero de conectores e indice de confiabilidade.

    O `robots.txt` do site declara `Allow: /` e
    `Content-Signal: ai-train=yes, search=yes, ai-input=yes`.

USO E CREDITO
    Coleta feita para o projeto de extensao universitaria (PEX), sem fim
    comercial. Cada registro guarda o link da pagina de origem e a fonte
    fica creditada no site e no README. Pedidos de remocao podem ser
    atendidos via GitHub Issues.

    Atencao: estes dados NAO sao ODbL. O banco final mantem a coluna
    `fonte` justamente para nao misturar o subconjunto do OpenStreetMap
    (ODbL, exige atribuicao e compartilhamento igual) com este.

ESTRATEGIA
    A API devolve no maximo 400 estacoes por consulta. Em vez de forcar a
    paginacao, o coletor faz uma subdivisao em quadtree: comeca com o
    Brasil inteiro e, sempre que um quadrante volta no teto de 400,
    divide em quatro e desce mais um nivel. Isso troca ~11.900 downloads
    de pagina por algumas centenas de chamadas de API.

Saida: etl/raw/eletropostos_carregados.json
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from http_util import get_json  # noqa: E402
import geo_uf  # noqa: E402

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")

API = "https://carregados.com.br/api/mobile/v1/map/stations"
BASE_SITE = "https://carregados.com.br/estacoes/"

BRASIL = {"north": 5.6, "south": -34.3, "east": -33.7, "west": -74.4}

TETO = 400          # limite de itens por resposta da API
PROFUNDIDADE = 11   # ~2^11 divisoes por eixo: cobre ate as areas mais densas
PAUSA = 0.35        # segundos entre chamadas


def buscar(n, s, e, w):
    url = "%s?north=%.6f&south=%.6f&east=%.6f&west=%.6f" % (API, n, s, e, w)
    d = get_json(url, timeout=60, retries=3, pause=2.0)
    if not d or "features" not in d:
        return None
    return d["features"]


def varrer(n, s, e, w, achados, nivel=0, stats=None):
    """Baixa um quadrante; se vier cheio, divide em quatro e desce."""
    feats = buscar(n, s, e, w)
    stats["chamadas"] += 1

    if feats is None:
        stats["falhas"] += 1
        return

    for f in feats:
        pid = str(f.get("id") or (f.get("properties") or {}).get("id") or "")
        if pid and pid not in achados:
            achados[pid] = f

    cheio = len(feats) >= TETO
    if cheio and nivel < PROFUNDIDADE:
        mlat = (n + s) / 2.0
        mlon = (e + w) / 2.0
        time.sleep(PAUSA)
        varrer(n, mlat, mlon, w, achados, nivel + 1, stats)
        time.sleep(PAUSA)
        varrer(n, mlat, e, mlon, achados, nivel + 1, stats)
        time.sleep(PAUSA)
        varrer(mlat, s, mlon, w, achados, nivel + 1, stats)
        time.sleep(PAUSA)
        varrer(mlat, s, e, mlon, achados, nivel + 1, stats)
    else:
        if cheio:
            stats["saturados"] += 1     # quadrante no teto sem poder dividir
        if stats["chamadas"] % 25 == 0:
            print("  %4d chamadas | %6d estacoes unicas"
                  % (stats["chamadas"], len(achados)), flush=True)
        time.sleep(PAUSA)


def normalizar(feature, ufs):
    p = feature.get("properties") or {}
    geo = feature.get("geometry") or {}
    coords = geo.get("coordinates") or []
    if len(coords) < 2:
        return None
    lon, lat = float(coords[0]), float(coords[1])

    rede = p.get("network") or {}
    slug = p.get("slug") or ""

    return {
        "id_origem": str(p.get("id") or feature.get("id") or ""),
        "nome": p.get("name"),
        "rede": rede.get("name"),
        "rede_id": rede.get("id"),
        "uf": geo_uf.uf_de(lon, lat, ufs),
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "potencia_kw": p.get("maxPowerKw"),
        "conectores": p.get("connectorCount"),
        "confiabilidade": p.get("reliabilityScorePercent"),
        "situacao": p.get("status"),
        "verificado": 1 if p.get("verified") else 0,
        "url": (BASE_SITE + slug) if slug else None,
    }


def main():
    os.makedirs(RAW, exist_ok=True)

    print("baixando a malha das UFs no IBGE...")
    ufs = geo_uf.carregar()
    if not ufs:
        print("nao foi possivel baixar a malha do IBGE")
        sys.exit(1)

    print("varrendo o Brasil em quadtree (teto de %d por consulta)..." % TETO)
    achados, stats = {}, {"chamadas": 0, "falhas": 0, "saturados": 0}
    t0 = time.time()
    varrer(BRASIL["north"], BRASIL["south"], BRASIL["east"], BRASIL["west"],
           achados, 0, stats)

    print("\n%d chamadas em %.0f s | %d falhas | %d quadrantes saturados"
          % (stats["chamadas"], time.time() - t0, stats["falhas"], stats["saturados"]))

    registros, sem_uf = [], 0
    for f in achados.values():
        r = normalizar(f, ufs)
        if not r:
            continue
        if not r["uf"]:
            sem_uf += 1
            continue          # fora do territorio brasileiro
        registros.append(r)

    dest = os.path.join(RAW, "eletropostos_carregados.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump({
            "fonte": "carregados.com.br - API publica de mapa",
            "endpoint": API,
            "uso": "projeto de extensao universitaria (PEX), sem fim comercial, com credito",
            "licenca": "nao e dado aberto; ver README",
            "coletado_em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "estacoes": registros,
        }, fh, ensure_ascii=False)

    por_uf = {}
    for r in registros:
        por_uf[r["uf"]] = por_uf.get(r["uf"], 0) + 1

    print("\n%d eletropostos (%d descartados fora do Brasil)" % (len(registros), sem_uf))
    for uf, n in sorted(por_uf.items(), key=lambda x: -x[1])[:10]:
        print("  %s %5d" % (uf, n))
    print("\n-> %s" % dest)


if __name__ == "__main__":
    main()
