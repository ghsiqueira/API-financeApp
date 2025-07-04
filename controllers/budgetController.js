const Budget = require('../models/Budget')
const Transaction = require('../models/Transaction')
const Category = require('../models/Category')
const { validationResult } = require('express-validator')
const mongoose = require('mongoose')

exports.getAll = async (req, res) => {
  try {
    const { 
      status, 
      categoria, 
      periodo, 
      ativo = true,
      page = 1,
      limit = 20,
      sortBy = 'dataInicio',
      sortOrder = 'desc'
    } = req.query

    // Construir filtros
    const filtros = { userId: req.userId }
    
    if (status) filtros.status = status
    if (categoria) filtros.categoria = categoria
    if (periodo) filtros.periodo = periodo
    
    // Filtrar apenas ativos por padrão
    if (ativo === 'true') {
      const agora = new Date()
      filtros.dataInicio = { $lte: agora }
      filtros.dataFim = { $gte: agora }
      filtros.status = 'ativo'
    }

    // Configurar paginação
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Configurar ordenação
    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1

    // Buscar orçamentos
    const [orcamentos, total] = await Promise.all([
      Budget.find(filtros)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Budget.countDocuments(filtros)
    ])

    // Calcular dados adicionais para cada orçamento
    const orcamentosEnriquecidos = await Promise.all(
      orcamentos.map(async (orcamento) => {
        // Recalcular valor gasto baseado nas transações
        const transacoes = await Transaction.find({
          userId: req.userId,
          categoria: orcamento.categoria,
          tipo: 'despesa',
          data: {
            $gte: orcamento.dataInicio,
            $lte: orcamento.dataFim
          }
        })

        const valorGastoReal = transacoes.reduce((sum, t) => sum + t.valor, 0)
        
        // Atualizar no banco se houver diferença
        if (Math.abs(valorGastoReal - orcamento.valorGasto) > 0.01) {
          await Budget.findByIdAndUpdate(orcamento._id, {
            valorGasto: valorGastoReal
          })
        }

        return {
          ...orcamento,
          valorGasto: valorGastoReal,
          valorRestante: Math.max(0, orcamento.valorLimite - valorGastoReal),
          porcentagemGasta: orcamento.valorLimite > 0 ? 
            Math.round((valorGastoReal / orcamento.valorLimite) * 100) : 0,
          diasRestantes: Math.max(0, Math.ceil((orcamento.dataFim - new Date()) / (1000 * 60 * 60 * 24))),
          transacoesCount: transacoes.length
        }
      })
    )

    // Calcular resumo geral
    const resumo = orcamentosEnriquecidos.reduce((acc, orc) => {
      acc.totalLimite += orc.valorLimite
      acc.totalGasto += orc.valorGasto
      acc.totalRestante += orc.valorRestante
      
      if (orc.porcentagemGasta >= 100) acc.excedidos++
      if (orc.porcentagemGasta >= 80 && orc.porcentagemGasta < 100) acc.emAlerta++
      if (orc.diasRestantes <= 7 && orc.diasRestantes > 0) acc.vencendoEm7Dias++
      
      return acc
    }, {
      totalLimite: 0,
      totalGasto: 0,
      totalRestante: 0,
      excedidos: 0,
      emAlerta: 0,
      vencendoEm7Dias: 0
    })

    res.json({
      success: true,
      data: {
        orcamentos: orcamentosEnriquecidos,
        paginacao: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        },
        resumo
      }
    })

  } catch (err) {
    console.error('Erro ao buscar orçamentos:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getById = async (req, res) => {
  try {
    const { id } = req.params

    const orcamento = await Budget.findOne({
      _id: id,
      userId: req.userId
    })

    if (!orcamento) {
      return res.status(404).json({ error: 'Orçamento não encontrado' })
    }

    // Buscar transações relacionadas
    const transacoes = await Transaction.find({
      userId: req.userId,
      categoria: orcamento.categoria,
      tipo: 'despesa',
      data: {
        $gte: orcamento.dataInicio,
        $lte: orcamento.dataFim
      }
    }).sort({ data: -1 })

    // Recalcular valor gasto
    const valorGastoReal = transacoes.reduce((sum, t) => sum + t.valor, 0)

    // Estatísticas detalhadas
    const estatisticas = {
      valorGasto: valorGastoReal,
      valorRestante: Math.max(0, orcamento.valorLimite - valorGastoReal),
      porcentagemGasta: orcamento.valorLimite > 0 ? 
        Math.round((valorGastoReal / orcamento.valorLimite) * 100) : 0,
      diasRestantes: Math.max(0, Math.ceil((orcamento.dataFim - new Date()) / (1000 * 60 * 60 * 24))),
      diasDecorridos: Math.max(0, Math.ceil((new Date() - orcamento.dataInicio) / (1000 * 60 * 60 * 24))),
      totalTransacoes: transacoes.length,
      mediaGastoPorDia: valorGastoReal / Math.max(1, Math.ceil((new Date() - orcamento.dataInicio) / (1000 * 60 * 60 * 24))),
      projecaoFinal: 0
    }

    // Calcular projeção para final do período
    if (estatisticas.diasDecorridos > 0) {
      const totalDias = Math.ceil((orcamento.dataFim - orcamento.dataInicio) / (1000 * 60 * 60 * 24))
      estatisticas.projecaoFinal = (estatisticas.mediaGastoPorDia * totalDias)
    }

    res.json({
      success: true,
      data: {
        orcamento: {
          ...orcamento.toObject(),
          ...estatisticas
        },
        transacoes,
        alertas: gerarAlertasOrcamento(orcamento, estatisticas)
      }
    })

  } catch (err) {
    console.error('Erro ao buscar orçamento:', err)
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

    const dadosOrcamento = { ...req.body, userId: req.userId }

    // Validar datas
    if (new Date(dadosOrcamento.dataInicio) >= new Date(dadosOrcamento.dataFim)) {
      return res.status(400).json({ error: 'Data de início deve ser anterior à data de fim' })
    }

    // Validar se categoria existe
    const categoria = await Category.findOne({
      $or: [
        { userId: req.userId, nome: dadosOrcamento.categoria },
        { padrao: true, nome: dadosOrcamento.categoria }
      ],
      ativa: true
    })

    if (!categoria) {
      return res.status(400).json({ error: 'Categoria não encontrada' })
    }

    // Verificar conflitos com orçamentos existentes
    const conflito = await Budget.findOne({
      userId: req.userId,
      categoria: dadosOrcamento.categoria,
      status: 'ativo',
      $or: [
        {
          dataInicio: { $lte: dadosOrcamento.dataFim },
          dataFim: { $gte: dadosOrcamento.dataInicio }
        }
      ]
    })

    if (conflito) {
      return res.status(400).json({ 
        error: 'Já existe um orçamento ativo para esta categoria no período especificado' 
      })
    }

    // Calcular valor gasto inicial baseado em transações existentes
    const transacoesExistentes = await Transaction.find({
      userId: req.userId,
      categoria: dadosOrcamento.categoria,
      tipo: 'despesa',
      data: {
        $gte: new Date(dadosOrcamento.dataInicio),
        $lte: new Date(dadosOrcamento.dataFim)
      }
    })

    dadosOrcamento.valorGasto = transacoesExistentes.reduce((sum, t) => sum + t.valor, 0)

    // Criar orçamento
    const orcamento = await Budget.create(dadosOrcamento)

    // Adicionar ao histórico
    orcamento.adicionarHistorico('criado', orcamento.valorLimite, 'Orçamento criado')
    await orcamento.save()

    res.status(201).json({
      success: true,
      message: 'Orçamento criado com sucesso',
      data: orcamento
    })

  } catch (err) {
    console.error('Erro ao criar orçamento:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.update = async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const orcamento = await Budget.findOne({
      _id: id,
      userId: req.userId
    })

    if (!orcamento) {
      return res.status(404).json({ error: 'Orçamento não encontrado' })
    }

    // Guardar valores antigos para histórico
    const valorLimiteAntigo = orcamento.valorLimite

    // Aplicar atualizações
    Object.keys(updates).forEach(key => {
      if (key !== 'userId' && key !== 'valorGasto') {
        orcamento[key] = updates[key]
      }
    })

    // Validar datas se foram alteradas
    if (updates.dataInicio || updates.dataFim) {
      if (orcamento.dataInicio >= orcamento.dataFim) {
        return res.status(400).json({ error: 'Data de início deve ser anterior à data de fim' })
      }

      // Recalcular valor gasto se as datas mudaram
      const transacoes = await Transaction.find({
        userId: req.userId,
        categoria: orcamento.categoria,
        tipo: 'despesa',
        data: {
          $gte: orcamento.dataInicio,
          $lte: orcamento.dataFim
        }
      })

      orcamento.valorGasto = transacoes.reduce((sum, t) => sum + t.valor, 0)
    }

    // Adicionar ao histórico se valor limite mudou
    if (updates.valorLimite && updates.valorLimite !== valorLimiteAntigo) {
      orcamento.adicionarHistorico('editado', updates.valorLimite, 
        `Limite alterado de R$ ${valorLimiteAntigo} para R$ ${updates.valorLimite}`)
    }

    await orcamento.save()

    res.json({
      success: true,
      message: 'Orçamento atualizado com sucesso',
      data: orcamento
    })

  } catch (err) {
    console.error('Erro ao atualizar orçamento:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.remove = async (req, res) => {
  try {
    const { id } = req.params

    const orcamento = await Budget.findOne({
      _id: id,
      userId: req.userId
    })

    if (!orcamento) {
      return res.status(404).json({ error: 'Orçamento não encontrado' })
    }

    // Remover referências em transações
    await Transaction.updateMany(
      { orcamentoId: id },
      { $unset: { orcamentoId: 1 } }
    )

    // Deletar orçamento
    await Budget.deleteOne({ _id: id, userId: req.userId })

    res.json({
      success: true,
      message: 'Orçamento removido com sucesso'
    })

  } catch (err) {
    console.error('Erro ao remover orçamento:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.renovar = async (req, res) => {
  try {
    const { id } = req.params

    const orcamento = await Budget.findOne({
      _id: id,
      userId: req.userId
    })

    if (!orcamento) {
      return res.status(404).json({ error: 'Orçamento não encontrado' })
    }

    if (!orcamento.renovacaoAutomatica) {
      return res.status(400).json({ error: 'Orçamento não está configurado para renovação automática' })
    }

    const renovado = orcamento.renovar()
    if (!renovado) {
      return res.status(400).json({ error: 'Não foi possível renovar o orçamento' })
    }

    await orcamento.save()

    res.json({
      success: true,
      message: 'Orçamento renovado com sucesso',
      data: orcamento
    })

  } catch (err) {
    console.error('Erro ao renovar orçamento:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.pausar = async (req, res) => {
  try {
    const { id } = req.params

    const orcamento = await Budget.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { 
        status: 'pausado',
        atualizadoEm: new Date()
      },
      { new: true }
    )

    if (!orcamento) {
      return res.status(404).json({ error: 'Orçamento não encontrado' })
    }

    orcamento.adicionarHistorico('pausado', null, 'Orçamento pausado pelo usuário')
    await orcamento.save()

    res.json({
      success: true,
      message: 'Orçamento pausado com sucesso',
      data: orcamento
    })

  } catch (err) {
    console.error('Erro ao pausar orçamento:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.reativar = async (req, res) => {
  try {
    const { id } = req.params

    const orcamento = await Budget.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { 
        status: 'ativo',
        atualizadoEm: new Date()
      },
      { new: true }
    )

    if (!orcamento) {
      return res.status(404).json({ error: 'Orçamento não encontrado' })
    }

    orcamento.adicionarHistorico('reativado', null, 'Orçamento reativado pelo usuário')
    await orcamento.save()

    res.json({
      success: true,
      message: 'Orçamento reativado com sucesso',
      data: orcamento
    })

  } catch (err) {
    console.error('Erro ao reativar orçamento:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getResumo = async (req, res) => {
  try {
    const agora = new Date()
    
    const resumo = await Budget.getResumo(req.userId)
    
    // Buscar orçamentos que precisam de atenção
    const orcamentosAtencao = await Budget.find({
      userId: req.userId,
      dataInicio: { $lte: agora },
      dataFim: { $gte: agora },
      status: 'ativo'
    }).lean()

    const alertas = []
    const estatisticas = {
      total: 0,
      ativos: 0,
      excedidos: 0,
      emAlerta: 0,
      vencendoEm7Dias: 0,
      totalLimite: 0,
      totalGasto: 0
    }

    for (const orcamento of orcamentosAtencao) {
      // Recalcular valores em tempo real
      const transacoes = await Transaction.find({
        userId: req.userId,
        categoria: orcamento.categoria,
        tipo: 'despesa',
        data: {
          $gte: orcamento.dataInicio,
          $lte: orcamento.dataFim
        }
      })

      const valorGasto = transacoes.reduce((sum, t) => sum + t.valor, 0)
      const porcentagem = orcamento.valorLimite > 0 ? (valorGasto / orcamento.valorLimite) * 100 : 0
      const diasRestantes = Math.ceil((orcamento.dataFim - agora) / (1000 * 60 * 60 * 24))

      estatisticas.total++
      estatisticas.ativos++
      estatisticas.totalLimite += orcamento.valorLimite
      estatisticas.totalGasto += valorGasto

      if (porcentagem >= 100) {
        estatisticas.excedidos++
        alertas.push({
          tipo: 'excedido',
          orcamento: orcamento.nome,
          porcentagem: Math.round(porcentagem)
        })
      } else if (porcentagem >= 80) {
        estatisticas.emAlerta++
        alertas.push({
          tipo: 'alerta',
          orcamento: orcamento.nome,
          porcentagem: Math.round(porcentagem)
        })
      }

      if (diasRestantes <= 7 && diasRestantes > 0) {
        estatisticas.vencendoEm7Dias++
        alertas.push({
          tipo: 'vencimento',
          orcamento: orcamento.nome,
          dias: diasRestantes
        })
      }
    }

    res.json({
      success: true,
      data: {
        estatisticas,
        alertas,
        eficiencia: estatisticas.totalLimite > 0 ? 
          Math.round((1 - (estatisticas.totalGasto / estatisticas.totalLimite)) * 100) : 0
      }
    })

  } catch (err) {
    console.error('Erro ao buscar resumo:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getHistorico = async (req, res) => {
  try {
    const { id } = req.params

    const orcamento = await Budget.findOne({
      _id: id,
      userId: req.userId
    }).select('historico nome')

    if (!orcamento) {
      return res.status(404).json({ error: 'Orçamento não encontrado' })
    }

    res.json({
      success: true,
      data: {
        orcamento: orcamento.nome,
        historico: orcamento.historico.sort((a, b) => b.data - a.data)
      }
    })

  } catch (err) {
    console.error('Erro ao buscar histórico:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.processarVencimentos = async (req, res) => {
  try {
    const agora = new Date()
    
    // Buscar orçamentos que venceram
    const orcamentosVencidos = await Budget.find({
      dataFim: { $lt: agora },
      status: 'ativo'
    })

    const processados = {
      finalizados: 0,
      renovados: 0,
      erros: 0
    }

    for (const orcamento of orcamentosVencidos) {
      try {
        if (orcamento.renovacaoAutomatica) {
          const renovado = orcamento.renovar()
          if (renovado) {
            await orcamento.save()
            processados.renovados++
          } else {
            orcamento.status = 'finalizado'
            await orcamento.save()
            processados.finalizados++
          }
        } else {
          orcamento.status = 'finalizado'
          orcamento.adicionarHistorico('finalizado', null, 'Orçamento finalizado automaticamente')
          await orcamento.save()
          processados.finalizados++
        }
      } catch (err) {
        console.error(`Erro ao processar orçamento ${orcamento._id}:`, err)
        processados.erros++
      }
    }

    res.json({
      success: true,
      message: 'Vencimentos processados com sucesso',
      data: processados
    })

  } catch (err) {
    console.error('Erro ao processar vencimentos:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

// Função auxiliar para gerar alertas
function gerarAlertasOrcamento(orcamento, estatisticas) {
  const alertas = []

  if (estatisticas.porcentagemGasta >= 100) {
    alertas.push({
      tipo: 'erro',
      titulo: 'Orçamento Excedido',
      mensagem: `Você já gastou ${estatisticas.porcentagemGasta}% do orçamento`,
      valor: estatisticas.valorGasto - orcamento.valorLimite
    })
  } else if (estatisticas.porcentagemGasta >= 90) {
    alertas.push({
      tipo: 'warning',
      titulo: 'Orçamento Quase Esgotado',
      mensagem: `Você já gastou ${estatisticas.porcentagemGasta}% do orçamento`,
      valor: estatisticas.valorRestante
    })
  } else if (estatisticas.porcentagemGasta >= 75) {
    alertas.push({
      tipo: 'info',
      titulo: 'Atenção ao Orçamento',
      mensagem: `Você já gastou ${estatisticas.porcentagemGasta}% do orçamento`,
      valor: estatisticas.valorRestante
    })
  }

  if (estatisticas.diasRestantes <= 7 && estatisticas.diasRestantes > 0) {
    alertas.push({
      tipo: 'warning',
      titulo: 'Orçamento Vencendo',
      mensagem: `Este orçamento vence em ${estatisticas.diasRestantes} dias`,
      valor: estatisticas.diasRestantes
    })
  }

  if (estatisticas.projecaoFinal > orcamento.valorLimite) {
    const excesso = estatisticas.projecaoFinal - orcamento.valorLimite
    alertas.push({
      tipo: 'warning',
      titulo: 'Projeção de Excesso',
      mensagem: `Mantendo o ritmo atual, você pode exceder o orçamento em R$ ${excesso.toFixed(2)}`,
      valor: excesso
    })
  }

  return alertas
}