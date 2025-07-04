const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tipo: { type: String, enum: ['receita', 'despesa'], required: true },
  descricao: String,
  valor: Number,
  data: { type: Date, default: Date.now },
  categoria: String,
  recorrente: Boolean,
  metodoPagamento: String,
  orcamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget', default: null }
})

module.exports = mongoose.model('Transaction', transactionSchema)
