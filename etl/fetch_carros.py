"""Coleta anuncios de carros eletricos em carregados.com.br/carros.

Le o bloco schema.org JSON-LD (<script type="application/ld+json">) que a
propria pagina publica para buscadores - ou seja, dados estruturados
publicados para consumo automatizado. O robots.txt do site permite
rastreamento (Allow: / e Content-Signal: ai-train=yes, search=yes).

Nao guardamos anuncios individuais no banco final: o build agrega por
modelo (preco medio/min/max e contagem de ofertas), que e o dado
estatistico util para o BI.

Saida: etl/raw/carros_anuncios.json
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from http_util import get  # noqa: E402

BASE = "https://carregados.com.br/carros"
RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
PAUSA = 1.5           # segundos entre paginas - crawl educado
MAX_PAGINAS = 80

LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)


def parse_pagina(html):
    """Extrai a lista de veiculos do JSON-LD da pagina."""
    itens = []
    for bloco in LD.findall(html):
        try:
            doc = json.loads(bloco)
        except json.JSONDecodeError:
            continue
        if doc.get("@type") != "ItemList":
            continue
        for li in doc.get("itemListElement", []):
            it = li.get("item") or {}
            if it.get("@type") != "Vehicle":
                continue
            oferta = it.get("offers") or {}
            itens.append({
                "nome": it.get("name"),
                "marca": (it.get("brand") or "").strip().lower() or None,
                "modelo": (it.get("model") or "").strip().lower() or None,
                "ano": it.get("vehicleModelDate"),
                "preco": oferta.get("price"),
                "moeda": oferta.get("priceCurrency"),
                "url": li.get("url"),
            })
    return itens


def total_resultados(html):
    m = re.search(r"([\d\.]+)\s*resultados", html)
    return int(m.group(1).replace(".", "")) if m else None


def main():
    os.makedirs(RAW, exist_ok=True)
    anuncios, vistos = [], set()
    total = None

    for pagina in range(1, MAX_PAGINAS + 1):
        url = BASE if pagina == 1 else "%s?page=%d" % (BASE, pagina)
        html = get(url, timeout=45)
        if not html:
            print("pagina %d: sem resposta, encerrando" % pagina)
            break
        if pagina == 1:
            total = total_resultados(html)
            print("anunciados no site: %s" % total)

        itens = parse_pagina(html)
        novos = [i for i in itens if i["url"] and i["url"] not in vistos]
        for i in novos:
            vistos.add(i["url"])
        anuncios.extend(novos)
        print("pagina %2d: %2d itens (%2d novos) | acumulado %d"
              % (pagina, len(itens), len(novos), len(anuncios)))

        if not itens or not novos:
            break
        if total and len(anuncios) >= total:
            break
        time.sleep(PAUSA)

    dest = os.path.join(RAW, "carros_anuncios.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump({
            "fonte": "carregados.com.br/carros (schema.org JSON-LD)",
            "coletado_em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total_informado_pelo_site": total,
            "anuncios": anuncios,
        }, fh, ensure_ascii=False)
    print("\n%d anuncios -> %s" % (len(anuncios), dest))


if __name__ == "__main__":
    main()
