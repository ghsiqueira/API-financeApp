const Transaction = require('../models/Transaction')
const Budget = require('../models/Budget')
const Goal = require('../models/Goal')
const Category = require('../models/Category')
const mongoose = require('mongoose')
const { validationResult } = require('express-validator')

/**
 * Obter overview geral do dashboard
 */
exports.getOverview = async (req, res) => {
  try {
    console.log('📊 Dashboard Overview - Usuário:', req.userId)
    
    const { periodo = 'mes' } = req.query
    const agora = new Date()
    
    // Calcular data de início baseado no período
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
      case 'semestre':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth() - 6, 1)
        break
      case 'ano':
        dataInicio = new Date(agora.getFullYear(), 0, 1)
        break
      default:
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
    }

    console.log('📅 Período:', periodo, 'De:', dataInicio, 'Até:', agora)

    // Converter userId para ObjectId corretamente
    const userObjectId = new mongoose.Types.ObjectId(req.userId)

    // Buscar dados em paralelo para melhor performance
    const [
      resumoFinanceiro,
      transacoesRecentes,
      orcamentosData,
      metasData,
      categoriasPopulares,
      gastosPorCategoria
    ] = await Promise.all([
      // 1. Resumo financeiro do período
      Transaction.aggregate([
        {
          $match: {
            userId: userObjectId,
            data: { $gte: dataInicio, $lte: agora }
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
      
      // 2. Transações recentes (últimas 10)
      Transaction.find({ 
        userId: req.userId 
      })
      .sort({ data: -1 })
      .limit(10)
      .lean(),
      
      // 3. Dados dos orçamentos
      Budget.aggregate([
        {
          $match: {
            userId: userObjectId,
            'periodo.dataInicio': { $lte: agora },
            'periodo.dataFim': { $gte: agora }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            ativos: {
              $sum: {
                $cond: [{ $eq: ['$status', 'ativo'] }, 1, 0]
              }
            },
            excedidos: {
              $sum: {
                $cond: [{ $gt: ['$valorGasto', '$valorLimite'] }, 1, 0]
              }
            },
            totalLimite: { $sum: '$valorLimite' },
            totalGasto: { $sum: '$valorGasto' }
          }
        }
      ]),
      
      // 4. Dados das metas
      Goal.aggregate([
        {
          $match: {
            userId: userObjectId
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
              $sum: {
                $cond: [{ $eq: ['$status', 'ativa'] }, 1, 0]
              }
            },
            concluidas: {
              $sum: {
                $cond: [{ $gte: ['$porcentagemConcluida', 100] }, 1, 0]
              }
            },
            progressoMedio: { $avg: '$porcentagemConcluida' }
          }
        }
      ]),
      
      // 5. Categorias mais utilizadas
      Transaction.aggregate([
        {
          $match: {
            userId: userObjectId,
            data: { $gte: dataInicio, $lte: agora }
          }
        },
        {
          $group: {
            _id: '$categoria',
            total: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 5
        }
      ]),
      
      // 6. Gastos por categoria (apenas despesas)
      Transaction.aggregate([
        {
          $match: {
            userId: userObjectId,
            tipo: 'despesa',
            data: { $gte: dataInicio, $lte: agora }
          }
        },
        {
          $group: {
            _id: '$categoria',
            total: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { total: -1 }
        },
        {
          $limit: 8
        }
      ])
    ])

    console.log('📈 Resumo financeiro encontrado:', resumoFinanceiro)
    console.log('📋 Transações recentes:', transacoesRecentes.length)
    console.log('💰 Orçamentos:', orcamentosData)
    console.log('🎯 Metas:', metasData)

    // Processar resumo financeiro
    const receitas = resumoFinanceiro.find(r => r._id === 'receita')?.total || 0
    const despesas = resumoFinanceiro.find(r => r._id === 'despesa')?.total || 0
    const totalTransacoes = resumoFinanceiro.reduce((sum, r) => sum + r.count, 0)

    // Processar dados dos orçamentos
    const orcamentoInfo = orcamentosData[0] || {
      total: 0,
      ativos: 0,
      excedidos: 0,
      totalLimite: 0,
      totalGasto: 0
    }

    // Processar dados das metas
    const metaInfo = metasData[0] || {
      total: 0,
      ativas: 0,
      concluidas: 0,
      progressoMedio: 0
    }

    // Buscar alertas importantes
    const alertas = []
    
    // Alertas de orçamento excedido
    if (orcamentoInfo.excedidos > 0) {
      alertas.push({
        tipo: 'orcamento',
        titulo: 'Orçamento Excedido',
        mensagem: `${orcamentoInfo.excedidos} orçamento(s) foram excedidos`,
        nivel: 'critico',
        icone: 'warning'
      })
    }
    
    // Alertas de metas próximas do prazo
    const metasProximasVencimento = await Goal.find({
      userId: req.userId,
      status: 'ativa',
      dataLimite: {
        $gte: agora,
        $lte: new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 dias
      }
    }).countDocuments()
    
    if (metasProximasVencimento > 0) {
      alertas.push({
        tipo: 'meta',
        titulo: 'Metas Próximas do Vencimento',
        mensagem: `${metasProximasVencimento} meta(s) vencem em 30 dias`,
        nivel: 'aviso',
        icone: 'time'
      })
    }

    // Montar resposta final
    const overview = {
      resumoFinanceiro: {
        receitas,
        despesas,
        saldo: receitas - despesas,
        totalTransacoes,
        crescimentoReceitas: 0, // Calcular comparação com período anterior
        crescimentoDespesas: 0
      },
      transacoesRecentes: transacoesRecentes.map(t => ({
        _id: t._id,
        tipo: t.tipo,
        descricao: t.descricao,
        valor: t.valor,
        categoria: t.categoria,
        data: t.data,
        metodoPagamento: t.metodoPagamento
      })),
      orcamentos: {
        total: orcamentoInfo.total,
        ativos: orcamentoInfo.ativos,
        excedidos: orcamentoInfo.excedidos,
        utilizacao: orcamentoInfo.totalLimite > 0 
          ? Math.round((orcamentoInfo.totalGasto / orcamentoInfo.totalLimite) * 100)
          : 0,
        totalLimite: orcamentoInfo.totalLimite,
        totalGasto: orcamentoInfo.totalGasto
      },
      metas: {
        total: metaInfo.total,
        ativas: metaInfo.ativas,
        concluidas: metaInfo.concluidas,
        progressoMedio: Math.round(metaInfo.progressoMedio || 0)
      },
      categoriasPopulares: categoriasPopulares.map(cat => ({
        categoria: cat._id,
        valor: cat.total,
        transacoes: cat.count
      })),
      gastosPorCategoria: gastosPorCategoria.map(cat => ({
        categoria: cat._id,
        valor: cat.total,
        transacoes: cat.count
      })),
      alertas,
      periodo: {
        tipo: periodo,
        dataInicio,
        dataFim: agora,
        diasNoPeriodo: Math.ceil((agora - dataInicio) / (1000 * 60 * 60 * 24))
      }
    }

    console.log('✅ Dashboard overview criado com sucesso')

    res.json({
      success: true,
      data: overview
    })

  } catch (err) {
    console.error('❌ Erro no dashboard overview:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  }
}

/**
 * Obter estatísticas detalhadas
 */
exports.getStats = async (req, res) => {
  try {
    const { periodo = 'mes', tipo = 'geral' } = req.query
    const agora = new Date()
    
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
      default:
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
    }

    const userObjectId = new mongoose.Types.ObjectId(req.userId)

    let pipeline = []
    
    if (tipo === 'categoria') {
      // Estatísticas por categoria
      pipeline = [
        {
          $match: {
            userId: userObjectId,
            data: { $gte: dataInicio, $lte: agora }
          }
        },
        {
          $group: {
            _id: {
              categoria: '$categoria',
              tipo: '$tipo'
            },
            total: { $sum: '$valor' },
            count: { $sum: 1 },
            mediaTransacao: { $avg: '$valor' }
          }
        },
        {
          $sort: { total: -1 }
        }
      ]
    } else if (tipo === 'temporal') {
      // Estatísticas temporais (por dia/mês)
      const agrupamento = periodo === 'ano' ? {
        mes: { $month: '$data' },
        ano: { $year: '$data' }
      } : {
        dia: { $dayOfMonth: '$data' },
        mes: { $month: '$data' },
        ano: { $year: '$data' }
      }
      
      pipeline = [
        {
          $match: {
            userId: userObjectId,
            data: { $gte: dataInicio, $lte: agora }
          }
        },
        {
          $group: {
            _id: {
              ...agrupamento,
              tipo: '$tipo'
            },
            total: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.ano': 1, '_id.mes': 1, '_id.dia': 1 }
        }
      ]
    } else {
      // Estatísticas gerais
      pipeline = [
        {
          $match: {
            userId: userObjectId,
            data: { $gte: dataInicio, $lte: agora }
          }
        },
        {
          $group: {
            _id: '$tipo',
            total: { $sum: '$valor' },
            count: { $sum: 1 },
            media: { $avg: '$valor' },
            maximo: { $max: '$valor' },
            minimo: { $min: '$valor' }
          }
        }
      ]
    }

    const stats = await Transaction.aggregate(pipeline)

    res.json({
      success: true,
      data: {
        periodo,
        tipo,
        dataInicio,
        dataFim: agora,
        estatisticas: stats
      }
    })

  } catch (err) {
    console.error('❌ Erro nas estatísticas:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Obter dados para gráficos
 */
exports.getChartData = async (req, res) => {
  try {
    const { tipo = 'receitas-despesas', periodo = 'mes' } = req.query
    const agora = new Date()
    
    let dataInicio = new Date()
    switch (periodo) {
      case 'semana':
        dataInicio = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'mes':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
        break
      case 'ano':
        dataInicio = new Date(agora.getFullYear(), 0, 1)
        break
      default:
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
    }

    const userObjectId = new mongoose.Types.ObjectId(req.userId)
    let chartData = {}

    if (tipo === 'receitas-despesas') {
      // Gráfico de receitas vs despesas por período
      const agrupamento = periodo === 'ano' ? {
        mes: { $month: '$data' },
        ano: { $year: '$data' }
      } : {
        dia: { $dayOfMonth: '$data' },
        mes: { $month: '$data' },
        ano: { $year: '$data' }
      }

      const dados = await Transaction.aggregate([
        {
          $match: {
            userId: userObjectId,
            data: { $gte: dataInicio, $lte: agora }
          }
        },
        {
          $group: {
            _id: {
              ...agrupamento,
              tipo: '$tipo'
            },
            total: { $sum: '$valor' }
          }
        },
        {
          $sort: { '_id.ano': 1, '_id.mes': 1, '_id.dia': 1 }
        }
      ])

      chartData = dados
      
    } else if (tipo === 'categorias') {
      // Gráfico pizza por categorias
      const dados = await Transaction.aggregate([
        {
          $match: {
            userId: userObjectId,
            data: { $gte: dataInicio, $lte: agora },
            tipo: 'despesa' // Focar nas despesas para o gráfico
          }
        },
        {
          $group: {
            _id: '$categoria',
            total: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { total: -1 }
        },
        {
          $limit: 10
        }
      ])

      chartData = dados
    }

    res.json({
      success: true,
      data: {
        tipo,
        periodo,
        chartData
      }
    })

  } catch (err) {
    console.error('❌ Erro nos dados do gráfico:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Obter resumo rápido para widgets
 */
exports.getQuickSummary = async (req, res) => {
  try {
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const inicioAno = new Date(agora.getFullYear(), 0, 1)

    const userObjectId = new mongoose.Types.ObjectId(req.userId)

    const [resumoMes, resumoAno, proximasContas] = await Promise.all([
      // Resumo do mês
      Transaction.aggregate([
        {
          $match: {
            userId: userObjectId,
            data: { $gte: inicioMes, $lte: agora }
          }
        },
        {
          $group: {
            _id: '$tipo',
            total: { $sum: '$valor' }
          }
        }
      ]),
      
      // Resumo do ano
      Transaction.aggregate([
        {
          $match: {
            userId: userObjectId,
            data: { $gte: inicioAno, $lte: agora }
          }
        },
        {
          $group: {
            _id: '$tipo',
            total: { $sum: '$valor' }
          }
        }
      ]),
      
      // Próximas contas/transações recorrentes
      Transaction.find({
        userId: req.userId,
        'recorrente.ativo': true,
        'recorrente.proximaData': {
          $gte: agora,
          $lte: new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 dias
        }
      }).limit(5)
    ])

    const receitasMes = resumoMes.find(r => r._id === 'receita')?.total || 0
    const despesasMes = resumoMes.find(r => r._id === 'despesa')?.total || 0
    const receitasAno = resumoAno.find(r => r._id === 'receita')?.total || 0
    const despesasAno = resumoAno.find(r => r._id === 'despesa')?.total || 0

    res.json({
      success: true,
      data: {
        mesCorrente: {
          receitas: receitasMes,
          despesas: despesasMes,
          saldo: receitasMes - despesasMes
        },
        anoCorrente: {
          receitas: receitasAno,
          despesas: despesasAno,
          saldo: receitasAno - despesasAno
        },
        proximasContas: proximasContas.map(conta => ({
          _id: conta._id,
          descricao: conta.descricao,
          valor: conta.valor,
          data: conta.recorrente.proximaData,
          tipo: conta.tipo
        }))
      }
    })

  } catch (err) {
    console.error('❌ Erro no resumo rápido:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}

/**
 * Obter comparação entre períodos
 */
exports.getComparison = async (req, res) => {
  try {
    const { periodo = 'mes' } = req.query
    const agora = new Date()
    
    let dataInicioAtual, dataInicioAnterior, dataFimAnterior
    
    if (periodo === 'mes') {
      dataInicioAtual = new Date(agora.getFullYear(), agora.getMonth(), 1)
      dataInicioAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
      dataFimAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0)
    } else if (periodo === 'ano') {
      dataInicioAtual = new Date(agora.getFullYear(), 0, 1)
      dataInicioAnterior = new Date(agora.getFullYear() - 1, 0, 1)
      dataFimAnterior = new Date(agora.getFullYear() - 1, 11, 31)
    }

    const userObjectId = new mongoose.Types.ObjectId(req.userId)

    const [dadosAtual, dadosAnterior] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId: userObjectId,
            data: { $gte: dataInicioAtual, $lte: agora }
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
      
      Transaction.aggregate([
        {
          $match: {
            userId: userObjectId,
            data: { $gte: dataInicioAnterior, $lte: dataFimAnterior }
          }
        },
        {
          $group: {
            _id: '$tipo',
            total: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        }
      ])
    ])

    const receitasAtual = dadosAtual.find(d => d._id === 'receita')?.total || 0
    const despesasAtual = dadosAtual.find(d => d._id === 'despesa')?.total || 0
    const receitasAnterior = dadosAnterior.find(d => d._id === 'receita')?.total || 0
    const despesasAnterior = dadosAnterior.find(d => d._id === 'despesa')?.total || 0

    const crescimentoReceitas = receitasAnterior > 0 
      ? ((receitasAtual - receitasAnterior) / receitasAnterior) * 100 
      : 0
    const crescimentoDespesas = despesasAnterior > 0 
      ? ((despesasAtual - despesasAnterior) / despesasAnterior) * 100 
      : 0

    res.json({
      success: true,
      data: {
        periodo,
        atual: {
          receitas: receitasAtual,
          despesas: despesasAtual,
          saldo: receitasAtual - despesasAtual
        },
        anterior: {
          receitas: receitasAnterior,
          despesas: despesasAnterior,
          saldo: receitasAnterior - despesasAnterior
        },
        crescimento: {
          receitas: Math.round(crescimentoReceitas * 100) / 100,
          despesas: Math.round(crescimentoDespesas * 100) / 100,
          saldo: Math.round(((receitasAtual - despesasAtual) - (receitasAnterior - despesasAnterior)) * 100) / 100
        }
      }
    })

  } catch (err) {
    console.error('❌ Erro na comparação:', err)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
}