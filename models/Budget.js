const mongoose = require('mongoose')

const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  categoria: String,
  valorLimite: Number,
  periodo: String,
  dataInicio: Date,
  dataFim: Date,
  renovacaoAutomatica: Boolean
})

module.exports = mongoose.model('Budget', budgetSchema)
