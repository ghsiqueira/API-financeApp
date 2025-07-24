// models/Budget.js - Versão atualizada com renovação automática
const mongoose = require('mongoose')

const budgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  nome: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  categoria: {
    type: String,
    required: true,
    index: true
  },
  valorLimite: {
    type: Number,
    required: true,
    min: 0
  },
  valorGasto: {
    type: Number,
    default: 0,
    min: 0
  },
  periodo: {
    type: String,
    enum: ['semanal', 'mensal', 'trimestral', 'semestral', 'anual', 'personalizado'],
    required: true,
    index: true
  },
  dataInicio: {
    type: Date,
    required: true,
    index: true
  },
  dataFim: {
    type: Date,
    required: true,
    index: true
  },
  cor: {
    type: String,
    default: '#007AFF'
  },
  icone: {
    type: String,
    default: 'wallet'
  },
  status: {
    type: String,
    enum: ['ativo', 'pausado', 'finalizado', 'excedido'],
    default: 'ativo',
    index: true
  },
  // 🆕 NOVOS CAMPOS PARA RENOVAÇÃO AUTOMÁTICA
  renovacaoAutomatica: {
    type: Boolean,
    default: false,
    index: true
  },
  ultimaRenovacao: {
    type: Date,
    index: true
  },
  configuracoes: {
    // Configurações de alertas
    alertas: {
      ativo: {
        type: Boolean,
        default: true
      },
      porcentagens: [{
        type: Number,
        min: 1,
        max: 100
      }],
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    // 🆕 Configurações específicas de renovação
    renovacao: {
      // Transferir saldo restante para próximo período
      rollover: {
        type: Boolean,
        default: false
      },
      // Ajustar limite baseado na média de gastos anteriores
      ajusteAutomatico: {
        type: Boolean,
        default: false
      },
      // Percentual de ajuste automático (-20% a +50%)
      percentualAjuste: {
        type: Number,
        min: -20,
        max: 50,
        default: 0
      },
      // Notificações específicas de renovação
      notificarRenovacao: {
        type: Boolean,
        default: true
      }
    }
  },
  // Histórico de ações no orçamento
  historico: [{
    data: {
      type: Date,
      default: Date.now
    },
    acao: {
      type: String,
      enum: [
        'criado', 'editado', 'pausado', 'reativado', 
        'renovado', 'renovado_manual', 'finalizado',
        'limite_alterado', 'configuracao_alterada',
        'renovacao_ativada', 'renovacao_desativada'
      ],
      required: true
    },
    valor: Number, // Valor relacionado à ação (ex: novo limite)
    observacao: String,
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // 🆕 Estatísticas de renovações
  estatisticasRenovacao: {
    totalRenovacoes: {
      type: Number,
      default: 0
    },
    mediaGastosPorPeriodo: {
      type: Number,
      default: 0
    },
    melhorPerformance: {
      porcentagem: Number,
      periodo: Date
    },
    piorPerformance: {
      porcentagem: Number,
      periodo: Date
    }
  },
  descricao: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Índices compostos para performance
budgetSchema.index({ userId: 1, status: 1, dataFim: 1 })
budgetSchema.index({ userId: 1, categoria: 1, dataInicio: 1 })
budgetSchema.index({ renovacaoAutomatica: 1, dataFim: 1, status: 1 })
budgetSchema.index({ ultimaRenovacao: 1 })

// Virtual para calcular porcentagem gasta
budgetSchema.virtual('porcentagemGasta').get(function() {
  return this.valorLimite > 0 ? Math.round((this.valorGasto / this.valorLimite) * 100) : 0
})

// Virtual para calcular valor restante
budgetSchema.virtual('valorRestante').get(function() {
  return Math.max(0, this.valorLimite - this.valorGasto)
})

// Virtual para calcular dias restantes
budgetSchema.virtual('diasRestantes').get(function() {
  const agora = new Date()
  const diffTime = this.dataFim - agora
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
})

// Virtual para verificar se está vencido
budgetSchema.virtual('vencido').get(function() {
  return new Date() > this.dataFim
})

// Middleware para atualizar status automaticamente
budgetSchema.pre('save', function(next) {
  const agora = new Date()
  
  // Atualizar status baseado na data e gastos
  if (this.valorGasto > this.valorLimite && this.status !== 'pausado') {
    this.status = 'excedido'
  } else if (agora > this.dataFim && this.status === 'ativo') {
    this.status = 'finalizado'
  }
  
  next()
})

// 🆕 MÉTODO RENOVAR MELHORADO
budgetSchema.methods.renovar = function() {
  if (!this.renovacaoAutomatica) {
    console.log(`Orçamento ${this.nome} não tem renovação automática ativada`)
    return false
  }
  
  // Verificar se é um período válido para renovação
  const periodosValidos = ['semanal', 'mensal', 'trimestral', 'semestral', 'anual']
  if (!periodosValidos.includes(this.periodo)) {
    console.log(`Período ${this.periodo} não é válido para renovação automática`)
    return false
  }

  // Salvar estatísticas do período atual
  const estatisticasAtual = {
    valorGasto: this.valorGasto,
    valorLimite: this.valorLimite,
    porcentagemGasta: this.porcentagemGasta,
    periodo: {
      inicio: this.dataInicio,
      fim: this.dataFim
    }
  }

  // Calcular novas datas
  const novaDataInicio = new Date(this.dataFim)
  novaDataInicio.setDate(novaDataInicio.getDate() + 1)
  
  let novaDataFim = new Date(novaDataInicio)
  
  switch (this.periodo) {
    case 'semanal':
      novaDataFim.setDate(novaDataFim.getDate() + 7)
      break
    case 'mensal':
      novaDataFim.setMonth(novaDataFim.getMonth() + 1)
      break
    case 'trimestral':
      novaDataFim.setMonth(novaDataFim.getMonth() + 3)
      break
    case 'semestral':
      novaDataFim.setMonth(novaDataFim.getMonth() + 6)
      break
    case 'anual':
      novaDataFim.setFullYear(novaDataFim.getFullYear() + 1)
      break
  }
  
  // Aplicar configurações especiais de renovação
  let novoLimite = this.valorLimite
  
  // 🆕 Rollover: transferir saldo restante
  if (this.configuracoes?.renovacao?.rollover && this.valorRestante > 0) {
    novoLimite += this.valorRestante
    console.log(`Rollover aplicado: +R$ ${this.valorRestante.toFixed(2)}`)
  }
  
  // 🆕 Ajuste automático baseado no histórico
  if (this.configuracoes?.renovacao?.ajusteAutomatico) {
    const ajuste = this.calcularAjusteAutomatico()
    novoLimite = Math.max(novoLimite * (1 + ajuste), 0)
    console.log(`Ajuste automático aplicado: ${(ajuste * 100).toFixed(1)}%`)
  }

  // Atualizar dados do orçamento
  this.dataInicio = novaDataInicio
  this.dataFim = novaDataFim
  this.valorLimite = novoLimite
  this.valorGasto = 0
  this.status = 'ativo'
  
  // 🆕 Atualizar estatísticas de renovação
  this.estatisticasRenovacao.totalRenovacoes += 1
  this.atualizarEstatisticasRenovacao(estatisticasAtual)
  
  // Adicionar ao histórico
  this.adicionarHistorico('renovado', novoLimite, 
    `Renovação automática para período ${novaDataInicio.toLocaleDateString()} - ${novaDataFim.toLocaleDateString()}`)
  
  console.log(`✅ Orçamento ${this.nome} renovado com sucesso`)
  return true
}

// 🆕 Método para calcular ajuste automático
budgetSchema.methods.calcularAjusteAutomatico = function() {
  // Buscar histórico dos últimos 3 períodos
  const ultimasRenovacoes = this.historico
    .filter(h => h.acao === 'renovado')
    .slice(-3)
  
  if (ultimasRenovacoes.length < 2) {
    return 0 // Não há dados suficientes
  }

  // Calcular média de gastos dos últimos períodos
  const mediaGastos = this.estatisticasRenovacao.mediaGastosPorPeriodo || this.valorGasto
  
  if (mediaGastos === 0) return 0

  // Calcular ajuste baseado na diferença entre média e limite atual
  const diferencaPercentual = (mediaGastos - this.valorLimite) / this.valorLimite
  
  // Limitar ajuste entre -20% e +50%
  const percentualAjuste = this.configuracoes?.renovacao?.percentualAjuste || 0
  const ajusteCalculado = Math.max(-0.2, Math.min(0.5, diferencaPercentual * 0.5))
  
  return ajusteCalculado + (percentualAjuste / 100)
}

// 🆕 Método para atualizar estatísticas de renovação
budgetSchema.methods.atualizarEstatisticasRenovacao = function(estatisticasAtual) {
  const stats = this.estatisticasRenovacao
  
  // Atualizar média de gastos
  const totalPeriodos = stats.totalRenovacoes || 1
  stats.mediaGastosPorPeriodo = (
    (stats.mediaGastosPorPeriodo * (totalPeriodos - 1)) + estatisticasAtual.valorGasto
  ) / totalPeriodos
  
  // Atualizar melhor performance
  if (!stats.melhorPerformance || estatisticasAtual.porcentagemGasta < stats.melhorPerformance.porcentagem) {
    stats.melhorPerformance = {
      porcentagem: estatisticasAtual.porcentagemGasta,
      periodo: estatisticasAtual.periodo.fim
    }
  }
  
  // Atualizar pior performance
  if (!stats.piorPerformance || estatisticasAtual.porcentagemGasta > stats.piorPerformance.porcentagem) {
    stats.piorPerformance = {
      porcentagem: estatisticasAtual.porcentagemGasta,
      periodo: estatisticasAtual.periodo.fim
    }
  }
}

// Método para adicionar ao histórico
budgetSchema.methods.adicionarHistorico = function(acao, valor = null, observacao = null, usuarioId = null) {
  this.historico.push({
    data: new Date(),
    acao,
    valor,
    observacao,
    usuarioId: usuarioId || this.userId
  })
}

// 🆕 Método para verificar se precisa renovar
budgetSchema.methods.precisaRenovar = function() {
  const agora = new Date()
  return this.renovacaoAutomatica && 
         this.dataFim < agora && 
         this.status === 'ativo' &&
         (!this.ultimaRenovacao || 
          this.ultimaRenovacao < new Date(agora.getTime() - 24 * 60 * 60 * 1000))
}

// 🆕 Método para obter próxima data de renovação
budgetSchema.methods.proximaRenovacao = function() {
  if (!this.renovacaoAutomatica) return null
  
  const proximaData = new Date(this.dataFim)
  proximaData.setDate(proximaData.getDate() + 1)
  
  return proximaData
}

// Método estático para estatísticas gerais
budgetSchema.statics.getResumo = async function(userId) {
  const agora = new Date()
  
  return await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId)
      }
    },
    {
      $group: {
        _id: null,
        totalOrcamentos: { $sum: 1 },
        orcamentosAtivos: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ['$status', 'ativo'] },
                  { $lte: ['$dataInicio', agora] },
                  { $gte: ['$dataFim', agora] }
                ]
              }, 
              1, 
              0
            ]
          }
        },
        totalLimite: { 
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ['$status', 'ativo'] },
                  { $lte: ['$dataInicio', agora] },
                  { $gte: ['$dataFim', agora] }
                ]
              },
              '$valorLimite',
              0
            ]
          }
        },
        totalGasto: { 
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ['$status', 'ativo'] },
                  { $lte: ['$dataInicio', agora] },
                  { $gte: ['$dataFim', agora] }
                ]
              },
              '$valorGasto',
              0
            ]
          }
        },
        orcamentosExcedidos: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $gt: ['$valorGasto', '$valorLimite'] },
                  { $eq: ['$status', 'ativo'] }
                ]
              }, 
              1, 
              0
            ]
          }
        },
        comRenovacaoAutomatica: {
          $sum: {
            $cond: [{ $eq: ['$renovacaoAutomatica', true] }, 1, 0]
          }
        }
      }
    }
  ])
}

