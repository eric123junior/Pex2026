"""Cotacao USD -> BRL para converter precos de referencia internacionais.

Fonte primaria: AwesomeAPI (economia.awesomeapi.com.br), sem chave.
Reserva: open.er-api.com.

Saida: etl/raw/cambio.json
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from http_util import get_json  # noqa: E402

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")


def cotacao():
    d = get_json("https://economia.awesomeapi.com.br/last/USD-BRL", timeout=30)
    if d and "USDBRL" in d:
        c = d["USDBRL"]
        return {"taxa": float(c["bid"]), "fonte": "AwesomeAPI",
                "atualizado_em": c.get("create_date")}

    d = get_json("https://open.er-api.com/v6/latest/USD", timeout=30)
    if d and d.get("result") == "success":
        return {"taxa": float(d["rates"]["BRL"]), "fonte": "open.er-api.com",
                "atualizado_em": d.get("time_last_update_utc")}
    return None


def main():
    os.makedirs(RAW, exist_ok=True)
    c = cotacao()
    if not c:
        print("nao foi possivel obter a cotacao")
        sys.exit(1)
    c["coletado_em"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    dest = os.path.join(RAW, "cambio.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(c, fh, ensure_ascii=False, indent=1)
    print("USD -> BRL = %.4f  (%s, %s)" % (c["taxa"], c["fonte"], c["atualizado_em"]))


if __name__ == "__main__":
    main()
