const Transaction = require('../models/Transaction')
const Budget = require('../models/Budget')
const Goal = require('../models/Goal')
const Category = require('../models/Category')
const mongoose = require('mongoose')

exports.getOverview = async (req, res) => {
  try {
    const userId = req.userId
    const { periodo = 'mes', ano, mes } = req.query

    // Definir datas baseado no período
    let dataInicio, dataFim
    const agora = new Date()

    switch (periodo) {
      case 'semana':
        dataInicio = new Date(agora)
        dataInicio.setDate(agora.getDate() - agora.getDay())
        dataInicio.setHours(0, 0, 0, 0)
        dataFim = new Date(dataInicio)
        dataFim.setDate(dataInicio.getDate() + 6)
        dataFim.setHours(23, 59, 59, 999)
        break
      
      case 'mes':
        dataInicio = new Date(ano || agora.getFullYear(), (mes || agora.getMonth()), 1)
        dataFim = new Date(ano || agora.getFullYear(), (mes || agora.getMonth()) + 1, 0)
        dataFim.setHours(23, 59, 59, 999)
        break
      
      case 'ano':
        dataInicio = new Date(ano || agora.getFullYear(), 0, 1)
        dataFim = new Date(ano || agora.getFullYear(), 11, 31, 23, 59, 59, 999)
        break
      
      default:
        // Mês atual
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
        dataFim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
        dataFim.setHours(23, 59, 59, 999)
    }

    // Buscar dados em paralelo para melhor performance
    const [
      transacoes,
      orcamentos,
      metas,
      estatisticasCategorias
    ] = await Promise.all([
      // Transações do período
      Transaction.find({
        userId,
        data: { $gte: dataInicio, $lte: dataFim }
      }).sort({ data: -1 }),

      // Orçamentos ativos
      Budget.find({
        userId,
        dataInicio: { $lte: dataFim },
        dataFim: { $gte: dataInicio }
      }),

      // Metas ativas
      Goal.find({
        userId,
        status: 'ativa'
      }).sort({ dataLimite: 1 }),

      // Estatísticas por categoria
      Transaction.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(userId),
            data: { $gte: dataInicio, $lte: dataFim }
          }
        },
        {
          $group: {
            _id: { categoria: '$categoria', tipo: '$tipo' },
            total: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { total: -1 }
        }
      ])
    ])

    // Calcular resumo financeiro
    const receitas = transacoes
      .filter(t => t.tipo === 'receita')
      .reduce((sum, t) => sum + t.valor, 0)
    
    const despesas = transacoes
      .filter(t => t.tipo === 'despesa')
      .reduce((sum, t) => sum + t.valor, 0)
    
    const saldo = receitas - despesas

    // Processar orçamentos
    const resumoOrcamentos = {
      total: orcamentos.length,
      totalLimite: orcamentos.reduce((sum, o) => sum + o.valorLimite, 0),
      totalGasto: orcamentos.reduce((sum, o) => sum + o.valorGasto, 0),
      excedidos: orcamentos.filter(o => o.valorGasto > o.valorLimite).length,
      proximosVencimento: orcamentos.filter(o => {
        const diasRestantes = Math.ceil((o.dataFim - agora) / (1000 * 60 * 60 * 24))
        return diasRestantes <= 7 && diasRestantes > 0
      }).length
    }

    // Processar metas
    const resumoMetas = {
      total: metas.length,
      concluidas: metas.filter(m => m.estaConcluida).length,
      emAndamento: metas.filter(m => !m.estaConcluida && m.status === 'ativa').length,
      proximasVencimento: metas.filter(m => {
        const diasRestantes = m.diasRestantes()
        return diasRestantes <= 30 && diasRestantes > 0
      }).length,
      totalValorAlvo: metas.reduce((sum, m) => sum + m.valorAlvo, 0),
      totalValorAtual: metas.reduce((sum, m) => sum + m.valorAtual, 0)
    }

    // Top categorias
    const topCategorias = {
      receitas: estatisticasCategorias
        .filter(c => c._id.tipo === 'receita')
        .slice(0, 5),
      despesas: estatisticasCategorias
        .filter(c => c._id.tipo === 'despesa')
        .slice(0, 5)
    }

    // Transações recentes (últimas 10)
    const transacoesRecentes = transacoes.slice(0, 10)

    // Calcular evolução (comparar com período anterior)
    let dataInicioAnterior, dataFimAnterior
    const diff = dataFim - dataInicio
    dataFimAnterior = new Date(dataInicio.getTime() - 1)
    dataInicioAnterior = new Date(dataFimAnterior.getTime() - diff)

    const transacoesAnteriores = await Transaction.find({
      userId,
      data: { $gte: dataInicioAnterior, $lte: dataFimAnterior }
    })

    const receitasAnteriores = transacoesAnteriores
      .filter(t => t.tipo === 'receita')
      .reduce((sum, t) => sum + t.valor, 0)
    
    const despesasAnteriores = transacoesAnteriores
      .filter(t => t.tipo === 'despesa')
      .reduce((sum, t) => sum + t.valor, 0)

    const evolucao = {
      receitas: receitasAnteriores > 0 ? ((receitas - receitasAnteriores) / receitasAnteriores) * 100 : 0,
      despesas: despesasAnteriores > 0 ? ((despesas - despesasAnteriores) / despesasAnteriores) * 100 : 0,
      saldo: (receitasAnteriores - despesasAnteriores) > 0 ? 
        ((saldo - (receitasAnteriores - despesasAnteriores)) / (receitasAnteriores - despesasAnteriores)) * 100 : 0
    }

    res.json({
      success: true,
      data: {
        periodo: {
          tipo: periodo,
          dataInicio,
          dataFim
        },
        resumoFinanceiro: {
          receitas: Math.round(receitas * 100) / 100,
          despesas: Math.round(despesas * 100) / 100,
          saldo: Math.round(saldo * 100) / 100,
          totalTransacoes: transacoes.length
        },
        evolucao: {
          receitas: Math.round(evolucao.receitas * 100) / 100,
          despesas: Math.round(evolucao.despesas * 100) / 100,
          saldo: Math.round(evolucao.saldo * 100) / 100
        },
        orcamentos: resumoOrcamentos,
        metas: resumoMetas,
        topCategorias,
        transacoesRecentes,
        alertas: await gerarAlertas(userId, orcamentos, metas)
      }
    })

  } catch (err) {
    console.error('Erro ao buscar overview:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getChartData = async (req, res) => {
  try {
    const userId = req.userId
    const { tipo, periodo = 'mes', categoria } = req.query

    let dataInicio, dataFim, agrupamento
    const agora = new Date()

    // Definir período e agrupamento
    switch (periodo) {
      case 'semana':
        dataInicio = new Date(agora)
        dataInicio.setDate(agora.getDate() - 6)
        dataFim = agora
        agrupamento = { $dayOfYear: '$data' }
        break
      
      case 'mes':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
        dataFim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
        agrupamento = { $dayOfMonth: '$data' }
        break
      
      case 'ano':
        dataInicio = new Date(agora.getFullYear(), 0, 1)
        dataFim = new Date(agora.getFullYear(), 11, 31)
        agrupamento = { $month: '$data' }
        break
      
      case '6meses':
        dataInicio = new Date(agora)
        dataInicio.setMonth(agora.getMonth() - 5)
        dataInicio.setDate(1)
        dataFim = agora
        agrupamento = { $month: '$data' }
        break
    }

    const match = {
      userId: mongoose.Types.ObjectId(userId),
      data: { $gte: dataInicio, $lte: dataFim }
    }

    if (tipo && tipo !== 'ambos') {
      match.tipo = tipo
    }

    if (categoria) {
      match.categoria = categoria
    }

    // Dados para gráfico de linha (evolução temporal)
    const evolucaoTemporal = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            periodo: agrupamento,
            tipo: '$tipo'
          },
          total: { $sum: '$valor' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.periodo': 1 } }
    ])

    // Dados para gráfico de pizza (por categoria)
    const porCategoria = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { categoria: '$categoria', tipo: '$tipo' },
          total: { $sum: '$valor' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ])

    // Dados para gráfico de barras (receitas vs despesas)
    const receitasVsDespesas = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            periodo: agrupamento,
            tipo: '$tipo'
          },
          total: { $sum: '$valor' }
        }
      },
      { $sort: { '_id.periodo': 1 } }
    ])

    res.json({
      success: true,
      data: {
        evolucaoTemporal,
        porCategoria,
        receitasVsDespesas,
        periodo: {
          inicio: dataInicio,
          fim: dataFim,
          tipo: periodo
        }
      }
    })

  } catch (err) {
    console.error('Erro ao buscar dados do gráfico:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getRelatorioCompleto = async (req, res) => {
  try {
    const userId = req.userId
    const { dataInicio, dataFim, incluirOrcamentos = true, incluirMetas = true } = req.query

    const inicio = new Date(dataInicio)
    const fim = new Date(dataFim)

    // Validar datas
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      return res.status(400).json({ error: 'Datas inválidas' })
    }

    if (inicio > fim) {
      return res.status(400).json({ error: 'Data de início deve ser anterior à data de fim' })
    }

    const [
      transacoes,
      estatisticasDetalhadas,
      orcamentos,
      metas,
      tendencias
    ] = await Promise.all([
      // Todas as transações do período
      Transaction.find({
        userId,
        data: { $gte: inicio, $lte: fim }
      }).sort({ data: -1 }),

      // Estatísticas detalhadas
      Transaction.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(userId),
            data: { $gte: inicio, $lte: fim }
          }
        },
        {
          $group: {
            _id: {
              categoria: '$categoria',
              tipo: '$tipo',
              metodoPagamento: '$metodoPagamento'
            },
            total: { $sum: '$valor' },
            count: { $sum: 1 },
            media: { $avg: '$valor' },
            maior: { $max: '$valor' },
            menor: { $min: '$valor' }
          }
        }
      ]),

      // Orçamentos do período (se solicitado)
      incluirOrcamentos ? Budget.find({
        userId,
        $or: [
          { dataInicio: { $lte: fim }, dataFim: { $gte: inicio } }
        ]
      }) : [],

      // Metas do período (se solicitado)
      incluirMetas ? Goal.find({
        userId,
        $or: [
          { dataInicio: { $lte: fim }, dataLimite: { $gte: inicio } }
        ]
      }) : [],

      // Análise de tendências
      Transaction.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(userId),
            data: { $gte: inicio, $lte: fim }
          }
        },
        {
          $group: {
            _id: {
              ano: { $year: '$data' },
              mes: { $month: '$data' },
              tipo: '$tipo'
            },
            total: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.ano': 1, '_id.mes': 1 } }
      ])
    ])

    // Processar dados
    const receitas = transacoes.filter(t => t.tipo === 'receita')
    const despesas = transacoes.filter(t => t.tipo === 'despesa')
    
    const totalReceitas = receitas.reduce((sum, t) => sum + t.valor, 0)
    const totalDespesas = despesas.reduce((sum, t) => sum + t.valor, 0)
    const saldoFinal = totalReceitas - totalDespesas

    // Análise por categorias
    const categorias = {}
    estatisticasDetalhadas.forEach(stat => {
      const key = `${stat._id.categoria}_${stat._id.tipo}`
      if (!categorias[key]) {
        categorias[key] = {
          categoria: stat._id.categoria,
          tipo: stat._id.tipo,
          total: 0,
          transacoes: 0,
          media: 0,
          metodosUtilizados: new Set()
        }
      }
      categorias[key].total += stat.total
      categorias[key].transacoes += stat.count
      categorias[key].media = categorias[key].total / categorias[key].transacoes
      categorias[key].metodosUtilizados.add(stat._id.metodoPagamento)
    })

    // Converter Set para Array
    Object.values(categorias).forEach(cat => {
      cat.metodosUtilizados = Array.from(cat.metodosUtilizados)
    })

    // Calcular médias e frequências
    const diasNoPeriodo = Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24))
    const mediaDiariaReceitas = totalReceitas / diasNoPeriodo
    const mediaDiariaDespesas = totalDespesas / diasNoPeriodo
    
    const frequenciaTransacoes = {
      total: transacoes.length,
      receitas: receitas.length,
      despesas: despesas.length,
      mediaPorDia: transacoes.length / diasNoPeriodo
    }

    // Maior e menor transação
    const maiorReceita = receitas.length > 0 ? receitas.reduce((max, t) => t.valor > max.valor ? t : max) : null
    const maiorDespesa = despesas.length > 0 ? despesas.reduce((max, t) => t.valor > max.valor ? t : max) : null
    const menorReceita = receitas.length > 0 ? receitas.reduce((min, t) => t.valor < min.valor ? t : min) : null
    const menorDespesa = despesas.length > 0 ? despesas.reduce((min, t) => t.valor < min.valor ? t : min) : null

    res.json({
      success: true,
      data: {
        periodo: {
          inicio,
          fim,
          diasNoPeriodo
        },
        resumo: {
          totalReceitas,
          totalDespesas,
          saldoFinal,
          mediaDiariaReceitas,
          mediaDiariaDespesas,
          frequenciaTransacoes
        },
        extremos: {
          maiorReceita,
          maiorDespesa,
          menorReceita,
          menorDespesa
        },
        categorias: Object.values(categorias),
        tendencias,
        orcamentos: incluirOrcamentos ? orcamentos : null,
        metas: incluirMetas ? metas : null,
        transacoes: transacoes.slice(0, 100) // Limitar para performance
      }
    })

  } catch (err) {
    console.error('Erro ao gerar relatório:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

// Função auxiliar para gerar alertas
async function gerarAlertas(userId, orcamentos, metas) {
  const alertas = []
  const agora = new Date()

  // Alertas de orçamentos
  orcamentos.forEach(orcamento => {
    const porcentagem = orcamento.porcentagemGasta
    const diasRestantes = orcamento.diasRestantes()

    if (porcentagem >= 100) {
      alertas.push({
        tipo: 'orcamento_excedido',
        titulo: 'Orçamento Excedido',
        mensagem: `O orçamento "${orcamento.nome}" foi excedido em ${porcentagem - 100}%`,
        prioridade: 'alta',
        data: agora,
        orcamentoId: orcamento._id
      })
    } else if (porcentagem >= 80) {
      alertas.push({
        tipo: 'orcamento_quase_excedido',
        titulo: 'Orçamento Quase no Limite',
        mensagem: `O orçamento "${orcamento.nome}" já utilizou ${porcentagem}% do valor`,
        prioridade: 'media',
        data: agora,
        orcamentoId: orcamento._id
      })
    }

    if (diasRestantes <= 3 && diasRestantes > 0) {
      alertas.push({
        tipo: 'orcamento_vencendo',
        titulo: 'Orçamento Vencendo',
        mensagem: `O orçamento "${orcamento.nome}" vence em ${diasRestantes} dias`,
        prioridade: 'baixa',
        data: agora,
        orcamentoId: orcamento._id
      })
    }
  })

  // Alertas de metas
  metas.forEach(meta => {
    const diasRestantes = meta.diasRestantes()
    const porcentagem = meta.porcentagemConcluida

    if (diasRestantes <= 30 && diasRestantes > 0 && porcentagem < 100) {
      const valorNecessario = meta.valorMensalNecessario()
      alertas.push({
        tipo: 'meta_vencendo',
        titulo: 'Meta Próxima do Vencimento',
        mensagem: `A meta "${meta.titulo}" vence em ${diasRestantes} dias. Você precisa economizar R$ ${valorNecessario} por mês`,
        prioridade: porcentagem < 50 ? 'alta' : 'media',
        data: agora,
        metaId: meta._id
      })
    }

    if (porcentagem >= 100) {
      alertas.push({
        tipo: 'meta_concluida',
        titulo: 'Meta Concluída! 🎉',
        mensagem: `Parabéns! Você concluiu a meta "${meta.titulo}"`,
        prioridade: 'baixa',
        data: agora,
        metaId: meta._id
      })
    }
  })

  return alertas.sort((a, b) => {
    const prioridades = { 'alta': 3, 'media': 2, 'baixa': 1 }
    return prioridades[b.prioridade] - prioridades[a.prioridade]
  })
}