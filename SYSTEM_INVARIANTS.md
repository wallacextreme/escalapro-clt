# SYSTEM_INVARIANTS.md — Invariantes Jurídicas e Algorítmicas

Estas invariantes **NUNCA** podem ser relaxadas ou contornadas em código de produção:

1. **Intervalo Intrajornada (Art. 71 CLT)**:
   - Jornadas > 6h exigem janela mínima de 1h de refeição.
   - O `LunchWindowStaggerEngine` deve distribuir os colaboradores do mesmo setor equilibradamente entre janelas (`W1_12_13` e `W2_13_14` ou equivalentes noturnas) garantindo cobertura contínua quando houver `>= 2` colaboradores no setor.

2. **Bloqueio de Dupla Ausência Setorial (`[sectorId+date]`)**:
   - Dois ou mais colaboradores do mesmo setor não podem ter ausência programada (`F`, `FE`, `LM`, `LP`) na mesma data sem `substituteEmployeeId` válido pré-alocado (`BLOQUEADO: COLISÃO SETORIAL >= 2 NO SETOR`).

3. **Trava de Início de Férias (Art. 134, § 3º CLT)**:
   - É terminantemente vedado o início das férias (`FE`) no período de **2 dias** que antecede feriado oficial ou dia de DSR do colaborador.

4. **Substituição Ágil e Descansos Obrigatórios**:
   - **Art. 66 CLT**: Interjornada mínima de **11h consecutivas** antes e depois do turno assumido.
   - **Art. 67 CLT**: Descanso semanal remunerado somado à interjornada exige mínimo de **35h consecutivas** após DSR.
   - **Art. 59 CLT**: Respeitar teto semanal da escala (`40h`, `42h`, `44h`, etc.) e limite máximo de **2h extras diárias**.
   - **Revezamento Dominical**:
     - Mulheres (**Art. 386 CLT**): escala quinzenal (15 dias), no máximo 1 domingo trabalhado seguido de folga no próximo.
     - Comércio (**Lei 10.101/2000**): pelo menos 1 domingo de folga a cada 3 semanas.
     - Demais setores (**Portaria MTP 671/2021**): pelo menos 1 domingo de folga a cada 7 semanas.

5. **Ponto, DSR, Férias Proporcionais e INSS**:
   - **Art. 58, § 1º CLT**: Variações de até 5 min por batida limitadas a 10 min diários são isentas; excedido o limite, computa-se a integralidade da variação diária.
   - **Lei 605/1949 Art. 6º**: Falta injustificada acarreta perda automática do DSR da respectiva semana.
   - **Art. 130 CLT**: Faltas injustificadas no período aquisitivo reduzem o direito a férias (`<=5: 30d`, `6-14: 24d`, `15-23: 18d`, `24-32: 12d`, `>32: 0d`).
   - **INSS (Lei 8.213/1991 Art. 60)**: Atestados médicos que ultrapassem **15 dias em janela móvel de 60 dias** disparam alerta obrigatório de encaminhamento previdenciário.

6. **Fator de Bradford (`B = S² × D`)**:
   - Classificação imutável: Baixo (`< 50` / `<= 50`), Atenção (`51–124`), Alto (`125–399`), Crítico (`>= 400`).

