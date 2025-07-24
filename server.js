// server.js - Completo e atualizado
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const compression = require('compression')
const morgan = require('morgan')
const path = require('path')
const fs = require('fs')

require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 5001

// ==========================================
// MIDDLEWARES GLOBAIS
// ==========================================

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, process.env.APP_URL]
    : ['http://localhost:3000', 'http://localhost:19006', 'exp://192.168.1.100:19000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'))
} else {
  app.use(morgan('dev'))
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// ==========================================
// CONEXÃO COM MONGODB
// ==========================================

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log('✅ Conectado ao MongoDB')
  
  // Inicializar cron jobs apenas se habilitado
  if (process.env.ENABLE_CRON_JOBS === 'true') {
    initializeCronJobs()
  }
})
.catch((err) => {
  console.error('❌ Erro ao conectar no MongoDB:', err)
  process.exit(1)
})

// ==========================================
// FUNÇÃO AUXILIAR
// ==========================================

function routeExists(routePath) {
  return fs.existsSync(path.join(__dirname, routePath))
}

// ==========================================
// ROTAS BÁSICAS
// ==========================================

app.get('/health', async (req, res) => {
  try {
    const healthInfo = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        name: mongoose.connection.name
      },
      memory: process.memoryUsage(),
      version: '1.0.0'
    }

    // Verificar cron jobs se habilitados
    if (process.env.ENABLE_CRON_JOBS === 'true') {
      try {
        const cronManager = require('./scripts/budgetRenewalCron')
        healthInfo.cronJobs = cronManager.getStatus()
      } catch (error) {
        healthInfo.cronJobs = { error: 'Cron jobs não disponíveis' }
      }
    }

    res.json(healthInfo)
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

app.get('/api', (req, res) => {
  res.json({
    name: 'Finance App API',
    version: '1.0.0',
    description: 'API para gestão financeira pessoal',
    endpoints: {
      auth: '/api/auth',
      categories: '/api/categories',
      transactions: '/api/transactions',
      budgets: '/api/budgets',
      goals: '/api/goals',
      budgetRenewal: '/api/budgets/renewal',
      health: '/health'
    },
    features: [
      'Autenticação JWT',
      'Gestão de transações',
      'Orçamentos com renovação automática',
      'Metas financeiras',
      'Categorização automática'
    ]
  })
})

// ==========================================
// IMPORTAR E USAR ROTAS
// ==========================================

// Verificar e importar apenas rotas que existem
if (routeExists('./routes/auth.js')) {
  const authRoutes = require('./routes/auth')
  app.use('/api/auth', authRoutes)
  console.log('✅ Rota auth carregada')
}

if (routeExists('./routes/categories.js')) {
  const categoryRoutes = require('./routes/categories')
  app.use('/api/categories', categoryRoutes)
  console.log('✅ Rota categories carregada')
} else {
  console.log('⚠️ Rota categories não encontrada')
}

if (routeExists('./routes/transactions.js')) {
  const transactionRoutes = require('./routes/transactions')
  app.use('/api/transactions', transactionRoutes)
  console.log('✅ Rota transactions carregada')
}

if (routeExists('./routes/budgets.js')) {
  const budgetRoutes = require('./routes/budgets')
  app.use('/api/budgets', budgetRoutes)
  console.log('✅ Rota budgets carregada')
}

if (routeExists('./routes/goals.js')) {
  const goalRoutes = require('./routes/goals')
  app.use('/api/goals', goalRoutes)
  console.log('✅ Rota goals carregada')
}

// Rota de renovação automática
if (routeExists('./routes/budgetRenewal.js')) {
  const budgetRenewalRoutes = require('./routes/budgetRenewal')
  app.use('/api/budgets/renewal', budgetRenewalRoutes)
  console.log('✅ Rota budget renewal carregada')
}

// ==========================================
// TESTAR SERVIÇOS
// ==========================================

// Testar email service
if (routeExists('./services/emailService.js')) {
  try {
    const emailService = require('./services/emailService')
    if (emailService.testConnection) {
      emailService.testConnection()
        .then(() => console.log('✅ Serviço de email funcionando'))
        .catch(() => console.log('⚠️ Serviço de email com problemas (mas servidor continua)'))
    }
  } catch (error) {
    console.log('⚠️ Erro no serviço de email:', error.message)
  }
} else if (routeExists('./config/mailer.js')) {
  try {
    const emailService = require('./config/mailer')
    if (emailService.testConnection) {
      emailService.testConnection()
        .then(() => console.log('✅ Serviço de email funcionando'))
        .catch(() => console.log('⚠️ Serviço de email com problemas'))
    }
  } catch (error) {
    console.log('⚠️ Erro no serviço de email:', error.message)
  }
}

// ==========================================
// SWAGGER (OPCIONAL)
// ==========================================

if (process.env.ENABLE_SWAGGER === 'true') {
  try {
    const swaggerUi = require('swagger-ui-express')
    const swaggerJsdoc = require('swagger-jsdoc')
    
    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'Finance App API',
          version: '1.0.0',
          description: 'API para aplicativo de gestão financeira pessoal',
        },
        servers: [{
          url: `http://localhost:${PORT}`,
          description: 'Desenvolvimento'
        }],
      },
      apis: ['./routes/*.js'],
    }
    
    const swaggerSpec = swaggerJsdoc(swaggerOptions)
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
    console.log('✅ Swagger habilitado')
  } catch (error) {
    console.log('⚠️ Erro ao configurar Swagger:', error.message)
  }
}

