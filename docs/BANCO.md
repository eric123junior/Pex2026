# Subir o banco num serviço gratuito

O pipeline gera um banco completo em `data/`. Este guia mostra como colocá-lo
num serviço hospedado gratuito para que o Power BI e outras ferramentas consumam
os dados pela rede.

> **Sobre criar a conta:** o cadastro e a senha do serviço são seus e precisam ser
> feitos por você — nenhuma automação deve digitar credenciais no seu lugar. Os
> passos abaixo começam depois que a conta existe.

---

## O que o ETL produz

| Arquivo | Uso |
|---|---|
| `data/sustambitech.db` | SQLite — funciona sem servidor nenhum |
| `data/schema.sql` | DDL portável (PostgreSQL, MySQL 8, SQLite) |
| `data/seed.sql` | `INSERT`s de todo o conteúdo |
| `data/csv/*.csv` | importação direta em Power BI, Excel ou Sheets |

O `schema.sql` foi escrito no subconjunto de SQL comum aos três bancos, então roda
sem adaptação nos serviços abaixo.

---

## Modelo de dados

```
estados          uf (PK), nome, regiao, capital_lat, capital_lon
eletropostos     id (PK), osm_id, nome, operador, rede, uf, cidade, endereco,
                 latitude, longitude, capacidade, potencia_kw,
                 ccs2, type2, chademo, gbt, tipo2_tomada,
                 acesso, pago, horario, fonte
modelos_ev       id (PK), marca, modelo, categoria, conector,
                 bateria_kwh, autonomia_km, ofertas,
                 preco_min_brl, preco_medio_brl, preco_mediano_brl, preco_max_brl,
                 ano_min, ano_max,
                 preco_ref_usd, preco_ref_usd_em_brl, indice_km_por_mil_brl
ofertas          id (PK), marca, modelo, ano, preco_brl, categoria, conector, url
cambio           moeda (PK), taxa_brl, fonte, atualizado_em
snapshots        data (PK), total_eletropostos, total_modelos, total_ofertas,
                 preco_medio_brl, ufs_cobertas
```

Relacionamentos para montar no Power BI:

- `eletropostos.uf` → `estados.uf` (muitos para um)
- `ofertas.marca + modelo` → `modelos_ev.marca + modelo` (muitos para um)

Como o Power BI não faz relacionamento por duas colunas, crie uma coluna
calculada em ambas as tabelas e relacione por ela:

```dax
ChaveModelo = LOWER( ofertas[marca] & "|" & ofertas[modelo] )
```

---

## Opção 1 — Neon (PostgreSQL gratuito)

1. Crie o projeto em [neon.tech](https://neon.tech) e copie a connection string.
2. Rode o schema e a carga:

```bash
psql "postgresql://USUARIO:SENHA@HOST/neondb?sslmode=require" -f data/schema.sql
psql "postgresql://USUARIO:SENHA@HOST/neondb?sslmode=require" -f data/seed.sql
```

3. Confira:

```sql
SELECT uf, COUNT(*) FROM eletropostos GROUP BY uf ORDER BY 2 DESC LIMIT 5;
```

O Neon aceita conexão direta do Power BI Desktop pelo conector PostgreSQL.

## Opção 2 — Supabase (PostgreSQL + painel web)

1. Crie o projeto em [supabase.com](https://supabase.com).
2. Cole o conteúdo de `data/schema.sql` no **SQL Editor** e execute.
3. Repita com `data/seed.sql`. Se o editor reclamar do tamanho, importe os CSVs de
   `data/csv/` pela interface de **Table Editor → Import data**.
4. Os dados de conexão ficam em **Project Settings → Database**.

## Opção 3 — TiDB Cloud ou PlanetScale (MySQL)

```bash
mysql -h HOST -u USUARIO -p --ssl-mode=REQUIRED BANCO < data/schema.sql
mysql -h HOST -u USUARIO -p --ssl-mode=REQUIRED BANCO < data/seed.sql
```

## Opção 4 — Nenhum servidor

O `data/sustambitech.db` é um SQLite completo. Serve para análise local com
DB Browser for SQLite, Python (`sqlite3`), DuckDB ou o próprio Power BI via
conector ODBC de SQLite. É a opção mais simples se o objetivo é só analisar.

---

## Reatualizar

O pipeline é idempotente: rode os quatro scripts de novo e o `build_db.py`
regenera todos os artefatos, com uma nova linha em `snapshots`.

Para atualizar um banco remoto sem duplicar, execute `data/schema.sql` antes do
`seed.sql` — o DDL começa com `DROP TABLE IF EXISTS` de todas as tabelas, então a
carga sempre parte de um estado limpo.

> Se o banco remoto já estiver em produção e você não quiser derrubar as tabelas,
> carregue o `seed.sql` num schema temporário e faça o swap ao final.

---

## Consultas úteis

```sql
-- ranking de eletropostos por estado
SELECT e.uf, s.nome, COUNT(*) AS pontos,
       SUM(e.ccs2) AS com_ccs2,
       ROUND(AVG(NULLIF(e.potencia_kw, 0)), 1) AS potencia_media_kw
FROM eletropostos e
JOIN estados s ON s.uf = e.uf
GROUP BY e.uf, s.nome
ORDER BY pontos DESC;

-- preço médio por categoria ABVE
SELECT categoria, COUNT(*) AS ofertas, ROUND(AVG(preco_brl), 2) AS preco_medio
FROM ofertas
GROUP BY categoria
ORDER BY ofertas DESC;

-- modelos mais baratos por km de autonomia
SELECT marca, modelo, autonomia_km, preco_medio_brl, indice_km_por_mil_brl
FROM modelos_ev
WHERE autonomia_km > 0 AND ofertas >= 3
ORDER BY indice_km_por_mil_brl DESC
LIMIT 15;

-- preço no Brasil x referência internacional convertida
SELECT marca, modelo, preco_medio_brl, preco_ref_usd_em_brl,
       ROUND(100.0 * (preco_medio_brl - preco_ref_usd_em_brl)
             / preco_ref_usd_em_brl, 1) AS diferenca_pct
FROM modelos_ev
WHERE preco_ref_usd_em_brl IS NOT NULL
ORDER BY diferenca_pct DESC;
```
