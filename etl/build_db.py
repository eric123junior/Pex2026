# -*- coding: utf-8 -*-
"""Consolida os dados coletados em um banco relacional e nos arquivos do site.

Entradas (etl/raw/):
    eletropostos_osm.json   fetch_eletropostos.py
    carros_anuncios.json    fetch_carros.py
    cambio.json             fetch_cambio.py

Saidas:
    data/sustambitech.db        SQLite pronto para uso
    data/schema.sql             DDL portavel (Postgres/MySQL/SQLite)
    data/seed.sql              INSERTs do conteudo completo
    data/csv/*.csv              importacao no Power BI / planilhas
    assets/data/*.json          o que o site consome no navegador
"""
import csv
import json
import os
import re
import sqlite3
import math
import statistics
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
RAW = os.path.join(AQUI, "raw")
DATA = os.path.join(RAIZ, "data")
CSVD = os.path.join(DATA, "csv")
SITE = os.path.join(RAIZ, "assets", "data")

sys.path.insert(0, AQUI)
from ref_modelos import classificar  # noqa: E402

REGIOES = {
    "AC": "Norte", "AP": "Norte", "AM": "Norte", "PA": "Norte", "RO": "Norte",
    "RR": "Norte", "TO": "Norte",
    "AL": "Nordeste", "BA": "Nordeste", "CE": "Nordeste", "MA": "Nordeste",
    "PB": "Nordeste", "PE": "Nordeste", "PI": "Nordeste", "RN": "Nordeste",
    "SE": "Nordeste",
    "DF": "Centro-Oeste", "GO": "Centro-Oeste", "MT": "Centro-Oeste",
    "MS": "Centro-Oeste",
    "ES": "Sudeste", "MG": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste",
    "PR": "Sul", "RS": "Sul", "SC": "Sul",
}

UF_NOME = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas",
    "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal",
    "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão",
    "MT": "Mato Grosso", "MS": "Mato Grosso do Sul", "MG": "Minas Gerais",
    "PA": "Pará", "PB": "Paraíba", "PR": "Paraná", "PE": "Pernambuco",
    "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima",
    "SC": "Santa Catarina", "SP": "São Paulo", "SE": "Sergipe",
    "TO": "Tocantins",
}

# centroide aproximado das capitais, usado como fallback de posicao
CAPITAIS = {
    "AC": (-9.97, -67.81), "AL": (-9.65, -35.73), "AP": (0.03, -51.06),
    "AM": (-3.10, -60.02), "BA": (-12.97, -38.50), "CE": (-3.73, -38.52),
    "DF": (-15.79, -47.88), "ES": (-20.31, -40.31), "GO": (-16.68, -49.25),
    "MA": (-2.53, -44.30), "MT": (-15.60, -56.10), "MS": (-20.44, -54.65),
    "MG": (-19.92, -43.94), "PA": (-1.45, -48.50), "PB": (-7.12, -34.86),
    "PR": (-25.43, -49.27), "PE": (-8.05, -34.88), "PI": (-5.09, -42.80),
    "RJ": (-22.91, -43.17), "RN": (-5.79, -35.21), "RS": (-30.03, -51.23),
    "RO": (-8.76, -63.90), "RR": (2.82, -60.67), "SC": (-27.59, -48.55),
    "SP": (-23.55, -46.63), "SE": (-10.91, -37.07), "TO": (-10.18, -48.33),
}


# ----------------------------------------------------------------------------
# leitura das coletas
# ----------------------------------------------------------------------------
def ler(nome):
    caminho = os.path.join(RAW, nome)
    if not os.path.exists(caminho):
        print("!! faltando %s - rode o coletor correspondente" % nome)
        return None
    with open(caminho, encoding="utf-8") as fh:
        return json.load(fh)


def num(txt):
    """Extrai o primeiro numero de textos como '22 kW', '150kW', '2 x 60'."""
    if txt is None:
        return None
    m = re.search(r"(\d+(?:[.,]\d+)?)", str(txt))
    return float(m.group(1).replace(",", ".")) if m else None


