require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')

// Importar chalk de forma compatível
let chalk
try {
  chalk = require('chalk')
} catch (error) {
  // Fallback se chalk não estiver disponível
  chalk = {
    blue: (text) => `[BLUE] ${text}`,
    green: (text) => `[GREEN] ${text}`,
    red: (text) => `[RED] ${text}`,
    yellow: (text) => `[YELLOW] ${text}`,
    gray: (text) => `[GRAY] ${text}`,
    cyan: (text) => `[CYAN] ${text}`,
    white: (text) => `[WHITE] ${text}`
  }
}

const NetworkHelper = require('./utils/networkHelper')

const app = express()

// Configuração de CORS mais permissiva para desenvolvimento
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sem origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)
    
    // Em desenvolvimento, permitir qualquer origin local
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || 
          origin.includes('127.0.0.1') || 
          origin.includes('192.168.') || 
          origin.includes('10.0.') ||
          origin.includes('172.')) {
        return callback(null, true)
      }
    }
    
    // Em produção, usar apenas origins permitidas
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://your-domain.com'
    ].filter(Boolean)
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Não permitido pelo CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}

// Middlewares de segurança
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))
app.use(cors(corsOptions))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Mais permissivo em dev
  message: { error: 'Muitas tentativas, tente novamente em 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/api/', limiter)

// Rate limiting para auth (mais rigoroso)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 20 : 5,
  message: { error: 'Muitas tentativas de login, tente novamente em 15 minutos' }
})
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Conexão MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log(chalk.green('✅ MongoDB conectado'))
  })
  .catch(err => {
    console.error(chalk.red('❌ Erro ao conectar MongoDB:'), err)
    process.exit(1)
  })

// Middleware para logs detalhados
app.use((req, res, next) => {
  const timestamp = new Date().toISOString()
  const method = req.method
  const url = req.path
  const ip = req.ip || req.connection.remoteAddress
  
  console.log(chalk.gray(`${timestamp} - ${method} ${url} from ${ip}`))
  next()
})

// Rota de health check com informações detalhadas
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    platform: process.platform
  }
  
  if (process.env.NODE_ENV === 'development') {
    healthInfo.networkInfo = {
      availableIPs: NetworkHelper.getLocalIPs(),
      primaryIP: NetworkHelper.getPrimaryIP()
    }
  }
  
  res.json(healthInfo)
})

// Rota para obter informações de rede (apenas em desenvolvimento)
if (process.env.NODE_ENV === 'development') {
  app.get('/network-info', (req, res) => {
    const port = process.env.PORT || 5000
    res.json(NetworkHelper.createMobileConfig(port))
  })
}

// Função para carregar rotas se existirem
function loadRouteIfExists(routePath, routeName) {
  const fs = require('fs')
  const path = require('path')
  const fullPath = path.join(__dirname, 'routes', `${routeName}.js`)
  
  if (fs.existsSync(fullPath)) {
    try {
      app.use(routePath, require(`./routes/${routeName}`))
      console.log(chalk.green(`✅ Rotas ${routeName} carregadas`))
    } catch (err) {
      console.error(chalk.red(`❌ Erro ao carregar rotas ${routeName}:`), err.message)
    }
  } else {
    console.log(chalk.yellow(`⚠️  Arquivo ./routes/${routeName}.js não encontrado`))
  }
}

// Carregar todas as rotas
const routes = [
  { path: '/api/auth', name: 'auth' },
  { path: '/api/user', name: 'user' },
  { path: '/api/transactions', name: 'transactions' },
  { path: '/api/budgets', name: 'budgets' },
  { path: '/api/goals', name: 'goals' },
  { path: '/api/categories', name: 'categories' },
  { path: '/api/dashboard', name: 'dashboard' },
  { path: '/api/reports', name: 'reports' }
]

routes.forEach(route => {
  loadRouteIfExists(route.path, route.name)
})

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error(chalk.red('❌ Erro:'), err.stack)
  
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Erro interno do servidor',
    ...(isDevelopment && { stack: err.stack })
  })
})

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method
  })
})

const PORT = process.env.PORT || 5000

// Função para inicializar o servidor
function startServer() {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + chalk.blue('🚀 SERVIDOR FINANCE APP INICIADO'))
    console.log(chalk.gray('=' .repeat(60)))
    console.log(chalk.green(`✅ Porta: ${PORT}`))
    console.log(chalk.green(`✅ Ambiente: ${process.env.NODE_ENV || 'development'}`))
    console.log(chalk.green(`✅ MongoDB: ${mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado'}`))
    console.log(chalk.green(`✅ CORS: Configurado para desenvolvimento`))
    console.log(chalk.green(`✅ Rate Limiting: Ativo`))
    
    // Mostrar informações de rede
    NetworkHelper.displayNetworkInfo(PORT)
    
    // URLs úteis
    console.log('\n' + chalk.blue('🔗 URLs ÚTEIS:'))
    console.log(chalk.white(`   Health Check: http://localhost:${PORT}/health`))
    
    if (process.env.NODE_ENV === 'development') {
      console.log(chalk.white(`   Network Info: http://localhost:${PORT}/network-info`))
      console.log(chalk.white(`   API Base: http://localhost:${PORT}/api`))
      
      // Monitorar mudanças de rede
      NetworkHelper.watchNetworkChanges((newIPs) => {
        console.log(chalk.blue('\n📱 NOVOS IPs DISPONÍVEIS PARA O MOBILE:'))
        newIPs.forEach(({ ip, type }) => {
          console.log(chalk.cyan(`   → http://${ip}:${PORT}/api - ${type}`))
        })
        console.log(chalk.gray('   O app mobile detectará automaticamente\n'))
      })
    }
    
    console.log('\n' + chalk.blue('📖 COMO USAR:'))
    console.log(chalk.gray('   1. Inicie seu app mobile'))
    console.log(chalk.gray('   2. O app detectará automaticamente o IP'))
    console.log(chalk.gray('   3. Não precisa mais configurar IPs manualmente!'))
    
    console.log('\n' + chalk.gray('=' .repeat(60)) + '\n')
  })

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n🛑 Recebido SIGTERM, fechando servidor graciosamente...'))
    server.close(() => {
      console.log(chalk.green('✅ Servidor HTTP fechado'))
      mongoose.connection.close(() => {
        console.log(chalk.green('✅ Conexão MongoDB fechada'))
        process.exit(0)
      })
    })
  })

  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Recebido SIGINT (Ctrl+C), fechando servidor graciosamente...'))
    server.close(() => {
      console.log(chalk.green('✅ Servidor HTTP fechado'))
      mongoose.connection.close(() => {
        console.log(chalk.green('✅ Conexão MongoDB fechada'))
        console.log(chalk.blue('👋 Até logo!'))
        process.exit(0)
      })
    })
  })

  // Tratamento de erros não capturados
  process.on('uncaughtException', (error) => {
    console.error(chalk.red('❌ Erro não capturado:'), error)
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('❌ Promise rejeitada não tratada:'), reason)
    process.exit(1)
  })
}

// Aguardar conexão do MongoDB antes de iniciar o servidor
mongoose.connection.once('open', () => {
  startServer()
})

mongoose.connection.on('error', (error) => {
  console.error(chalk.red('❌ Erro de conexão MongoDB:'), error)
})

mongoose.connection.on('disconnected', () => {
  console.log(chalk.yellow('⚠️  MongoDB desconectado'))
})

module.exports = app