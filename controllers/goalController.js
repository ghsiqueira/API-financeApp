const Goal = require('../models/Goal')
const mongoose = require('mongoose')
const { validationResult } = require('express-validator')

/**
 * Listar todas as metas do usuário com filtros e paginação
 */
exports.getAll = async (req, res) => {
  try {
    console.log('🎯 Buscando metas para usuário:', req.userId)
    
    const { 
      status, 
      categoria, 
      prioridade,
      periodo,
      page = 1, 
      limit = 20,
      sortBy = 'dataLimite',
      sortOrder = 'asc',
      search
    } = req.query

    // Construir filtros
    const filtros = { userId: req.userId }
    
    if (status) filtros.status = status
    if (categoria) filtros.categoria = categoria
    if (prioridade) filtros.prioridade = prioridade

    // Filtro por período
    if (periodo) {
      const agora = new Date()
      let dataInicio = new Date()
      
      switch (periodo) {
        case 'mes':
          dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
          break
        case 'trimestre':
          dataInicio = new Date(agora.getFullYear(), agora.getMonth() - 3, 1)
          break
        case 'ano':
          dataInicio = new Date(agora.getFullYear(), 0, 1)
          break
      }
      
      filtros.dataInicio = { $gte: dataInicio }
    }

    // Filtro de busca
    if (search) {
      filtros.$or = [
        { titulo: { $regex: search, $options: 'i' } },
        { descricao: { $regex: search, $options: 'i' } }
      ]
    }

    // Configurar paginação
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Configurar ordenação
    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1

    // Buscar metas com paginação
    const [metas, total] = await Promise.all([
      Goal.find(filtros)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Goal.countDocuments(filtros)
    ])

    // Calcular progresso e estatísticas para cada meta
    const metasComProgresso = metas.map(meta => {
      const porcentagemConcluida = Math.min((meta.valorAtual / meta.valorAlvo) * 100, 100)
      const diasRestantes = Math.max(
        Math.ceil((new Date(meta.dataLimite) - new Date()) / (1000 * 60 * 60 * 24)), 
        0
      )
      const valorRestante = Math.max(meta.valorAlvo - meta.valorAtual, 0)
      
      // Calcular valor necessário por dia/mês
      const valorPorDia = diasRestantes > 0 ? valorRestante / diasRestantes : 0
      const valorPorMes = valorPorDia * 30.44 // Média de dias por mês

      return {
        ...meta,
        porcentagemConcluida: Math.round(porcentagemConcluida * 100) / 100,
        diasRestantes,
        valorRestante,
        sugestoes: {
          valorPorDia: Math.round(valorPorDia * 100) / 100,
          valorPorMes: Math.round(valorPorMes * 100) / 100
        },
        estatisticas: {
          totalContribuicoes: meta.contribuicoes?.length || 0,
          ultimaContribuicao: meta.contribuicoes?.length > 0 
            ? meta.contribuicoes[meta.contribuicoes.length - 1].data 
            : null
        }
      }
    })

    console.log(`✅ ${metas.length} metas encontradas`)

    res.json({
      success: true,
      data: metasComProgresso,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1
      },
      filtros: {
        status,
        categoria,
        prioridade,
        periodo,
        search
      }
    })

  } catch (err) {
    console.error('❌ Erro ao buscar metas:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  }
}

/**
 * Obter meta específica por ID
 */
exports.getById = async (req, res) => {
  try {
    console.log('🎯 Buscando meta:', req.params.id)
    
    const meta = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId
    })

    if (!meta) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada'
      })
    }

    // Calcular estatísticas detalhadas
    const porcentagemConcluida = Math.min((meta.valorAtual / meta.valorAlvo) * 100, 100)
    const diasRestantes = Math.max(
      Math.ceil((new Date(meta.dataLimite) - new Date()) / (1000 * 60 * 60 * 24)), 
      0
    )
    const diasDecorridos = Math.ceil((new Date() - new Date(meta.dataInicio)) / (1000 * 60 * 60 * 24))
    const valorRestante = Math.max(meta.valorAlvo - meta.valorAtual, 0)
    
    // Calcular velocidade de progresso
    const velocidadeProgresso = diasDecorridos > 0 ? meta.valorAtual / diasDecorridos : 0
    const tempoEstimado = velocidadeProgresso > 0 ? valorRestante / velocidadeProgresso : Infinity
    
    // Calcular valor necessário por período
    const valorPorDia = diasRestantes > 0 ? valorRestante / diasRestantes : 0
    const valorPorSemana = valorPorDia * 7
    const valorPorMes = valorPorDia * 30.44

    // Analisar histórico de contribuições
    const contribuicoes = meta.contribuicoes || []
    const ultimaContribuicao = contribuicoes.length > 0 ? contribuicoes[contribuicoes.length - 1] : null
    const totalContribuicoes = contribuicoes.reduce((sum, c) => sum + c.valor, 0)
    const mediaContribuicao = contribuicoes.length > 0 ? totalContribuicoes / contribuicoes.length : 0

    const metaDetalhada = {
      ...meta.toObject(),
      progresso: {
        porcentagemConcluida: Math.round(porcentagemConcluida * 100) / 100,
        valorAtual: meta.valorAtual,
        valorAlvo: meta.valorAlvo,
        valorRestante,
        diasRestantes,
        diasDecorridos,
        velocidadeProgresso: Math.round(velocidadeProgresso * 100) / 100,
        tempoEstimadoDias: tempoEstimado === Infinity ? null : Math.ceil(tempoEstimado)
      },
      sugestoes: {
        valorPorDia: Math.round(valorPorDia * 100) / 100,
        valorPorSemana: Math.round(valorPorSemana * 100) / 100,
        valorPorMes: Math.round(valorPorMes * 100) / 100
      },
      estatisticas: {
        totalContribuicoes: contribuicoes.length,
        valorTotalContribuido: totalContribuicoes,
        mediaContribuicao: Math.round(mediaContribuicao * 100) / 100,
        ultimaContribuicao: ultimaContribuicao ? {
          valor: ultimaContribuicao.valor,
          data: ultimaContribuicao.data,
          nota: ultimaContribuicao.nota
        } : null
      }
    }

    console.log('✅ Meta encontrada:', meta._id)

    res.json({
      success: true,
      data: metaDetalhada
    })

  } catch (err) {
    console.error('❌ Erro ao buscar meta:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Criar nova meta
 */
exports.create = async (req, res) => {
  try {
    console.log('🎯 Criando nova meta:', req.body)
    
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

    // Validações adicionais
    const { titulo, valorAlvo, dataLimite } = req.body
    
    if (new Date(dataLimite) <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Data limite deve ser futura'
      })
    }

    if (valorAlvo <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valor alvo deve ser maior que zero'
      })
    }

    // Verificar se já existe meta com mesmo título
    const metaExistente = await Goal.findOne({
      userId: req.userId,
      titulo: titulo.trim(),
      status: { $in: ['ativa', 'pausada'] }
    })

    if (metaExistente) {
      return res.status(400).json({
        success: false,
        error: 'Já existe uma meta ativa com este título'
      })
    }

    // Criar meta
    const dadosMeta = {
      ...req.body,
      userId: req.userId,
      titulo: titulo.trim(),
      dataInicio: req.body.dataInicio || new Date(),
      status: 'ativa'
    }

    const meta = await Goal.create(dadosMeta)

    console.log('✅ Meta criada com sucesso:', meta._id)

    res.status(201).json({
      success: true,
      message: 'Meta criada com sucesso',
      data: meta
    })

  } catch (err) {
    console.error('❌ Erro ao criar meta:', err)
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        detalhes: Object.values(err.errors).map(e => ({
          field: e.path,
          message: e.message
        }))
      })
    }

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Atualizar meta existente
 */
