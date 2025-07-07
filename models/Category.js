const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null // null para categorias padrão do sistema
  },
  nome: {
    type: String,
    required: [true, 'Nome da categoria é obrigatório'],
    trim: true,
    maxlength: [50, 'Nome não pode ter mais de 50 caracteres']
  },
  tipo: {
    type: String,
    enum: ['receita', 'despesa', 'ambos'],
    required: [true, 'Tipo é obrigatório']
  },
  icone: {
    type: String,
    required: [true, 'Ícone é obrigatório'],
    default: 'folder'
  },
  cor: {
    type: String,
    required: [true, 'Cor é obrigatória'],
    default: '#007AFF',
    match: [/^#[0-9A-F]{6}$/i, 'Cor deve estar em formato hexadecimal']
  },
  subcategorias: [{
    nome: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, 'Nome da subcategoria não pode ter mais de 50 caracteres']
    },
    icone: String,
    cor: String,
    ativa: { type: Boolean, default: true }
  }],
  ativa: {
    type: Boolean,
    default: true
  },
  padrao: {
    type: Boolean,
    default: false // categorias padrão do sistema
  },
  ordem: {
    type: Number,
    default: 0
  },
  estatisticas: {
    totalTransacoes: { type: Number, default: 0 },
    totalValor: { type: Number, default: 0 },
    ultimaTransacao: Date
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

// Índices
categorySchema.index({ userId: 1, tipo: 1 })
categorySchema.index({ userId: 1, ativa: 1 })
categorySchema.index({ padrao: 1 })

// Middleware para atualizar atualizadoEm
categorySchema.pre('save', function(next) {
  this.atualizadoEm = Date.now()
  next()
})

// Método para adicionar subcategoria
categorySchema.methods.adicionarSubcategoria = function(subcategoria) {
  this.subcategorias.push(subcategoria)
  return this.save()
}

// Método para remover subcategoria
categorySchema.methods.removerSubcategoria = function(subcategoriaId) {
  this.subcategorias.id(subcategoriaId).remove()
  return this.save()
}

// Método para atualizar estatísticas
categorySchema.methods.atualizarEstatisticas = async function() {
  const Transaction = mongoose.model('Transaction')
  
  const stats = await Transaction.aggregate([
    {
      $match: {
        categoria: this._id,
        userId: this.userId
      }
    },
    {
      $group: {
        _id: null,
        totalTransacoes: { $sum: 1 },
        totalValor: { $sum: '$valor' },
        ultimaTransacao: { $max: '$data' }
      }
    }
  ])

  if (stats.length > 0) {
    this.estatisticas = {
      totalTransacoes: stats[0].totalTransacoes || 0,
      totalValor: stats[0].totalValor || 0,
      ultimaTransacao: stats[0].ultimaTransacao
    }
  } else {
    this.estatisticas = {
      totalTransacoes: 0,
      totalValor: 0,
      ultimaTransacao: null
    }
  }

  return this.save()
}

// Método estático para criar categorias padrão para um usuário
categorySchema.statics.criarCategoriasPadrao = async function(userId) {
  const categoriasPadrao = [
    // Categorias de Receita
    {
      userId,
      nome: 'Salário',
      tipo: 'receita',
      icone: 'briefcase',
      cor: '#4CAF50',
      padrao: true,
      ordem: 1
    },
    {
      userId,
      nome: 'Freelance',
      tipo: 'receita',
      icone: 'laptop',
      cor: '#2196F3',
      padrao: true,
      ordem: 2
    },
    {
      userId,
      nome: 'Investimentos',
      tipo: 'receita',
      icone: 'trending-up',
      cor: '#FF9800',
      padrao: true,
      ordem: 3
    },
    {
      userId,
      nome: 'Outras Receitas',
      tipo: 'receita',
      icone: 'cash',
      cor: '#9C27B0',
      padrao: true,
      ordem: 4
    },

    // Categorias de Despesa
    {
      userId,
      nome: 'Alimentação',
      tipo: 'despesa',
      icone: 'restaurant',
      cor: '#FF5722',
      padrao: true,
      ordem: 5,
      subcategorias: [
        { nome: 'Supermercado', icone: 'storefront', cor: '#FF5722' },
        { nome: 'Restaurante', icone: 'restaurant', cor: '#FF5722' },
        { nome: 'Delivery', icone: 'bicycle', cor: '#FF5722' }
      ]
    },
    {
      userId,
      nome: 'Transporte',
      tipo: 'despesa',
      icone: 'car',
      cor: '#607D8B',
      padrao: true,
      ordem: 6,
      subcategorias: [
        { nome: 'Combustível', icone: 'car', cor: '#607D8B' },
        { nome: 'Uber/Taxi', icone: 'car-sport', cor: '#607D8B' },
        { nome: 'Transporte Público', icone: 'bus', cor: '#607D8B' }
      ]
    },
    {
      userId,
      nome: 'Moradia',
      tipo: 'despesa',
      icone: 'home',
      cor: '#795548',
      padrao: true,
      ordem: 7,
      subcategorias: [
        { nome: 'Aluguel', icone: 'home', cor: '#795548' },
        { nome: 'Condomínio', icone: 'business', cor: '#795548' },
        { nome: 'Energia', icone: 'flash', cor: '#795548' },
        { nome: 'Água', icone: 'water', cor: '#795548' },
        { nome: 'Internet', icone: 'wifi', cor: '#795548' }
      ]
    },
    {
      userId,
      nome: 'Saúde',
      tipo: 'despesa',
      icone: 'medical',
      cor: '#F44336',
      padrao: true,
      ordem: 8,
      subcategorias: [
        { nome: 'Consultas', icone: 'person', cor: '#F44336' },
        { nome: 'Medicamentos', icone: 'medical', cor: '#F44336' },
        { nome: 'Exames', icone: 'document-text', cor: '#F44336' }
      ]
    },
    {
      userId,
      nome: 'Educação',
      tipo: 'despesa',
      icone: 'school',
      cor: '#3F51B5',
      padrao: true,
      ordem: 9,
      subcategorias: [
        { nome: 'Cursos', icone: 'school', cor: '#3F51B5' },
        { nome: 'Livros', icone: 'book', cor: '#3F51B5' },
        { nome: 'Material', icone: 'pencil', cor: '#3F51B5' }
      ]
    },
    {
      userId,
      nome: 'Lazer',
      tipo: 'despesa',
      icone: 'game-controller',
      cor: '#E91E63',
      padrao: true,
      ordem: 10,
      subcategorias: [
        { nome: 'Cinema', icone: 'film', cor: '#E91E63' },
        { nome: 'Streaming', icone: 'tv', cor: '#E91E63' },
        { nome: 'Viagens', icone: 'airplane', cor: '#E91E63' }
      ]
    },
    {
      userId,
      nome: 'Compras',
      tipo: 'despesa',
      icone: 'bag',
      cor: '#FF9800',
      padrao: true,
      ordem: 11,
      subcategorias: [
        { nome: 'Roupas', icone: 'shirt', cor: '#FF9800' },
        { nome: 'Eletrônicos', icone: 'phone-portrait', cor: '#FF9800' },
        { nome: 'Casa', icone: 'home', cor: '#FF9800' }
      ]
    },
    {
      userId,
      nome: 'Outros',
      tipo: 'despesa',
      icone: 'ellipsis-horizontal',
      cor: '#9E9E9E',
      padrao: true,
      ordem: 12
    }
  ]

  try {
    // Verificar se já existem categorias para este usuário
    const existentes = await this.countDocuments({ userId })
    if (existentes > 0) {
      console.log('⚠️ Usuário já possui categorias, pulando criação das padrão')
      return
    }

    // Criar todas as categorias
    const categoriasCriadas = await this.insertMany(categoriasPadrao)
    console.log(`✅ ${categoriasCriadas.length} categorias padrão criadas para usuário ${userId}`)
    
    return categoriasCriadas
  } catch (error) {
    console.error('❌ Erro ao criar categorias padrão:', error)
    throw error
  }
}

// Método estático para buscar categorias por tipo
categorySchema.statics.buscarPorTipo = function(userId, tipo) {
  const query = { 
    $or: [
      { userId },
      { padrao: true, userId: null }
    ],
    ativa: true
  }

  if (tipo && tipo !== 'ambos') {
    query.$and = [
      { $or: [{ tipo }, { tipo: 'ambos' }] }
    ]
  }

  return this.find(query).sort({ ordem: 1, nome: 1 })
}

// Método estático para buscar categorias populares
categorySchema.statics.buscarPopulares = function(userId, limite = 5) {
  return this.find({
    $or: [
      { userId },
      { padrao: true, userId: null }
    ],
    ativa: true
  })
  .sort({ 'estatisticas.totalTransacoes': -1 })
  .limit(limite)
}

module.exports = mongoose.model('Category', categorySchema)