const Transaction = require('../models/Transaction')
const Budget = require('../models/Budget')
const Goal = require('../models/Goal')
const Category = require('../models/Category')
const { validationResult } = require('express-validator')
const mongoose = require('mongoose')

exports.getAll = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      tipo, 
      categoria, 
      dataInicio, 
      dataFim, 
      search,
      metodoPagamento,
      sortBy = 'data',
      sortOrder = 'desc'
    } = req.query

    // Construir filtros
    const filtros = { userId: req.userId }
    
    if (tipo && tipo !== 'todos') filtros.tipo = tipo
    if (categoria) filtros.categoria = categoria
    if (metodoPagamento) filtros.metodoPagamento = metodoPagamento
    
    if (dataInicio || dataFim) {
      filtros.data = {}
      if (dataInicio) filtros.data.$gte = new Date(dataInicio)
      if (dataFim) filtros.data.$lte = new Date(dataFim)
    }
    
    if (search) {
      filtros.$or = [
        { descricao: { $regex: search, $options: 'i' } },
        { observacoes: { $regex: search, $options: 'i' } },
        { 'tags': { $in: [new RegExp(search, 'i')] } }
      ]
    }

    // Configurar paginação
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Configurar ordenação
    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1

    // Buscar transações com paginação
    const [transacoes, total] = await Promise.all([
      Transaction.find(filtros)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Transaction.countDocuments(filtros)
    ])

    // Calcular totais
    const [estatisticas] = await Transaction.aggregate([
      { $match: filtros },
      {
        $group: {
          _id: null,
          totalReceitas: {
            $sum: {
              $cond: [{ $eq: ['$tipo', 'receita'] }, '$valor', 0]
            }
          },
          totalDespesas: {
            $sum: {
              $cond: [{ $eq: ['$tipo', 'despesa'] }, '$valor', 0]
            }
          },
          count: { $sum: 1 }
        }
      }
    ])

    const saldo = estatisticas ? estatisticas.totalReceitas - estatisticas.totalDespesas : 0

    res.json({
      success: true,
      data: {
        transacoes,
        paginacao: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        },
        resumo: {
          totalReceitas: estatisticas?.totalReceitas || 0,
          totalDespesas: estatisticas?.totalDespesas || 0,
          saldo,
          totalTransacoes: total
        }
      }
    })

  } catch (err) {
    console.error('Erro ao buscar transações:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getById = async (req, res) => {
  try {
    const { id } = req.params
    
    const transacao = await Transaction.findOne({
      _id: id,
      userId: req.userId
    })
    
    if (!transacao) {
      return res.status(404).json({ error: 'Transação não encontrada' })
    }
    
    res.json({
      success: true,
      data: transacao
    })
    
  } catch (err) {
    console.error('Erro ao buscar transação:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.create = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados inválidos',
        detalhes: errors.array()
      })
    }

    const transactionData = { ...req.body, userId: req.userId }
    
    // Validar se categoria existe
    const categoria = await Category.findOne({
      $or: [
        { userId: req.userId, nome: transactionData.categoria },
        { padrao: true, nome: transactionData.categoria }
      ],
      ativa: true
    })
    
    if (!categoria) {
      return res.status(400).json({ error: 'Categoria não encontrada' })
    }

    // Criar transação
    const transacao = await Transaction.create(transactionData)

    // Atualizar orçamento se especificado
    if (transactionData.orcamentoId && transactionData.tipo === 'despesa') {
      await Budget.findOneAndUpdate(
        { _id: transactionData.orcamentoId, userId: req.userId },
        { $inc: { valorGasto: transactionData.valor } }
      )
    }

    // Atualizar meta se especificado
    if (transactionData.metaId && transactionData.tipo === 'receita') {
      const meta = await Goal.findOne({
        _id: transactionData.metaId,
        userId: req.userId
      })
      
      if (meta) {
        meta.adicionarContribuicao(transactionData.valor, transactionData.observacoes || '')
        await meta.save()
      }
    }

    // Atualizar estatísticas da categoria
    categoria.atualizarEstatisticas(transactionData.valor, 'adicionar')
    await categoria.save()

    // Criar transações recorrentes se configurado
    if (transactionData.recorrente?.ativo) {
      await criarTransacoesRecorrentes(transacao)
    }

    res.status(201).json({
      success: true,
      message: 'Transação criada com sucesso',
      data: transacao
    })

  } catch (err) {
    console.error('Erro ao criar transação:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.update = async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    // Buscar transação original
    const transacaoOriginal = await Transaction.findOne({
      _id: id,
      userId: req.userId
    })

    if (!transacaoOriginal) {
      return res.status(404).json({ error: 'Transação não encontrada' })
    }

    // Reverter impactos da transação original
    await reverterImpactos(transacaoOriginal)

    // Atualizar transação
    const transacaoAtualizada = await Transaction.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { ...updates, atualizadoEm: new Date() },
      { new: true, runValidators: true }
    )

    // Aplicar novos impactos
    await aplicarImpactos(transacaoAtualizada)

    res.json({
      success: true,
      message: 'Transação atualizada com sucesso',
      data: transacaoAtualizada
    })

  } catch (err) {
    console.error('Erro ao atualizar transação:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.remove = async (req, res) => {
  try {
    const { id } = req.params

    const transacao = await Transaction.findOne({
      _id: id,
      userId: req.userId
    })

    if (!transacao) {
      return res.status(404).json({ error: 'Transação não encontrada' })
    }

    // Reverter impactos antes de deletar
    await reverterImpactos(transacao)

    // Deletar transação
    await Transaction.deleteOne({ _id: id, userId: req.userId })

    res.json({
      success: true,
      message: 'Transação removida com sucesso'
    })

  } catch (err) {
    console.error('Erro ao remover transação:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.bulkCreate = async (req, res) => {
  try {
    const { transacoes } = req.body

    if (!Array.isArray(transacoes) || transacoes.length === 0) {
      return res.status(400).json({ error: 'Lista de transações inválida' })
    }

    // Adicionar userId a todas as transações
    const transacoesComUserId = transacoes.map(t => ({
      ...t,
      userId: req.userId
    }))

    // Criar todas as transações
    const transacoesCriadas = await Transaction.insertMany(transacoesComUserId, {
      ordered: false // Continua mesmo se algumas falharem
    })

    res.status(201).json({
      success: true,
      message: `${transacoesCriadas.length} transações criadas com sucesso`,
      data: transacoesCriadas
    })

  } catch (err) {
    console.error('Erro ao criar transações em lote:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.bulkUpdate = async (req, res) => {
  try {
    const { ids, updates } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs inválidos' })
    }

    const resultado = await Transaction.updateMany(
      { 
        _id: { $in: ids },
        userId: req.userId
      },
      { 
        ...updates,
        atualizadoEm: new Date()
      }
    )

    res.json({
      success: true,
      message: `${resultado.modifiedCount} transações atualizadas`,
      data: {
        matched: resultado.matchedCount,
        modified: resultado.modifiedCount
      }
    })

  } catch (err) {
    console.error('Erro ao atualizar transações em lote:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs inválidos' })
    }

    // Buscar transações antes de deletar para reverter impactos
    const transacoes = await Transaction.find({
      _id: { $in: ids },
      userId: req.userId
    })

    // Reverter impactos de todas as transações
    for (const transacao of transacoes) {
      await reverterImpactos(transacao)
    }

    // Deletar transações
    const resultado = await Transaction.deleteMany({
      _id: { $in: ids },
      userId: req.userId
    })

    res.json({
      success: true,
      message: `${resultado.deletedCount} transações removidas`,
      data: {
        deletedCount: resultado.deletedCount
      }
    })

  } catch (err) {
    console.error('Erro ao remover transações em lote:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getStatistics = async (req, res) => {
  try {
    const { periodo = 'mes', ano, mes } = req.query
    
    // Definir período
    let dataInicio, dataFim
    const agora = new Date()

    switch (periodo) {
      case 'semana':
        dataInicio = new Date(agora)
        dataInicio.setDate(agora.getDate() - 6)
        dataFim = agora
        break
      case 'mes':
        dataInicio = new Date(ano || agora.getFullYear(), mes || agora.getMonth(), 1)
        dataFim = new Date(ano || agora.getFullYear(), (mes || agora.getMonth()) + 1, 0)
        break
      case 'ano':
        dataInicio = new Date(ano || agora.getFullYear(), 0, 1)
        dataFim = new Date(ano || agora.getFullYear(), 11, 31)
        break
    }

    const estatisticas = await Transaction.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(req.userId),
          data: { $gte: dataInicio, $lte: dataFim }
        }
      },
      {
        $facet: {
          porTipo: [
            {
              $group: {
                _id: '$tipo',
                total: { $sum: '$valor' },
                count: { $sum: 1 },
                media: { $avg: '$valor' }
              }
            }
          ],
          porCategoria: [
            {
              $group: {
                _id: { categoria: '$categoria', tipo: '$tipo' },
                total: { $sum: '$valor' },
                count: { $sum: 1 }
              }
            },
            { $sort: { total: -1 } },
            { $limit: 10 }
          ],
          porMetodoPagamento: [
            {
              $group: {
                _id: '$metodoPagamento',
                total: { $sum: '$valor' },
                count: { $sum: 1 }
              }
            },
            { $sort: { total: -1 } }
          ],
          evolucaoDiaria: [
            {
              $group: {
                _id: {
                  dia: { $dayOfMonth: '$data' },
                  mes: { $month: '$data' },
                  ano: { $year: '$data' },
                  tipo: '$tipo'
                },
                total: { $sum: '$valor' }
              }
            },
            { $sort: { '_id.ano': 1, '_id.mes': 1, '_id.dia': 1 } }
          ]
        }
      }
    ])

    res.json({
      success: true,
      data: {
        periodo: { inicio: dataInicio, fim: dataFim },
        estatisticas: estatisticas[0]
      }
    })

  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

// Funções auxiliares
async function reverterImpactos(transacao) {
  try {
    // Reverter orçamento
    if (transacao.orcamentoId && transacao.tipo === 'despesa') {
      await Budget.findOneAndUpdate(
        { _id: transacao.orcamentoId },
        { $inc: { valorGasto: -transacao.valor } }
      )
    }

    // Reverter meta
    if (transacao.metaId && transacao.tipo === 'receita') {
      const meta = await Goal.findById(transacao.metaId)
      if (meta) {
        meta.adicionarContribuicao(-transacao.valor, 'Reversão de transação', 'retirada')
        await meta.save()
      }
    }

    // Reverter estatísticas da categoria
    const categoria = await Category.findOne({
      $or: [
        { userId: transacao.userId, nome: transacao.categoria },
        { padrao: true, nome: transacao.categoria }
      ]
    })
    
    if (categoria) {
      categoria.atualizarEstatisticas(transacao.valor, 'remover')
      await categoria.save()
    }

  } catch (err) {
    console.error('Erro ao reverter impactos:', err)
  }
}

async function aplicarImpactos(transacao) {
  try {
    // Aplicar orçamento
    if (transacao.orcamentoId && transacao.tipo === 'despesa') {
      await Budget.findOneAndUpdate(
        { _id: transacao.orcamentoId },
        { $inc: { valorGasto: transacao.valor } }
      )
    }

    // Aplicar meta
    if (transacao.metaId && transacao.tipo === 'receita') {
      const meta = await Goal.findById(transacao.metaId)
      if (meta) {
        meta.adicionarContribuicao(transacao.valor, transacao.observacoes || '')
        await meta.save()
      }
    }

    // Aplicar estatísticas da categoria
    const categoria = await Category.findOne({
      $or: [
        { userId: transacao.userId, nome: transacao.categoria },
        { padrao: true, nome: transacao.categoria }
      ]
    })
    
    if (categoria) {
      categoria.atualizarEstatisticas(transacao.valor, 'adicionar')
      await categoria.save()
    }

  } catch (err) {
    console.error('Erro ao aplicar impactos:', err)
  }
}

async function criarTransacoesRecorrentes(transacaoOriginal) {
  try {
    if (!transacaoOriginal.recorrente.ativo) return

    const proximaData = transacaoOriginal.calcularProximaData()
    if (!proximaData) return

    // Atualizar a transação original com a próxima data
    await Transaction.findByIdAndUpdate(transacaoOriginal._id, {
      'recorrente.proximaData': proximaData
    })

    // Verificar se deve criar a próxima transação (se está dentro do período)
    const agora = new Date()
    const umMesAFrente = new Date(agora.getFullYear(), agora.getMonth() + 1, agora.getDate())
    
    if (proximaData <= umMesAFrente && 
        (!transacaoOriginal.recorrente.dataFim || proximaData <= transacaoOriginal.recorrente.dataFim)) {
      
      // Criar próxima transação recorrente
      const novaTransacao = {
        ...transacaoOriginal.toObject(),
        _id: undefined,
        data: proximaData,
        observacoes: `${transacaoOriginal.observacoes || ''} (Recorrente)`.trim(),
        criadoEm: new Date(),
        atualizadoEm: new Date()
      }
      
      await Transaction.create(novaTransacao)
    }

  } catch (err) {
    console.error('Erro ao criar transações recorrentes:', err)
  }
}