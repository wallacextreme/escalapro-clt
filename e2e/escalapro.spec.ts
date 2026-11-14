import { expect, test } from '@playwright/test';

test.describe('EscalaPro CLT — Validação E2E das 6 Telas e Invariantes', () => {
  test('carrega os 15 colaboradores, navega pelas 6 visões e valida bloqueio de dupla ausência setorial', async ({
    page
  }) => {
    await page.goto('/');

    // 1. Mapeamento de Turnos em Tela Única (#view-shift-mapping)
    await expect(page.locator('#view-shift-mapping')).toBeVisible();
    await expect(page.getByText('15 colaboradores • 6 setores')).toBeVisible();
    await expect(page.getByText('Ana Paula Ribeiro')).toBeVisible();
    await expect(page.getByText('Patrícia Azevedo Farias')).toBeVisible();

    // Testa escalonamento automático de almoço Art. 71 CLT
    await page
      .getByRole('button', { name: /Escalonar Almoço \(Art\. 71\)/i })
      .click();
    await expect(page.getByRole('status')).toContainText('Almoço escalonado');

    // 2. Programação de Folgas, Férias & Licenças (#view-leave-planner)
    await page.locator('#nav-leave-planner').click();
    await expect(page.locator('#view-leave-planner')).toBeVisible();

    // Seed já possui Ana Paula Ribeiro (sec-vendas) ausente em 2026-11-18.
    // Tentar agendar Bruno Henrique Costa (sec-vendas) em 2026-11-18 sem substituto deve BLOQUEAR!
    await page.locator('#leave-employee-select').selectOption('emp-02');
    await page.locator('#leave-date-input').fill('2026-11-18');
    await page.locator('#leave-type-select').selectOption('F');
    await page.locator('#leave-substitute-select').selectOption('');

    await expect(page.locator('#leave-validation-banner')).toContainText(
      'BLOQUEADO: COLISÃO SETORIAL >= 2 NO SETOR'
    );
    await expect(page.locator('#leave-submit-btn')).toBeDisabled();

    // Testar trava do Art. 134 § 3º CLT: Férias em 2026-11-13 (2 dias antes de 2026-11-15 feriado/domingo)
    await page.locator('#leave-employee-select').selectOption('emp-14');
    await page.locator('#leave-date-input').fill('2026-11-13');
    await page.locator('#leave-type-select').selectOption('FE');
    await expect(page.locator('#leave-validation-banner')).toContainText(
      'BLOQUEADO: ART. 134 § 3º CLT'
    );
    await expect(page.locator('#leave-submit-btn')).toBeDisabled();

    // Selecionar substituto pré-alocado na colisão de 2026-11-18 libera o botão!
    await page.locator('#leave-employee-select').selectOption('emp-02');
    await page.locator('#leave-date-input').fill('2026-11-18');
    await page.locator('#leave-type-select').selectOption('F');
    await page.locator('#leave-substitute-select').selectOption('emp-14');
    await expect(page.locator('#leave-submit-btn')).toBeEnabled();

    // 3. Matriz de Cobertura nos Horários Críticos (#view-coverage-matrix)
    await page.locator('#nav-coverage-matrix').click();
    await expect(page.locator('#view-coverage-matrix')).toBeVisible();
    await expect(page.getByText('Headcount Simulator')).toBeVisible();
    await expect(page.getByText('Vendas Balcão')).toBeVisible();

    // 4. Ajuste Ágil na Escala (#view-agile-swap)
    await page.locator('#nav-agile-swap').click();
    await expect(page.locator('#view-agile-swap')).toBeVisible();
    await expect(
      page.getByText(/Cockpit de Ajuste Ágil na Escala/i)
    ).toBeVisible();

    // 5. Prontuário Mensal do RH (#view-absence-history)
    await page.locator('#nav-absence-history').click();
    await expect(page.locator('#view-absence-history')).toBeVisible();
    await expect(page.getByText(/ALERTA INSS \(17d\/60d\)/i)).toBeVisible();

    // 6. Controle Preditivo de Absenteísmo & Analytics (#view-analytics-dashboard)
    await page.locator('#nav-analytics-dashboard').click();
    await expect(page.locator('#view-analytics-dashboard')).toBeVisible();
    await expect(
      page.getByText(/Fator de Bradford por Colaborador/i)
    ).toBeVisible();
    await expect(
      page.getByText('RISCO DE CRISE: REFORÇAR PLANTÃO').first()
    ).toBeVisible();
  });
});

