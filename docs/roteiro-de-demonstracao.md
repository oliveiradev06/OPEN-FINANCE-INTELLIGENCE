# Roteiro de demonstração (uns 7 minutos)

A ideia é sair da carteira inteira e chegar num cliente, e depois do número até a evidência que explica esse número.

1. **Login.** Abra http://localhost:3000, que redireciona para o login. O e-mail de demonstração já vem preenchido e qualquer senha funciona. Clique em *Entrar*.
2. **Início.** São 5.000 clientes analisados e 4.189 oportunidades abertas (R$ 216 mi em valor). O gráfico *Evolução da carteira* mostra a adoção do Open Finance mês a mês. Clique em *Investimentos* no donut e a lista de oportunidades abre já filtrada.
3. **Score com motivo.** Volte ao início e passe o mouse sobre um score em *Clientes em destaque*. Aparecem os fatores e as evidências, porque nenhum score aparece sem explicação.
4. **Customer 360.** Busque **João Silva** na barra de cima (Ctrl+K). Na visão geral estão o score 81 em investimentos, as informações principais, a evolução do relacionamento e o ecossistema: R$ 85 mil no BTG contra R$ 8 mil investidos no banco.
5. **Ecossistema em detalhe.** Na aba *Open Finance*, o mapa mostra o salário chegando no Banco Aurora (linha animada), o cartão mais usado no Nubank e o empréstimo no Inter. Clique no BTG para ver saldo, produtos, transações e o consentimento.
6. **Produtos.** As abas *Conta e pagamentos*, *Investimentos* e *Crédito* mostram cada conta, cartão, aplicação e contrato, com a instituição de cada um. Em *Conta e pagamentos* está a cascata renda → gastos → dívidas → investimentos → disponível.
7. **Oportunidade.** Abra o **Lucas Santos** (CUS-00003) e a oportunidade de dívida cara: R$ 18,5 mil a 11,5% a.m. enquanto R$ 19,1 mil estão parados em conta. Veja a composição do score na aba *Análise* e mude o status para *Em análise* em *Recomendação*. A mudança aparece na aba *Histórico*.
8. **Simulador.** Clique em *Simular proposta*. A simulação usa os contratos reais do cliente: amortizando R$ 18,5 mil, ele evita cerca de R$ 25 mil de juros em 12 meses. Dá para copiar o resumo da proposta.
9. **Risco de evasão.** Em **Carla Mendes** (CUS-00004), a aba *Histórico* mostra a queda de saldo e a saída de investimentos. A oportunidade de retenção (score 89) mostra o salário migrando para o Itaú mês a mês.
10. **IA explicando.** No Customer 360, clique em *Gerar resumo* e pergunte "Por que esse cliente recebeu score 81?". A resposta informa a fonte e os fatos usados. O modelo não recebe nome, ID nem transações.

Se sobrar tempo:

- **Insights.** "357 clientes aumentaram em mais de 30% seus gastos em concorrentes": *Ver clientes* abre exatamente esses 357.
- **Relatórios e perfis.** Exporte a lista de oportunidades em CSV. Depois troque o perfil para *Auditor* no menu do usuário (canto superior direito): os dados de clientes ficam bloqueados e a trilha de auditoria em *Configurações* mostra tudo o que foi feito, inclusive a exportação.
