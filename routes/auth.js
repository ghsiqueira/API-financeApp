// routes/auth.js - Completo
const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const router = express.Router()

// Mock de usuários (em produção seria um modelo do MongoDB)
let users = [
  {
    _id: '1',
    nome: 'Gabriel',
    email: 'admin@financeapp.com',
    senhaHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1VpJUjJC3a', // senha: admin123
    emailVerificado: true,
    criadoEm: new Date(),
    configuracoes: {
      tema: 'escuro',
      moeda: 'BRL',
      notificacoes: {
        email: true,
        push: true,
        orcamento: true,
        metas: true
      }
    }
  }
]

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         nome:
 *           type: string
 *         email:
 *           type: string
 *         emailVerificado:
 *           type: boolean
 *         configuracoes:
 *           type: object
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - senha
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         senha:
 *           type: string
 *           minLength: 6
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - nome
 *         - email
 *         - senha
 *       properties:
 *         nome:
 *           type: string
 *           minLength: 2
 *         email:
 *           type: string
 *           format: email
 *         senha:
 *           type: string
 *           minLength: 6
 */

// Validações
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('senha')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres')
]

const registerValidation = [
  body('nome')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nome deve ter entre 2 e 50 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('senha')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres')
]

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Fazer login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Credenciais inválidas
 */
router.post('/login', loginValidation, async (req, res) => {
  try {
    // Verificar erros de validação
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      })
    }

    const { email, senha } = req.body

    // Buscar usuário
    const user = users.find(u => u.email === email)
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Email ou senha incorretos'
      })
    }

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, user.senhaHash)
    if (!senhaValida) {
      return res.status(401).json({
        success: false,
        error: 'Email ou senha incorretos'
      })
    }

    // Gerar token JWT
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    // Remover senha da resposta
    const { senhaHash, ...userResponse } = user

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      token,
      user: userResponse
    })

  } catch (error) {
    console.error('Erro no login:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar novo usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       400:
 *         description: Dados inválidos ou email já existe
 */
router.post('/register', registerValidation, async (req, res) => {
  try {
    // Verificar erros de validação
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      })
    }

    const { nome, email, senha } = req.body

    // Verificar se email já existe
    const userExists = users.find(u => u.email === email)
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'Email já está em uso'
      })
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 12)

    // Criar novo usuário
    const newUser = {
      _id: (Date.now() + Math.random()).toString(),
      nome: nome.trim(),
      email: email.toLowerCase(),
      senhaHash,
      emailVerificado: false, // Em produção, seria false até verificar
      criadoEm: new Date(),
      configuracoes: {
        tema: 'escuro',
        moeda: 'BRL',
        notificacoes: {
          email: true,
          push: true,
          orcamento: true,
          metas: true
        }
      }
    }

    users.push(newUser)

    // Gerar token
    const token = jwt.sign(
      { 
        userId: newUser._id,
        email: newUser.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    // Remover senha da resposta
    const { senhaHash: _, ...userResponse } = newUser

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      token,
      user: userResponse
    })

  } catch (error) {
    console.error('Erro no registro:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicitar reset de senha
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email de reset enviado
 *       404:
 *         description: Email não encontrado
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email é obrigatório'
      })
    }

    // Buscar usuário
    const user = users.find(u => u.email === email.toLowerCase())
    if (!user) {
      // Por segurança, não revelar se o email existe ou não
      return res.json({
        success: true,
        message: 'Se o email existir, você receberá as instruções para resetar a senha'
      })
    }

    // Gerar código de 4 dígitos
    const resetCode = Math.floor(1000 + Math.random() * 9000).toString()
    
    // Em produção, salvaria o código no banco e enviaria por email
    console.log(`🔑 Código de reset para ${email}: ${resetCode}`)

    // Por enquanto, retornar o código na resposta (só para desenvolvimento)
    res.json({
      success: true,
      message: 'Código de reset enviado para seu email',
      ...(process.env.NODE_ENV === 'development' && { resetCode }) // Só mostrar em dev
    })

  } catch (error) {
    console.error('Erro no forgot password:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Resetar senha com código
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - codigo
 *               - novaSenha
 *             properties:
 *               email:
 *                 type: string
 *               codigo:
 *                 type: string
 *               novaSenha:
 *                 type: string
 *     responses:
 *       200:
 *         description: Senha alterada com sucesso
 *       400:
 *         description: Código inválido
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, codigo, novaSenha } = req.body

    if (!email || !codigo || !novaSenha) {
      return res.status(400).json({
        success: false,
        error: 'Email, código e nova senha são obrigatórios'
      })
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Nova senha deve ter pelo menos 6 caracteres'
      })
    }

    // Buscar usuário
    const userIndex = users.findIndex(u => u.email === email.toLowerCase())
    if (userIndex === -1) {
      return res.status(400).json({
        success: false,
        error: 'Código inválido'
      })
    }

    // Em produção, verificaria o código salvo no banco
    // Por enquanto, aceitar qualquer código de 4 dígitos
    if (!/^\d{4}$/.test(codigo)) {
      return res.status(400).json({
        success: false,
        error: 'Código deve ter 4 dígitos'
      })
    }

    // Hash da nova senha
    const novaSenhaHash = await bcrypt.hash(novaSenha, 12)

    // Atualizar senha
    users[userIndex].senhaHash = novaSenhaHash

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    })

  } catch (error) {
    console.error('Erro no reset password:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/auth/verify-token:
 *   get:
 *     summary: Verificar se token é válido
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token válido
 *       401:
 *         description: Token inválido
 */
router.get('/verify-token', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token não fornecido'
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = users.find(u => u._id === decoded.userId)

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não encontrado'
      })
    }

    const { senhaHash, ...userResponse } = user

    res.json({
      success: true,
      message: 'Token válido',
      user: userResponse
    })

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado'
      })
    }

    return res.status(401).json({
      success: false,
      error: 'Token inválido'
    })
  }
})

// Rota de teste
router.get('/test', (req, res) => {
  res.json({
    message: 'Rota de autenticação funcionando!',
    endpoints: [
      'POST /api/auth/login',
      'POST /api/auth/register', 
      'POST /api/auth/forgot-password',
      'POST /api/auth/reset-password',
      'GET /api/auth/verify-token'
    ],
    usuariosTeste: [
      {
        email: 'admin@financeapp.com',
        senha: 'admin123'
      }
    ]
  })
})

module.exports = router