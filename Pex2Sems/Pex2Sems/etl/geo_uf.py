# -*- coding: utf-8 -*-
"""Atribuicao de UF a um par (lon, lat) usando a malha territorial do IBGE.

Compartilhado pelos coletores de eletropostos. A malha vem simplificada, entao
pontos de orla, ilha e aterro podem cair fora de todos os poligonos; nesses
casos `uf_de` adota a UF mais proxima em vez de descartar o registro.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from http_util import get  # noqa: E402

MALHA = ("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
         "?formato=application/vnd.geo+json&intrarregiao=UF&qualidade=intermediaria")

COD_UF = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP",
    "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB",
    "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES",
    "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS",
    "51": "MT", "52": "GO", "53": "DF",
}


def _aneis(geometria):
    """Achata Polygon/MultiPolygon em uma lista de aneis externos."""
    t, c = geometria["type"], geometria["coordinates"]
    if t == "Polygon":
        return [c[0]]
    if t == "MultiPolygon":
        return [p[0] for p in c]
    return []


def carregar():
    """Baixa a malha e devolve a lista de (uf, bbox, anel), ou None."""
    body = get(MALHA, timeout=120)
    if not body:
        return None
    gj = json.loads(body)
    ufs = []
    for f in gj["features"]:
        uf = COD_UF.get(str(f["properties"].get("codarea")))
        if not uf:
            continue
        for anel in _aneis(f["geometry"]):
            xs = [p[0] for p in anel]
            ys = [p[1] for p in anel]
            ufs.append((uf, min(xs), min(ys), max(xs), max(ys), anel))
    return ufs


def _dentro(lon, lat, anel):
    """Ray casting classico."""
    dentro = False
    n = len(anel)
    j = n - 1
    for i in range(n):
        xi, yi = anel[i][0], anel[i][1]
        xj, yj = anel[j][0], anel[j][1]
        if (yi > lat) != (yj > lat):
            if lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-18) + xi:
                dentro = not dentro
        j = i
    return dentro


def uf_contendo(lon, lat, ufs):
    """UF cujo poligono contem o ponto, ou None."""
    for uf, x0, y0, x1, y1, anel in ufs:
        if x0 <= lon <= x1 and y0 <= lat <= y1 and _dentro(lon, lat, anel):
            return uf
    return None


def uf_mais_proxima(lon, lat, ufs, limite_graus=0.6):
    """UF cujo contorno passa mais perto do ponto (~66 km de tolerancia)."""
    melhor, menor = None, float("inf")
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


def uf_de(lon, lat, ufs):
    """UF do ponto: contencao primeiro, proximidade como rede de seguranca."""
    return uf_contendo(lon, lat, ufs) or uf_mais_proxima(lon, lat, ufs)
