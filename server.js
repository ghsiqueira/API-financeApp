require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')

const app = express()

// Configuração do Swagger (opcional)
const fs = require('fs')
const path = require('path')

// Verificar se swagger está instalado
let swaggerConfig = null
try {
  if (fs.existsSync('./config/swagger.js')) {
    const { specs, swaggerUi, swaggerConfig: config } = require('./config/swagger')
    swaggerConfig = { specs, swaggerUi, config }
  }
} catch (err) {
  console.log('⚠️ Swagger não configurado:', err.message)
}

// Middlewares de segurança
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: { error: 'Muitas tentativas, tente novamente em 15 minutos' }
})
app.use('/api/', limiter)

// Rate limiting mais rigoroso para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de login, tente novamente em 15 minutos' }
})
app.use('/api/auth/login', authLimiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Configurar Swagger se disponível
if (swaggerConfig) {
  app.use('/api-docs', swaggerConfig.swaggerUi.serve, swaggerConfig.swaggerUi.setup(swaggerConfig.specs, swaggerConfig.config))
  console.log('📖 Swagger UI disponível em /api-docs')
}

// Conexão MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Erro ao conectar MongoDB:', err))

// Middleware para logs com melhor formatação
app.use((req, res, next) => {
  const timestamp = new Date().toISOString()
  console.log(`🚀 ${req.method} ${req.path}`)
  
  // Log do body para POST/PUT (sem senhas)
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const logBody = { ...req.body }
    if (logBody.senha) logBody.senha = '***'
    if (logBody.novaSenha) logBody.novaSenha = '***'
    if (logBody.senhaAtual) logBody.senhaAtual = '***'
    console.log('📝 Body:', JSON.stringify(logBody, null, 2))
  }
  
  next()
})

// Middleware para capturar respostas
app.use((req, res, next) => {
  const originalSend = res.send
  
  res.send = function(data) {
    // Log da resposta (apenas status)
    if (res.statusCode >= 400) {
      console.log(`❌ ${res.statusCode} ${req.path}`)
      if (data) {
        try {
          const parsed = JSON.parse(data)
          console.log('Error details:', parsed.error || parsed.message || 'undefined')
        } catch (e) {
          console.log('Error details:', data)
        }
      }
    } else {
      console.log(`✅ ${res.statusCode} ${req.path}`)
    }
    
    originalSend.call(this, data)
  }
  
  next()
})

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  })
})

// Função para carregar rota se o arquivo existir
function loadRouteIfExists(routePath, routeName) {
  const fullPath = path.join(__dirname, 'routes', `${routeName}.js`)
  if (fs.existsSync(fullPath)) {
    try {
      app.use(routePath, require(`./routes/${routeName}`))
      console.log(`✅ Rotas ${routeName} carregadas`)
    } catch (err) {
      console.error(`❌ Erro ao carregar rotas ${routeName}:`, err.message)
    }
  } else {
    console.log(`⚠️  Arquivo ./routes/${routeName}.js não encontrado`)
  }
}

// Carregar rotas
loadRouteIfExists('/api/auth', 'auth')
loadRouteIfExists('/api/user', 'user')
loadRouteIfExists('/api/transactions', 'transactions')
loadRouteIfExists('/api/budgets', 'budgets')
loadRouteIfExists('/api/goals', 'goals')
loadRouteIfExists('/api/categories', 'categories')
loadRouteIfExists('/api/dashboard', 'dashboard')
loadRouteIfExists('/api/reports', 'reports')

// Rota para listar todas as rotas disponíveis
app.get('/api/routes', (req, res) => {
  const routes = []
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Rota direta
      routes.push({
        path: middleware.route.path,
        method: Object.keys(middleware.route.methods)[0].toUpperCase()
      })
    } else if (middleware.name === 'router') {
      // Rota de router
      middleware.handle.stack.forEach((handler) => {
        const route = handler.route
        if (route) {
          routes.push({
            path: route.path,
            method: Object.keys(route.methods)[0].toUpperCase()
          })
        }
      })
    }
  })
  
  res.json({
    success: true,
    data: {
      routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
      total: routes.length
    }
  })
})

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error('❌ Erro global:', err.stack)
  
  // Erro de validação do Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }))
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      detalhes: errors
    })
  }
  
  // Erro de duplicação (unique key)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    return res.status(400).json({
      success: false,
      error: `${field} já está em uso`
    })
  }
  
  // Erro de cast (ID inválido)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'ID inválido'
    })
  }
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message
  })
})

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method,
    suggestion: 'Verifique a documentação em /api-docs'
  })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log('🎉 =================================')
  console.log(`🚀 Servidor rodando na porta ${PORT}`)
  console.log(`📱 Ambiente: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 Health check: http://localhost:${PORT}/health`)
  console.log(`📋 Rotas disponíveis: http://localhost:${PORT}/api/routes`)
  if (swaggerConfig) {
    console.log(`📖 API Docs: http://localhost:${PORT}/api-docs`)
  }
  console.log('🎉 =================================')
})