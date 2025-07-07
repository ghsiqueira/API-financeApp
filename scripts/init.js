const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const User = require('../models/User')
const Category = require('../models/Category')
const Transaction = require('../models/Transaction')
const Budget = require('../models/Budget')
const Goal = require('../models/Goal')

require('dotenv').config()

async function initializeDatabase() {
  try {
    console.log('🚀 Iniciando configuração do banco de dados...')
    
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Conectado ao MongoDB')
    
    // Verificar se já existe usuário admin
    const adminExists = await User.findOne({ email: 'admin@financeapp.com' })
    
    if (!adminExists) {
      // Criar usuário administrador
      const adminUser = await User.create({
        nome: 'Administrador',
        email: 'admin@financeapp.com',
        senhaHash: await bcrypt.hash('admin123', 12),
        emailVerificado: true,
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
      })
      
      console.log('✅ Usuário administrador criado:', adminUser.email)
      
      // Criar categorias padrão para o admin
      await Category.criarCategoriasPadrao(adminUser._id)
      console.log('✅ Categorias padrão criadas para admin')
      
      // Criar transações de exemplo
      const categories = await Category.find({ userId: adminUser._id })
      const alimentacaoCategory = categories.find(cat => cat.nome === 'Alimentação')
      const salarioCategory = categories.find(cat => cat.nome === 'Salário')
      
      if (alimentacaoCategory && salarioCategory) {
        const transacoesExemplo = [
          {
            userId: adminUser._id,
            tipo: 'receita',
            descricao: 'Salário Janeiro',
            valor: 5000,
            data: new Date(),
            categoria: salarioCategory._id.toString(),
            metodoPagamento: 'transferencia',
            tags: ['salario', 'trabalho']
          },
          {
            userId: adminUser._id,
            tipo: 'despesa',
            descricao: 'Supermercado',
            valor: 350.50,
            data: new Date(),
            categoria: alimentacaoCategory._id.toString(),
            metodoPagamento: 'cartao_debito',
            tags: ['mercado', 'casa']
          },
          {
            userId: adminUser._id,
            tipo: 'despesa',
            descricao: 'Almoço restaurante',
            valor: 45.90,
            data: new Date(Date.now() - 24 * 60 * 60 * 1000),
            categoria: alimentacaoCategory._id.toString(),
            metodoPagamento: 'cartao_credito',
            tags: ['almoço', 'trabalho']
          }
        ]
        
        await Transaction.insertMany(transacoesExemplo)
        console.log('✅ Transações de exemplo criadas')
      }
      
      // Criar orçamento de exemplo
      if (alimentacaoCategory) {
        const orcamentoExemplo = {
          userId: adminUser._id,
          nome: 'Orçamento Alimentação Janeiro',
          categoria: alimentacaoCategory._id,
          valorLimite: 800,
          valorGasto: 0,
          periodo: {
            tipo: 'mensal',
            dataInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            dataFim: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
          },
          alertas: {
            valor: 80,
            email: true,
            push: true
          },
          renovacaoAutomatica: true,
          status: 'ativo'
        }
        
        await Budget.create(orcamentoExemplo)
        console.log('✅ Orçamento de exemplo criado')
      }
      
      // Criar meta de exemplo
      const metaExemplo = {
        userId: adminUser._id,
        titulo: 'Emergência - Reserva de 6 meses',
        descricao: 'Criar uma reserva de emergência equivalente a 6 meses de gastos',
        valorAlvo: 30000,
        valorAtual: 0,
        dataLimite: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        prioridade: 'alta',
        categoria: 'emergencia',
        lembretes: {
          ativo: true,
          frequencia: 'mensal'
        },
        status: 'ativa'
      }
      
      await Goal.create(metaExemplo)
      console.log('✅ Meta de exemplo criada')
    } else {
      console.log('⚠️ Usuário administrador já existe')
    }
    
    // Verificar integridade dos dados
    const stats = {
      usuarios: await User.countDocuments(),
      categorias: await Category.countDocuments(),
      transacoes: await Transaction.countDocuments(),
      orcamentos: await Budget.countDocuments(),
      metas: await Goal.countDocuments()
    }
    
    console.log('\n📊 Estatísticas do banco de dados:')
    console.log(`   👥 Usuários: ${stats.usuarios}`)
    console.log(`   📁 Categorias: ${stats.categorias}`)
    console.log(`   💰 Transações: ${stats.transacoes}`)
    console.log(`   📊 Orçamentos: ${stats.orcamentos}`)
    console.log(`   🎯 Metas: ${stats.metas}`)
    
    console.log('\n🎉 Configuração concluída!')
    console.log('\n📋 Credenciais do administrador:')
    console.log('   Email: admin@financeapp.com')
    console.log('   Senha: admin123')
    
  } catch (error) {
    console.error('❌ Erro na configuração:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Desconectado do MongoDB')
    process.exit(0)
  }
}

// Função para limpar banco de dados (cuidado!)
async function clearDatabase() {
  try {
    console.log('⚠️ ATENÇÃO: Limpando TODOS os dados do banco...')
    
    await mongoose.connect(process.env.MONGO_URI)
    
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Transaction.deleteMany({}),
      Budget.deleteMany({}),
      Goal.deleteMany({})
    ])
    
    console.log('✅ Banco de dados limpo')
    
  } catch (error) {
    console.error('❌ Erro ao limpar banco:', error)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

// Verificar argumentos da linha de comando
const args = process.argv.slice(2)

if (args.includes('--clear')) {
  clearDatabase()
} else {
  initializeDatabase()
}