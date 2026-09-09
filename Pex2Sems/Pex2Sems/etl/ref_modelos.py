# -*- coding: utf-8 -*-
"""Tabela de referencia de modelos eletrificados vendidos no Brasil.

IMPORTANTE - natureza destes dados:
Os anuncios coletados em carregados.com.br trazem marca, modelo, ano e preco,
mas NAO trazem ficha tecnica (bateria, autonomia, conector). Esta tabela
preenche essa lacuna com **estimativas de referencia** compiladas de material
publico dos fabricantes e do INMETRO/PBEV.

Nao sao medicoes proprias e nao substituem a ficha tecnica oficial: servem para
classificar os anuncios por categoria ABVE e por tipo de conector no BI.

`preco_ref_usd` existe so nos modelos com equivalente no mercado internacional
e e convertido para BRL em tempo de build pela cotacao do dia (fetch_cambio.py),
atendendo ao caso "preco em dolar -> converter para real".

Campos:
  chave        : substring casada contra "marca modelo" do anuncio (minusculas)
  categoria    : BEV | PHEV | HEV | MHEV | FCEV  (taxonomia ABVE)
  conector     : conector de recarga rapida predominante no Brasil
  bateria_kwh  : capacidade util aproximada
  autonomia_km : autonomia homologada aproximada (ciclo do fabricante)
  preco_ref_usd: MSRP de referencia do mercado americano/europeu, quando existe
"""

# (chave, categoria, conector, bateria_kwh, autonomia_km, preco_ref_usd)
MODELOS = [
    # --- BYD ---------------------------------------------------------------
    ("byd dolphin mini",      "BEV",  "CCS2",     38.0,  380, None),
    ("byd dolphin",           "BEV",  "CCS2",     44.9,  427, None),
    ("byd seal",              "BEV",  "CCS2",     82.5,  570, None),
    ("byd yuan",              "BEV",  "CCS2",     60.5,  480, None),
    ("byd atto",              "BEV",  "CCS2",     60.5,  480, None),
    ("byd han",               "BEV",  "CCS2",     85.4,  550, None),
    ("byd tan",               "BEV",  "CCS2",     86.4,  400, None),
    ("byd song plus dm-i",    "PHEV", "CCS2",     18.3,  110, None),
    ("byd song pro",          "PHEV", "CCS2",     18.3,  105, None),
    ("byd king",              "PHEV", "CCS2",     18.3,  115, None),
    ("byd shark",             "PHEV", "CCS2",     29.6,  100, None),
    ("byd seal u",            "PHEV", "CCS2",     18.3,  105, None),

    # --- GWM ---------------------------------------------------------------
    ("gwm ora",               "BEV",  "CCS2",     48.0,  320, None),
    ("gwm haval h6 phev",     "PHEV", "CCS2",     34.0,  170, None),
    ("gwm haval h6",          "HEV",  "N/A",       1.8,    0, None),
    ("gwm poer",              "PHEV", "CCS2",     37.1,  110, None),

    # --- Nacionais / populares --------------------------------------------
    ("renault kwid",          "BEV",  "CCS2",     26.8,  185, None),
    ("renault megane",        "BEV",  "CCS2",     60.0,  450, None),
    ("fiat 500e",             "BEV",  "CCS2",     42.0,  320, 34095.0),
    ("fiat pulse hybrid",     "MHEV", "N/A",       0.4,    0, None),
    ("fiat fastback hybrid",  "MHEV", "N/A",       0.4,    0, None),
    ("jac e-js1",             "BEV",  "GB/T",     30.2,  300, None),
    ("jac iev",               "BEV",  "GB/T",     41.5,  300, None),
    ("caoa chery icar",       "BEV",  "CCS2",     30.0,  310, None),

    # --- Japoneses / hibridos ---------------------------------------------
    ("toyota corolla cross",  "HEV",  "N/A",       1.3,    0, None),
    ("toyota corolla",        "HEV",  "N/A",       1.3,    0, None),
    ("toyota prius",          "HEV",  "N/A",       1.3,    0, 28350.0),
    ("toyota rav4",           "PHEV", "Type 2",   18.1,   68, 44265.0),
    ("honda cr-v",            "HEV",  "N/A",       1.1,    0, None),
    ("nissan leaf",           "BEV",  "CHAdeMO",  40.0,  270, 28140.0),
    ("nissan kicks e-power",  "HEV",  "N/A",       2.1,    0, None),

    # --- Premium / europeus -----------------------------------------------
    ("volvo ex30",            "BEV",  "CCS2",     69.0,  480, 44900.0),
    ("volvo xc40",            "BEV",  "CCS2",     78.0,  460, 53795.0),
    ("volvo ec40",            "BEV",  "CCS2",     78.0,  500, None),
    ("volvo xc60",            "PHEV", "Type 2",   18.8,   81, 59000.0),
    ("bmw ix",                "BEV",  "CCS2",    111.5,  600, 87250.0),
    ("bmw i4",                "BEV",  "CCS2",     83.9,  590, 57900.0),
    ("bmw x5",                "PHEV", "Type 2",   29.5,  110, 72500.0),
    ("audi q8 e-tron",        "BEV",  "CCS2",    114.0,  505, 74400.0),
    ("audi e-tron",           "BEV",  "CCS2",     95.0,  440, 74400.0),
    ("audi q5",               "PHEV", "Type 2",   17.9,   88, None),
    ("porsche taycan",        "BEV",  "CCS2",     93.4,  503, 99400.0),
    ("porsche cayenne",       "PHEV", "Type 2",   25.9,   90, 96900.0),
    ("mercedes eqe",          "BEV",  "CCS2",     90.6,  590, 74900.0),
    ("mercedes eqa",          "BEV",  "CCS2",     70.5,  480, None),
    ("mini cooper se",        "BEV",  "CCS2",     54.2,  400, 30900.0),
    ("peugeot e-208",         "BEV",  "CCS2",     51.0,  400, None),

    # --- Chineses recentes -------------------------------------------------
    ("zeekr",                 "BEV",  "CCS2",    100.0,  580, None),
    ("omoda e5",              "BEV",  "CCS2",     61.0,  430, None),
    ("chery",                 "BEV",  "CCS2",     40.0,  350, None),
    ("neta",                  "BEV",  "CCS2",     58.0,  400, None),
    ("seres",                 "BEV",  "CCS2",     51.0,  330, None),

    # --- Americanos --------------------------------------------------------
    ("chevrolet bolt",        "BEV",  "CCS2",     65.0,  416, 27495.0),
    ("chevrolet spark",       "BEV",  "CCS2",     26.0,  200, None),
    ("ford mustang mach-e",   "BEV",  "CCS2",     91.0,  490, 39995.0),
    ("tesla model 3",         "BEV",  "CCS2",     60.0,  513, 38990.0),
    ("tesla model y",         "BEV",  "CCS2",     75.0,  533, 44990.0),
]

