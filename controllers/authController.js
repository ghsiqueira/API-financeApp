const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const User = require('../models/User')
const Category = require('../models/Category')
const transporter = require('../config/mailer')
const { validationResult } = require('express-validator')

// Gerar token JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { 
    expiresIn: process.env.JWT_EXPIRES_IN || '7d' 
  })
}

// Gerar refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

exports.register = async (req, res) => {
  try {
    // Validar dados de entrada
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        detalhes: errors.array() 
      })
    }

    const { nome, email, senha } = req.body

    // Verificar se email já existe
    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return res.status(400).json({ error: 'Email já está em uso' })
    }

    // Validar força da senha
    if (senha.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' })
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 12)

    // Criar usuário
    const user = await User.create({ 
      nome: nome.trim(), 
      email: email.toLowerCase().trim(), 
      senhaHash 
    })

    // Criar categorias padrão para o usuário (async para não travar)
    Category.criarCategoriasPadrao().catch(console.error)

    // Gerar tokens
    const token = generateToken(user._id)
    const refreshToken = generateRefreshToken()

    // Atualizar último login
    user.ultimoLogin = new Date()
    await user.save()

    res.status(201).json({ 
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        token, 
        refreshToken,
        user: user.toSafeObject()
      }
    })

  } catch (err) {
    console.error('Erro no registro:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        detalhes: errors.array() 
      })
    }

    const { email, senha } = req.body

    // Buscar usuário
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(400).json({ error: 'Credenciais inválidas' })
    }

    // Verificar senha
    const match = await bcrypt.compare(senha, user.senhaHash)
    if (!match) {
      return res.status(400).json({ error: 'Credenciais inválidas' })
    }

    // Gerar tokens
    const token = generateToken(user._id)
    const refreshToken = generateRefreshToken()

    // Atualizar último login
    user.ultimoLogin = new Date()
    await user.save()

    res.json({ 
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        token, 
        refreshToken,
        user: user.toSafeObject()
      }
    })

  } catch (err) {
    console.error('Erro no login:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' })
    }

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      // Por segurança, sempre retornar sucesso
      return res.json({ 
        success: true,
        message: 'Se o email existir, você receberá o código de recuperação' 
      })
    }

    // Gerar código de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString()
    
    // Definir expiração (15 minutos)
    const expiracao = new Date()
    expiracao.setMinutes(expiracao.getMinutes() + 15)

    user.codigoResetSenha = codigo
    user.resetSenhaExpira = expiracao
    await user.save()

    // Enviar email
    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #007AFF;">Código de Recuperação de Senha</h2>
        <p>Olá ${user.nome},</p>
        <p>Você solicitou a recuperação de senha para sua conta.</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #007AFF; font-size: 32px; margin: 0;">${codigo}</h1>
        </div>
        <p>Este código é válido por <strong>15 minutos</strong>.</p>
        <p>Se você não solicitou esta recuperação, ignore este email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Este é um email automático, não responda.
        </p>
      </div>
    `

    await transporter.sendMail({
      from: process.env.MAIL_FROM_ADDRESS,
      to: email,
      subject: 'Código de Recuperação de Senha - Finance App',
      html: emailHTML,
      text: `Seu código de recuperação é: ${codigo}. Válido por 15 minutos.`
    })

    res.json({ 
      success: true,
      message: 'Código enviado para o email' 
    })

  } catch (err) {
    console.error('Erro ao enviar email:', err)
    res.status(500).json({ error: 'Erro ao enviar email de recuperação' })
  }
}

exports.resetPassword = async (req, res) => {
  try {
    const { email, codigo, novaSenha } = req.body

    if (!email || !codigo || !novaSenha) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' })
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' })
    }

    const user = await User.findOne({ 
      email: email.toLowerCase(),
      codigoResetSenha: codigo
    })

    if (!user || !user.isResetTokenValid()) {
      return res.status(400).json({ error: 'Código inválido ou expirado' })
    }

    // Atualizar senha
    user.senhaHash = await bcrypt.hash(novaSenha, 12)
    user.codigoResetSenha = null
    user.resetSenhaExpira = null
    await user.save()

    res.json({ 
      success: true,
      message: 'Senha redefinida com sucesso' 
    })

  } catch (err) {
    console.error('Erro ao redefinir senha:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token não fornecido' })
    }

    // Aqui você implementaria a lógica de validação do refresh token
    // Por simplicidade, vamos apenas verificar se o usuário existe
    const { userId } = req.body

    const user = await User.findById(userId)
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' })
    }

    // Gerar novo token
    const token = generateToken(user._id)
    const newRefreshToken = generateRefreshToken()

    res.json({
      success: true,
      data: {
        token,
        refreshToken: newRefreshToken
      }
    })

  } catch (err) {
    console.error('Erro ao renovar token:', err)
    res.status(401).json({ error: 'Token inválido' })
  }
}

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params

    // Implementar verificação de email se necessário
    res.json({ 
      success: true,
      message: 'Email verificado com sucesso' 
    })

  } catch (err) {
    console.error('Erro na verificação:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.logout = async (req, res) => {
  try {
    // Aqui você pode implementar blacklist de tokens se necessário
    res.json({ 
      success: true,
      message: 'Logout realizado com sucesso' 
    })
  } catch (err) {
    console.error('Erro no logout:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}