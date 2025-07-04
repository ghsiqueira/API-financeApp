const mongoose = require('mongoose')

const goalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  titulo: String,
  valorAlvo: Number,
  dataLimite: Date,
  contribuicoes: [{
    valor: Number,
    nota: String,
    data: { type: Date, default: Date.now }
  }],
  prioridade: { type: String, enum: ['baixa', 'media', 'alta'], default: 'media' }
})

module.exports = mongoose.model('Goal', goalSchema)
