// routes/budgets.js - Completo
const express = require('express')
const router = express.Router()

// Mock de orçamentos (em produção seria um modelo do MongoDB)
let budgets = [
  {
    _id: '1',
    userId: '1',
    nome: 'Alimentação Dezembro',
    categoria: '1', // ID da categoria Alimentação
    valorLimite: 800,
    valorGasto: 450.50,
    periodo: 'mensal',
    dataInicio: new Date('2024-12-01'),
    dataFim: new Date('2024-12-31'),
    cor: '#FF5722',
    icone: 'restaurant',
    status: 'ativo',
    renovacaoAutomatica: true,
    ultimaRenovacao: null,
    configuracoes: {
      alertas: {
        ativo: true,
        porcentagens: [50, 80, 90, 100],
        email: true,
        push: true
      },
      renovacao: {
        rollover: false,
        ajusteAutomatico: false,
        percentualAjuste: 0,
        notificarRenovacao: true
      }
    },
    estatisticasRenovacao: {
      totalRenovacoes: 0,
      mediaGastosPorPeriodo: 0,
      melhorPerformance: null,
      piorPerformance: null
    },
    historico: [
      {
        data: new Date('2024-12-01'),
        acao: 'criado',
        valor: 800,
        observacao: 'Orçamento criado',
        usuarioId: '1'
      }
    ],
    criadoEm: new Date('2024-12-01'),
    atualizadoEm: new Date('2024-12-01')
  },
  {
    _id: '2',
    userId: '1',
    nome: 'Transporte',
    categoria: '2', // ID da categoria Transporte
    valorLimite: 400,
    valorGasto: 120.00,
    periodo: 'mensal',
    dataInicio: new Date('2024-12-01'),
    dataFim: new Date('2024-12-31'),
    cor: '#607D8B',
    icone: 'car',
    status: 'ativo',
    renovacaoAutomatica: false,
    ultimaRenovacao: null,
    configuracoes: {
      alertas: {
        ativo: true,
        porcentagens: [80, 100],
        email: true,
        push: false
      },
      renovacao: {
        rollover: true,
        ajusteAutomatico: false,
        percentualAjuste: 0,
        notificarRenovacao: true
      }
    },
    estatisticasRenovacao: {
      totalRenovacoes: 0,
      mediaGastosPorPeriodo: 0,
      melhorPerformance: null,
      piorPerformance: null
    },
    historico: [
      {
        data: new Date('2024-12-01'),
        acao: 'criado',
        valor: 400,
        observacao: 'Orçamento criado',
        usuarioId: '1'
      }
    ],
    criadoEm: new Date('2024-12-01'),
    atualizadoEm: new Date('2024-12-01')
  }
]

// Middleware para simular autenticação
const mockAuth = (req, res, next) => {
  // Em produção seria um middleware real de JWT
  req.userId = '1' // Simular usuário logado
  next()
}

// Aplicar auth em todas as rotas
router.use(mockAuth)

// Função para calcular campos virtuais
const calcularCamposVirtuais = (budget) => {
  const porcentagemGasta = budget.valorLimite > 0 ? 
    Math.round((budget.valorGasto / budget.valorLimite) * 100) : 0
  
  const valorRestante = Math.max(0, budget.valorLimite - budget.valorGasto)
  
  const agora = new Date()
  const diffTime = budget.dataFim - agora
  const diasRestantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  
  const vencido = agora > budget.dataFim

  return {
    ...budget,
    porcentagemGasta,
    valorRestante,
    diasRestantes,
    vencido
  }
}

/**
 * @swagger
 * /api/budgets:
 *   get:
 *     summary: Listar orçamentos do usuário
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ativo, pausado, finalizado, excedido]
 *         description: Filtrar por status
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *         description: Filtrar por categoria
 *     responses:
 *       200:
 *         description: Lista de orçamentos com resumo
 */
