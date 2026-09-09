-- SustAmbiTech BI - esquema do banco
-- Compativel com PostgreSQL, MySQL 8 e SQLite.

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