# fallback por categoria quando o modelo nao esta na tabela
PADRAO_CATEGORIA = {
    "BEV":  ("CCS2",  50.0, 350),
    "PHEV": ("Type 2", 18.0, 100),
    "HEV":  ("N/A",     1.5,   0),
    "MHEV": ("N/A",     0.5,   0),
    "FCEV": ("H2",      0.0, 600),
}

# palavras no nome do anuncio que denunciam a categoria quando o modelo e novo
PISTAS = [
    ("plug-in", "PHEV"), ("plug in", "PHEV"), ("phev", "PHEV"), ("dm-i", "PHEV"),
    ("e-power", "HEV"), ("mhev", "MHEV"), ("mild", "MHEV"),
    ("hybrid", "HEV"), ("hibrido", "HEV"), ("híbrido", "HEV"),
    ("electric", "BEV"), ("eletrico", "BEV"), ("elétrico", "BEV"), ("e-tech", "BEV"),
]


def classificar(nome, marca, modelo):
    """Devolve (categoria, conector, bateria_kwh, autonomia_km, preco_ref_usd).

    Casa primeiro pela tabela de referencia (a chave mais longa vence, para que
    "byd dolphin mini" ganhe de "byd dolphin"); depois cai nas pistas textuais.
    """
    alvo = ("%s %s %s" % (marca or "", modelo or "", nome or "")).lower()

    melhor = None
    for chave, cat, con, kwh, km, usd in MODELOS:
        if chave in alvo and (melhor is None or len(chave) > len(melhor[0])):
            melhor = (chave, cat, con, kwh, km, usd)
    if melhor:
        return melhor[1:]

    categoria = "BEV"
    for pista, cat in PISTAS:
        if pista in alvo:
            categoria = cat
            break
    con, kwh, km = PADRAO_CATEGORIA[categoria]
    return categoria, con, kwh, km, None