# ----------------------------------------------------------------------------
# eletropostos
# ----------------------------------------------------------------------------
def montar_carregados(bruto):
    """Registros da API publica do carregados.com.br."""
    linhas = []
    for e in (bruto or {}).get("estacoes", []):
        linhas.append({
            "id_origem": "carregados/" + str(e.get("id_origem") or ""),
            "nome": e.get("nome") or "Eletroposto",
            "operador": e.get("rede"),
            "rede": e.get("rede"),
            "uf": e.get("uf"),
            "cidade": None,
            "endereco": None,
            "latitude": e.get("latitude"),
            "longitude": e.get("longitude"),
            "capacidade": e.get("conectores"),
            "potencia_kw": e.get("potencia_kw"),
            "ccs2": 0, "type2": 0, "chademo": 0, "gbt": 0, "tipo2_tomada": 0,
            "acesso": None,
            "pago": None,
            "horario": None,
            "confiabilidade": e.get("confiabilidade"),
            "situacao": e.get("situacao"),
            "verificado": e.get("verificado"),
            "url": e.get("url"),
            "fonte": "carregados.com.br",
        })
    return linhas


def mesclar(principal, complementar, metros=150):
    """Junta as duas fontes descartando o que ja existe na principal.

    Duas estacoes a menos de `metros` uma da outra sao tratadas como a mesma:
    a base do carregados e mais rica, entao ela manda, e o registro do OSM so
    entra quando nao ha equivalente por perto. Um indice em grade evita o
    produto cartesiano entre as duas listas.
    """
    GRAU = metros / 111000.0
    grade = {}
    for r in principal:
        cx = int(r["latitude"] / GRAU)
        cy = int(r["longitude"] / GRAU)
        grade.setdefault((cx, cy), []).append(r)

    saida = list(principal)
    duplicados = 0
    for r in complementar:
        cx = int(r["latitude"] / GRAU)
        cy = int(r["longitude"] / GRAU)
        achou = False
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for o in grade.get((cx + dx, cy + dy), ()):
                    dlat = (o["latitude"] - r["latitude"]) * 111000.0
                    dlon = ((o["longitude"] - r["longitude"]) * 111000.0 *
                            math.cos(math.radians(r["latitude"])))
                    if dlat * dlat + dlon * dlon <= metros * metros:
                        achou = True
                        break
                if achou:
                    break
            if achou:
                break
        if achou:
            duplicados += 1
        else:
            saida.append(r)
    return saida, duplicados


def montar_eletropostos(bruto):
    linhas = []
    for uf, elementos in (bruto or {}).get("por_uf", {}).items():
        for e in elementos:
            t = e.get("tags", {}) or {}
            lat = e.get("lat") or (e.get("center") or {}).get("lat")
            lon = e.get("lon") or (e.get("center") or {}).get("lon")
            if lat is None or lon is None:
                continue

            # potencia: maior valor entre as saidas declaradas
            potencias = [num(v) for k, v in t.items() if k.endswith(":output")]
            potencias = [p for p in potencias if p]
            potencia = max(potencias) if potencias else None

            linhas.append({
                "id_origem": "osm/%s/%s" % (e.get("type"), e.get("id")),
                "nome": t.get("name") or t.get("operator") or "Eletroposto",
                "operador": t.get("operator") or t.get("brand") or None,
                "rede": t.get("network") or t.get("brand") or None,
                "uf": uf,
                "cidade": t.get("addr:city") or None,
                "endereco": " ".join(x for x in [t.get("addr:street"),
                                                 t.get("addr:housenumber")] if x) or None,
                "latitude": round(float(lat), 6),
                "longitude": round(float(lon), 6),
                "capacidade": int(num(t.get("capacity")) or 0) or None,
                "potencia_kw": potencia,
                "ccs2": 1 if any(k.startswith("socket:type2_combo") for k in t) else 0,
                "type2": 1 if any(k.startswith("socket:type2") and "combo" not in k
                                  for k in t) else 0,
                "chademo": 1 if any(k.startswith("socket:chademo") for k in t) else 0,
                "gbt": 1 if any("gb_t" in k or "gbt" in k for k in t) else 0,
                "tipo2_tomada": 1 if any(k.startswith("socket:schuko") or
                                         k.startswith("socket:typee") for k in t) else 0,
                "acesso": t.get("access") or None,
                "pago": {"yes": 1, "no": 0}.get(t.get("fee"), None),
                "horario": t.get("opening_hours") or None,
                "confiabilidade": None,
                "situacao": None,
                "verificado": None,
                "url": None,
                "fonte": "OpenStreetMap",
            })
    return linhas


