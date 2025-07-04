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
    required: [true, 'Nome do orçamento é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  categoria: {
    type: String,
    required: [true, 'Categoria é obrigatória'],
    index: true
  },
  subcategorias: [{
    type: String,
    trim: true
  }],
  valorLimite: {
    type: Number,
    required: [true, 'Valor limite é obrigatório'],
    min: [0, 'Valor limite deve ser positivo']
  },
  valorGasto: {
    type: Number,
    default: 0,
    min: [0, 'Valor gasto não pode ser negativo']
  },
  periodo: {
    type: String,
    enum: ['semanal', 'mensal', 'trimestral', 'semestral', 'anual', 'personalizado'],
    required: [true, 'Período é obrigatório']
  },
  dataInicio: {
    type: Date,
    required: [true, 'Data de início é obrigatória'],
    index: true
  },
  dataFim: {
    type: Date,
    required: [true, 'Data de fim é obrigatória'],
    index: true
  },
  renovacaoAutomatica: {
    type: Boolean,
    default: false
  },
  configuracoes: {
    alertas: {
      ativo: { type: Boolean, default: true },
      porcentagens: [{ type: Number, min: 0, max: 100 }], // Ex: [50, 80, 100]
      diasAntecedencia: { type: Number, default: 3 }
    },
    incluirSubcategorias: { type: Boolean, default: false },
    rollover: { type: Boolean, default: false } // Levar saldo para próximo período
  },
  historico: [{
    data: { type: Date, default: Date.now },
    acao: {
      type: String,
      enum: ['criado', 'editado', 'renovado', 'alerta_enviado', 'limite_excedido']
    },
    valor: Number,
    observacao: String
  }],
  status: {
    type: String,
    enum: ['ativo', 'pausado', 'finalizado', 'excedido'],
    default: 'ativo'
  },
  cor: {
    type: String,
    default: '#007AFF',
    match: [/^#[0-9A-F]{6}$/i, 'Cor deve estar em formato hexadecimal']
  },
  icone: {
    type: String,
    default: 'wallet'
  },
  criadoEm: {
    type: Date,
    default: Date.now
  },
  atualizadoEm: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Índices compostos
budgetSchema.index({ userId: 1, periodo: 1 })
budgetSchema.index({ userId: 1, dataInicio: 1, dataFim: 1 })
budgetSchema.index({ userId: 1, categoria: 1 })

// Middleware para atualizar atualizadoEm
budgetSchema.pre('save', function(next) {
  this.atualizadoEm = Date.now()
  next()
})

// Método virtual para calcular porcentagem gasta
budgetSchema.virtual('porcentagemGasta').get(function() {
  if (this.valorLimite === 0) return 0
  return Math.round((this.valorGasto / this.valorLimite) * 100)
})

// Método virtual para calcular valor restante
budgetSchema.virtual('valorRestante').get(function() {
  return Math.max(0, this.valorLimite - this.valorGasto)
})

// Método virtual para verificar se está ativo
budgetSchema.virtual('estaAtivo').get(function() {
  const agora = new Date()
  return agora >= this.dataInicio && agora <= this.dataFim && this.status === 'ativo'
})

// Método para calcular dias restantes
budgetSchema.methods.diasRestantes = function() {
  const agora = new Date()
  if (agora > this.dataFim) return 0
  return Math.ceil((this.dataFim - agora) / (1000 * 60 * 60 * 24))
}

// Método para verificar se deve enviar alerta
budgetSchema.methods.deveEnviarAlerta = function() {
  if (!this.configuracoes.alertas.ativo) return false
  
  const porcentagem = this.porcentagemGasta
  return this.configuracoes.alertas.porcentagens.some(p => 
    porcentagem >= p && !this.historicoContemAlerta(p)
  )
}

// Método para verificar se já foi enviado alerta para uma porcentagem
budgetSchema.methods.historicoContemAlerta = function(porcentagem) {
  return this.historico.some(h => 
    h.acao === 'alerta_enviado' && h.valor === porcentagem
  )
}

// Método para adicionar ao histórico
budgetSchema.methods.adicionarHistorico = function(acao, valor = null, observacao = null) {
  this.historico.push({
    data: new Date(),
    acao,
    valor,
    observacao
  })
}

// Método para renovar orçamento
budgetSchema.methods.renovar = function() {
  if (!this.renovacaoAutomatica) return false
  
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
  
  this.dataInicio = novaDataInicio
  this.dataFim = novaDataFim
  
  // Rollover do saldo se configurado
  if (this.configuracoes.rollover && this.valorRestante > 0) {
    this.valorLimite += this.valorRestante
  }
  
  this.valorGasto = 0
  this.status = 'ativo'
  this.adicionarHistorico('renovado', this.valorLimite)
  
  return true
}

// Método estático para estatísticas
budgetSchema.statics.getResumo = async function(userId) {
  const agora = new Date()
  
  return await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        dataInicio: { $lte: agora },
        dataFim: { $gte: agora }
      }
    },
    {
      $group: {
        _id: null,
        totalOrcamentos: { $sum: 1 },
        totalLimite: { $sum: '$valorLimite' },
        totalGasto: { $sum: '$valorGasto' },
        orcamentosExcedidos: {
          $sum: {
            $cond: [{ $gt: ['$valorGasto', '$valorLimite'] }, 1, 0]
          }
        }
      }
    }
  ])
}

module.exports = mongoose.model('Budget', budgetSchema)