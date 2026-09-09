"""Camada HTTP compartilhada do ETL.

Usa o `curl` do sistema em vez de urllib porque o bundle de certificados do
Python nesta maquina esta expirado (SSL: CERTIFICATE_VERIFY_FAILED).
"""
import json
import subprocess
import time
import sys

UA = "SustAmbiTechBI/1.0 (projeto academico; contato via GitHub Issues)"


def get(url, timeout=60, retries=3, pause=1.5):
    """GET simples. Devolve o corpo como texto (str) ou None."""
    for attempt in range(1, retries + 1):
        try:
            out = subprocess.run(
                ["curl", "-sS", "-L", "-m", str(timeout), "-A", UA, url],
                capture_output=True, timeout=timeout + 15,
            )
            if out.returncode == 0 and out.stdout:
                return out.stdout.decode("utf-8", "replace")
        except subprocess.TimeoutExpired:
            pass
        if attempt < retries:
            time.sleep(pause * attempt)
    return None


def get_json(url, **kw):
    body = get(url, **kw)
    if not body:
        return None
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return None


def overpass(query, retries=5, timeout=280):
    """Executa uma query Overpass, com retry quando o servidor esta ocupado.

    O Overpass responde HTTP 200 com um HTML de erro quando esta sobrecarregado,
    entao a deteccao de falha precisa olhar o corpo, nao o status.
    """
    mirrors = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]
    for attempt in range(1, retries + 1):
        host = mirrors[(attempt - 1) % len(mirrors)]
        try:
            out = subprocess.run(
                ["curl", "-sS", "-m", str(timeout), "-A", UA,
                 "-X", "POST", host, "--data-urlencode", "data=" + query],
                capture_output=True, timeout=timeout + 20,
            )
            body = out.stdout.decode("utf-8", "replace")
            if body.lstrip().startswith("{"):
                return json.loads(body)
            sys.stderr.write("  overpass ocupado (%s), tentativa %d\n" % (host, attempt))
        except (subprocess.TimeoutExpired, json.JSONDecodeError):
            sys.stderr.write("  overpass timeout (%s), tentativa %d\n" % (host, attempt))
        time.sleep(4 * attempt)
    return None
