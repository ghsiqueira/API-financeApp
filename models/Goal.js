const mongoose = require('mongoose')

const goalSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  titulo: {
    type: String,
    required: [true, 'Título é obrigatório'],
    trim: true,
    maxlength: [100, 'Título não pode ter mais de 100 caracteres']
  },
  descricao: {
    type: String,
    trim: true,
    maxlength: [500, 'Descrição não pode ter mais de 500 caracteres']
  },
  valorAlvo: {
    type: Number,
    required: [true, 'Valor alvo é obrigatório'],
    min: [0.01, 'Valor alvo deve ser maior que 0']
  },
  valorAtual: {
    type: Number,
    default: 0,
    min: [0, 'Valor atual não pode ser negativo']
  },
  dataInicio: {
    type: Date,
    default: Date.now,
    index: true
  },
  dataLimite: {
    type: Date,
    required: [true, 'Data limite é obrigatória'],
    index: true
  },
  prioridade: { 
    type: String, 
    enum: ['baixa', 'media', 'alta'], 
    default: 'media'
  },
  categoria: {
    type: String,
    required: [true, 'Categoria é obrigatória'],
    enum: ['emergencia', 'viagem', 'casa', 'educacao', 'aposentadoria', 'investimento', 'saude', 'outro']
  },
  contribuicoes: [{
    valor: {
      type: Number,
      required: true,
      min: [0.01, 'Valor da contribuição deve ser maior que 0']
    },
    nota: {
      type: String,
      maxlength: [200, 'Nota não pode ter mais de 200 caracteres']
    },
    data: { 
      type: Date, 
      default: Date.now 
    },
    tipo: {
      type: String,
      enum: ['contribuicao', 'retirada', 'ajuste'],
      default: 'contribuicao'
    }
  }],
  configuracoes: {
    lembretes: {
      ativo: { type: Boolean, default: true },
      frequencia: {
        type: String,
        enum: ['diario', 'semanal', 'mensal'],
        default: 'semanal'
      },
      diasAntecedencia: { type: Number, default: 7 }
    },
    contribuicaoAutomatica: {
      ativo: { type: Boolean, default: false },
      valor: { type: Number, default: 0 },
      frequencia: {
        type: String,
        enum: ['semanal', 'mensal'],
        default: 'mensal'
      },
      proximaData: Date
    },
    visibilidade: {
      type: String,
      enum: ['privada', 'publica', 'amigos'],
      default: 'privada'
    }
  },
  status: {
    type: String,
    enum: ['ativa', 'pausada', 'concluida', 'cancelada'],
    default: 'ativa'
  },
  motivacao: {
    razao: String,
    imagem: String, // URL da imagem motivacional
    citacao: String
  },
  milestones: [{
    nome: String,
    valor: Number,
    data: Date,
    alcancado: { type: Boolean, default: false },
    dataAlcancado: Date
  }],
  cor: {
    type: String,
    default: '#34C759',
    match: [/^#[0-9A-F]{6}$/i, 'Cor deve estar em formato hexadecimal']
  },
  icone: {
    type: String,
    default: 'target'
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
goalSchema.index({ userId: 1, status: 1 })
goalSchema.index({ userId: 1, dataLimite: 1 })
goalSchema.index({ userId: 1, prioridade: 1 })

// Middleware para atualizar atualizadoEm
goalSchema.pre('save', function(next) {
  this.atualizadoEm = Date.now()
  next()
})

// Virtual para calcular porcentagem concluída
goalSchema.virtual('porcentagemConcluida').get(function() {
  if (this.valorAlvo === 0) return 0
  return Math.min(100, Math.round((this.valorAtual / this.valorAlvo) * 100))
})

// Virtual para calcular valor restante
goalSchema.virtual('valorRestante').get(function() {
  return Math.max(0, this.valorAlvo - this.valorAtual)
})

// Virtual para verificar se está concluída
goalSchema.virtual('estaConcluida').get(function() {
  return this.valorAtual >= this.valorAlvo
})

// Método para calcular dias restantes
goalSchema.methods.diasRestantes = function() {
  const agora = new Date()
  if (agora > this.dataLimite) return 0
  return Math.ceil((this.dataLimite - agora) / (1000 * 60 * 60 * 24))
}

// Método para calcular valor mensal necessário
goalSchema.methods.valorMensalNecessario = function() {
  const diasRestantes = this.diasRestantes()
  if (diasRestantes <= 0) return this.valorRestante
  
  const mesesRestantes = Math.ceil(diasRestantes / 30)
  return Math.ceil(this.valorRestante / mesesRestantes)
}

// Método para calcular valor diário necessário
goalSchema.methods.valorDiarioNecessario = function() {
  const diasRestantes = this.diasRestantes()
  if (diasRestantes <= 0) return this.valorRestante
  
  return Math.ceil(this.valorRestante / diasRestantes)
}

// Método para adicionar contribuição
goalSchema.methods.adicionarContribuicao = function(valor, nota = '', tipo = 'contribuicao') {
  this.contribuicoes.push({
    valor,
    nota,
    data: new Date(),
    tipo
  })
  
  if (tipo === 'contribuicao') {
    this.valorAtual += valor
  } else if (tipo === 'retirada') {
    this.valorAtual = Math.max(0, this.valorAtual - valor)
  } else if (tipo === 'ajuste') {
    this.valorAtual = Math.max(0, valor)
  }
  
  // Verificar se atingiu milestones
  this.verificarMilestones()
  
  // Verificar se concluiu a meta
  if (this.estaConcluida && this.status === 'ativa') {
    this.status = 'concluida'
  }
}

// Método para verificar milestones
goalSchema.methods.verificarMilestones = function() {
  this.milestones.forEach(milestone => {
    if (!milestone.alcancado && this.valorAtual >= milestone.valor) {
      milestone.alcancado = true
      milestone.dataAlcancado = new Date()
    }
  })
}

// Método para calcular estatísticas
goalSchema.methods.calcularEstatisticas = function() {
  const contribuicoes = this.contribuicoes.filter(c => c.tipo === 'contribuicao')
  const retiradas = this.contribuicoes.filter(c => c.tipo === 'retirada')
  
  const totalContribuicoes = contribuicoes.reduce((sum, c) => sum + c.valor, 0)
  const totalRetiradas = retiradas.reduce((sum, c) => sum + c.valor, 0)
  
  const primeiraDt = contribuicoes.length > 0 ? contribuicoes[0].data : this.dataInicio
  const ultimaDt = contribuicoes.length > 0 ? contribuicoes[contribuicoes.length - 1].data : new Date()
  
  const mesesAtivos = Math.max(1, Math.ceil((ultimaDt - primeiraDt) / (1000 * 60 * 60 * 24 * 30)))
  const mediaMensal = totalContribuicoes / mesesAtivos
  
  return {
    totalContribuicoes,
    totalRetiradas,
    numeroContribuicoes: contribuicoes.length,
    numeroRetiradas: retiradas.length,
    mediaMensal: Math.round(mediaMensal),
    mesesAtivos,
    velocidadeProgresso: this.porcentagemConcluida / mesesAtivos
  }
}

// Método estático para relatório de metas
goalSchema.statics.getRelatorio = async function(userId, filtros = {}) {
  const match = { userId: mongoose.Types.ObjectId(userId) }
  
  if (filtros.status) match.status = filtros.status
  if (filtros.categoria) match.categoria = filtros.categoria
  if (filtros.prioridade) match.prioridade = filtros.prioridade
  
  return await this.aggregate([
    { $match: match },
    {
      $addFields: {
        porcentagemConcluida: {
          $multiply: [
            { $divide: ['$valorAtual', '$valorAlvo'] },
            100
          ]
        },
        diasRestantes: {
          $ceil: {
            $divide: [
              { $subtract: ['$dataLimite', new Date()] },
              86400000
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValorAlvo: { $sum: '$valorAlvo' },
        totalValorAtual: { $sum: '$valorAtual' },
        mediaProgresso: { $avg: '$porcentagemConcluida' },
        metas: { $push: '$ROOT' }
      }
    }
  ])
}

module.exports = mongoose.model('Goal', goalSchema)