exports.update = async (req, res) => {
  try {
    console.log('🎯 Atualizando meta:', req.params.id)
    
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

    // Não permitir alterar campos específicos
    const dadosProibidos = ['userId', 'valorAtual', 'contribuicoes', 'criadoEm']
    dadosProibidos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        delete req.body[campo]
      }
    })

    const meta = await Goal.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.userId
      },
      { 
        ...req.body, 
        atualizadoEm: new Date() 
      },
      { 
        new: true, 
        runValidators: true 
      }
    )

    if (!meta) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada'
      })
    }

    console.log('✅ Meta atualizada:', meta._id)

    res.json({
      success: true,
      message: 'Meta atualizada com sucesso',
      data: meta
    })

  } catch (err) {
    console.error('❌ Erro ao atualizar meta:', err)
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        detalhes: Object.values(err.errors).map(e => ({
          field: e.path,
          message: e.message
        }))
      })
    }

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Excluir meta
 */
exports.delete = async (req, res) => {
  try {
    console.log('🎯 Excluindo meta:', req.params.id)
    
    const meta = await Goal.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    })

    if (!meta) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada'
      })
    }

    console.log('✅ Meta excluída:', meta._id)

    res.json({
      success: true,
      message: 'Meta excluída com sucesso',
      data: {
        metaExcluida: {
          id: meta._id,
          titulo: meta.titulo,
          valorAlvo: meta.valorAlvo,
          valorAtual: meta.valorAtual
        }
      }
    })

  } catch (err) {
    console.error('❌ Erro ao excluir meta:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Adicionar contribuição à meta
 */
exports.addContribuicao = async (req, res) => {
  try {
    console.log('💰 Adicionando contribuição à meta:', req.params.id)
    
    const { valor, nota, data, tipo = 'contribuicao' } = req.body

    // Validações
    if (!valor || valor <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valor da contribuição deve ser maior que zero'
      })
    }

    const meta = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId
    })

    if (!meta) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada'
      })
    }

    if (meta.status !== 'ativa') {
      return res.status(400).json({
        success: false,
        error: 'Só é possível adicionar contribuições a metas ativas'
      })
    }

    // Adicionar contribuição
    const novaContribuicao = {
      valor: tipo === 'retirada' ? -Math.abs(valor) : Math.abs(valor),
      nota: nota || '',
      data: data ? new Date(data) : new Date(),
      tipo: tipo || 'contribuicao'
    }

    meta.contribuicoes.push(novaContribuicao)

    // Atualizar valor atual
    const valorAnterior = meta.valorAtual
    meta.valorAtual += novaContribuicao.valor

    // Garantir que o valor atual não seja negativo
    if (meta.valorAtual < 0) {
      meta.valorAtual = 0
    }

    // Verificar se meta foi atingida
    const foiConcluida = valorAnterior < meta.valorAlvo && meta.valorAtual >= meta.valorAlvo
    if (foiConcluida) {
      meta.status = 'concluida'
      meta.dataConclusao = new Date()
    }

    // Verificar se meta voltou a estar pendente
    if (meta.valorAtual < meta.valorAlvo && meta.status === 'concluida') {
      meta.status = 'ativa'
      meta.dataConclusao = null
    }

    await meta.save()

    console.log(`✅ Contribuição de ${novaContribuicao.valor} adicionada à meta ${meta._id}`)

    // Preparar resposta
    let mensagem = `${tipo === 'contribuicao' ? 'Contribuição' : tipo === 'retirada' ? 'Retirada' : 'Ajuste'} de R$ ${Math.abs(valor)} registrada com sucesso`
    if (foiConcluida) {
      mensagem += '. 🎉 Parabéns! Meta atingida!'
    }

    res.json({
      success: true,
      message: mensagem,
      data: {
        meta,
        contribuicaoAdicionada: novaContribuicao,
        alteracoes: {
          valorAnterior,
          valorAtual: meta.valorAtual,
          progressoAnterior: Math.round((valorAnterior / meta.valorAlvo) * 100),
          progressoAtual: Math.round((meta.valorAtual / meta.valorAlvo) * 100),
          metaConcluida: foiConcluida
        }
      }
    })

  } catch (err) {
    console.error('❌ Erro ao adicionar contribuição:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Remover contribuição específica
 */
exports.removeContribuicao = async (req, res) => {
  try {
    console.log('🗑️ Removendo contribuição:', req.params.contributionId)
    
    const meta = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId
    })

    if (!meta) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada'
      })
    }

    const contribuicao = meta.contribuicoes.id(req.params.contributionId)
    if (!contribuicao) {
      return res.status(404).json({
        success: false,
        error: 'Contribuição não encontrada'
      })
    }

    // Guardar dados da contribuição antes de remover
    const contribuicaoRemovida = {
      valor: contribuicao.valor,
      nota: contribuicao.nota,
      data: contribuicao.data,
      tipo: contribuicao.tipo
    }

    // Subtrair valor da contribuição
    meta.valorAtual -= contribuicao.valor

    // Garantir que não fique negativo
    if (meta.valorAtual < 0) {
      meta.valorAtual = 0
    }

    // Remover contribuição
    contribuicao.remove()

    // Verificar se status da meta deve mudar
    if (meta.valorAtual < meta.valorAlvo && meta.status === 'concluida') {
      meta.status = 'ativa'
      meta.dataConclusao = null
    }

    await meta.save()

    console.log('✅ Contribuição removida da meta:', meta._id)

    res.json({
      success: true,
      message: 'Contribuição removida com sucesso',
      data: {
        meta,
        contribuicaoRemovida
      }
    })

  } catch (err) {
    console.error('❌ Erro ao remover contribuição:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Pausar meta
 */
exports.pausar = async (req, res) => {
  try {
    console.log('⏸️ Pausando meta:', req.params.id)
    
    const meta = await Goal.findOneAndUpdate(
      { 
        _id: req.params.id, 
        userId: req.userId,
        status: { $in: ['ativa'] }
      },
      { 
        status: 'pausada',
        atualizadoEm: new Date()
      },
      { new: true }
    )

    if (!meta) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada ou não pode ser pausada'
      })
    }

    console.log('✅ Meta pausada:', meta._id)

    res.json({
      success: true,
      message: 'Meta pausada com sucesso',
      data: meta
    })

  } catch (err) {
    console.error('❌ Erro ao pausar meta:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Reativar meta pausada
 */
exports.reativar = async (req, res) => {
  try {
    console.log('▶️ Reativando meta:', req.params.id)
    
    const meta = await Goal.findOneAndUpdate(
      { 
        _id: req.params.id, 
        userId: req.userId,
        status: 'pausada'
      },
      { 
        status: 'ativa',
        atualizadoEm: new Date()
      },
      { new: true }
    )

    if (!meta) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada ou não está pausada'
      })
    }

    console.log('✅ Meta reativada:', meta._id)

    res.json({
      success: true,
      message: 'Meta reativada com sucesso',
      data: meta
    })

  } catch (err) {
    console.error('❌ Erro ao reativar meta:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Marcar meta como concluída
 */
exports.concluir = async (req, res) => {
  try {
    console.log('✅ Concluindo meta:', req.params.id)
    
    const meta = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId
    })

    if (!meta) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada'
      })
    }

    if (meta.status === 'concluida') {
      return res.status(400).json({
        success: false,
        error: 'Meta já está concluída'
      })
    }

    // Verificar se pode ser concluída
    if (meta.valorAtual < meta.valorAlvo) {
      // Permitir conclusão manual, mas avisar
      const confirmacao = req.body.forcar || false
      
      if (!confirmacao) {
        return res.status(400).json({
          success: false,
          error: 'Meta não atingiu o valor alvo ainda',
          valorAtual: meta.valorAtual,
          valorAlvo: meta.valorAlvo,
          valorRestante: meta.valorAlvo - meta.valorAtual,
          dica: 'Para forçar a conclusão, envie "forcar: true" no body da requisição'
        })
      }
    }

    meta.status = 'concluida'
    meta.dataConclusao = new Date()
    
    await meta.save()

    console.log('🎉 Meta concluída:', meta._id)

    res.json({
      success: true,
      message: '🎉 Parabéns! Meta concluída com sucesso!',
      data: meta
    })

  } catch (err) {
    console.error('❌ Erro ao concluir meta:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Obter resumo geral das metas
 */
exports.getResumo = async (req, res) => {
  try {
    console.log('📊 Gerando resumo das metas para usuário:', req.userId)
    
    const { periodo = 'todas' } = req.query
    
    // Filtro por período
    let filtroData = {}
    if (periodo !== 'todas') {
      const agora = new Date()
      let dataInicio = new Date()
      
      switch (periodo) {
        case 'mes':
          dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
          break
        case 'trimestre':
          dataInicio = new Date(agora.getFullYear(), agora.getMonth() - 3, 1)
          break
        case 'ano':
          dataInicio = new Date(agora.getFullYear(), 0, 1)
          break
      }
      
      filtroData = { dataInicio: { $gte: dataInicio } }
    }

    const userObjectId = new mongoose.Types.ObjectId(req.userId)

    // Agregação para estatísticas gerais
    const estatisticas = await Goal.aggregate([
      {
        $match: {
          userId: userObjectId,
          ...filtroData
        }
      },
      {
        $addFields: {
          porcentagemConcluida: {
            $multiply: [
              { $divide: ['$valorAtual', '$valorAlvo'] },
              100
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          ativas: {
            $sum: { $cond: [{ $eq: ['$status', 'ativa'] }, 1, 0] }
          },
          pausadas: {
            $sum: { $cond: [{ $eq: ['$status', 'pausada'] }, 1, 0] }
          },
          concluidas: {
            $sum: { $cond: [{ $eq: ['$status', 'concluida'] }, 1, 0] }
          },
          canceladas: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelada'] }, 1, 0] }
          },
          valorTotalAlvo: { $sum: '$valorAlvo' },
          valorTotalAtual: { $sum: '$valorAtual' },
          progressoMedio: { $avg: '$porcentagemConcluida' }
        }
      }
    ])

    // Estatísticas por categoria
    const estatisticasPorCategoria = await Goal.aggregate([
      {
        $match: {
          userId: userObjectId,
          ...filtroData
        }
      },
      {
        $group: {
          _id: '$categoria',
          total: { $sum: 1 },
          valorTotalAlvo: { $sum: '$valorAlvo' },
          valorTotalAtual: { $sum: '$valorAtual' },
          concluidas: {
            $sum: { $cond: [{ $eq: ['$status', 'concluida'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          progressoMedio: {
            $multiply: [
              { $divide: ['$valorTotalAtual', '$valorTotalAlvo'] },
              100
            ]
          }
        }
      },
      {
        $sort: { total: -1 }
      }
    ])

    // Metas próximas do vencimento (próximos 30 dias)
    const proximoVencimento = new Date()
    proximoVencimento.setDate(proximoVencimento.getDate() + 30)

    const metasProximasVencimento = await Goal.find({
      userId: req.userId,
      status: 'ativa',
      dataLimite: {
        $gte: new Date(),
        $lte: proximoVencimento
      }
    })
    .sort({ dataLimite: 1 })
    .limit(5)
    .select('titulo valorAlvo valorAtual dataLimite categoria')

    const resumo = {
      periodo,
      estatisticasGerais: estatisticas[0] || {
        total: 0,
        ativas: 0,
        pausadas: 0,
        concluidas: 0,
        canceladas: 0,
        valorTotalAlvo: 0,
        valorTotalAtual: 0,
        progressoMedio: 0
      },
      estatisticasPorCategoria,
      metasProximasVencimento: metasProximasVencimento.map(meta => ({
        ...meta.toObject(),
        diasRestantes: Math.ceil((new Date(meta.dataLimite) - new Date()) / (1000 * 60 * 60 * 24)),
        porcentagemConcluida: Math.round((meta.valorAtual / meta.valorAlvo) * 100)
      })),
      insights: {
        categoriaFavorita: estatisticasPorCategoria[0]?._id || null,
        progressoGeral: estatisticas[0] ? Math.round(estatisticas[0].progressoMedio) : 0,
        metasVencendoEm30Dias: metasProximasVencimento.length
      },
      atualizadoEm: new Date()
    }

    console.log('✅ Resumo gerado com sucesso')

    res.json({
      success: true,
      data: resumo
    })

  } catch (err) {
    console.error('❌ Erro no resumo das metas:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Obter relatório detalhado das metas
 */
exports.getRelatorio = async (req, res) => {
  try {
    console.log('📋 Gerando relatório detalhado das metas')
    
    const { 
      dataInicio, 
      dataFim, 
      categoria, 
      status,
      formato = 'json'
    } = req.query

    // Construir filtros
    const filtros = { userId: req.userId }
    
    if (categoria) filtros.categoria = categoria
    if (status) filtros.status = status
    
    if (dataInicio || dataFim) {
      filtros.dataInicio = {}
      if (dataInicio) filtros.dataInicio.$gte = new Date(dataInicio)
      if (dataFim) filtros.dataInicio.$lte = new Date(dataFim)
    }

    const userObjectId = new mongoose.Types.ObjectId(req.userId)

    // Buscar todas as metas com detalhes
    const metas = await Goal.find(filtros).sort({ dataInicio: -1 })

    // Calcular estatísticas detalhadas
    const estatisticasDetalhadas = await Goal.aggregate([
      { $match: { userId: userObjectId, ...filtros } },
      {
        $addFields: {
          porcentagemConcluida: {
            $multiply: [{ $divide: ['$valorAtual', '$valorAlvo'] }, 100]
          },
          diasParaMeta: {
            $ceil: {
              $divide: [
                { $subtract: ['$dataLimite', '$dataInicio'] },
                86400000
              ]
            }
          },
          diasDecorridos: {
            $ceil: {
              $divide: [
                { $subtract: [new Date(), '$dataInicio'] },
                86400000
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalMetas: { $sum: 1 },
          valorTotalAlvo: { $sum: '$valorAlvo' },
          valorTotalAtual: { $sum: '$valorAtual' },
          progressoMedio: { $avg: '$porcentagemConcluida' },
          tempoMedioMeta: { $avg: '$diasParaMeta' },
          metasConcluidas: {
            $sum: { $cond: [{ $eq: ['$status', 'concluida'] }, 1, 0] }
          },
          metasAtivas: {
            $sum: { $cond: [{ $eq: ['$status', 'ativa'] }, 1, 0] }
          }
        }
      }
    ])

    // Análise de performance por categoria
    const performancePorCategoria = await Goal.aggregate([
      { $match: { userId: userObjectId, ...filtros } },
      {
        $addFields: {
          porcentagemConcluida: {
            $multiply: [{ $divide: ['$valorAtual', '$valorAlvo'] }, 100]
          }
        }
      },
      {
        $group: {
          _id: '$categoria',
          totalMetas: { $sum: 1 },
          valorTotalAlvo: { $sum: '$valorAlvo' },
          valorTotalAtual: { $sum: '$valorAtual' },
          progressoMedio: { $avg: '$porcentagemConcluida' },
          metasConcluidas: {
            $sum: { $cond: [{ $eq: ['$status', 'concluida'] }, 1, 0] }
          },
          taxaSucesso: {
            $avg: { $cond: [{ $eq: ['$status', 'concluida'] }, 1, 0] }
          }
        }
      },
      { $sort: { progressoMedio: -1 } }
    ])

    // Análise temporal (progresso ao longo do tempo)
    const progressoTemporal = await Goal.aggregate([
      { $match: { userId: userObjectId, ...filtros } },
      { $unwind: '$contribuicoes' },
      {
        $group: {
          _id: {
            mes: { $month: '$contribuicoes.data' },
            ano: { $year: '$contribuicoes.data' }
          },
          totalContribuicoes: { $sum: '$contribuicoes.valor' },
          numeroContribuicoes: { $sum: 1 }
        }
      },
      { $sort: { '_id.ano': 1, '_id.mes': 1 } }
    ])

    // Identificar padrões e insights
    const insights = []
    
    const stats = estatisticasDetalhadas[0]
    if (stats) {
      // Taxa de sucesso
      const taxaSucesso = (stats.metasConcluidas / stats.totalMetas) * 100
      insights.push({
        tipo: 'sucesso',
        titulo: 'Taxa de Sucesso',
        valor: `${Math.round(taxaSucesso)}%`,
        descricao: `${stats.metasConcluidas} de ${stats.totalMetas} metas foram concluídas`
      })

      // Progresso geral
      if (stats.progressoMedio >= 80) {
        insights.push({
          tipo: 'positivo',
          titulo: 'Excelente Progresso',
          valor: `${Math.round(stats.progressoMedio)}%`,
          descricao: 'Você está indo muito bem com suas metas!'
        })
      } else if (stats.progressoMedio < 30) {
        insights.push({
          tipo: 'atencao',
          titulo: 'Progresso Baixo',
          valor: `${Math.round(stats.progressoMedio)}%`,
          descricao: 'Considere revisar suas estratégias ou ajustar os valores das metas'
        })
      }

      // Categoria com melhor performance
      if (performancePorCategoria.length > 0) {
        const melhorCategoria = performancePorCategoria[0]
        insights.push({
          tipo: 'destaque',
          titulo: 'Categoria Destaque',
          valor: melhorCategoria._id,
          descricao: `Melhor performance com ${Math.round(melhorCategoria.progressoMedio)}% de progresso médio`
        })
      }
    }

    const relatorio = {
      parametros: {
        dataInicio,
        dataFim,
        categoria,
        status,
        formato
      },
      resumoExecutivo: {
        totalMetas: metas.length,
        valorTotalEmMetas: metas.reduce((sum, m) => sum + m.valorAlvo, 0),
        valorTotalAlcancado: metas.reduce((sum, m) => sum + m.valorAtual, 0),
        progressoGeral: stats ? Math.round(stats.progressoMedio) : 0,
        metasConcluidas: metas.filter(m => m.status === 'concluida').length
      },
      estatisticasDetalhadas: stats || {},
      performancePorCategoria,
      progressoTemporal,
      metasDetalhadas: metas.map(meta => ({
        ...meta.toObject(),
        porcentagemConcluida: Math.round((meta.valorAtual / meta.valorAlvo) * 100),
        diasRestantes: Math.max(
          Math.ceil((new Date(meta.dataLimite) - new Date()) / (1000 * 60 * 60 * 24)), 
          0
        ),
        statusDetalhado: {
          situacao: meta.status,
          foiConcluida: meta.status === 'concluida',
          estaNoPrazo: new Date(meta.dataLimite) > new Date(),
          contribuicoes: meta.contribuicoes?.length || 0
        }
      })),
      insights,
      recomendacoes: [
        'Revise metas com baixo progresso mensalmente',
        'Defina contribuições regulares para manter o momentum',
        'Celebre as conquistas para manter a motivação',
        'Ajuste valores ou prazos se necessário para manter as metas realistas'
      ],
      geradoEm: new Date()
    }

    console.log('✅ Relatório detalhado gerado com sucesso')

    if (formato === 'csv') {
      // Para CSV, retornar dados estruturados para conversão
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio-metas.csv')
      
      // Simplificar dados para CSV
      const dadosCSV = metas.map(meta => ({
        titulo: meta.titulo,
        categoria: meta.categoria,
        status: meta.status,
        valorAlvo: meta.valorAlvo,
        valorAtual: meta.valorAtual,
        progresso: Math.round((meta.valorAtual / meta.valorAlvo) * 100),
        dataInicio: meta.dataInicio.toISOString().split('T')[0],
        dataLimite: meta.dataLimite.toISOString().split('T')[0],
        contribuicoes: meta.contribuicoes?.length || 0
      }))
      
      return res.json({
        success: true,
        formato: 'csv',
        dados: dadosCSV,
        headers: ['titulo', 'categoria', 'status', 'valorAlvo', 'valorAtual', 'progresso', 'dataInicio', 'dataLimite', 'contribuicoes']
      })
    }

    res.json({
      success: true,
      data: relatorio
    })

  } catch (err) {
    console.error('❌ Erro no relatório das metas:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Obter estatísticas das metas para dashboards
 */
exports.getStats = async (req, res) => {
  try {
    const { periodo = 'mes', categoria } = req.query
    const agora = new Date()
    
    // Calcular período
    let dataInicio = new Date()
    switch (periodo) {
      case 'semana':
        dataInicio = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'mes':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
        break
      case 'trimestre':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth() - 3, 1)
        break
      case 'ano':
        dataInicio = new Date(agora.getFullYear(), 0, 1)
        break
    }

    const filtros = { 
      userId: req.userId,
      dataInicio: { $gte: dataInicio }
    }
    
    if (categoria) filtros.categoria = categoria

    const userObjectId = new mongoose.Types.ObjectId(req.userId)

    const stats = await Goal.aggregate([
      { $match: { userId: userObjectId, ...filtros } },
      {
        $addFields: {
          porcentagemConcluida: {
            $multiply: [{ $divide: ['$valorAtual', '$valorAlvo'] }, 100]
          }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          valorTotalAlvo: { $sum: '$valorAlvo' },
          valorTotalAtual: { $sum: '$valorAtual' },
          progressoMedio: { $avg: '$porcentagemConcluida' }
        }
      }
    ])

    // Estatísticas de contribuições no período
    const contribuicoesStats = await Goal.aggregate([
      { $match: { userId: userObjectId, ...filtros } },
      { $unwind: '$contribuicoes' },
      {
        $match: {
          'contribuicoes.data': { $gte: dataInicio, $lte: agora }
        }
      },
      {
        $group: {
          _id: null,
          totalContribuicoes: { $sum: '$contribuicoes.valor' },
          numeroContribuicoes: { $sum: 1 },
          mediaContribuicao: { $avg: '$contribuicoes.valor' }
        }
      }
    ])

    res.json({
      success: true,
      data: {
        periodo,
        categoria: categoria || 'todas',
        estatisticasPorStatus: stats,
        contribuicoes: contribuicoesStats[0] || {
          totalContribuicoes: 0,
          numeroContribuicoes: 0,
          mediaContribuicao: 0
        },
        resumo: {
          totalMetas: stats.reduce((sum, s) => sum + s.count, 0),
          valorTotalAlvo: stats.reduce((sum, s) => sum + s.valorTotalAlvo, 0),
          valorTotalAtual: stats.reduce((sum, s) => sum + s.valorTotalAtual, 0),
          progressoGeral: stats.length > 0 
            ? stats.reduce((sum, s) => sum + s.progressoMedio, 0) / stats.length 
            : 0
        }
      }
    })

  } catch (err) {
    console.error('❌ Erro nas estatísticas das metas:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Atualizar status da meta (ativa, pausada, cancelada)
 */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body

    if (!['ativa', 'pausada', 'concluida', 'cancelada'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status inválido. Use: ativa, pausada, concluida ou cancelada'
      })
    }

    const meta = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId
    })

    if (!meta) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada'
      })
    }

    const statusAnterior = meta.status
    meta.status = status
    
    // Definir data de conclusão se aplicável
    if (status === 'concluida') {
      meta.dataConclusao = new Date()
    } else if (status === 'ativa' || status === 'pausada') {
      meta.dataConclusao = null
    }

    await meta.save()

    console.log(`✅ Status da meta ${meta._id} alterado de ${statusAnterior} para ${status}`)

    res.json({
      success: true,
      message: `Meta ${status === 'ativa' ? 'ativada' : status === 'pausada' ? 'pausada' : status === 'concluida' ? 'concluída' : 'cancelada'} com sucesso`,
      data: {
        meta,
        alteracao: {
          statusAnterior,
          statusAtual: status,
          dataAlteracao: new Date()
        }
      }
    })

  } catch (err) {
    console.error('❌ Erro ao atualizar status da meta:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Duplicar meta existente
 */
exports.duplicate = async (req, res) => {
  try {
    const metaOriginal = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId
    })

    if (!metaOriginal) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada'
      })
    }

    // Criar nova meta baseada na original
    const { sufixo = ' (Cópia)' } = req.body
    
    const novaMeta = new Goal({
      ...metaOriginal.toObject(),
      _id: undefined,
      titulo: metaOriginal.titulo + sufixo,
      valorAtual: 0,
      contribuicoes: [],
      status: 'ativa',
      dataInicio: new Date(),
      dataConclusao: null,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    })

    await novaMeta.save()

    console.log('✅ Meta duplicada:', novaMeta._id)

    res.status(201).json({
      success: true,
      message: 'Meta duplicada com sucesso',
      data: {
        metaOriginal: {
          id: metaOriginal._id,
          titulo: metaOriginal.titulo
        },
        novaMeta
      }
    })

  } catch (err) {
    console.error('❌ Erro ao duplicar meta:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}