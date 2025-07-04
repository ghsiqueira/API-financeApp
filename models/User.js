const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  nome: { 
    type: String, 
    required: [true, 'Nome é obrigatório'],
    trim: true,
    minlength: [2, 'Nome deve ter pelo menos 2 caracteres']
  },
  email: { 
    type: String, 
    required: [true, 'Email é obrigatório'], 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  senhaHash: { 
    type: String, 
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
  },
  emailVerificado: { 
    type: Boolean, 
    default: false 
  },
  codigoResetSenha: { 
    type: String, 
    default: null 
  },
  resetSenhaExpira: {
    type: Date,
    default: null
  },
  avatarUrl: {
    type: String,
    default: null
  },
  configuracoes: {
    tema: {
      type: String,
      enum: ['claro', 'escuro', 'sistema'],
      default: 'sistema'
    },
    moeda: {
      type: String,
      default: 'BRL'
    },
    notificacoes: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      orcamento: { type: Boolean, default: true },
      metas: { type: Boolean, default: true }
    },
    privacidade: {
      perfilPublico: { type: Boolean, default: false },
      compartilharDados: { type: Boolean, default: false }
    }
  },
  ultimoLogin: {
    type: Date,
    default: null
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

// Middleware para atualizar o campo atualizadoEm
userSchema.pre('save', function(next) {
  this.atualizadoEm = Date.now()
  next()
})

// Método para verificar se o reset de senha é válido
userSchema.methods.isResetTokenValid = function() {
  return this.resetSenhaExpira && this.resetSenhaExpira > Date.now()
}

// Método para limpar dados sensíveis
userSchema.methods.toSafeObject = function() {
  const user = this.toObject()
  delete user.senhaHash
  delete user.codigoResetSenha
  delete user.resetSenhaExpira
  return user
}

module.exports = mongoose.model('User', userSchema)