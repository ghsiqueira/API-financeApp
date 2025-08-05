// routes/transactions.js - SISTEMA MOCKADO INDEPENDENTE (como budgets)
const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const jwt = require('jsonwebtoken')

// Mock de transações (similar ao sistema de orçamentos)
let transactions = [
  {
    _id: '1',
    userId: '1754097538803.4392', // Mesmo userId do JWT
    tipo: 'despesa',
    descricao: 'Almoço',
    valor: 25.50,
    categoria: '1',
    metodoPagamento: 'cartao_debito',
    data: new Date(),
    observacoes: 'Teste inicial',
    orcamentoId: '',
    tags: [],
    recorrente: {
      ativo: false,
      tipo: 'mensal',
      dataInicio: new Date(),
      dataFim: new Date(),
      intervalo: 1
    },
    criadoEm: new Date(),
    atualizadoEm: new Date()
  }
]

// Mock de usuários (mesmo que está funcionando nos orçamentos)
const mockUsers = [
  {
    _id: '1',
    nome: 'Gabriel',
    email: 'admin@financeapp.com',
    senhaHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1VpJUjJC3a'
  },
  {
    _id: '1754097538803.4392',
    nome: 'Teste',
    email: 'teste@teste.com',
    senhaHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1VpJUjJC3a'
  }
]

// 🔥 FUNÇÃO PARA CRIAR USUÁRIO AUTOMATICAMENTE
const createUserIfNotExists = (userId, email) => {
  let user = mockUsers.find(u => u._id === userId || u._id.toString() === userId)
  
  if (!user) {
    console.log('🆕 [TRANSACTIONS] Criando usuário automaticamente:', { userId, email })
    
    const newUser = {
      _id: userId,
      nome: email ? email.split('@')[0] : 'Usuário',
      email: email || `user${userId}@app.com`,
      senhaHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1VpJUjJC3a'
    }
    
    mockUsers.push(newUser)
    user = newUser
    
    console.log('✅ [TRANSACTIONS] Usuário criado automaticamente')
  }
  
  return user
}

// 🔥 MIDDLEWARE DE AUTENTICAÇÃO INDEPENDENTE (não depende de outros arquivos)
const transactionsAuth = (req, res, next) => {
  console.log('🔐 [TRANSACTIONS] Auth middleware iniciado')
  
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader

    if (!token) {
      console.log('❌ [TRANSACTIONS] Token não fornecido')
      return res.status(401).json({ 
        error: 'Token de acesso não fornecido',
        code: 'NO_TOKEN'
      })
    }

    // Verificar e decodificar token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
      console.log('🔍 [TRANSACTIONS] JWT decoded:', { userId: decoded.userId, email: decoded.email })
    } catch (err) {
      console.log('❌ [TRANSACTIONS] Erro na verificação do token:', err.message)
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expirado',
          code: 'TOKEN_EXPIRED'
        })
      } else {
        return res.status(401).json({ 
          error: 'Token inválido',
          code: 'INVALID_TOKEN'
        })
      }
    }

    // Extrair dados do token
    const userIdFromToken = decoded.userId || decoded.id
    const emailFromToken = decoded.email
    console.log('👤 [TRANSACTIONS] Buscando usuário com ID:', userIdFromToken)

    if (!userIdFromToken) {
      return res.status(401).json({ 
        error: 'ID do usuário não encontrado no token',
        code: 'NO_USER_ID_IN_TOKEN'
      })
    }

    // 🔥 BUSCAR USUÁRIO NO SISTEMA MOCKADO
    let user = mockUsers.find(u => u._id === userIdFromToken || u._id.toString() === userIdFromToken)
    
    if (!user) {
      console.log('❌ [TRANSACTIONS] Usuário não encontrado, criando automaticamente')
      user = createUserIfNotExists(userIdFromToken, emailFromToken)
    }

    if (!user) {
      console.log('❌ [TRANSACTIONS] Falha ao criar/encontrar usuário')
      return res.status(401).json({ 
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      })
    }

    // Adicionar informações do usuário à requisição
    req.userId = user._id
    req.user = user

    console.log('✅ [TRANSACTIONS] Autenticação bem-sucedida para:', user.email)
    next()

  } catch (err) {
    console.error('❌ [TRANSACTIONS] Erro no middleware de autenticação:', err)
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    })
  }
}

// Aplicar auth em todas as rotas
router.use(transactionsAuth)

// Validações
const transactionValidation = [
  body('tipo')
    .isIn(['receita', 'despesa'])
    .withMessage('Tipo deve ser receita ou despesa'),
  
  body('descricao')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Descrição deve ter entre 1 e 200 caracteres'),
  
  body('valor')
    .isNumeric()
    .custom(value => {
      if (parseFloat(value) <= 0) {
        throw new Error('Valor deve ser maior que 0')
      }
      return true
    }),
  
  body('categoria')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Categoria é obrigatória'),
  
  body('metodoPagamento')
    .isIn(['dinheiro', 'cartao_debito', 'cartao_credito', 'pix', 'transferencia', 'boleto', 'cheque'])
    .withMessage('Método de pagamento inválido')
]

/**
 * GET /api/transactions
 * Listar todas as transações do usuário
 */
