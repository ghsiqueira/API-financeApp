const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Transaction = require('../models/Transaction')
const Budget = require('../models/Budget')
const Goal = require('../models/Goal')
const bcrypt = require('bcrypt')
const authMiddleware = require('../middleware/authMiddleware')
const { updateProfileValidation, changePasswordValidation } = require('../middleware/validation')
const { validationResult } = require('express-validator')

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware)

/**
 * @swagger
 * tags:
 *   name: User
 *   description: Gestão de perfil do usuário
 */

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Obter perfil do usuário com estatísticas
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil do usuário
 */
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-senhaHash -codigoResetSenha -resetSenhaExpira')
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuário não encontrado' 
      })
    }

    // Calcular estatísticas do mês atual
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
    
    const [transacoesCount, budgetsCount, goalsCount, saldoMensal] = await Promise.all([
      Transaction.countDocuments({ userId: req.userId }),
      Budget.countDocuments({ userId: req.userId }),
      Goal.countDocuments({ userId: req.userId }),
      Transaction.aggregate([
        {
          $match: {
            userId: user._id,
            data: { $gte: inicioMes, $lte: fimMes }
          }
        },
        {
          $group: {
            _id: '$tipo',
            total: { $sum: '$valor' }
          }
        }
      ])
    ])

    const receitas = saldoMensal.find(s => s._id === 'receita')?.total || 0
    const despesas = saldoMensal.find(s => s._id === 'despesa')?.total || 0

    const estatisticas = {
      totalTransacoes: transacoesCount,
      totalOrcamentos: budgetsCount,
      totalMetas: goalsCount,
      saldoMensal: receitas - despesas,
      receitasMes: receitas,
      despesasMes: despesas,
      mesAtual: {
        mes: agora.getMonth() + 1,
        ano: agora.getFullYear()
      }
    }

    res.json({
      success: true,
      data: {
        user: user.toSafeObject(),
        estatisticas
      }
    })

  } catch (err) {
    console.error('Erro ao buscar perfil:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/user/profile:
 *   patch:
 *     summary: Atualizar perfil do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *               configuracoes:
 *                 type: object
 */
router.patch('/profile', updateProfileValidation, async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        detalhes: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      })
    }

    const { nome, email, configuracoes } = req.body
    const updateData = {}

    if (nome) updateData.nome = nome.trim()
    if (email) {
      // Verificar se email já está em uso por outro usuário
      const emailExists = await User.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: req.userId } 
      })
      if (emailExists) {
        return res.status(400).json({
          success: false,
          error: 'Email já está em uso'
        })
      }
      updateData.email = email.toLowerCase()
      updateData.emailVerificado = false // Precisará verificar novamente
    }
    if (configuracoes) updateData.configuracoes = { ...configuracoes }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { ...updateData, atualizadoEm: new Date() },
      { new: true, runValidators: true }
    ).select('-senhaHash -codigoResetSenha -resetSenhaExpira')

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: user.toSafeObject()
    })

  } catch (err) {
    console.error('Erro ao atualizar perfil:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/user/change-password:
 *   post:
 *     summary: Alterar senha do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - senhaAtual
 *               - novaSenha
 *             properties:
 *               senhaAtual:
 *                 type: string
 *               novaSenha:
 *                 type: string
 */
router.post('/change-password', changePasswordValidation, async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        detalhes: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      })
    }

    const { senhaAtual, novaSenha } = req.body

    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      })
    }

    // Verificar senha atual
    const senhaCorreta = await bcrypt.compare(senhaAtual, user.senhaHash)
    if (!senhaCorreta) {
      return res.status(400).json({
        success: false,
        error: 'Senha atual incorreta'
      })
    }

    // Hash da nova senha
    const novaSenhaHash = await bcrypt.hash(novaSenha, 12)

    // Atualizar senha
    await User.findByIdAndUpdate(req.userId, {
      senhaHash: novaSenhaHash,
      atualizadoEm: new Date()
    })

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    })

  } catch (err) {
    console.error('Erro ao alterar senha:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/user/statistics:
 *   get:
 *     summary: Obter estatísticas detalhadas do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [mes, trimestre, semestre, ano]
 *         description: Período para as estatísticas
 */
router.get('/statistics', async (req, res) => {
  try {
    const { periodo = 'mes' } = req.query
    
    // Calcular datas baseado no período
    const agora = new Date()
    let dataInicio = new Date()
    
    switch (periodo) {
      case 'mes':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
        break
      case 'trimestre':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth() - 3, 1)
        break
      case 'semestre':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth() - 6, 1)
        break
      case 'ano':
        dataInicio = new Date(agora.getFullYear(), 0, 1)
        break
      default:
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
    }

    // Buscar estatísticas
    const [transacoes, orcamentos, metas] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId: req.user._id,
            data: { $gte: dataInicio, $lte: agora }
          }
        },
        {
          $group: {
            _id: {
              tipo: '$tipo',
              mes: { $month: '$data' },
              ano: { $year: '$data' }
            },
            total: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        }
      ]),
      Budget.find({ 
        userId: req.userId,
        'periodo.dataInicio': { $lte: agora },
        'periodo.dataFim': { $gte: dataInicio }
      }),
      Goal.find({ 
        userId: req.userId,
        dataInicio: { $lte: agora }
      })
    ])

    // Processar dados das transações
    const receitas = transacoes.filter(t => t._id.tipo === 'receita')
    const despesas = transacoes.filter(t => t._id.tipo === 'despesa')
    
    const totalReceitas = receitas.reduce((sum, t) => sum + t.total, 0)
    const totalDespesas = despesas.reduce((sum, t) => sum + t.total, 0)
    const saldoTotal = totalReceitas - totalDespesas

    // Estatísticas dos orçamentos
    const orcamentosAtivos = orcamentos.filter(o => o.status === 'ativo')
    const orcamentosExcedidos = orcamentos.filter(o => o.valorGasto > o.valorLimite)

    // Estatísticas das metas
    const metasAtivas = metas.filter(m => m.status === 'ativa')
    const metasConcluidas = metas.filter(m => m.status === 'concluida')

    const estatisticas = {
      periodo: {
        tipo: periodo,
        dataInicio,
        dataFim: agora
      },
      transacoes: {
        totalReceitas,
        totalDespesas,
        saldoTotal,
        quantidadeReceitas: receitas.reduce((sum, t) => sum + t.count, 0),
        quantidadeDespesas: despesas.reduce((sum, t) => sum + t.count, 0)
      },
      orcamentos: {
        total: orcamentos.length,
        ativos: orcamentosAtivos.length,
        excedidos: orcamentosExcedidos.length,
        percentualUtilizacao: orcamentosAtivos.length > 0 
          ? (orcamentosAtivos.reduce((sum, o) => sum + (o.valorGasto / o.valorLimite * 100), 0) / orcamentosAtivos.length)
          : 0
      },
      metas: {
        total: metas.length,
        ativas: metasAtivas.length,
        concluidas: metasConcluidas.length,
        progressoMedio: metasAtivas.length > 0
          ? (metasAtivas.reduce((sum, m) => sum + m.porcentagemConcluida, 0) / metasAtivas.length)
          : 0
      }
    }

    res.json({
      success: true,
      data: estatisticas
    })

  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/user/settings:
 *   patch:
 *     summary: Atualizar apenas configurações do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tema:
 *                 type: string
 *                 enum: [claro, escuro, sistema]
 *               moeda:
 *                 type: string
 *               notificacoes:
 *                 type: object
 */
