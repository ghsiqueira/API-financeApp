const Goal = require('../models/Goal')
const Transaction = require('../models/Transaction')
const { validationResult } = require('express-validator')
const mongoose = require('mongoose')

exports.getAll = async (req, res) => {
  try {
    const { 
      status, 
      categoria, 
      prioridade,
      page = 1,
      limit = 20,
      sortBy = 'dataLimite',
      sortOrder = 'asc'
    } = req.query

    // Construir filtros
    const filtros = { userId: req.userId }
    
    if (status) filtros.status = status
    if (categoria) filtros.categoria = categoria
    if (prioridade) filtros.prioridade = prioridade

    // Configurar paginação
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Configurar ordenação
    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1

    // Buscar metas
    const [metas, total] = await Promise.all([
      Goal.find(filtros)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Goal.countDocuments(filtros)
    ])

    // Enriquecer dados das metas
    const metasEnriquecidas = metas.map(meta => {
      const diasRestantes = Math.max(0, Math.ceil((new Date(meta.dataLimite) - new Date()) / (1000 * 60 * 60 * 24)))
      const porcentagemConcluida = meta.valorAlvo > 0 ? Math.min(100, Math.round((meta.valorAtual / meta.valorAlvo) * 100)) : 0
      const valorRestante = Math.max(0, meta.valorAlvo - meta.valorAtual)
      
      return {
        ...meta,
        diasRestantes,
        porcentagemConcluida,
        valorRestante,
        estaConcluida: meta.valorAtual >= meta.valorAlvo,
        valorMensalNecessario: diasRestantes > 0 ? 
          Math.ceil(valorRestante / Math.max(1, Math.ceil(diasRestantes / 30))) : 0,
        valorDiarioNecessario: diasRestantes > 0 ? 
          Math.ceil(valorRestante / diasRestantes) : 0
      }
    })

    // Calcular estatísticas gerais
    const estatisticas = metasEnriquecidas.reduce((acc, meta) => {
      acc.total++
      acc.valorTotalAlvo += meta.valorAlvo
      acc.valorTotalAtual += meta.valorAtual
      
      if (meta.estaConcluida) acc.concluidas++
      if (meta.status === 'ativa' && !meta.estaConcluida) acc.ativas++
      if (meta.diasRestantes <= 30 && meta.diasRestantes > 0 && !meta.estaConcluida) acc.vencendoEm30Dias++
      if (meta.prioridade === 'alta') acc.altaPrioridade++
      
      return acc
    }, {
      total: 0,
      concluidas: 0,
      ativas: 0,
      vencendoEm30Dias: 0,
      altaPrioridade: 0,
      valorTotalAlvo: 0,
      valorTotalAtual: 0
    })

    estatisticas.porcentagemGeralConcluida = estatisticas.valorTotalAlvo > 0 ? 
      Math.round((estatisticas.valorTotalAtual / estatisticas.valorTotalAlvo) * 100) : 0

    res.json({
      success: true,
      data: {
        metas: metasEnriquecidas,
        paginacao: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        },
        estatisticas
      }
    })

  } catch (err) {
    console.error('Erro ao buscar metas:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getById = async (req, res) => {
  try {
    const { id } = req.params

    const meta = await Goal.findOne({
      _id: id,
      userId: req.userId
    })

    if (!meta) {
      return res.status(404).json({ error: 'Meta não encontrada' })
    }

    // Calcular estatísticas detalhadas
    const estatisticas = meta.calcularEstatisticas()
    const diasRestantes = meta.diasRestantes()
    const valorMensalNecessario = meta.valorMensalNecessario()
    const valorDiarioNecessario = meta.valorDiarioNecessario()

    // Buscar transações relacionadas (se houver)
    const transacoesRelacionadas = await Transaction.find({
      metaId: id,
      userId: req.userId
    }).sort({ data: -1 })

    // Calcular progresso por mês
    const progressoPorMes = calcularProgressoPorMes(meta.contribuicoes, meta.dataInicio)

    // Verificar milestones alcançados
    const milestonesAlcancados = meta.milestones.filter(m => m.alcancado).length

    res.json({
      success: true,
      data: {
        meta: {
          ...meta.toObject(),
          diasRestantes,
          valorMensalNecessario,
          valorDiarioNecessario,
          porcentagemConcluida: meta.porcentagemConcluida,
          valorRestante: meta.valorRestante,
          estaConcluida: meta.estaConcluida
        },
        estatisticas,
        transacoesRelacionadas,
        progressoPorMes,
        milestonesAlcancados,
        alertas: gerarAlertasMeta(meta, diasRestantes, valorMensalNecessario)
      }
    })

  } catch (err) {
    console.error('Erro ao buscar meta:', err)
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

    const dadosMeta = { ...req.body, userId: req.userId }

    // Validar datas
    if (new Date(dadosMeta.dataLimite) <= new Date()) {
      return res.status(400).json({ error: 'Data limite deve ser futura' })
    }

    // Criar milestones automáticos se não fornecidos
    if (!dadosMeta.milestones || dadosMeta.milestones.length === 0) {
      dadosMeta.milestones = criarMilestonesAutomaticos(dadosMeta.valorAlvo)
    }

    // Criar meta
    const meta = await Goal.create(dadosMeta)

    res.status(201).json({
      success: true,
      message: 'Meta criada com sucesso',
      data: meta
    })

  } catch (err) {
    console.error('Erro ao criar meta:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.update = async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const meta = await Goal.findOne({
      _id: id,
      userId: req.userId
    })

    if (!meta) {
      return res.status(404).json({ error: 'Meta não encontrada' })
    }

    // Não permitir alterar valor atual diretamente (usar contribuições)
    if (updates.valorAtual !== undefined) {
      delete updates.valorAtual
    }

    // Aplicar atualizações
    Object.keys(updates).forEach(key => {
      if (key !== 'userId' && key !== 'contribuicoes') {
        meta[key] = updates[key]
      }
    })

    // Recriar milestones se valor alvo mudou
    if (updates.valorAlvo && updates.valorAlvo !== meta.valorAlvo) {
      meta.milestones = criarMilestonesAutomaticos(updates.valorAlvo)
      meta.verificarMilestones()
    }

    await meta.save()

    res.json({
      success: true,
      message: 'Meta atualizada com sucesso',
      data: meta
    })

  } catch (err) {
    console.error('Erro ao atualizar meta:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.remove = async (req, res) => {
  try {
    const { id } = req.params

    const meta = await Goal.findOne({
      _id: id,
      userId: req.userId
    })

    if (!meta) {
      return res.status(404).json({ error: 'Meta não encontrada' })
    }

    // Remover referências em transações
    await Transaction.updateMany(
      { metaId: id },
      { $unset: { metaId: 1 } }
    )

    // Deletar meta
    await Goal.deleteOne({ _id: id, userId: req.userId })

    res.json({
      success: true,
      message: 'Meta removida com sucesso'
    })

  } catch (err) {
    console.error('Erro ao remover meta:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.addContribuicao = async (req, res) => {
  try {
    const { id } = req.params
    const { valor, nota = '', tipo = 'contribuicao' } = req.body

    if (!valor || valor <= 0) {
      return res.status(400).json({ error: 'Valor deve ser maior que zero' })
    }

    const meta = await Goal.findOne({
      _id: id,
      userId: req.userId
    })

    if (!meta) {
      return res.status(404).json({ error: 'Meta não encontrada' })
    }

    if (meta.status !== 'ativa') {
      return res.status(400).json({ error: 'Não é possível contribuir para uma meta inativa' })
    }

    // Adicionar contribuição
    const valorAnterior = meta.valorAtual
    meta.adicionarContribuicao(valor, nota, tipo)
    
    // Verificar se a meta foi concluída
    const foiConcluida = !meta.estaConcluida && valorAnterior < meta.valorAlvo && meta.valorAtual >= meta.valorAlvo

    await meta.save()

    let mensagem = `${tipo === 'contribuicao' ? 'Contribuição' : tipo === 'retirada' ? 'Retirada' : 'Ajuste'} registrado com sucesso`
    if (foiConcluida) {
      mensagem += '. Parabéns! Meta concluída! 🎉'
    }

    res.json({
      success: true,
      message: mensagem,
      data: {
        meta,
        contribuicaoAdicionada: {
          valor,
          nota,
          tipo,
          data: new Date()
        },
        metaConcluida: foiConcluida
      }
    })

  } catch (err) {
    console.error('Erro ao adicionar contribuição:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.pausar = async (req, res) => {
  try {
    const { id } = req.params

    const meta = await Goal.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { 
        status: 'pausada',
        atualizadoEm: new Date()
      },
      { new: true }
    )

    if (!meta) {
      return res.status(404).json({ error: 'Meta não encontrada' })
    }

    res.json({
      success: true,
      message: 'Meta pausada com sucesso',
      data: meta
    })

  } catch (err) {
    console.error('Erro ao pausar meta:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.reativar = async (req, res) => {
  try {
    const { id } = req.params

    const meta = await Goal.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { 
        status: 'ativa',
        atualizadoEm: new Date()
      },
      { new: true }
    )

    if (!meta) {
      return res.status(404).json({ error: 'Meta não encontrada' })
    }

    res.json({
      success: true,
      message: 'Meta reativada com sucesso',
      data: meta
    })

  } catch (err) {
    console.error('Erro ao reativar meta:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.concluir = async (req, res) => {
  try {
    const { id } = req.params

    const meta = await Goal.findOne({
      _id: id,
      userId: req.userId
    })

    if (!meta) {
      return res.status(404).json({ error: 'Meta não encontrada' })
    }

    if (meta.valorAtual < meta.valorAlvo) {
      return res.status(400).json({ 
        error: 'Meta não pode ser concluída pois o valor alvo ainda não foi atingido' 
      })
    }

    meta.status = 'concluida'
    await meta.save()

    res.json({
      success: true,
      message: 'Parabéns! Meta concluída com sucesso! 🎉',
      data: meta
    })

  } catch (err) {
    console.error('Erro ao concluir meta:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getResumo = async (req, res) => {
  try {
    const { periodo = 'todas' } = req.query
    
    let filtroData = {}
    if (periodo !== 'todas') {
      const agora = new Date()
      switch (periodo) {
        case 'mes':
          filtroData.dataLimite = { 
            $gte: agora,
            $lte: new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
          }
          break
        case 'trimestre':
          filtroData.dataLimite = {
            $gte: agora,
            $lte: new Date(agora.getFullYear(), agora.getMonth() + 3, 0)
          }
          break
        case 'ano':
          filtroData.dataLimite = {
            $gte: agora,
            $lte: new Date(agora.getFullYear(), 11, 31)
          }
          break
      }
    }

    const metas = await Goal.find({
      userId: req.userId,
      ...filtroData
    })

    const resumo = {
      total: metas.length,
      ativas: 0,
      concluidas: 0,
      pausadas: 0,
      canceladas: 0,
      valorTotalAlvo: 0,
      valorTotalAtual: 0,
      porCategoria: {},
      porPrioridade: { alta: 0, media: 0, baixa: 0 },
      metasVencendoEm30Dias: 0,
      metasAtrasadas: 0,
      eficienciaGeral: 0
    }

    const agora = new Date()
    
    metas.forEach(meta => {
      // Contadores por status
      resumo[meta.status]++
      
      // Totais
      resumo.valorTotalAlvo += meta.valorAlvo
      resumo.valorTotalAtual += meta.valorAtual
      
      // Por categoria
      if (!resumo.porCategoria[meta.categoria]) {
        resumo.porCategoria[meta.categoria] = { count: 0, valorAlvo: 0, valorAtual: 0 }
      }
      resumo.porCategoria[meta.categoria].count++
      resumo.porCategoria[meta.categoria].valorAlvo += meta.valorAlvo
      resumo.porCategoria[meta.categoria].valorAtual += meta.valorAtual
      
      // Por prioridade
      resumo.porPrioridade[meta.prioridade]++
      
      // Metas vencendo
      const diasRestantes = Math.ceil((meta.dataLimite - agora) / (1000 * 60 * 60 * 24))
      if (diasRestantes <= 30 && diasRestantes > 0 && meta.status === 'ativa') {
        resumo.metasVencendoEm30Dias++
      }
      
      // Metas atrasadas
      if (diasRestantes < 0 && meta.status === 'ativa' && meta.valorAtual < meta.valorAlvo) {
        resumo.metasAtrasadas++
      }
    })

    // Calcular eficiência geral
    resumo.eficienciaGeral = resumo.valorTotalAlvo > 0 ? 
      Math.round((resumo.valorTotalAtual / resumo.valorTotalAlvo) * 100) : 0

    // Calcular porcentagem por categoria
    Object.keys(resumo.porCategoria).forEach(categoria => {
      const cat = resumo.porCategoria[categoria]
      cat.porcentagem = cat.valorAlvo > 0 ? Math.round((cat.valorAtual / cat.valorAlvo) * 100) : 0
    })

    res.json({
      success: true,
      data: resumo
    })

  } catch (err) {
    console.error('Erro ao buscar resumo:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getRelatorio = async (req, res) => {
  try {
    const { dataInicio, dataFim, categoria, status } = req.query

    const filtros = { userId: req.userId }
    
    if (categoria) filtros.categoria = categoria
    if (status) filtros.status = status
    
    if (dataInicio || dataFim) {
      filtros.$or = []
      
      if (dataInicio && dataFim) {
        filtros.$or.push({
          dataInicio: { $lte: new Date(dataFim) },
          dataLimite: { $gte: new Date(dataInicio) }
        })
      } else if (dataInicio) {
        filtros.dataLimite = { $gte: new Date(dataInicio) }
      } else if (dataFim) {
        filtros.dataInicio = { $lte: new Date(dataFim) }
      }
    }

    const metas = await Goal.find(filtros).sort({ dataLimite: 1 })

    const relatorio = {
      periodo: {
        inicio: dataInicio ? new Date(dataInicio) : null,
        fim: dataFim ? new Date(dataFim) : null
      },
      totalMetas: metas.length,
      metasDetalhadas: [],
      estatisticas: {
        concluidas: 0,
        emAndamento: 0,
        atrasadas: 0,
        totalInvestido: 0,
        totalAlvo: 0,
        mediaTempoConclusao: 0,
        sucessoRate: 0
      },
      insights: []
    }

    const agora = new Date()
    let tempoTotalConclusao = 0
    let metasConcluidas = 0

    metas.forEach(meta => {
      const diasRestantes = Math.ceil((meta.dataLimite - agora) / (1000 * 60 * 60 * 24))
      const diasDecorridos = Math.ceil((agora - meta.dataInicio) / (1000 * 60 * 60 * 24))
      const porcentagemConcluida = meta.valorAlvo > 0 ? (meta.valorAtual / meta.valorAlvo) * 100 : 0
      
      const metaDetalhada = {
        ...meta.toObject(),
        diasRestantes,
        diasDecorridos,
        porcentagemConcluida: Math.round(porcentagemConcluida),
        valorRestante: Math.max(0, meta.valorAlvo - meta.valorAtual),
        status: meta.status,
        performance: calcularPerformanceMeta(meta, diasDecorridos, diasRestantes)
      }

      relatorio.metasDetalhadas.push(metaDetalhada)
      relatorio.estatisticas.totalInvestido += meta.valorAtual
      relatorio.estatisticas.totalAlvo += meta.valorAlvo

      if (meta.status === 'concluida') {
        relatorio.estatisticas.concluidas++
        metasConcluidas++
        
        // Calcular tempo de conclusão
        const tempoConclusao = Math.ceil((meta.atualizadoEm - meta.dataInicio) / (1000 * 60 * 60 * 24))
        tempoTotalConclusao += tempoConclusao
      } else if (meta.status === 'ativa') {
        if (diasRestantes < 0 && porcentagemConcluida < 100) {
          relatorio.estatisticas.atrasadas++
        } else {
          relatorio.estatisticas.emAndamento++
        }
      }
    })

    // Calcular médias e taxa de sucesso
    if (metasConcluidas > 0) {
      relatorio.estatisticas.mediaTempoConclusao = Math.round(tempoTotalConclusao / metasConcluidas)
    }
    
    relatorio.estatisticas.sucessoRate = metas.length > 0 ? 
      Math.round((relatorio.estatisticas.concluidas / metas.length) * 100) : 0

    // Gerar insights
    relatorio.insights = gerarInsightsMetas(relatorio)

    res.json({
      success: true,
      data: relatorio
    })

  } catch (err) {
    console.error('Erro ao gerar relatório:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

// Funções auxiliares
function criarMilestonesAutomaticos(valorAlvo) {
  const milestones = []
  const percentuais = [25, 50, 75, 90]
  
  percentuais.forEach(percentual => {
    milestones.push({
      nome: `${percentual}% da meta`,
      valor: Math.round((valorAlvo * percentual) / 100),
      alcancado: false
    })
  })
  
  return milestones
}

function calcularProgressoPorMes(contribuicoes, dataInicio) {
  const progresso = {}
  const inicio = new Date(dataInicio)
  
  contribuicoes.forEach(contrib => {
    const data = new Date(contrib.data)
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
    
    if (!progresso[chave]) {
      progresso[chave] = {
        mes: chave,
        contribuicoes: 0,
        retiradas: 0,
        liquido: 0,
        count: 0
      }
    }
    
    if (contrib.tipo === 'contribuicao') {
      progresso[chave].contribuicoes += contrib.valor
      progresso[chave].liquido += contrib.valor
    } else if (contrib.tipo === 'retirada') {
      progresso[chave].retiradas += contrib.valor
      progresso[chave].liquido -= contrib.valor
    }
    
    progresso[chave].count++
  })
  
  return Object.values(progresso).sort((a, b) => a.mes.localeCompare(b.mes))
}

function gerarAlertasMeta(meta, diasRestantes, valorMensalNecessario) {
  const alertas = []
  const porcentagem = meta.porcentagemConcluida

  if (meta.estaConcluida) {
    alertas.push({
      tipo: 'success',
      titulo: 'Meta Concluída! 🎉',
      mensagem: 'Parabéns! Você atingiu sua meta!',
      valor: meta.valorAtual
    })
  } else if (diasRestantes < 0) {
    alertas.push({
      tipo: 'error',
      titulo: 'Meta Vencida',
      mensagem: `Esta meta venceu há ${Math.abs(diasRestantes)} dias`,
      valor: meta.valorRestante
    })
  } else if (diasRestantes <= 30) {
    alertas.push({
      tipo: 'warning',
      titulo: 'Meta Vencendo',
      mensagem: `Restam apenas ${diasRestantes} dias para esta meta`,
      valor: valorMensalNecessario
    })
  }

  if (!meta.estaConcluida && valorMensalNecessario > 0) {
    if (valorMensalNecessario > 10000) {
      alertas.push({
        tipo: 'warning',
        titulo: 'Valor Alto Necessário',
        mensagem: `Você precisa economizar R$ ${valorMensalNecessario} por mês`,
        valor: valorMensalNecessario
      })
    } else if (diasRestantes <= 7) {
      const valorDiario = Math.ceil(meta.valorRestante / diasRestantes)
      alertas.push({
        tipo: 'info',
        titulo: 'Sprint Final',
        mensagem: `Você precisa economizar R$ ${valorDiario} por dia`,
        valor: valorDiario
      })
    }
  }

  // Verificar milestones próximos
  const proximoMilestone = meta.milestones.find(m => !m.alcancado && m.valor > meta.valorAtual)
  if (proximoMilestone) {
    const faltaPara = proximoMilestone.valor - meta.valorAtual
    if (faltaPara <= valorMensalNecessario * 0.1) { // Menos de 10% do valor mensal
      alertas.push({
        tipo: 'info',
        titulo: 'Milestone Próximo',
        mensagem: `Faltam apenas R$ ${faltaPara.toFixed(2)} para "${proximoMilestone.nome}"`,
        valor: faltaPara
      })
    }
  }

  return alertas
}

function calcularPerformanceMeta(meta, diasDecorridos, diasRestantes) {
  const totalDias = diasDecorridos + Math.max(0, diasRestantes)
  const porcentagemTempo = totalDias > 0 ? (diasDecorridos / totalDias) * 100 : 0
  const porcentagemConcluida = meta.valorAlvo > 0 ? (meta.valorAtual / meta.valorAlvo) * 100 : 0
  
  let performance = 'no_prazo'
  let score = porcentagemConcluida - porcentagemTempo
  
  if (score > 10) {
    performance = 'adiantada'
  } else if (score < -10) {
    performance = 'atrasada'
  }
  
  return {
    status: performance,
    score: Math.round(score),
    porcentagemTempo: Math.round(porcentagemTempo),
    porcentagemConcluida: Math.round(porcentagemConcluida)
  }
}

function gerarInsightsMetas(relatorio) {
  const insights = []
  
  // Insight sobre taxa de sucesso
  if (relatorio.estatisticas.sucessoRate >= 80) {
    insights.push({
      tipo: 'positivo',
      titulo: 'Excelente Taxa de Sucesso',
      mensagem: `Você tem uma taxa de sucesso de ${relatorio.estatisticas.sucessoRate}% em suas metas!`
    })
  } else if (relatorio.estatisticas.sucessoRate < 50) {
    insights.push({
      tipo: 'atencao',
      titulo: 'Taxa de Sucesso Baixa',
      mensagem: `Sua taxa de sucesso é de ${relatorio.estatisticas.sucessoRate}%. Considere revisar suas metas.`
    })
  }
  
  // Insight sobre metas atrasadas
  if (relatorio.estatisticas.atrasadas > 0) {
    insights.push({
      tipo: 'alerta',
      titulo: 'Metas em Atraso',
      mensagem: `Você tem ${relatorio.estatisticas.atrasadas} meta(s) em atraso. Revisite seus prazos.`
    })
  }
  
  // Insight sobre valor investido
  const porcentagemInvestida = relatorio.estatisticas.totalAlvo > 0 ? 
    (relatorio.estatisticas.totalInvestido / relatorio.estatisticas.totalAlvo) * 100 : 0
  
  if (porcentagemInvestida >= 90) {
    insights.push({
      tipo: 'positivo',
      titulo: 'Quase Lá!',
      mensagem: `Você já investiu ${Math.round(porcentagemInvestida)}% do valor total de suas metas!`
    })
  }
  
  return insights
}