# ----------------------------------------------------------------------------
# modelos e ofertas
# ----------------------------------------------------------------------------
def montar_carros(bruto, taxa_usd):
    anuncios = (bruto or {}).get("anuncios", [])
    ofertas, por_modelo = [], {}

    for a in anuncios:
        preco = a.get("preco")
        try:
            preco = float(preco) if preco is not None else None
        except (TypeError, ValueError):
            preco = None
        if not preco or preco <= 0:
            continue

        marca = (a.get("marca") or "").strip()
        modelo = (a.get("modelo") or "").strip()
        if not marca or not modelo:
            continue

        cat, con, kwh, km, usd = classificar(a.get("nome"), marca, modelo)
        ofertas.append({
            "marca": marca, "modelo": modelo, "ano": a.get("ano"),
            "preco_brl": preco, "categoria": cat, "conector": con,
            "url": a.get("url"),
        })

        chave = (marca, modelo)
        d = por_modelo.setdefault(chave, {
            "marca": marca, "modelo": modelo, "categoria": cat, "conector": con,
            "bateria_kwh": kwh, "autonomia_km": km, "preco_ref_usd": usd,
            "precos": [], "anos": [],
        })
        d["precos"].append(preco)
        if a.get("ano"):
            d["anos"].append(int(a["ano"]))

    modelos = []
    for d in por_modelo.values():
        p = sorted(d["precos"])
        usd = d["preco_ref_usd"]
        modelos.append({
            "marca": d["marca"],
            "modelo": d["modelo"],
            "categoria": d["categoria"],
            "conector": d["conector"],
            "bateria_kwh": d["bateria_kwh"],
            "autonomia_km": d["autonomia_km"],
            "ofertas": len(p),
            "preco_min_brl": round(p[0], 2),
            "preco_medio_brl": round(statistics.mean(p), 2),
            "preco_mediano_brl": round(statistics.median(p), 2),
            "preco_max_brl": round(p[-1], 2),
            "ano_min": min(d["anos"]) if d["anos"] else None,
            "ano_max": max(d["anos"]) if d["anos"] else None,
            "preco_ref_usd": usd,
            "preco_ref_usd_em_brl": round(usd * taxa_usd, 2) if usd else None,
            # indice proprio, nao e nota de usuario: km de autonomia por R$ mil
            "indice_km_por_mil_brl": round(
                d["autonomia_km"] / (statistics.mean(p) / 1000.0), 2
            ) if d["autonomia_km"] and p else None,
        })
    modelos.sort(key=lambda m: (-m["ofertas"], m["marca"]))
    return modelos, ofertas