router.get('/', (req, res) => {
  try {
    const { status, categoria } = req.query
    
    // Filtrar orçamentos do usuário
    let userBudgets = budgets.filter(budget => budget.userId === req.userId)
    
    // Aplicar filtros
    if (status) {
      userBudgets = userBudgets.filter(budget => budget.status === status)
    }
    
    if (categoria) {
      userBudgets = userBudgets.filter(budget => budget.categoria === categoria)
    }
    
    // Calcular campos virtuais
    const orcamentosComCalculos = userBudgets.map(calcularCamposVirtuais)
    
    // Calcular resumo
    const resumo = {
      totalLimite: orcamentosComCalculos.reduce((sum, b) => sum + b.valorLimite, 0),
      totalGasto: orcamentosComCalculos.reduce((sum, b) => sum + b.valorGasto, 0),
      totalRestante: orcamentosComCalculos.reduce((sum, b) => sum + b.valorRestante, 0),
      excedidos: orcamentosComCalculos.filter(b => b.porcentagemGasta >= 100).length,
      emAlerta: orcamentosComCalculos.filter(b => b.porcentagemGasta >= 80 && b.porcentagemGasta < 100).length,
      vencendoEm7Dias: orcamentosComCalculos.filter(b => b.diasRestantes <= 7 && b.diasRestantes > 0).length,
      comRenovacaoAutomatica: orcamentosComCalculos.filter(b => b.renovacaoAutomatica).length
    }
    
    res.json({
      success: true,
      data: {
        orcamentos: orcamentosComCalculos,
        resumo,
        total: orcamentosComCalculos.length
      }
    })
    
  } catch (error) {
    console.error('Erro ao buscar orçamentos:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/budgets/{id}:
 *   get:
 *     summary: Buscar orçamento por ID
 *     tags: [Budgets]
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
 *         description: Orçamento encontrado
 *       404:
 *         description: Orçamento não encontrado
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params
    
    const budget = budgets.find(b => b._id === id && b.userId === req.userId)
    if (!budget) {
      return res.status(404).json({
        success: false,
        error: 'Orçamento não encontrado'
      })
    }
    
    const budgetComCalculos = calcularCamposVirtuais(budget)
    
    res.json({
      success: true,
      data: budgetComCalculos
    })
    
  } catch (error) {
    console.error('Erro ao buscar orçamento:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/budgets:
 *   post:
 *     summary: Criar novo orçamento
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - categoria
 *               - valorLimite
 *               - periodo
 *               - dataInicio
 *               - dataFim
 *             properties:
 *               nome:
 *                 type: string
 *               categoria:
 *                 type: string
 *               valorLimite:
 *                 type: number
 *               periodo:
 *                 type: string
 *               dataInicio:
 *                 type: string
 *               dataFim:
 *                 type: string
 *               renovacaoAutomatica:
 *                 type: boolean
 *               cor:
 *                 type: string
 *               icone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Orçamento criado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/', (req, res) => {
  try {
    const {
      nome,
      categoria,
      valorLimite,
      periodo,
      dataInicio,
      dataFim,
      renovacaoAutomatica = false,
      cor = '#007AFF',
      icone = 'wallet',
      descricao = ''
    } = req.body
    
    // Validações
    if (!nome || !categoria || !valorLimite || !periodo || !dataInicio || !dataFim) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: nome, categoria, valorLimite, periodo, dataInicio, dataFim'
      })
    }
    
    if (valorLimite <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valor limite deve ser maior que zero'
      })
    }
    
    if (new Date(dataFim) <= new Date(dataInicio)) {
      return res.status(400).json({
        success: false,
        error: 'Data fim deve ser posterior à data início'
      })
    }
    
    // Verificar se já existe orçamento para a mesma categoria no período
    const periodoConflito = budgets.find(b => 
      b.userId === req.userId &&
      b.categoria === categoria &&
      b.status === 'ativo' &&
      (
        (new Date(dataInicio) >= new Date(b.dataInicio) && new Date(dataInicio) <= new Date(b.dataFim)) ||
        (new Date(dataFim) >= new Date(b.dataInicio) && new Date(dataFim) <= new Date(b.dataFim))
      )
    )
    
    if (periodoConflito) {
      return res.status(400).json({
        success: false,
        error: 'Já existe um orçamento ativo para esta categoria no período especificado'
      })
    }
    
    const novoBudget = {
      _id: (Date.now() + Math.random()).toString(),
      userId: req.userId,
      nome: nome.trim(),
      categoria,
      valorLimite: parseFloat(valorLimite),
      valorGasto: 0,
      periodo,
      dataInicio: new Date(dataInicio),
      dataFim: new Date(dataFim),
      cor,
      icone,
      status: 'ativo',
      renovacaoAutomatica,
      ultimaRenovacao: null,
      configuracoes: {
        alertas: {
          ativo: true,
          porcentagens: [50, 80, 90, 100],
          email: true,
          push: true
        },
        renovacao: {
          rollover: false,
          ajusteAutomatico: false,
          percentualAjuste: 0,
          notificarRenovacao: true
        }
      },
      estatisticasRenovacao: {
        totalRenovacoes: 0,
        mediaGastosPorPeriodo: 0,
        melhorPerformance: null,
        piorPerformance: null
      },
      historico: [
        {
          data: new Date(),
          acao: 'criado',
          valor: parseFloat(valorLimite),
          observacao: 'Orçamento criado',
          usuarioId: req.userId
        }
      ],
      descricao,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    }
    
    budgets.push(novoBudget)
    
    const budgetComCalculos = calcularCamposVirtuais(novoBudget)
    
    res.status(201).json({
      success: true,
      message: 'Orçamento criado com sucesso',
      data: budgetComCalculos
    })
    
  } catch (error) {
    console.error('Erro ao criar orçamento:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/budgets/{id}:
 *   put:
 *     summary: Atualizar orçamento
 *     tags: [Budgets]
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
 *             $ref: '#/components/schemas/Budget'
 *     responses:
 *       200:
 *         description: Orçamento atualizado
 *       404:
 *         description: Orçamento não encontrado
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    const budgetIndex = budgets.findIndex(b => b._id === id && b.userId === req.userId)
    if (budgetIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Orçamento não encontrado'
      })
    }
    
    const budget = budgets[budgetIndex]
    const valorLimiteAntigo = budget.valorLimite
    
    // Aplicar atualizações
    const camposPermitidos = [
      'nome', 'categoria', 'valorLimite', 'periodo', 'dataInicio', 'dataFim',
      'cor', 'icone', 'renovacaoAutomatica', 'configuracoes', 'descricao'
    ]
    
    camposPermitidos.forEach(campo => {
      if (updates[campo] !== undefined) {
        if (campo === 'dataInicio' || campo === 'dataFim') {
          budget[campo] = new Date(updates[campo])
        } else {
          budget[campo] = updates[campo]
        }
      }
    })
    
    // Validar datas se foram alteradas
    if (budget.dataInicio >= budget.dataFim) {
      return res.status(400).json({
        success: false,
        error: 'Data de início deve ser anterior à data de fim'
      })
    }
    
    // Adicionar ao histórico se valor limite mudou
    if (updates.valorLimite && updates.valorLimite !== valorLimiteAntigo) {
      budget.historico.push({
        data: new Date(),
        acao: 'limite_alterado',
        valor: updates.valorLimite,
        observacao: `Limite alterado de R$ ${valorLimiteAntigo.toFixed(2)} para R$ ${updates.valorLimite.toFixed(2)}`,
        usuarioId: req.userId
      })
    }
    
    budget.atualizadoEm = new Date()
    budgets[budgetIndex] = budget
    
    const budgetComCalculos = calcularCamposVirtuais(budget)
    
    res.json({
      success: true,
      message: 'Orçamento atualizado com sucesso',
      data: budgetComCalculos
    })
    
  } catch (error) {
    console.error('Erro ao atualizar orçamento:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/budgets/{id}/pausar:
 *   put:
 *     summary: Pausar orçamento
 *     tags: [Budgets]
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
 *         description: Orçamento pausado
 *       404:
 *         description: Orçamento não encontrado
 */
router.put('/:id/pausar', (req, res) => {
  try {
    const { id } = req.params
    
    const budgetIndex = budgets.findIndex(b => b._id === id && b.userId === req.userId)
    if (budgetIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Orçamento não encontrado'
      })
    }
    
    const budget = budgets[budgetIndex]
    budget.status = 'pausado'
    budget.atualizadoEm = new Date()
    
    budget.historico.push({
      data: new Date(),
      acao: 'pausado',
      observacao: 'Orçamento pausado pelo usuário',
      usuarioId: req.userId
    })
    
    budgets[budgetIndex] = budget
    
    const budgetComCalculos = calcularCamposVirtuais(budget)
    
    res.json({
      success: true,
      message: 'Orçamento pausado com sucesso',
      data: budgetComCalculos
    })
    
  } catch (error) {
    console.error('Erro ao pausar orçamento:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/budgets/{id}/reativar:
 *   put:
 *     summary: Reativar orçamento
 *     tags: [Budgets]
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
 *         description: Orçamento reativado
 *       404:
 *         description: Orçamento não encontrado
 */
router.put('/:id/reativar', (req, res) => {
  try {
    const { id } = req.params
    
    const budgetIndex = budgets.findIndex(b => b._id === id && b.userId === req.userId)
    if (budgetIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Orçamento não encontrado'
      })
    }
    
    const budget = budgets[budgetIndex]
    budget.status = 'ativo'
    budget.atualizadoEm = new Date()
    
    budget.historico.push({
      data: new Date(),
      acao: 'reativado',
      observacao: 'Orçamento reativado pelo usuário',
      usuarioId: req.userId
    })
    
    budgets[budgetIndex] = budget
    
    const budgetComCalculos = calcularCamposVirtuais(budget)
    
    res.json({
      success: true,
      message: 'Orçamento reativado com sucesso',
      data: budgetComCalculos
    })
    
  } catch (error) {
    console.error('Erro ao reativar orçamento:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/budgets/{id}:
 *   delete:
 *     summary: Excluir orçamento
 *     tags: [Budgets]
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
 *         description: Orçamento excluído
 *       404:
 *         description: Orçamento não encontrado
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params
    
    const budgetIndex = budgets.findIndex(b => b._id === id && b.userId === req.userId)
    if (budgetIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Orçamento não encontrado'
      })
    }
    
    const budgetRemovido = budgets.splice(budgetIndex, 1)[0]
    
    res.json({
      success: true,
      message: 'Orçamento removido com sucesso',
      data: budgetRemovido
    })
    
  } catch (error) {
    console.error('Erro ao remover orçamento:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

// Rota de teste
router.get('/test/debug', (req, res) => {
  const userBudgets = budgets.filter(b => b.userId === req.userId)
  const orcamentosComCalculos = userBudgets.map(calcularCamposVirtuais)
  
  res.json({
    message: 'Rota de orçamentos funcionando!',
    estatisticas: {
      totalOrcamentos: orcamentosComCalculos.length,
      ativos: orcamentosComCalculos.filter(b => b.status === 'ativo').length,
      pausados: orcamentosComCalculos.filter(b => b.status === 'pausado').length,
      excedidos: orcamentosComCalculos.filter(b => b.porcentagemGasta >= 100).length,
      comRenovacaoAutomatica: orcamentosComCalculos.filter(b => b.renovacaoAutomatica).length
    },
    orcamentos: orcamentosComCalculos,
    endpoints: [
      'GET /api/budgets',
      'GET /api/budgets/:id',
      'POST /api/budgets',
      'PUT /api/budgets/:id',
      'PUT /api/budgets/:id/pausar',
      'PUT /api/budgets/:id/reativar',
      'DELETE /api/budgets/:id'
    ]
  })
})

module.exports = router