# Opportunity Engine, Financial Health e ML

## Método de pontuação

Cada regra (`app/services/opportunity_engine/rules.py`) segue o mesmo contrato:

1. **Condições de disparo** — limites configuráveis em `params` (exibidos em *Configurações*).
2. **Fatores** — cada fator tem peso máximo (a soma dos pesos é 100) e uma nota de 0 a 1 calculada a partir de uma métrica. Valores monetários usam escala logarítmica (importam em ordens de grandeza); proporções usam escala linear.
3. **Score** = soma dos pontos dos fatores, arredondada. Abaixo de 45 a oportunidade não é exibida.
4. **Evidências** — frases geradas com os números que a regra usou: `support` (sustentam), `context` (contexto) e `caution` (ressalvas para o analista).
5. **Métricas e contexto** — os valores exibidos no detalhe e os dados da visualização específica do tipo.
6. **Ação recomendada** — sempre como orientação ao analista, nunca como decisão automática.

```text
score = Σ max_points(fator) × clamp(nota(fator), 0, 1)
```

## As sete regras

### Saldo parado (`IDLE_CASH_V1`)
- Dispara: saldo médio de fim de mês no banco ≥ R$ 15 mil, variação ≤ 20%, ≥ 5 de 6 meses acima de 80% da média, giro mensal ≤ 0,8 e sem dívida cara (quitar a dívida é o melhor uso do saldo).
- Valor ocioso = saldo médio − meia movimentação mensal (folga operacional).
- Fatores: valor ocioso (35), estabilidade (25), baixa utilização (15), renda recorrente (15), baixo endividamento (10).

### Investimentos (`INVESTMENT_V1`)
- Dispara: ≥ R$ 20 mil em outras instituições e ≥ 60% da carteira de investimentos fora.
- Fatores: volume externo (30), concentração externa (25), estabilidade de renda (15), baixo endividamento (10), tempo de relacionamento (10), sobra mensal (10).

### Otimização de dívida (`DEBT_OPTIMIZATION_V1`)
- Dispara: dívidas acima de 3% a.m. ≥ R$ 2 mil e saldo disponível (menos meia despesa mensal) cobrindo ≥ 50% delas.
- Fatores: custo anual dos juros (35), cobertura (25), diferença de taxa (20), economia em 12 meses (20).
- Economia = valor amortizável × (taxa − ~0,85% a.m. de rendimento perdido) × 12.

### Crédito — portabilidade (`CREDIT_PORTABILITY_V1`)
- Dispara: empréstimo em concorrente com taxa ≥ 0,3 p.p. acima da referência do banco para a modalidade, saldo ≥ R$ 5 mil e ≥ 6 parcelas restantes.
- Economia = (parcela atual − parcela recalculada na taxa de referência) × prazo restante.
- Fatores: spread relativo (35), saldo portável (25), economia para o cliente (25), comprometimento de renda (15).
- Evidência de ressalva obrigatória: a portabilidade depende de análise de crédito — sem aprovação automática.

### Migração de gastos (`SPENDING_MIGRATION_V1`)
- Dispara: gasto com cartão ≥ R$ 1.500/mês e ≥ 60% dele em cartões de outras instituições.
- Fatores: participação externa (40), volume externo (25), tendência trimestral (20), vínculo com o banco (15).

### Relacionamento (`RELATIONSHIP_V1`)
- Dispara: salário creditado no banco e ao menos 2 de 3 categorias (investimentos, cartão, crédito) com 60%+ fora.
- Fatores: produtos fora (40), patrimônio externo (25), potencial de renda (20), tempo de relacionamento (15).

### Retenção (`RETENTION_V1`)
- Fatores: portabilidade de salário (35), queda de saldo (25), saída de investimentos (25), aumento de uso de concorrentes (15).
- Dispara com salário migrado ou score ≥ 35 (combinação de sinais).
- Valor = recursos em risco (saldo + investimentos no banco antes da mudança).

## Financial Health Score

`app/services/financial_health.py` — cada componente converte uma métrica em 0–100 por uma curva linear por partes:

| Componente | Peso | Métrica |
|---|---|---|
| Fluxo de caixa | 20% | sobra média (renda − gastos − parcelas) / renda, 6 meses |
| Endividamento | 20% | parcelas / renda, com penalidade por dívida acima de 3% a.m. |
| Liquidez | 15% | meses de despesas cobertos pelo saldo em conta |
| Poupança | 15% | aplicações líquidas / renda, 6 meses |
| Investimentos | 15% | carteira / renda anual |
| Estabilidade de renda | 15% | variação robusta (MAD) da renda mensal em 12 meses |

Faixas: **excelente ≥ 80**, saudável ≥ 65, atenção ≥ 45, crítica < 45. Cada componente vem com um texto de leitura ("Sobra 34% da renda") e uma explicação.

## Mudanças de comportamento

`app/services/behavior_analysis.py` compara o último trimestre com o anterior:

| Sinal | Limite |
|---|---|
| Entrada de salário mudou | instituição que recebe a renda mudou no trimestre |
| Investimentos transferidos | investimentos no banco −30% (base ≥ R$ 5 mil) |
| Queda de saldo | saldo médio −30% (base ≥ R$ 3 mil) |
| Cartão concorrente | +10 p.p. de participação ou +30% de gasto externo |
| Aumento de gastos | +25% |
| Queda de renda | −25% |
| Aumento de dívida | +30% ou nova dívida ≥ R$ 3 mil |

## Machine Learning

- **Segmentação** (`app/ml/segmentation.py`): KMeans (k=6) sobre 9 features padronizadas. Os clusters são nomeados comparando cada centroide com arquétipos de negócio e resolvendo a atribuição com o algoritmo húngaro (`scipy.optimize.linear_sum_assignment`), o que garante nomes únicos e estáveis. O silhouette score é registrado em cada execução.
- **Anomalias** (`app/ml/anomaly.py`): Isolation Forest (contaminação 3%) sobre as variações trimestrais de gastos, saldo, renda, cartão externo, investimentos e dívida; as duas maiores variações padronizadas viram a explicação.

## Dados sintéticos

O gerador parte de variáveis latentes por cliente (ocupação, renda log-normal, idade, afinidade digital, lealdade) e comportamentos com probabilidades calibradas: poupador, investidor externo, dívida cara (metade com saldo para quitá-la), migração de cartão, empréstimo em concorrente, risco de evasão, aumento de gastos e estresse financeiro. Há sazonalidade (dezembro, janeiro, julho), 13º salário para CLT, servidores e aposentados, e ~1,5% de clientes com um consentimento revogado (os dados daquela instituição não entram na análise).

Cinco **personas de demonstração** (CUS-00001 a CUS-00005) passam pelo mesmo pipeline e exercitam cada tipo de oportunidade: João Silva (investimentos fora, cartão Nubank, empréstimo Inter), Maria Souza (saldo parado), Lucas Santos (dívida cara com saldo disponível), Carla Mendes (salário migrou para o Itaú, investimentos para a XP) e Rafael Costa (consignado e financiamento acima da taxa de referência).