// 🆕 Método estático para buscar orçamentos que precisam renovar
budgetSchema.statics.buscarParaRenovacao = async function() {
  const agora = new Date()
  const ontemAgora = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  
  return await this.find({
    renovacaoAutomatica: true,
    dataFim: { $lt: agora },
    status: { $in: ['ativo', 'excedido'] },
    $or: [
      { ultimaRenovacao: { $exists: false } },
      { ultimaRenovacao: { $lt: ontemAgora } }
    ]
  }).populate('userId', 'nome email configuracoes')
}

// 🆕 Método estático para estatísticas de renovação
budgetSchema.statics.estatisticasRenovacao = async function(userId) {
  const agora = new Date()
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  return await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        ultimaRenovacao: { $gte: trintaDiasAtras }
      }
    },
    {
      $group: {
        _id: null,
        totalRenovacoes: { $sum: '$estatisticasRenovacao.totalRenovacoes' },
        mediaGastos: { $avg: '$estatisticasRenovacao.mediaGastosPorPeriodo' },
        melhorPerformance: { $min: '$estatisticasRenovacao.melhorPerformance.porcentagem' },
        piorPerformance: { $max: '$estatisticasRenovacao.piorPerformance.porcentagem' },
        orcamentosComRenovacao: { $sum: 1 }
      }
    }
  ])
}

module.exports = mongoose.model('Budget', budgetSchema)