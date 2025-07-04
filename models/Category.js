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
categorySchema.methods.adicionarSubcategoria = function(nome, icone = null, cor = null) {
  this.subcategorias.push({
    nome,
    icone: icone || this.icone,
    cor: cor || this.cor,
    ativa: true
  })
}

// Método para atualizar estatísticas
categorySchema.methods.atualizarEstatisticas = function(valor, operacao = 'adicionar') {
  if (operacao === 'adicionar') {
    this.estatisticas.totalTransacoes += 1
    this.estatisticas.totalValor += valor
    this.estatisticas.ultimaTransacao = new Date()
  } else if (operacao === 'remover') {
    this.estatisticas.totalTransacoes = Math.max(0, this.estatisticas.totalTransacoes - 1)
    this.estatisticas.totalValor = Math.max(0, this.estatisticas.totalValor - valor)
  }
}

// Método estático para criar categorias padrão
categorySchema.statics.criarCategoriasPadrao = async function() {
  const categoriasPadrao = [
    // Receitas
    { nome: 'Salário', tipo: 'receita', icone: 'briefcase', cor: '#34C759' },
    { nome: 'Freelance', tipo: 'receita', icone: 'laptop', cor: '#007AFF' },
    { nome: 'Investimentos', tipo: 'receita', icone: 'trending-up', cor: '#FF9500' },
    { nome: 'Vendas', tipo: 'receita', icone: 'shopping-bag', cor: '#30D158' },
    { nome: 'Outros', tipo: 'receita', icone: 'plus-circle', cor: '#8E8E93' },
    
    // Despesas
    { nome: 'Alimentação', tipo: 'despesa', icone: 'utensils', cor: '#FF3B30', 
      subcategorias: [
        { nome: 'Supermercado', icone: 'shopping-cart', cor: '#FF3B30' },
        { nome: 'Restaurantes', icone: 'coffee', cor: '#FF6B35' },
        { nome: 'Delivery', icone: 'truck', cor: '#FF8C42' }
      ]
    },
    { nome: 'Transporte', tipo: 'despesa', icone: 'car', cor: '#007AFF',
      subcategorias: [
        { nome: 'Combustível', icone: 'zap', cor: '#007AFF' },
        { nome: 'Transporte Público', icone: 'navigation', cor: '#0051D5' },
        { nome: 'Uber/99', icone: 'smartphone', cor: '#003D82' }
      ]
    },
    { nome: 'Moradia', tipo: 'despesa', icone: 'home', cor: '#5856D6',
      subcategorias: [
        { nome: 'Aluguel', icone: 'key', cor: '#5856D6' },
        { nome: 'Condomínio', icone: 'building', cor: '#4C44D4' },
        { nome: 'Energia', icone: 'zap', cor: '#AF52DE' }
      ]
    },
    { nome: 'Saúde', tipo: 'despesa', icone: 'heart', cor: '#FF2D92',
      subcategorias: [
        { nome: 'Medicamentos', icone: 'pill', cor: '#FF2D92' },
        { nome: 'Consultas', icone: 'user-check', cor: '#D70015' },
        { nome: 'Plano de Saúde', icone: 'shield', cor: '#A2006A' }
      ]
    },
    { nome: 'Educação', tipo: 'despesa', icone: 'book', cor: '#FF9500',
      subcategorias: [
        { nome: 'Cursos', icone: 'graduation-cap', cor: '#FF9500' },
        { nome: 'Livros', icone: 'book-open', cor: '#FF7A00' },
        { nome: 'Material', icone: 'edit', cor: '#CC7700' }
      ]
    },
    { nome: 'Lazer', tipo: 'despesa', icone: 'smile', cor: '#30D158',
      subcategorias: [
        { nome: 'Cinema', icone: 'film', cor: '#30D158' },
        { nome: 'Viagens', icone: 'map-pin', cor: '#24A96F' },
        { nome: 'Hobbies', icone: 'music', cor: '#1E8765' }
      ]
    }
  ]
  
  for (const categoria of categoriasPadrao) {
    await this.findOneAndUpdate(
      { nome: categoria.nome, padrao: true },
      { ...categoria, padrao: true, userId: null },
      { upsert: true, new: true }
    )
  }
}

// Método estático para obter categorias do usuário
categorySchema.statics.obterCategoriasUsuario = async function(userId, tipo = null) {
  const filtro = {
    $or: [
      { userId: mongoose.Types.ObjectId(userId) },
      { padrao: true }
    ],
    ativa: true
  }
  
  if (tipo) {
    filtro.$or.push({ tipo }, { tipo: 'ambos' })
  }
  
  return await this.find(filtro).sort({ ordem: 1, nome: 1 })
}

module.exports = mongoose.model('Category', categorySchema)