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

// Gerar código de reset de senha
const generateResetCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Registrar novo usuário
 */
exports.register = async (req, res) => {
  console.log('🚀 POST /auth/register')
  
  try {
    // Validar dados de entrada
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      console.log('❌ Dados inválidos:', errors.array())
      return res.status(400).json({ 
        success: false,
        error: 'Dados inválidos', 
        detalhes: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      })
    }

    const { nome, email, senha } = req.body
    console.log('📝 Dados recebidos:', { nome, email, senha: '***' })

    // Verificar se email já existe
    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      console.log('❌ Email já existe:', email)
      return res.status(400).json({ 
        success: false,
        error: 'Email já está em uso' 
      })
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 12)
    console.log('🔐 Senha hasheada')

    // Criar usuário
    const user = await User.create({ 
      nome: nome.trim(), 
      email: email.toLowerCase().trim(), 
      senhaHash 
    })
    console.log('✅ Usuário criado:', user._id)

    // Criar categorias padrão para o usuário (async para não travar)
    try {
      await Category.criarCategoriasPadrao(user._id)
      console.log('✅ Categorias padrão criadas')
    } catch (err) {
      console.error('⚠️ Erro ao criar categorias padrão:', err.message)
    }

    // Gerar tokens
    const token = generateToken(user._id)
    const refreshToken = generateRefreshToken()
    console.log('🎫 Tokens gerados')

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
    console.error('❌ Erro no registro:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
}

/**
 * Fazer login
 */
exports.login = async (req, res) => {
  console.log('🚀 POST /auth/login')
  
  try {
    // Validar dados de entrada
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      console.log('❌ Dados inválidos:', errors.array())
      return res.status(400).json({ 
        success: false,
        error: 'Dados inválidos', 
        detalhes: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      })
    }

    const { email, senha } = req.body
    console.log('📝 Tentativa de login:', email)

    // Buscar usuário
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      console.log('❌ Usuário não encontrado:', email)
      return res.status(400).json({ 
        success: false,
        error: 'Credenciais inválidas' 
      })
    }

    // Verificar senha
    const match = await bcrypt.compare(senha, user.senhaHash)
    if (!match) {
      console.log('❌ Senha incorreta para:', email)
      return res.status(400).json({ 
        success: false,
        error: 'Credenciais inválidas' 
      })
    }

    // Gerar tokens
    const token = generateToken(user._id)
    const refreshToken = generateRefreshToken()
    console.log('🎫 Login bem-sucedido:', user._id)

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
    console.error('❌ Erro no login:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
}

/**
 * Solicitar código de recuperação de senha
 */
exports.forgotPassword = async (req, res) => {
  console.log('🚀 POST /auth/forgot-password')
  
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: 'Dados inválidos', 
        detalhes: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      })
    }

    const { email } = req.body
    console.log('📧 Solicitação de reset para:', email)

    // Buscar usuário
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      console.log('❌ Email não encontrado:', email)
      return res.status(400).json({ 
        success: false,
        error: 'Email não encontrado' 
      })
    }

    // Gerar código de reset
    const resetCode = generateResetCode()
    const resetExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutos

    // Salvar código no usuário
    user.codigoResetSenha = resetCode
    user.resetSenhaExpira = resetExpires
    await user.save()

    // Enviar email
    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM_ADDRESS,
        to: user.email,
        subject: 'Código de Recuperação de Senha - Finance App',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Recuperação de Senha</h2>
            <p>Olá, ${user.nome}!</p>
            <p>Você solicitou a recuperação de sua senha. Use o código abaixo no aplicativo:</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="color: #1a1a2e; margin: 0; letter-spacing: 4px;">${resetCode}</h1>
            </div>
            <p><strong>Este código é válido por 10 minutos.</strong></p>
            <p>Se você não solicitou esta recuperação, ignore este email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">Finance App - Seu gestor financeiro pessoal</p>
          </div>
        `
      })
      console.log('✅ Email de reset enviado para:', email)
    } catch (emailErr) {
      console.error('❌ Erro ao enviar email:', emailErr)
      return res.status(500).json({ 
        success: false,
        error: 'Erro ao enviar email' 
      })
    }

    res.json({ 
      success: true,
      message: 'Código de recuperação enviado por email' 
    })

  } catch (err) {
    console.error('❌ Erro no forgot password:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
}

/**
 * Redefinir senha com código
 */
exports.resetPassword = async (req, res) => {
  console.log('🚀 POST /auth/reset-password')
  
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: 'Dados inválidos', 
        detalhes: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      })
    }

    const { email, code, novaSenha } = req.body
    console.log('🔐 Reset de senha para:', email)

    // Buscar usuário
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      codigoResetSenha: code,
      resetSenhaExpira: { $gt: new Date() }
    })

    if (!user) {
      console.log('❌ Código inválido ou expirado')
      return res.status(400).json({ 
        success: false,
        error: 'Código inválido ou expirado' 
      })
    }

    // Hash da nova senha
    const senhaHash = await bcrypt.hash(novaSenha, 12)

    // Atualizar senha e limpar código de reset
    user.senhaHash = senhaHash
    user.codigoResetSenha = null
    user.resetSenhaExpira = null
    await user.save()

    console.log('✅ Senha redefinida para:', email)

    res.json({ 
      success: true,
      message: 'Senha redefinida com sucesso' 
    })

  } catch (err) {
    console.error('❌ Erro no reset password:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
}

/**
 * Renovar token de acesso
 */
exports.refreshToken = async (req, res) => {
  console.log('🚀 POST /auth/refresh-token')
  
  try {
    const { refreshToken, userId } = req.body

    if (!refreshToken || !userId) {
      return res.status(400).json({ 
        success: false,
        error: 'Refresh token e userId são obrigatórios' 
      })
    }

    // Verificar se usuário existe
    const user = await User.findById(userId)
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Usuário não encontrado' 
      })
    }

    // Gerar novos tokens
    const newToken = generateToken(user._id)
    const newRefreshToken = generateRefreshToken()

    console.log('🎫 Tokens renovados para:', user.email)

    res.json({ 
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    })

  } catch (err) {
    console.error('❌ Erro no refresh token:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
}

/**
 * Verificar email do usuário
 */
exports.verifyEmail = async (req, res) => {
  console.log('🚀 GET /auth/verify-email/:token')
  
  try {
    const { token } = req.params

    // Verificar token (implementar lógica conforme necessário)
    // Por enquanto, apenas um placeholder
    
    res.json({ 
      success: true,
      message: 'Email verificado com sucesso' 
    })

  } catch (err) {
    console.error('❌ Erro na verificação de email:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
}

/**
 * Fazer logout
 */
exports.logout = async (req, res) => {
  console.log('🚀 POST /auth/logout')
  
  try {
    // Aqui você pode implementar blacklist de tokens se necessário
    console.log('✅ Logout realizado para usuário:', req.userId)

    res.json({ 
      success: true,
      message: 'Logout realizado com sucesso' 
    })

  } catch (err) {
    console.error('❌ Erro no logout:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
}

/**
 * Validar token atual
 */
exports.validateToken = async (req, res) => {
  console.log('🚀 GET /auth/validate-token')
  
  try {
    // O middleware de auth já validou o token e adicionou req.user
    res.json({ 
      success: true,
      data: {
        user: req.user.toSafeObject()
      }
    })

  } catch (err) {
    console.error('❌ Erro na validação do token:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
}