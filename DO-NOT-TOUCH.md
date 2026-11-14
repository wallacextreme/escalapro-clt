# DO-NOT-TOUCH.md — Restrições Críticas de Segurança, Compatibilidade e Schema

1. **Compatibilidade Windows 7 a Windows 11 (`chrome100`)**:
   - **NÃO** remova `build.target: 'chrome100'` nem `cssTarget: 'chrome100'` de `vite.config.ts`.
   - **NÃO** atualize o Tailwind CSS para v4 usando `oklch()` nem insira funções de cor `oklch()` em `src/index.css` ou componentes. Todo o CSS final deve usar exclusivamente Hex, RGB ou HSL.

2. **Segurança Firebase (`database.rules.json`)**:
   - **NUNCA** defina `".read": true` ou `".write": true` na raiz de `database.rules.json`.
   - Toda leitura/escrita deve permanecer isolada por `$tenantId` autenticado (`auth != null`) e com regras `.validate` granulares em todos os nós.

3. **Índices Dexie (`src/db/database.ts`)**:
   - **NÃO** remova os índices compostos `[sectorId+date]` em `scheduleAssignments` e `leavesAndVacations`, nem `[employeeId+month]` em `attendanceLogs`. Os motores de colisão e folha dependem dessas chaves.

4. **Integridade de Dados & Auditoria**:
   - Toda mutação nas visões operacionais deve passar por `recordDualWriteMutation()` para manter `auditLogs` e `syncQueue` com hash SHA-256 consistente.

