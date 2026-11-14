# MANUAL DO USUÁRIO — EscalaPro CLT (v2.0)

Bem-vindo ao **EscalaPro CLT**, sistema Offline-First para gestão inteligente de escalas de trabalho, conformidade trabalhista (CLT, EC nº 141/2026, Portaria MTP nº 671/2021, Lei nº 605/1949) e Workforce Analytics.

---

## 1. Barra Superior e Ferramentas Globais
- **Modo Offline / Sync**: O sistema funciona 100% sem internet usando banco local IndexedDB. Caso configure o Firebase Realtime Database clicando no botão **Offline-First**, as alterações pendentes são sincronizadas automaticamente com hash SHA-256.
- **Exportar `.XLSX (7 Abas)`**: Gera planilha corporativa completa com as abas `1_Mapeamento_Turnos`, `2_Folgas_Ferias`, `3_Matriz_Cobertura`, `4_Trocas_Substituicoes`, `5_Prontuario_RH`, `6_Analytics_Bradford` e `7_Regras_Escalas`.
- **Exportar `.CSV` e `.JSON`**: Gera CSV do mês ou backup completo do banco local.
- **Importar**: Permite restaurar backup `.json` ou importar atualizações via `.xlsx`/`.csv`.
- **Imprimir A4**: Formata o espelho oficial de escala em **A4 Paisagem** pronto para assinatura e mural.

---

## 2. Os 6 Módulos Operacionais

### Módulo 1 — Mapeamento de Turnos & Almoço (`1. Turnos & Almoço`)
- Filtre por setor e alterne entre visão **Semanal (7d)**, **Quinzenal (14d)** ou **Mensal (30d)**.
- Altere códigos diretamente na grade (`T`, `F`, `FE`, `LM`, `LP`, `FA`, `AT`, `BH`, `TR`).
- Clique em **Escalonar Almoço (Art. 71)** para distribuir automaticamente o time entre a `1ª Janela (12:00-13:00)` e a `2ª Janela (13:00-14:00)`.
- Clique em **Motor de Escalas & 6x1→5x2** para simular a migração constitucional (42h até 15/12/2027 ou 40h) ou criar uma escala customizada.

### Módulo 2 — Programação de Folgas, Férias & Licenças (`2. Folgas & Férias`)
- Selecione o colaborador, a data e o tipo (`F`, `FE`, `LM`, `LP`).
- **Bloqueio Automático de Colisão**: Se outro colaborador do mesmo setor já estiver ausente na mesma data e você não indicar um substituto pré-alocado, o sistema exibirá `BLOQUEADO: COLISÃO SETORIAL >= 2 NO SETOR`.
- **Trava Art. 134 § 3º CLT**: Impede início de férias nos 2 dias que antecedem feriados ou DSR.

### Módulo 3 — Matriz de Cobertura nos Horários Críticos (`3. Matriz Cobertura`)
- Acompanhe hora a hora (`08h` às `20h`) o saldo líquido de colaboradores no posto após descontar almoço e ausências.
- Utilize a **Calculadora de Dimensionamento (Headcount Simulator)** na base da tela para comparar quantos colaboradores são necessários nas escalas `5x2`, `6x1`, `12x36` e `12x48`.

### Módulo 4 — Ajuste Ágil na Escala (`4. Ajuste Ágil`)
- Selecione a data e o colaborador ausente.
- O sistema avalia todos os colegas automaticamente quanto à **Interjornada >= 11h (Art. 66)**, **DSR >= 35h (Art. 67)**, **Teto Semanal/Extra (Art. 59)** e **Revezamento Dominical (Art. 386 / Comércio / MTP 671)**.
- Clique em **Efetivar Substituição** nos candidatos com selo **APTO**.

### Módulo 5 — Prontuário Mensal do RH (`5. Prontuário RH`)
- Consulte faltas injustificadas, descontos automáticos de DSR (Lei 605/49), minutos isentos pela tolerância do Art. 58 § 1º CLT (5 min/batida, máx. 10 min/dia), férias proporcionais do Art. 130 CLT e **Alertas de Afastamento INSS (> 15 dias em 60 dias)**.
- Utilize o formulário superior para lançar novas ocorrências diretamente no prontuário.

### Módulo 6 — Analytics & Controle Preditivo (`6. Analytics & Crise`)
- Combine até **8 filtros** (Período, Setor, Cargo, Escala, Regime, Turno, Gênero e Colaborador).
- Acompanhe o **Índice de Absenteísmo (%)**, o ranking do **Fator de Bradford (`B = S² × D`)**, o **Mapa de Calor Seg–Dom × Setor** e os avisos preditivos **`RISCO DE CRISE: REFORÇAR PLANTÃO`**.

