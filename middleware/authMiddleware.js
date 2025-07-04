const jwt = require('jsonwebtoken')
const User = require('../models/User')

module.exports = async (req, res, next) => {
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader

    if (!token) {
      return res.status(401).json({ 
        error: 'Token de acesso não fornecido',
        code: 'NO_TOKEN'
      })
    }

    // Verificar e decodificar token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expirado',
          code: 'TOKEN_EXPIRED'
        })
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Token inválido',
          code: 'INVALID_TOKEN'
        })
      } else {
        return res.status(401).json({ 
          error: 'Erro na validação do token',
          code: 'TOKEN_ERROR'
        })
      }
    }

    // Verificar se usuário existe
    const user = await User.findById(decoded.id).select('-senhaHash')
    if (!user) {
      return res.status(401).json({ 
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      })
    }

    // Adicionar informações do usuário à requisição
    req.userId = user._id
    req.user = user

    // Atualizar último acesso (opcional - pode impactar performance)
    if (process.env.UPDATE_LAST_ACCESS === 'true') {
      User.findByIdAndUpdate(user._id, { 
        ultimoLogin: new Date() 
      }).exec().catch(console.error)
    }

    next()
  } catch (err) {
    console.error('Erro no middleware de autenticação:', err)
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    })
  }
}