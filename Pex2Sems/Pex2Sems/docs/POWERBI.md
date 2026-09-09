# Power BI sobre o banco novo

## Primeiro, a parte que não dá para fazer

**Não é possível extrair a base de um relatório publicado em `app.powerbi.com/view`.**

Um relatório publicado com "Publicar na web" entrega ao navegador o *visual já
renderizado*, não o modelo semântico por trás dele. As requisições que o iframe faz
carregam resultados de consultas específicas daquele visual, autenticadas por um
token efêmero ligado à sessão de incorporação — não o dataset.

Ler o dataset de verdade exige um destes caminhos, e os três precisam de
autenticação no workspace com credenciais do dono:

- API REST do Power BI (`GET /datasets/{id}`), com registro de app no Entra ID;
- endpoint XMLA (`powerbi://api.powerbi.com/v1.0/myorg/...`), disponível em
  capacidade Premium/PPU, consultável por DAX ou MDX;
- exportação manual pelo próprio relatório, quando o autor habilita.

Como a automação aqui não cria contas nem digita credenciais, o caminho correto é o
inverso do pedido: **publicar um relatório novo sobre o banco aberto deste
repositório**, que é reproduzível e não depende do acesso de ninguém.

---

## Montando o relatório novo

### 1. Conectar

**Opção CSV (mais rápida)** — no Power BI Desktop:
`Obter dados → Texto/CSV` e importe, de `data/csv/`:

- `eletropostos.csv`
- `modelos_ev.csv`
- `ofertas.csv`
- `estados.csv`

Os arquivos são gravados em UTF‑8 com BOM, então acentuação e cedilha entram
corretos sem ajuste de codificação.

**Opção banco hospedado** — `Obter dados → PostgreSQL` (ou MySQL) apontando para o
serviço configurado em [BANCO.md](BANCO.md). Prefira essa se quiser atualização
agendada no Power BI Service.

### 2. Relacionamentos

- `eletropostos[uf]` → `estados[uf]`
- `ofertas[ChaveModelo]` → `modelos_ev[ChaveModelo]`, com a coluna calculada:

```dax
ChaveModelo = LOWER( ofertas[marca] & "|" & ofertas[modelo] )
```

(a mesma expressão, trocando o nome da tabela, em `modelos_ev`)

### 3. Medidas

```dax
Total de eletropostos = COUNTROWS( eletropostos )

Pontos com CCS2 = CALCULATE( [Total de eletropostos], eletropostos[ccs2] = 1 )

Potência média (kW) =
AVERAGEX(
    FILTER( eletropostos, eletropostos[potencia_kw] > 0 ),
    eletropostos[potencia_kw]
)

Preço médio (BRL) = AVERAGE( ofertas[preco_brl] )

Ofertas = COUNTROWS( ofertas )

Prêmio sobre referência internacional =
VAR BR   = AVERAGE( modelos_ev[preco_medio_brl] )
VAR Intl = AVERAGE( modelos_ev[preco_ref_usd_em_brl] )
RETURN DIVIDE( BR - Intl, Intl )

Participação BEV =
DIVIDE(
    CALCULATE( [Ofertas], ofertas[categoria] = "BEV" ),
    [Ofertas]
)
```

### 4. Centralizar em São Paulo

O pedido de "centralizar em São Paulo" se resolve em duas camadas — vale fazer as
duas, porque uma controla o enquadramento e a outra, os números.

**No visual de mapa.** Use o visual **Mapa** (ou **Azure Maps**) com
`eletropostos[latitude]` e `eletropostos[longitude]`.

- Azure Maps: em `Formatar visual → Controles do mapa`, desligue o zoom automático
  e fixe `Latitude = -23,55`, `Longitude = -46,63`, `Zoom = 9`.
- Mapa clássico: sem controle de centro fixo. Aplique um **filtro de nível de
  visual** `estados[uf] = "SP"` e o enquadramento passa a nascer em São Paulo.

**Na página.** Em `Formatar página → Filtros`, adicione `estados[uf] = "SP"` como
filtro padrão e marque *Exibir e permitir alterar* — o relatório abre em São Paulo,
mas o leitor consegue trocar de estado.

Para uma visão nacional sem perder o padrão, duplique a página, remova o filtro e
nomeie as duas abas ("São Paulo" e "Brasil").

### 5. Publicar

`Publicar → workspace` e, no Power BI Service, `Arquivo → Inserir relatório →
Publicar na web`. Copie o `src` do iframe gerado e troque a URL no `index.html`, na
seção de dashboards.

> Publicar na web torna o relatório **público para qualquer pessoa com o link**.
> Como este banco só contém dados já públicos, isso é adequado aqui — mas confira
> antes de aplicar o mesmo procedimento a qualquer outro dataset.

---

## Atualização

Com CSV, a atualização é manual: rode o ETL, substitua os arquivos e clique em
`Atualizar` no Desktop, republicando em seguida.

Com banco hospedado, configure `Atualização agendada` no Service. O PostgreSQL na
nuvem dispensa gateway; bancos locais exigem o On‑premises Data Gateway.

A tabela `snapshots` guarda uma linha por execução do pipeline, então dá para
montar um cartão com a data da coleta vigente:

```dax
Coleta mais recente = MAX( snapshots[data] )
```
