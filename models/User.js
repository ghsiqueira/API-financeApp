const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senhaHash: { type: String, required: true },
  emailVerificado: { type: Boolean, default: false },
  codigoResetSenha: { type: String, default: null }
})

module.exports = mongoose.model('User', userSchema)