// ==========================================
// MIDDLEWARE DE ERRO
// ==========================================

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint não encontrado',
    availableEndpoints: {
      api: '/api',
      health: '/health',
      docs: process.env.ENABLE_SWAGGER === 'true' ? '/api-docs' : 'Não disponível'
    }
  })
})

app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err)

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message)
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors
    })
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'ID inválido'
    })
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    return res.status(400).json({
      success: false,
      error: `${field} já está em uso`
    })
  }

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  })
})

// ==========================================
// INICIALIZAÇÃO DOS CRON JOBS
// ==========================================

async function initializeCronJobs() {
  try {
    console.log('🔄 Inicializando sistema de renovação automática...')
    
    const cronManager = require('./scripts/budgetRenewalCron')
    await cronManager.initialize()
    cronManager.startAll()
    
    console.log('✅ Cron jobs de renovação automática iniciados')
    
  } catch (error) {
    console.error('❌ Erro ao inicializar cron jobs:', error)
  }
}

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

async function gracefulShutdown(signal) {
  console.log(`\n📡 Recebido sinal ${signal}. Iniciando shutdown graceful...`)
  
  try {
    if (process.env.ENABLE_CRON_JOBS === 'true') {
      try {
        const cronManager = require('./scripts/budgetRenewalCron')
        cronManager.stopAll()
        console.log('⏹️ Cron jobs parados')
      } catch (error) {
        console.error('❌ Erro ao parar cron jobs:', error)
      }
    }

    await mongoose.connection.close()
    console.log('🔌 Conexão MongoDB fechada')

    console.log('👋 Servidor finalizado gracefully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Erro durante shutdown:', error)
    process.exit(1)
  }
}

// ==========================================
// INICIAR SERVIDOR
// ==========================================

const server = app.listen(PORT, () => {
  console.log(`
🚀 Servidor Finance App rodando!
┌─────────────────────────────────────────┐
│  🌍 URL: http://localhost:${PORT}           │
│  💚 Health: http://localhost:${PORT}/health │
│  📋 API: http://localhost:${PORT}/api       │${process.env.ENABLE_SWAGGER === 'true' ? `
│  📚 Docs: http://localhost:${PORT}/api-docs │` : ''}
│  🔧 Ambiente: ${process.env.NODE_ENV || 'development'}        │
└─────────────────────────────────────────┘

📋 Status das Rotas:
${routeExists('./routes/auth.js') ? '✅' : '❌'} Auth
${routeExists('./routes/categories.js') ? '✅' : '❌'} Categories  
${routeExists('./routes/transactions.js') ? '✅' : '❌'} Transactions
${routeExists('./routes/budgets.js') ? '✅' : '❌'} Budgets
${routeExists('./routes/goals.js') ? '✅' : '❌'} Goals
${routeExists('./routes/budgetRenewal.js') ? '✅' : '❌'} Budget Renewal

🔧 Funcionalidades:
${process.env.ENABLE_CRON_JOBS === 'true' ? '✅' : '❌'} Renovação Automática
${process.env.ENABLE_SWAGGER === 'true' ? '✅' : '❌'} Documentação Swagger
✅ Rate Limiting
✅ Compressão GZIP
✅ Tratamento de Erros
  `)
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso`)
    process.exit(1)
  } else {
    console.error('❌ Erro do servidor:', error)
  }
})

module.exports = app