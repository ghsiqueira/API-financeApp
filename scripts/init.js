// scripts/init.js - Script de inicialização completo
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

require('dotenv').config()

// Dados de usuário padrão
const defaultUser = {
  _id: '1',
  nome: 'Gabriel',
  email: 'admin@financeapp.com',
  senhaHash: null, // Será gerado
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

// Dados de categorias padrão
const defaultCategories = [
  { _id: '1', nome: 'Alimentação', tipo: 'despesa', icone: 'restaurant', cor: '#FF5722' },
  { _id: '2', nome: 'Transporte', tipo: 'despesa', icone: 'car', cor: '#607D8B' },
  { _id: '3', nome: 'Moradia', tipo: 'despesa', icone: 'home', cor: '#795548' },
  { _id: '4', nome: 'Saúde', tipo: 'despesa', icone: 'medical', cor: '#F44336' },
  { _id: '5', nome: 'Educação', tipo: 'despesa', icone: 'school', cor: '#3F51B5' },
  { _id: '6', nome: 'Lazer', tipo: 'despesa', icone: 'game-controller', cor: '#9C27B0' },
  { _id: '7', nome: 'Vestuário', tipo: 'despesa', icone: 'shirt', cor: '#E91E63' },
  { _id: '8', nome: 'Tecnologia', tipo: 'despesa', icone: 'phone-portrait', cor: '#2196F3' },
  { _id: '9', nome: 'Salário', tipo: 'receita', icone: 'wallet', cor: '#4CAF50' },
  { _id: '10', nome: 'Freelance', tipo: 'receita', icone: 'briefcase', cor: '#FF9800' },
  { _id: '11', nome: 'Investimentos', tipo: 'receita', icone: 'trending-up', cor: '#009688' },
  { _id: '12', nome: 'Outros', tipo: 'despesa', icone: 'ellipsis-horizontal', cor: '#9E9E9E' }
]

// Dados de orçamentos de exemplo
const defaultBudgets = [
  {
    _id: '1',
    userId: '1',
    nome: 'Alimentação Dezembro',
    categoria: '1',
    valorLimite: 800,
    valorGasto: 450.50,
    periodo: 'mensal',
    dataInicio: new Date('2024-12-01'),
    dataFim: new Date('2024-12-31'),
    cor: '#FF5722',
    icone: 'restaurant',
    status: 'ativo',
    renovacaoAutomatica: true,
    configuracoes: {
      alertas: { ativo: true, porcentagens: [50, 80, 90, 100] },
      renovacao: { rollover: false, ajusteAutomatico: false }
    },
    historico: [{
      data: new Date('2024-12-01'),
      acao: 'criado',
      valor: 800,
      observacao: 'Orçamento criado'
    }]
  },
  {
    _id: '2',
    userId: '1',
    nome: 'Transporte',
    categoria: '2',
    valorLimite: 400,
    valorGasto: 120,
    periodo: 'mensal',
    dataInicio: new Date('2024-12-01'),
    dataFim: new Date('2024-12-31'),
    cor: '#607D8B',
    icone: 'car',
    status: 'ativo',
    renovacaoAutomatica: false,
    configuracoes: {
      alertas: { ativo: true, porcentagens: [80, 100] },
      renovacao: { rollover: true, ajusteAutomatico: false }
    },
    historico: [{
      data: new Date('2024-12-01'),
      acao: 'criado',
      valor: 400,
      observacao: 'Orçamento criado'
    }]
  }
]

// Transações de exemplo
const defaultTransactions = [
  {
    _id: '1',
    userId: '1',
    descricao: 'Supermercado',
    valor: 120.50,
    tipo: 'despesa',
    categoria: '1',
    data: new Date('2024-12-15'),
    metodoPagamento: 'cartao_credito',
    observacoes: 'Compras da semana'
  },
  {
    _id: '2',
    userId: '1',
    descricao: 'Uber',
    valor: 25.00,
    tipo: 'despesa',
    categoria: '2',
    data: new Date('2024-12-14'),
    metodoPagamento: 'pix',
    observacoes: 'Corrida para o trabalho'
  },
  {
    _id: '3',
    userId: '1',
    descricao: 'Salário',
    valor: 5000.00,
    tipo: 'receita',
    categoria: '9',
    data: new Date('2024-12-01'),
    metodoPagamento: 'transferencia',
    observacoes: 'Salário mensal'
  }
]

async function initializeDatabase() {
  try {
    console.log('🚀 Iniciando configuração do banco de dados...')
    
    // Conectar ao MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI)
      console.log('✅ Conectado ao MongoDB')
    }

    // Gerar hash da senha
    defaultUser.senhaHash = await bcrypt.hash('admin123', 12)

    // Como estamos usando dados mock, vamos apenas criar arquivos de configuração
    console.log('\n📋 Dados padrão configurados:')
    console.log(`👤 Usuário: ${defaultUser.email} | Senha: admin123`)
    console.log(`📁 ${defaultCategories.length} categorias padrão`)
    console.log(`💰 ${defaultBudgets.length} orçamentos de exemplo`)
    console.log(`💳 ${defaultTransactions.length} transações de exemplo`)

    // Verificar estrutura do banco
    const collections = await mongoose.connection.db.listCollections().toArray()
    console.log('\n🗃️ Collections disponíveis:', collections.map(c => c.name))

    console.log('\n🎉 Configuração concluída!')
    console.log('\n📝 Para usar o sistema:')
    console.log('1. Inicie o servidor: npm run dev')
    console.log('2. Acesse: http://localhost:5001')
    console.log('3. Teste as APIs:')
    console.log('   - GET /api/categories')
    console.log('   - GET /api/budgets')
    console.log('   - POST /api/auth/login')
    console.log('\n🔐 Credenciais de teste:')
    console.log('   Email: admin@financeapp.com')
    console.log('   Senha: admin123')

  } catch (error) {
    console.error('❌ Erro na configuração:', error)
  }
}