router.get('/', (req, res) => {
  console.log('📋 [TRANSACTIONS] GET /transactions - userId:', req.userId)
  
  try {
    // Filtrar transações do usuário logado
    const userTransactions = transactions.filter(t => t.userId === req.userId)
    
    // Calcular resumo
    const resumo = {
      totalReceitas: 0,
      totalDespesas: 0,
      saldo: 0,
      totalTransacoes: userTransactions.length
    }
    
    userTransactions.forEach(t => {
      if (t.tipo === 'receita') {
        resumo.totalReceitas += t.valor
      } else {
        resumo.totalDespesas += t.valor
      }
    })
    
    resumo.saldo = resumo.totalReceitas - resumo.totalDespesas
    
    console.log('✅ [TRANSACTIONS] Retornando', userTransactions.length, 'transações')
    
    res.json({
      success: true,
      data: {
        transacoes: userTransactions,
        resumo,
        total: userTransactions.length
      }
    })
    
  } catch (error) {
    console.error('❌ [TRANSACTIONS] Erro ao buscar transações:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * POST /api/transactions
 * Criar nova transação
 */
router.post('/', transactionValidation, (req, res) => {
  console.log('💾 [TRANSACTIONS] POST /transactions - userId:', req.userId)
  console.log('📝 [TRANSACTIONS] Dados recebidos:', req.body)
  
  try {
    // Verificar erros de validação
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      console.log('❌ [TRANSACTIONS] Erros de validação:', errors.array())
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      })
    }

    // Criar nova transação
    const novaTransacao = {
      _id: (Date.now() + Math.random()).toString(),
      userId: req.userId,
      tipo: req.body.tipo,
      descricao: req.body.descricao.trim(),
      valor: parseFloat(req.body.valor),
      categoria: req.body.categoria,
      metodoPagamento: req.body.metodoPagamento,
      data: req.body.data ? new Date(req.body.data) : new Date(),
      observacoes: req.body.observacoes || '',
      orcamentoId: req.body.orcamentoId || '',
      tags: req.body.tags || [],
      recorrente: req.body.recorrente || {
        ativo: false,
        tipo: 'mensal',
        dataInicio: new Date(),
        dataFim: new Date(),
        intervalo: 1
      },
      criadoEm: new Date(),
      atualizadoEm: new Date()
    }

    // Adicionar à lista
    transactions.push(novaTransacao)
    
    console.log('✅ [TRANSACTIONS] Transação criada com ID:', novaTransacao._id)
    console.log('📊 [TRANSACTIONS] Total de transações:', transactions.length)

    res.status(201).json({
      success: true,
      message: 'Transação criada com sucesso',
      data: novaTransacao
    })

  } catch (error) {
    console.error('❌ [TRANSACTIONS] Erro ao criar transação:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * GET /api/transactions/:id
 * Buscar transação por ID
 */
router.get('/:id', (req, res) => {
  console.log('🔍 [TRANSACTIONS] GET /transactions/:id - ID:', req.params.id)
  
  try {
    const transacao = transactions.find(t => 
      t._id === req.params.id && t.userId === req.userId
    )

    if (!transacao) {
      return res.status(404).json({
        success: false,
        error: 'Transação não encontrada'
      })
    }

    res.json({
      success: true,
      data: transacao
    })

  } catch (error) {
    console.error('❌ [TRANSACTIONS] Erro ao buscar transação:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * PUT /api/transactions/:id
 * Atualizar transação
 */
router.put('/:id', transactionValidation, (req, res) => {
  console.log('✏️ [TRANSACTIONS] PUT /transactions/:id - ID:', req.params.id)
  
  try {
    // Verificar erros de validação
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      })
    }

    const index = transactions.findIndex(t => 
      t._id === req.params.id && t.userId === req.userId
    )

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Transação não encontrada'
      })
    }

    // Atualizar transação
    transactions[index] = {
      ...transactions[index],
      tipo: req.body.tipo,
      descricao: req.body.descricao.trim(),
      valor: parseFloat(req.body.valor),
      categoria: req.body.categoria,
      metodoPagamento: req.body.metodoPagamento,
      data: req.body.data ? new Date(req.body.data) : transactions[index].data,
      observacoes: req.body.observacoes || '',
      orcamentoId: req.body.orcamentoId || '',
      tags: req.body.tags || [],
      recorrente: req.body.recorrente || transactions[index].recorrente,
      atualizadoEm: new Date()
    }

    console.log('✅ [TRANSACTIONS] Transação atualizada')

    res.json({
      success: true,
      message: 'Transação atualizada com sucesso',
      data: transactions[index]
    })

  } catch (error) {
    console.error('❌ [TRANSACTIONS] Erro ao atualizar transação:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * DELETE /api/transactions/:id
 * Excluir transação
 */
router.delete('/:id', (req, res) => {
  console.log('🗑️ [TRANSACTIONS] DELETE /transactions/:id - ID:', req.params.id)
  
  try {
    const index = transactions.findIndex(t => 
      t._id === req.params.id && t.userId === req.userId
    )

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Transação não encontrada'
      })
    }

    // Remover transação
    const transacaoRemovida = transactions.splice(index, 1)[0]
    
    console.log('✅ [TRANSACTIONS] Transação removida')

    res.json({
      success: true,
      message: 'Transação removida com sucesso',
      data: transacaoRemovida
    })

  } catch (error) {
    console.error('❌ [TRANSACTIONS] Erro ao remover transação:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

// Rota de teste
router.get('/test/debug', (req, res) => {
  res.json({
    message: 'Sistema de transações mockado funcionando!',
    userId: req.userId,
    totalTransactions: transactions.length,
    userTransactions: transactions.filter(t => t.userId === req.userId).length,
    totalUsers: mockUsers.length,
    endpoints: [
      'GET /api/transactions',
      'POST /api/transactions',
      'GET /api/transactions/:id',
      'PUT /api/transactions/:id',
      'DELETE /api/transactions/:id'
    ]
  })
})

module.exports = router