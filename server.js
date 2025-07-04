require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')

const app = express()

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

// Conexão MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Erro ao conectar MongoDB:', err))

// Middleware para logs
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Carregar rotas apenas se os arquivos existirem
const fs = require('fs')
const path = require('path')

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

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error('Erro:', err.stack)
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : err.message
  })
})

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`)
  console.log(`📱 Ambiente: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 Health check: http://localhost:${PORT}/health`)
})