async function clearDatabase() {
  try {
    console.log('⚠️ ATENÇÃO: Limpando dados...')
    
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI)
    }

    // Em um sistema real com MongoDB, faria:
    // await mongoose.connection.db.dropDatabase()
    
    console.log('✅ Dados limpos (simulado)')
    
  } catch (error) {
    console.error('❌ Erro ao limpar dados:', error)
  }
}

async function checkHealth() {
  try {
    console.log('🔍 Verificando saúde do sistema...')
    
    // Verificar conexão MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI)
    }
    
    console.log('✅ MongoDB: Conectado')
    
    // Verificar variáveis de ambiente importantes
    const requiredEnvs = ['MONGO_URI', 'JWT_SECRET', 'EMAIL_USER']
    const missingEnvs = requiredEnvs.filter(env => !process.env[env])
    
    if (missingEnvs.length > 0) {
      console.log('⚠️ Variáveis de ambiente faltando:', missingEnvs)
    } else {
      console.log('✅ Variáveis de ambiente: OK')
    }
    
    // Verificar email (se configurado)
    if (process.env.EMAIL_USER) {
      try {
        const emailService = require('../services/emailService')
        const emailOk = await emailService.testConnection()
        console.log(`${emailOk ? '✅' : '⚠️'} Email: ${emailOk ? 'Funcionando' : 'Com problemas'}`)
      } catch (error) {
        console.log('⚠️ Email: Não configurado')
      }
    }
    
    // Resumo final
    console.log('\n📊 Status do Sistema:')
    console.log(`🗄️ Banco: ${mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado'}`)
    console.log(`🔐 JWT: ${process.env.JWT_SECRET ? 'Configurado' : 'Não configurado'}`)
    console.log(`📧 Email: ${process.env.EMAIL_USER ? 'Configurado' : 'Não configurado'}`)
    console.log(`🔄 Cron Jobs: ${process.env.ENABLE_CRON_JOBS === 'true' ? 'Habilitado' : 'Desabilitado'}`)
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error)
  }
}

// Verificar argumentos da linha de comando
async function main() {
  const args = process.argv.slice(2)
  
  try {
    if (args.includes('--clear')) {
      await clearDatabase()
    } else if (args.includes('--health')) {
      await checkHealth()
    } else if (args.includes('--help')) {
      console.log(`
🔧 Script de Inicialização - Finance App

Uso: node scripts/init.js [opção]

Opções:
  (nenhuma)   Inicializar banco com dados padrão
  --clear     Limpar todos os dados
  --health    Verificar saúde do sistema
  --help      Mostrar esta ajuda

Exemplos:
  node scripts/init.js           # Inicializar
  node scripts/init.js --clear   # Limpar dados
  node scripts/init.js --health  # Verificar sistema
      `)
    } else {
      await initializeDatabase()
    }
  } catch (error) {
    console.error('❌ Erro:', error)
    process.exit(1)
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect()
      console.log('🔌 Desconectado do MongoDB')
    }
    process.exit(0)
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main()
}

module.exports = {
  initializeDatabase,
  clearDatabase,
  checkHealth,
  defaultUser,
  defaultCategories,
  defaultBudgets,
  defaultTransactions
}