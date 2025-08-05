// middleware/authMiddleware.js - CORRIGIDO PARA IDs CUSTOMIZADOS
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const mongoose = require('mongoose')

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
      console.log('🔍 DEBUG JWT decoded:', decoded)
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

    // 🔧 CORREÇÃO: Verificar ambos os campos possíveis do JWT
    const userIdFromToken = decoded.userId || decoded.id
    console.log('👤 Buscando usuário com ID:', userIdFromToken)

    if (!userIdFromToken) {
      return res.status(401).json({ 
        error: 'ID do usuário não encontrado no token',
        code: 'NO_USER_ID_IN_TOKEN'
      })
    }

    // 🔧 NOVA CORREÇÃO: Verificar se é ObjectId válido ou usar busca alternativa
    let user
    try {
      // Tentar primeiro como ObjectId (MongoDB padrão)
      if (mongoose.Types.ObjectId.isValid(userIdFromToken) && userIdFromToken.length === 24) {
        console.log('🔍 Buscando como ObjectId MongoDB...')
        user = await User.findById(userIdFromToken).select('-senhaHash')
      } else {
        console.log('🔍 Buscando como ID customizado...')
        // Se não for ObjectId válido, buscar por campo customizado
        user = await User.findOne({ 
          $or: [
            { _id: userIdFromToken },
            { userId: userIdFromToken },
            { id: userIdFromToken }
          ]
        }).select('-senhaHash')
      }
      
      console.log('👤 Usuário encontrado?', !!user)
      if (user) {
        console.log('👤 Dados do usuário:', { 
          id: user._id, 
          email: user.email || 'sem email', 
          nome: user.nome || 'sem nome' 
        })
      }
    } catch (error) {
      console.error('❌ Erro ao buscar usuário:', error)
      return res.status(401).json({ 
        error: 'Erro ao verificar usuário',
        code: 'USER_LOOKUP_ERROR'
      })
    }

    if (!user) {
      console.log('❌ Usuário não encontrado para ID:', userIdFromToken)
      return res.status(401).json({ 
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      })
    }

    // Adicionar informações do usuário à requisição
    req.userId = user._id
    req.user = user

    console.log('✅ Autenticação bem-sucedida para:', user.email || user.nome)

    // Atualizar último acesso (opcional - pode impactar performance)
    if (process.env.UPDATE_LAST_ACCESS === 'true') {
      User.findByIdAndUpdate(user._id, { 
        ultimoLogin: new Date() 
      }).exec().catch(console.error)
    }

    next()
  } catch (err) {
    console.error('❌ Erro no middleware de autenticação:', err)
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    })
  }
}