# -*- coding: utf-8 -*-
"""Coleta eletropostos brasileiros do OpenStreetMap via Overpass API.

Estrategia em duas etapas, com papeis separados de proposito:

  1. QUEM esta no Brasil  -> a propria Overpass, consultando a relacao
     administrativa do pais (area["ISO3166-1"="BR"]). E a resposta
     autoritativa: nao depende da precisao de nenhuma malha nossa.
  2. EM QUAL UF cada ponto esta -> point-in-polygon contra a malha do IBGE.
     Como a malha vem simplificada, pontos no litoral podem cair fora de
     todos os poligonos; nesses casos o ponto NAO e descartado, e sim
     atribuido a UF mais proxima.

Se a Overpass estiver sobrecarregada para a consulta por area, ha um plano B
por bounding box - ai o point-in-polygon volta a decidir tambem a inclusao,
porque o retangulo pega paises vizinhos.

Fontes:
  - OpenStreetMap / Overpass API .... eletropostos (licenca ODbL 1.0)
  - IBGE malhas territoriais ........ poligonos das UFs

Saida: etl/raw/eletropostos_osm.json
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from http_util import overpass, get  # noqa: E402

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")

# bounding box do Brasil: sul, oeste, norte, leste
BBOX = (-34.1, -74.2, 5.4, -33.9)

QUERY_AREA = ('[out:json][timeout:250];'
              'area["ISO3166-1"="BR"][admin_level=2]->.br;'
              'nwr["amenity"="charging_station"](area.br);'
              'out center tags;')

QUERY_BBOX = ('[out:json][timeout:300];'
              'nwr["amenity"="charging_station"](%f,%f,%f,%f);'
              'out center tags;' % BBOX)

MALHA = ("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
         "?formato=application/vnd.geo+json&intrarregiao=UF&qualidade=intermediaria")

COD_UF = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP",
    "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB",
    "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES",
    "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS",
    "51": "MT", "52": "GO", "53": "DF",
}


def aneis(geometria):
    """Achata Polygon/MultiPolygon em uma lista de aneis externos."""
    t, c = geometria["type"], geometria["coordinates"]
    if t == "Polygon":
        return [c[0]]
    if t == "MultiPolygon":
        return [p[0] for p in c]
    return []


def dentro(lon, lat, anel):
    """Ray casting classico."""
    dentro_ = False
    n = len(anel)
    j = n - 1
    for i in range(n):
        xi, yi = anel[i][0], anel[i][1]
        xj, yj = anel[j][0], anel[j][1]
        if (yi > lat) != (yj > lat):
            if lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-18) + xi:
                dentro_ = not dentro_
        j = i
    return dentro_


def carregar_ufs():
    """Baixa a malha do IBGE e pre-calcula o bbox de cada UF (filtro rapido)."""
    body = get(MALHA, timeout=120)
    if not body:
        return None
    gj = json.loads(body)
    ufs = []
    for f in gj["features"]:
        uf = COD_UF.get(str(f["properties"].get("codarea")))
        if not uf:
            continue
        for anel in aneis(f["geometry"]):
            xs = [p[0] for p in anel]
            ys = [p[1] for p in anel]
            ufs.append((uf, min(xs), min(ys), max(xs), max(ys), anel))
    return ufs


def uf_do_ponto(lon, lat, ufs):
    """UF que contem o ponto, ou None."""
    for uf, x0, y0, x1, y1, anel in ufs:
        if x0 <= lon <= x1 and y0 <= lat <= y1 and dentro(lon, lat, anel):
            return uf
    return None


def uf_mais_proxima(lon, lat, ufs, limite_graus=0.6):
    """UF cujo contorno passa mais perto do ponto.

    Serve para os pontos que caem fora de todos os poligonos por causa da
    simplificacao da malha - tipicamente eletropostos em orla, ilha ou
    aterro. `limite_graus` (~66 km) evita adotar um ponto claramente fora.
    """
    import math
    melhor, menor = None, float('inf')
    cos_lat = math.cos(math.radians(lat)) or 1e-6
    for uf, x0, y0, x1, y1, anel in ufs:
        if lon < x0 - limite_graus or lon > x1 + limite_graus:
            continue
        if lat < y0 - limite_graus or lat > y1 + limite_graus:
            continue
        for px, py in anel:
            dx = (px - lon) * cos_lat
            dy = py - lat
            d = dx * dx + dy * dy
            if d < menor:
                menor, melhor = d, uf
    return melhor if menor <= limite_graus * limite_graus else None


def main():
    os.makedirs(RAW, exist_ok=True)

    print("baixando a malha das UFs no IBGE...")
    ufs = carregar_ufs()
    if not ufs:
        print("nao foi possivel baixar a malha do IBGE")
        sys.exit(1)
    print("  %d aneis de %d UFs" % (len(ufs), len({u[0] for u in ufs})))

    print("consultando o Overpass pela area oficial do Brasil...")
    autoritativo = True
    data = overpass(QUERY_AREA, retries=4)
    if data is None:
        print("  area indisponivel; caindo para o plano B por bounding box")
        autoritativo = False
        data = overpass(QUERY_BBOX, retries=4)
    if data is None:
        print("Overpass indisponivel - tente de novo em alguns minutos")
        sys.exit(1)

    els = data.get("elements", [])
    print("  %d pontos retornados" % len(els))

    por_uf, fora, aproximados = {}, 0, 0
    for e in els:
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lon = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat is None or lon is None:
            fora += 1
            continue
        lon, lat = float(lon), float(lat)

        uf = uf_do_ponto(lon, lat, ufs)
        if not uf and autoritativo:
            # a Overpass ja garantiu que o ponto e brasileiro: se a malha
            # simplificada nao o contem, adotamos a UF mais proxima em vez
            # de perder o registro
            uf = uf_mais_proxima(lon, lat, ufs)
            if uf:
                aproximados += 1
        if not uf:
            fora += 1
            continue
        e["_uf"] = uf
        por_uf.setdefault(uf, []).append(e)

    dest = os.path.join(RAW, "eletropostos_osm.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump({"fonte": "OpenStreetMap / Overpass API",
                   "licenca": "ODbL 1.0",
                   "inclusao_via": ("area administrativa do Brasil na Overpass"
                                    if autoritativo else "bounding box + poligonos IBGE"),
                   "ufs_via": "IBGE malhas territoriais",
                   "coletado_em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                   "por_uf": por_uf}, fh, ensure_ascii=False)

    total = sum(len(v) for v in por_uf.values())
    print("
%d eletropostos no Brasil (%d descartados, %d com UF por proximidade)"
          % (total, fora, aproximados))
    for uf, v in sorted(por_uf.items(), key=lambda x: -len(x[1])):
        print("  %s %4d" % (uf, len(v)))
    print("\n-> %s" % dest)


if __name__ == "__main__":
    main()