router.patch('/settings', async (req, res) => {
  try {
    const configuracoes = req.body
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        $set: { 
          'configuracoes': { ...configuracoes },
          atualizadoEm: new Date()
        }
      },
      { new: true, runValidators: true }
    ).select('-senhaHash -codigoResetSenha -resetSenhaExpira')

    res.json({
      success: true,
      message: 'Configurações atualizadas com sucesso',
      data: user.toSafeObject()
    })

  } catch (err) {
    console.error('Erro ao atualizar configurações:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/user/delete-account:
 *   delete:
 *     summary: Excluir conta do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - senha
 *               - confirmacao
 *             properties:
 *               senha:
 *                 type: string
 *               confirmacao:
 *                 type: string
 *                 example: "EXCLUIR CONTA"
 */
router.delete('/delete-account', async (req, res) => {
  try {
    const { senha, confirmacao } = req.body

    if (!senha || !confirmacao) {
      return res.status(400).json({
        success: false,
        error: 'Senha e confirmação são obrigatórias'
      })
    }

    if (confirmacao !== 'EXCLUIR CONTA') {
      return res.status(400).json({
        success: false,
        error: 'Digite "EXCLUIR CONTA" para confirmar'
      })
    }

    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      })
    }

    // Verificar senha
    const senhaCorreta = await bcrypt.compare(senha, user.senhaHash)
    if (!senhaCorreta) {
      return res.status(400).json({
        success: false,
        error: 'Senha incorreta'
      })
    }

    // Excluir todos os dados do usuário
    await Promise.all([
      Transaction.deleteMany({ userId: req.userId }),
      Budget.deleteMany({ userId: req.userId }),
      Goal.deleteMany({ userId: req.userId }),
      Category.deleteMany({ userId: req.userId, padrao: false }),
      User.findByIdAndDelete(req.userId)
    ])

    res.json({
      success: true,
      message: 'Conta excluída com sucesso'
    })

  } catch (err) {
    console.error('Erro ao excluir conta:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/user/export:
 *   get:
 *     summary: Exportar dados do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formato
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Formato de exportação
 *       - in: query
 *         name: incluir
 *         schema:
 *           type: string
 *           enum: [todos, transacoes, orcamentos, metas]
 *         description: Dados a incluir
 */
router.get('/export', async (req, res) => {
  try {
    const { formato = 'json', incluir = 'todos' } = req.query
    
    const dadosExportacao = {
      usuario: req.user.toSafeObject(),
      dataExportacao: new Date(),
      formato
    }

    if (incluir === 'todos' || incluir === 'transacoes') {
      dadosExportacao.transacoes = await Transaction.find({ userId: req.userId }).lean()
    }

    if (incluir === 'todos' || incluir === 'orcamentos') {
      dadosExportacao.orcamentos = await Budget.find({ userId: req.userId }).lean()
    }

    if (incluir === 'todos' || incluir === 'metas') {
      dadosExportacao.metas = await Goal.find({ userId: req.userId }).lean()
    }

    if (incluir === 'todos') {
      dadosExportacao.categorias = await Category.find({ 
        userId: req.userId, 
        padrao: false 
      }).lean()
    }

    if (formato === 'csv') {
      // Implementar conversão para CSV se necessário
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=dados_financeiros.csv')
      
      // Por simplicidade, retornar JSON por enquanto
      res.json({
        success: true,
        message: 'Exportação CSV em desenvolvimento',
        data: dadosExportacao
      })
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', 'attachment; filename=dados_financeiros.json')
      
      res.json({
        success: true,
        data: dadosExportacao
      })
    }

  } catch (err) {
    console.error('Erro ao exportar dados:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/user/dashboard-summary:
 *   get:
 *     summary: Resumo rápido para dashboard
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 */
router.get('/dashboard-summary', async (req, res) => {
  try {
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    
    // Buscar dados do mês atual
    const [transacoesMes, orcamentosAtivos, metasAtivas] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId: req.user._id,
            data: { $gte: inicioMes }
          }
        },
        {
          $group: {
            _id: '$tipo',
            total: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        }
      ]),
      Budget.find({ 
        userId: req.userId,
        status: 'ativo',
        'periodo.dataInicio': { $lte: agora },
        'periodo.dataFim': { $gte: agora }
      }),
      Goal.find({ 
        userId: req.userId,
        status: 'ativa'
      }).limit(3).sort({ prioridade: -1, dataLimite: 1 })
    ])

    const receitas = transacoesMes.find(t => t._id === 'receita')?.total || 0
    const despesas = transacoesMes.find(t => t._id === 'despesa')?.total || 0
    
    // Alertas de orçamento
    const alertasOrcamento = orcamentosAtivos
      .filter(o => (o.valorGasto / o.valorLimite) >= (o.alertas.valor / 100))
      .map(o => ({
        tipo: 'orcamento',
        titulo: `Orçamento ${o.nome}`,
        mensagem: `${Math.round((o.valorGasto / o.valorLimite) * 100)}% utilizado`,
        nivel: o.valorGasto > o.valorLimite ? 'critico' : 'aviso'
      }))

    const resumo = {
      saldoMensal: receitas - despesas,
      receitasMes: receitas,
      despesasMes: despesas,
      orcamentosAtivos: orcamentosAtivos.length,
      orcamentosExcedidos: orcamentosAtivos.filter(o => o.valorGasto > o.valorLimite).length,
      metasAtivas: metasAtivas.length,
      proximasMetas: metasAtivas.slice(0, 3),
      alertas: alertasOrcamento,
      ultimaAtualizacao: agora
    }

    res.json({
      success: true,
      data: resumo
    })

  } catch (err) {
    console.error('Erro ao buscar resumo dashboard:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

module.exports = router