# ----------------------------------------------------------------------------
# banco
# ----------------------------------------------------------------------------
DDL = """
DROP TABLE IF EXISTS eletropostos;
DROP TABLE IF EXISTS modelos_ev;
DROP TABLE IF EXISTS ofertas;
DROP TABLE IF EXISTS estados;
DROP TABLE IF EXISTS cambio;
DROP TABLE IF EXISTS snapshots;

CREATE TABLE estados (
  uf            CHAR(2)      PRIMARY KEY,
  nome          VARCHAR(40)  NOT NULL,
  regiao        VARCHAR(20)  NOT NULL,
  capital_lat   DECIMAL(9,6),
  capital_lon   DECIMAL(9,6)
);

CREATE TABLE eletropostos (
  id            INTEGER      PRIMARY KEY,
  id_origem     VARCHAR(48)  NOT NULL,
  nome          VARCHAR(160),
  operador      VARCHAR(120),
  rede          VARCHAR(120),
  uf            CHAR(2)      NOT NULL,
  cidade        VARCHAR(120),
  endereco      VARCHAR(200),
  latitude      DECIMAL(9,6) NOT NULL,
  longitude     DECIMAL(9,6) NOT NULL,
  capacidade    INTEGER,
  potencia_kw   DECIMAL(7,2),
  ccs2          SMALLINT DEFAULT 0,
  type2         SMALLINT DEFAULT 0,
  chademo       SMALLINT DEFAULT 0,
  gbt           SMALLINT DEFAULT 0,
  tipo2_tomada  SMALLINT DEFAULT 0,
  acesso        VARCHAR(40),
  pago          SMALLINT,
  horario       VARCHAR(120),
  confiabilidade DECIMAL(5,2),
  situacao      VARCHAR(24),
  verificado    SMALLINT,
  url           VARCHAR(300),
  fonte         VARCHAR(40)  NOT NULL
);

CREATE TABLE modelos_ev (
  id                    INTEGER      PRIMARY KEY,
  marca                 VARCHAR(60)  NOT NULL,
  modelo                VARCHAR(120) NOT NULL,
  categoria             VARCHAR(6)   NOT NULL,
  conector              VARCHAR(12),
  bateria_kwh           DECIMAL(6,2),
  autonomia_km          INTEGER,
  ofertas               INTEGER      NOT NULL,
  preco_min_brl         DECIMAL(12,2),
  preco_medio_brl       DECIMAL(12,2),
  preco_mediano_brl     DECIMAL(12,2),
  preco_max_brl         DECIMAL(12,2),
  ano_min               INTEGER,
  ano_max               INTEGER,
  preco_ref_usd         DECIMAL(12,2),
  preco_ref_usd_em_brl  DECIMAL(12,2),
  indice_km_por_mil_brl DECIMAL(8,2)
);

CREATE TABLE ofertas (
  id          INTEGER      PRIMARY KEY,
  marca       VARCHAR(60)  NOT NULL,
  modelo      VARCHAR(120) NOT NULL,
  ano         INTEGER,
  preco_brl   DECIMAL(12,2) NOT NULL,
  categoria   VARCHAR(6),
  conector    VARCHAR(12),
  url         VARCHAR(300)
);

CREATE TABLE cambio (
  moeda         VARCHAR(8)   PRIMARY KEY,
  taxa_brl      DECIMAL(10,4) NOT NULL,
  fonte         VARCHAR(40),
  atualizado_em VARCHAR(40)
);

CREATE TABLE snapshots (
  data                DATE PRIMARY KEY,
  total_eletropostos  INTEGER,
  total_modelos       INTEGER,
  total_ofertas       INTEGER,
  preco_medio_brl     DECIMAL(12,2),
  ufs_cobertas        INTEGER
);

CREATE INDEX idx_eletropostos_uf    ON eletropostos (uf);
CREATE INDEX idx_eletropostos_fonte ON eletropostos (fonte);
CREATE INDEX idx_eletropostos_rede  ON eletropostos (rede);
CREATE INDEX idx_ofertas_modelo  ON ofertas (marca, modelo);
"""


