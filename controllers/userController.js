const User = require('../models/User')
const bcrypt = require('bcrypt')

exports.getMe = async (req, res) => {
  const user = await User.findById(req.userId).select('-senhaHash -codigoResetSenha')
  res.json(user)
}

exports.updateMe = async (req, res) => {
  const { nome, email, senha } = req.body
  const user = await User.findById(req.userId)

  if (nome) user.nome = nome
  if (email) user.email = email
  if (senha) user.senhaHash = await bcrypt.hash(senha, 10)

  await user.save()
  res.json({ message: 'Usuário atualizado' })
}
