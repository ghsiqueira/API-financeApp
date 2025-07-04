const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')
const User = require('../models/User')

// Ver perfil
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.userId).select('-senhaHash -codigoResetSenha')
  res.json(user)
})

// Atualizar dados
router.patch('/me', auth, async (req, res) => {
  const { nome, email, senha } = req.body
  const user = await User.findById(req.userId)

  if (nome) user.nome = nome
  if (email) user.email = email
  if (senha) user.senhaHash = await bcrypt.hash(senha, 10)

  await user.save()
  res.json({ message: 'Usuário atualizado' })
})

module.exports = router
