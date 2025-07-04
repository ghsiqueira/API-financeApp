const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')
const dashboardController = require('../controllers/dashboardController')

// Middleware de autenticação para todas as rotas
router.use(auth)

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardOverview:
 *       type: object
 *       properties:
 *         periodo:
 *           type: object
 *           properties:
 *             tipo:
 *               type: string
 *             dataInicio:
 *               type: string
 *               format: date-time
 *             dataFim:
 *               type: string
 *               format: date-time
 *         resumoFinanceiro:
 *           type: object
 *           properties:
 *             receitas:
 *               type: number
 *             despesas:
 *               type: number
 *             saldo:
 *               type: number
 *             totalTransacoes:
 *               type: number
 *         evolucao:
 *           type: object
 *           properties:
 *             receitas:
 *               type: number
 *             despesas:
 *               type: number
 *             saldo:
 *               type: number
 *         orcamentos:
 *           type: object
 *         metas:
 *           type: object
 *         topCategorias:
 *           type: object
 *         transacoesRecentes:
 *           type: array
 *         alertas:
 *           type: array
 */

/**
 * @swagger
 * /api/dashboard/overview:
 *   get:
 *     summary: Obter visão geral do dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [semana, mes, ano]
 *           default: mes
 *         description: Período para análise
 *       - in: query
 *         name: ano
 *         schema:
 *           type: integer
 *         description: Ano específico
 *       - in: query
 *         name: mes
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 11
 *         description: Mês específico (0-11)
 *     responses:
 *       200:
 *         description: Dados do dashboard obtidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardOverview'
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/overview', dashboardController.getOverview)

/**
 * @swagger
 * /api/dashboard/charts:
 *   get:
 *     summary: Obter dados para gráficos
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [receita, despesa, ambos]
 *           default: ambos
 *         description: Tipo de transação
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [semana, mes, ano, 6meses]
 *           default: mes
 *         description: Período para análise
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *         description: Categoria específica para filtrar
 *     responses:
 *       200:
 *         description: Dados dos gráficos obtidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     evolucaoTemporal:
 *                       type: array
 *                       description: Dados para gráfico de linha temporal
 *                     porCategoria:
 *                       type: array
 *                       description: Dados para gráfico de pizza por categoria
 *                     receitasVsDespesas:
 *                       type: array
 *                       description: Dados para gráfico de barras comparativo
 *                     periodo:
 *                       type: object
 *                       properties:
 *                         inicio:
 *                           type: string
 *                           format: date-time
 *                         fim:
 *                           type: string
 *                           format: date-time
 *                         tipo:
 *                           type: string
 *       400:
 *         description: Parâmetros inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/charts', dashboardController.getChartData)

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Obter resumo rápido para widgets
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumo rápido obtido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     saldoAtual:
 *                       type: number
 *                     receitasMes:
 *                       type: number
 *                     despesasMes:
 *                       type: number
 *                     metasAtivas:
 *                       type: number
 *                     orcamentosAtivos:
 *                       type: number
 *                     alertasPendentes:
 *                       type: number
 */
router.get('/summary', (req, res) => {
  // Implementação básica - pode ser expandida
  res.json({
    success: true,
    data: {
      saldoAtual: 0,
      receitasMes: 0,
      despesasMes: 0,
      metasAtivas: 0,
      orcamentosAtivos: 0,
      alertasPendentes: 0
    }
  })
})

/**
 * @swagger
 * /api/dashboard/alerts:
 *   get:
 *     summary: Obter alertas do usuário
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Número máximo de alertas
 *       - in: query
 *         name: prioridade
 *         schema:
 *           type: string
 *           enum: [baixa, media, alta]
 *         description: Filtrar por prioridade
 *     responses:
 *       200:
 *         description: Alertas obtidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       tipo:
 *                         type: string
 *                       titulo:
 *                         type: string
 *                       mensagem:
 *                         type: string
 *                       prioridade:
 *                         type: string
 *                         enum: [baixa, media, alta]
 *                       data:
 *                         type: string
 *                         format: date-time
 *                       lido:
 *                         type: boolean
 */
router.get('/alerts', (req, res) => {
  // Implementação básica - pode ser expandida
  res.json({
    success: true,
    data: []
  })
})

/**
 * @swagger
 * /api/dashboard/widgets/{widgetType}:
 *   get:
 *     summary: Obter dados para widget específico
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: widgetType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [balance, expenses, income, goals, budgets]
 *         description: Tipo do widget
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [hoje, semana, mes]
 *           default: mes
 *     responses:
 *       200:
 *         description: Dados do widget obtidos com sucesso
 *       404:
 *         description: Tipo de widget não encontrado
 */
router.get('/widgets/:widgetType', (req, res) => {
  const { widgetType } = req.params
  const { periodo = 'mes' } = req.query

  const widgets = {
    balance: { saldo: 0, variacao: 0 },
    expenses: { total: 0, categoria_principal: null },
    income: { total: 0, fonte_principal: null },
    goals: { ativas: 0, progresso_medio: 0 },
    budgets: { ativos: 0, utilizacao_media: 0 }
  }

  if (!widgets[widgetType]) {
    return res.status(404).json({
      success: false,
      error: 'Tipo de widget não encontrado'
    })
  }

  res.json({
    success: true,
    data: {
      widget: widgetType,
      periodo,
      dados: widgets[widgetType],
      atualizadoEm: new Date().toISOString()
    }
  })
})

module.exports = router