def sql_valor(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def gravar(conn, tabela, colunas, linhas):
    marcadores = ",".join("?" * len(colunas))
    conn.executemany(
        "INSERT INTO %s (%s) VALUES (%s)" % (tabela, ",".join(colunas), marcadores),
        [tuple(l.get(c) for c in colunas) for l in linhas],
    )


def escrever_csv(nome, colunas, linhas):
    with open(os.path.join(CSVD, nome), "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=colunas, extrasaction="ignore")
        w.writeheader()
        w.writerows(linhas)


def main():
    for d in (DATA, CSVD, SITE):
        os.makedirs(d, exist_ok=True)

    cambio = ler("cambio.json") or {"taxa": 5.0, "fonte": "fallback",
                                    "atualizado_em": None}
    taxa = float(cambio["taxa"])

    principal = montar_carregados(ler("eletropostos_carregados.json"))
    osm = montar_eletropostos(ler("eletropostos_osm.json"))
    if principal:
        postos, repetidos = mesclar(principal, osm)
        print("eletropostos: %d do carregados + %d do OSM "
              "(%d do OSM ja existiam na outra base)"
              % (len(principal), len(osm) - repetidos, repetidos))
    else:
        postos, repetidos = osm, 0
        print("eletropostos: apenas OSM (%d) - rode etl/fetch_carregados.py "
              "para a base completa" % len(osm))
    modelos, ofertas = montar_carros(ler("carros_anuncios.json"), taxa)

    estados = [{"uf": uf, "nome": UF_NOME[uf], "regiao": REGIOES[uf],
                "capital_lat": CAPITAIS[uf][0], "capital_lon": CAPITAIS[uf][1]}
               for uf in sorted(UF_NOME)]

    hoje = time.strftime("%Y-%m-%d")
    precos = [o["preco_brl"] for o in ofertas]
    snapshot = {
        "data": hoje,
        "total_eletropostos": len(postos),
        "total_modelos": len(modelos),
        "total_ofertas": len(ofertas),
        "preco_medio_brl": round(statistics.mean(precos), 2) if precos else None,
        "ufs_cobertas": len({p["uf"] for p in postos}),
    }

    # ---------------- SQLite ----------------
    caminho_db = os.path.join(DATA, "sustambitech.db")
    if os.path.exists(caminho_db):
        os.remove(caminho_db)
    conn = sqlite3.connect(caminho_db)
    conn.executescript(DDL)

    cols_est = ["uf", "nome", "regiao", "capital_lat", "capital_lon"]
    cols_ele = ["id_origem", "nome", "operador", "rede", "uf", "cidade", "endereco",
                "latitude", "longitude", "capacidade", "potencia_kw", "ccs2",
                "type2", "chademo", "gbt", "tipo2_tomada", "acesso", "pago",
                "horario", "confiabilidade", "situacao", "verificado", "url", "fonte"]
    cols_mod = ["marca", "modelo", "categoria", "conector", "bateria_kwh",
                "autonomia_km", "ofertas", "preco_min_brl", "preco_medio_brl",
                "preco_mediano_brl", "preco_max_brl", "ano_min", "ano_max",
                "preco_ref_usd", "preco_ref_usd_em_brl", "indice_km_por_mil_brl"]
    cols_ofe = ["marca", "modelo", "ano", "preco_brl", "categoria", "conector", "url"]

    gravar(conn, "estados", cols_est, estados)
    gravar(conn, "eletropostos", cols_ele, postos)
    gravar(conn, "modelos_ev", cols_mod, modelos)
    gravar(conn, "ofertas", cols_ofe, ofertas)
    conn.execute("INSERT INTO cambio VALUES (?,?,?,?)",
                 ("USD", taxa, cambio.get("fonte"), cambio.get("atualizado_em")))
    conn.execute(
        "INSERT INTO snapshots VALUES (?,?,?,?,?,?)",
        (snapshot["data"], snapshot["total_eletropostos"], snapshot["total_modelos"],
         snapshot["total_ofertas"], snapshot["preco_medio_brl"], snapshot["ufs_cobertas"]))
    conn.commit()

    # ---------------- SQL portavel ----------------
    with open(os.path.join(DATA, "schema.sql"), "w", encoding="utf-8") as fh:
        fh.write("-- SustAmbiTech BI - esquema do banco\n")
        fh.write("-- Compativel com PostgreSQL, MySQL 8 e SQLite.\n")
        fh.write(DDL)

    with open(os.path.join(DATA, "seed.sql"), "w", encoding="utf-8") as fh:
        fh.write("-- SustAmbiTech BI - carga de dados (%s)\n" % hoje)
        fh.write("-- Eletropostos: OpenStreetMap (ODbL 1.0)\n")
        fh.write("-- Ofertas: carregados.com.br via schema.org JSON-LD\n")
        fh.write("BEGIN;\n")
        for tabela, cols, linhas in (("estados", cols_est, estados),
                                     ("eletropostos", cols_ele, postos),
                                     ("modelos_ev", cols_mod, modelos),
                                     ("ofertas", cols_ofe, ofertas)):
            for l in linhas:
                fh.write("INSERT INTO %s (%s) VALUES (%s);\n" % (
                    tabela, ",".join(cols),
                    ",".join(sql_valor(l.get(c)) for c in cols)))
        fh.write("INSERT INTO cambio (moeda,taxa_brl,fonte,atualizado_em) "
                 "VALUES ('USD',%s,%s,%s);\n" % (
                     taxa, sql_valor(cambio.get("fonte")),
                     sql_valor(cambio.get("atualizado_em"))))
        fh.write("INSERT INTO snapshots (data,total_eletropostos,total_modelos,"
                 "total_ofertas,preco_medio_brl,ufs_cobertas) VALUES (%s,%d,%d,%d,%s,%d);\n"
                 % (sql_valor(hoje), snapshot["total_eletropostos"],
                    snapshot["total_modelos"], snapshot["total_ofertas"],
                    sql_valor(snapshot["preco_medio_brl"]), snapshot["ufs_cobertas"]))
        fh.write("COMMIT;\n")

    # ---------------- CSV para o Power BI ----------------
    escrever_csv("estados.csv", cols_est, estados)
    escrever_csv("eletropostos.csv", cols_ele, postos)
    escrever_csv("modelos_ev.csv", cols_mod, modelos)
    escrever_csv("ofertas.csv", cols_ofe, ofertas)

    # ---------------- JSON do site ----------------
    por_uf = {}
    for p in postos:
        u = por_uf.setdefault(p["uf"], {"uf": p["uf"], "nome": UF_NOME[p["uf"]],
                                        "regiao": REGIOES[p["uf"]], "total": 0,
                                        "ccs2": 0, "type2": 0, "chademo": 0})
        u["total"] += 1
        for c in ("ccs2", "type2", "chademo"):
            u[c] += p[c]
    ranking = sorted(por_uf.values(), key=lambda x: -x["total"])

    with open(os.path.join(SITE, "eletropostos.json"), "w", encoding="utf-8") as fh:
        json.dump({
            "fonte": ("carregados.com.br (API pública de mapa) + "
                      "OpenStreetMap (ODbL 1.0) via Overpass API"),
            "atualizado_em": hoje,
            "total": len(postos),
            "colunas": ["nome", "operador", "uf", "cidade", "lat", "lon",
                        "potencia_kw", "ccs2", "type2", "chademo"],
            # formato colunar compacto: reduz muito o tamanho do arquivo
            # 5 casas decimais (~1 m) bastam para o mapa e cortam ~15% do arquivo
            "postos": [[p["nome"], p["operador"], p["uf"], p["cidade"],
                        round(p["latitude"], 5), round(p["longitude"], 5),
                        p["potencia_kw"], p["ccs2"], p["type2"], p["chademo"]]
                       for p in postos],
            "por_uf": ranking,
        }, fh, ensure_ascii=False, separators=(",", ":"))

    with open(os.path.join(SITE, "modelos.json"), "w", encoding="utf-8") as fh:
        json.dump({
            "fonte": "carregados.com.br (schema.org JSON-LD) + ficha tecnica de referencia",
            "atualizado_em": hoje,
            "cambio_usd_brl": taxa,
            "cambio_fonte": cambio.get("fonte"),
            "cambio_atualizado_em": cambio.get("atualizado_em"),
            "modelos": modelos,
        }, fh, ensure_ascii=False, separators=(",", ":"))

    categorias = {}
    for o in ofertas:
        categorias[o["categoria"]] = categorias.get(o["categoria"], 0) + 1
    conectores = {}
    for p in postos:
        for k, rotulo in (("ccs2", "CCS2"), ("type2", "Type 2"),
                          ("chademo", "CHAdeMO"), ("gbt", "GB/T")):
            if p[k]:
                conectores[rotulo] = conectores.get(rotulo, 0) + 1

    # redes com mais pontos
    redes = {}
    for p in postos:
        if p.get("rede"):
            redes[p["rede"]] = redes.get(p["rede"], 0) + 1
    top_redes = sorted(redes.items(), key=lambda x: -x[1])[:12]

    # distribuicao por faixa de potencia (o que separa recarga lenta de rapida)
    faixas = [("Até 7 kW", 0, 7), ("7–22 kW", 7, 22), ("22–50 kW", 22, 50),
              ("50–100 kW", 50, 100), ("100–150 kW", 100, 150),
              ("Acima de 150 kW", 150, 1e9)]
    potencias = {r: 0 for r, _, _ in faixas}
    sem_potencia = 0
    for p in postos:
        kw = p.get("potencia_kw")
        if not kw:
            sem_potencia += 1
            continue
        for rotulo, minimo, maximo in faixas:
            if minimo < kw <= maximo or (minimo == 0 and kw <= maximo):
                potencias[rotulo] += 1
                break

    fontes = {}
    for p in postos:
        fontes[p["fonte"]] = fontes.get(p["fonte"], 0) + 1

    # retrato de cada categoria ABVE, para os cartoes da secao de taxonomia
    por_categoria = {}
    for cat in ("BEV", "PHEV", "HEV", "MHEV", "FCEV"):
        ofertas_cat = [o for o in ofertas if o["categoria"] == cat]
        modelos_cat = [m for m in modelos if m["categoria"] == cat]
        autonomias = [m["autonomia_km"] for m in modelos_cat if m["autonomia_km"]]
        conectores_cat = {}
        for m in modelos_cat:
            if m["conector"] and m["conector"] != "N/A":
                conectores_cat[m["conector"]] = conectores_cat.get(m["conector"], 0) + 1
        por_categoria[cat] = {
            "ofertas": len(ofertas_cat),
            "modelos": len(modelos_cat),
            "preco_medio_brl": round(statistics.mean(
                [o["preco_brl"] for o in ofertas_cat]), 2) if ofertas_cat else None,
            "autonomia_media_km": round(statistics.mean(autonomias)) if autonomias else None,
            "conector": max(conectores_cat, key=conectores_cat.get) if conectores_cat else None,
        }

    with open(os.path.join(SITE, "estatisticas.json"), "w", encoding="utf-8") as fh:
        json.dump({**snapshot,
                   "categorias": categorias,
                   "por_categoria": por_categoria,
                   "conectores": conectores,
                   "ranking_uf": ranking[:12],
                   "redes": [{"nome": n, "total": t} for n, t in top_redes],
                   "potencias": potencias,
                   "sem_potencia": sem_potencia,
                   "fontes": fontes,
                   "cambio_usd_brl": taxa}, fh, ensure_ascii=False, indent=1)

    print("""
Banco gerado
  eletropostos ....... %d  (%d UFs)
  modelos ............ %d
  ofertas ............ %d
  preco medio ........ R$ %s
  USD -> BRL ......... %.4f  (%s)

  data/sustambitech.db
  data/schema.sql  data/seed.sql
  data/csv/*.csv
  assets/data/*.json
""" % (len(postos), snapshot["ufs_cobertas"], len(modelos), len(ofertas),
       ("%.2f" % snapshot["preco_medio_brl"]) if snapshot["preco_medio_brl"] else "-",
       taxa, cambio.get("fonte")))


if __name__ == "__main__":
    main()
