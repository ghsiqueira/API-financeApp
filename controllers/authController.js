const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const transporter = require('../config/mailer')

exports.register = async (req, res) => {
  try {
    const { nome, email, senha } = req.body
    const existing = await User.findOne({ email })
    if (existing) return res.status(400).json({ message: 'Email já cadastrado' })

    const senhaHash = await bcrypt.hash(senha, 10)
    const user = await User.create({ nome, email, senhaHash })

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.status(201).json({ token, user: { id: user._id, nome: user.nome, email: user.email } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ message: 'Usuário não encontrado' })

    const match = await bcrypt.compare(senha, user.senhaHash)
    if (!match) return res.status(400).json({ message: 'Senha inválida' })

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.json({ token, user: { id: user._id, nome: user.nome, email: user.email } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ message: 'Usuário não encontrado' })

    const codigo = Math.floor(1000 + Math.random() * 9000).toString()
    user.codigoResetSenha = codigo
    await user.save()

    await transporter.sendMail({
      from: process.env.MAIL_FROM_ADDRESS,
      to: email,
      subject: 'Código para resetar senha',
      text: `Seu código de recuperação é: ${codigo}`
    })

    res.json({ message: 'Código enviado para o email' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.resetPassword = async (req, res) => {
  try {
    const { email, codigo, novaSenha } = req.body
    const user = await User.findOne({ email })
    if (!user || user.codigoResetSenha !== codigo)
      return res.status(400).json({ message: 'Código inválido' })

    user.senhaHash = await bcrypt.hash(novaSenha, 10)
    user.codigoResetSenha = null
    await user.save()

    res.json({ message: 'Senha redefinida com sucesso' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
