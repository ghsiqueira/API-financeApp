// routes/budgetRenewal.js
const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')
const budgetRenewalService = require('../services/budgetRenewalService')
const Budget = require('../models/Budget')

// Middleware de autenticação
router.use(auth)

/**
 * @swagger
 * /api/budgets/renewal/check:
 *   post:
 *     summary: Verificar e renovar orçamentos vencidos do usuário
 *     tags: [Budget Renewal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verificação concluída
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     renovados:
 *                       type: number
 *                     detalhes:
 *                       type: array
 */
router.post('/check', async (req, res) => {
  try {
    const resultados = await budgetRenewalService.renovarOrcamentosUsuario(req.userId)
    
    res.json({
      success: true,
      message: `Verificação concluída: ${resultados.filter(r => r.status === 'renovado').length} orçamentos renovados`,
      data: {
        renovados: resultados.filter(r => r.status === 'renovado').length,
        erros: resultados.filter(r => r.status === 'erro').length,
        detalhes: resultados
      }
    })

  } catch (error) {
    console.error('Erro na verificação de renovações:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/budgets/renewal/{id}/toggle:
 *   patch:
 *     summary: Ativar/desativar renovação automática de um orçamento
 *     tags: [Budget Renewal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               renovacaoAutomatica:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Configuração atualizada
 */
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params
    const { renovacaoAutomatica } = req.body

    if (typeof renovacaoAutomatica !== 'boolean') {
      return res.status(400).json({ 
        success: false,
        error: 'renovacaoAutomatica deve ser true ou false' 
      })
    }

    const orcamento = await Budget.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { 
        renovacaoAutomatica,
        $push: {
          historico: {
            data: new Date(),
            acao: renovacaoAutomatica ? 'renovacao_ativada' : 'renovacao_desativada',
            observacao: `Renovação automática ${renovacaoAutomatica ? 'ativada' : 'desativada'} pelo usuário`
          }
        }
      },
      { new: true }
    )

    if (!orcamento) {
      return res.status(404).json({ 
        success: false,
        error: 'Orçamento não encontrado' 
      })
    }

    res.json({
      success: true,
      message: `Renovação automática ${renovacaoAutomatica ? 'ativada' : 'desativada'} com sucesso`,
      data: orcamento
    })

  } catch (error) {
    console.error('Erro ao alterar renovação automática:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/budgets/renewal/{id}/renew-now:
 *   post:
 *     summary: Renovar orçamento específico imediatamente
 *     tags: [Budget Renewal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orçamento renovado com sucesso
 */
router.post('/:id/renew-now', async (req, res) => {
  try {
    const { id } = req.params

    const orcamento = await Budget.findOne({
      _id: id,
      userId: req.userId
    })

    if (!orcamento) {
      return res.status(404).json({ 
        success: false,
        error: 'Orçamento não encontrado' 
      })
    }

    // Verificar se o orçamento já está no período atual
    const agora = new Date()
    if (orcamento.dataFim > agora) {
      return res.status(400).json({ 
        success: false,
        error: 'Orçamento ainda está em período ativo. Só é possível renovar orçamentos vencidos.' 
      })
    }

    // Calcular estatísticas antes da renovação
    const estatisticas = budgetRenewalService.calcularEstatisticasPeriodo(orcamento)

    // Renovar
    const sucesso = orcamento.renovar()
    if (!sucesso) {
      return res.status(400).json({ 
        success: false,
        error: 'Não foi possível renovar o orçamento' 
      })
    }

    // Salvar com histórico
    orcamento.ultimaRenovacao = agora
    orcamento.adicionarHistorico('renovado_manual', orcamento.valorLimite, 
      `Renovação manual - ${estatisticas.resumo}`)
    
    await orcamento.save()

    // Enviar notificação se habilitado
    await budgetRenewalService.enviarNotificacaoRenovacao(orcamento, estatisticas)

    res.json({
      success: true,
      message: 'Orçamento renovado com sucesso',
      data: {
        orcamento,
        estatisticasPeriodoAnterior: estatisticas
      }
    })

  } catch (error) {
    console.error('Erro ao renovar orçamento:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/budgets/renewal/report:
 *   get:
 *     summary: Relatório de renovações do usuário
 *     tags: [Budget Renewal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: number
 *           default: 30
 *         description: Número de dias para o relatório
 *     responses:
 *       200:
 *         description: Relatório de renovações
 */
router.get('/report', async (req, res) => {
  try {
    const periodo = parseInt(req.query.periodo) || 30
    const relatorio = await budgetRenewalService.relatorioRenovacoes(req.userId, periodo)

    res.json({
      success: true,
      data: relatorio
    })

  } catch (error) {
    console.error('Erro ao gerar relatório:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/budgets/renewal/pending:
 *   get:
 *     summary: Listar orçamentos pendentes de renovação
 *     tags: [Budget Renewal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de orçamentos vencidos com renovação automática
 */
router.get('/pending', async (req, res) => {
  try {
    const agora = new Date()
    
    const orcamentosPendentes = await Budget.find({
      userId: req.userId,
      dataFim: { $lt: agora },
      renovacaoAutomatica: true,
      status: { $in: ['ativo', 'excedido'] }
    }).sort({ dataFim: 1 })

    const pendentes = orcamentosPendentes.map(orcamento => {
      const estatisticas = budgetRenewalService.calcularEstatisticasPeriodo(orcamento)
      const diasVencido = Math.ceil((agora - orcamento.dataFim) / (1000 * 60 * 60 * 24))
      
      return {
        _id: orcamento._id,
        nome: orcamento.nome,
        dataFim: orcamento.dataFim,
        diasVencido,
        periodo: orcamento.periodo,
        valorLimite: orcamento.valorLimite,
        estatisticas,
        podeRenovar: budgetRenewalService.isPeriodoRenovavel(orcamento.periodo)
      }
    })

    res.json({
      success: true,
      data: {
        total: pendentes.length,
        orcamentos: pendentes
      }
    })

  } catch (error) {
    console.error('Erro ao buscar orçamentos pendentes:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/budgets/renewal/settings/{id}:
 *   patch:
 *     summary: Atualizar configurações de renovação de um orçamento
 *     tags: [Budget Renewal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               renovacaoAutomatica:
 *                 type: boolean
 *               configuracoes:
 *                 type: object
 *                 properties:
 *                   rollover:
 *                     type: boolean
 *                     description: Transferir saldo restante para próximo período
 *                   ajusteAutomatico:
 *                     type: boolean
 *                     description: Ajustar limite baseado na média de gastos
 *                   notificacoes:
 *                     type: object
 *                     properties:
 *                       email:
 *                         type: boolean
 *                       push:
 *                         type: boolean
 *     responses:
 *       200:
 *         description: Configurações atualizadas
 */
router.patch('/settings/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    // Validar campos
    const allowedFields = ['renovacaoAutomatica', 'configuracoes']
    const updateFields = {}

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields[field] = updates[field]
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Nenhum campo válido para atualizar' 
      })
    }

    const orcamento = await Budget.findOneAndUpdate(
      { _id: id, userId: req.userId },
      updateFields,
      { new: true }
    )

    if (!orcamento) {
      return res.status(404).json({ 
        success: false,
        error: 'Orçamento não encontrado' 
      })
    }

    // Adicionar ao histórico
    orcamento.adicionarHistorico('configuracao_alterada', null, 
      `Configurações de renovação atualizadas`)
    await orcamento.save()

    res.json({
      success: true,
      message: 'Configurações de renovação atualizadas com sucesso',
      data: orcamento
    })

  } catch (error) {
    console.error('Erro ao atualizar configurações:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    })
  }
})

module.exports = router