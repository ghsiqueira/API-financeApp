const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  tipo: { 
    type: String, 
    enum: ['receita', 'despesa'], 
    required: [true, 'Tipo é obrigatório']
  },
  descricao: {
    type: String,
    required: [true, 'Descrição é obrigatória'],
    trim: true,
    maxlength: [200, 'Descrição não pode ter mais de 200 caracteres']
  },
  valor: {
    type: Number,
    required: [true, 'Valor é obrigatório'],
    min: [0.01, 'Valor deve ser maior que 0']
  },
  data: { 
    type: Date, 
    required: [true, 'Data é obrigatória'],
    index: true
  },
  categoria: {
    type: String,
    required: [true, 'Categoria é obrigatória'],
    index: true
  },
  subcategoria: {
    type: String,
    default: null
  },
  metodoPagamento: {
    type: String,
    enum: ['dinheiro', 'cartao_debito', 'cartao_credito', 'pix', 'transferencia', 'boleto', 'cheque'],
    required: [true, 'Método de pagamento é obrigatório']
  },
  conta: {
    type: String,
    default: 'principal'
  },
  recorrente: {
    ativo: { type: Boolean, default: false },
    tipo: {
      type: String,
      enum: ['diario', 'semanal', 'mensal', 'anual'],
      default: null
    },
    intervalo: { type: Number, default: 1 }, // a cada X dias/semanas/meses
    proximaData: { type: Date, default: null },
    dataFim: { type: Date, default: null }
  },
  orcamentoId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Budget', 
    default: null
  },
  metaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Goal',
    default: null
  },
  tags: [{
    type: String,
    trim: true
  }],
  localizacao: {
    nome: String,
    latitude: Number,
    longitude: Number
  },
  observacoes: {
    type: String,
    maxlength: [500, 'Observações não podem ter mais de 500 caracteres']
  },
  anexos: [{
    tipo: {
      type: String,
      enum: ['imagem', 'pdf', 'link']
    },
    url: String,
    nome: String,
    tamanho: Number
  }],
  status: {
    type: String,
    enum: ['pendente', 'confirmada', 'cancelada'],
    default: 'confirmada'
  },
  sincronizado: {
    type: Boolean,
    default: true
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

// Índices compostos para melhor performance
transactionSchema.index({ userId: 1, data: -1 })
transactionSchema.index({ userId: 1, categoria: 1 })
transactionSchema.index({ userId: 1, tipo: 1, data: -1 })

// Middleware para atualizar atualizadoEm
transactionSchema.pre('save', function(next) {
  this.atualizadoEm = Date.now()
  next()
})

// Método estático para estatísticas
transactionSchema.statics.getStats = async function(userId, startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        data: { $gte: startDate, $lte: endDate }
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
}

// Método para calcular próxima data recorrente
transactionSchema.methods.calcularProximaData = function() {
  if (!this.recorrente.ativo) return null
  
  const data = new Date(this.data)
  const { tipo, intervalo } = this.recorrente
  
  switch (tipo) {
    case 'diario':
      data.setDate(data.getDate() + intervalo)
      break
    case 'semanal':
      data.setDate(data.getDate() + (7 * intervalo))
      break
    case 'mensal':
      data.setMonth(data.getMonth() + intervalo)
      break
    case 'anual':
      data.setFullYear(data.getFullYear() + intervalo)
      break
  }
  
  return data
}

module.exports = mongoose.model('Transaction', transactionSchema)