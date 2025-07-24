// scripts/budgetRenewalCron.js
const cron = require('node-cron')
const mongoose = require('mongoose')
const budgetRenewalService = require('../services/budgetRenewalService')

require('dotenv').config()

class BudgetRenewalCron {
  constructor() {
    this.jobs = new Map()
    this.isInitialized = false
  }

  // Inicializar o sistema de cron jobs
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ Cron jobs já inicializados')
      return
    }

    try {
      // Conectar ao MongoDB se não estiver conectado
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGO_URI)
        console.log('✅ Conectado ao MongoDB para cron jobs')
      }

      // Configurar os jobs
      this.setupCronJobs()
      this.isInitialized = true

      console.log('🚀 Sistema de cron jobs para renovação de orçamentos inicializado')

    } catch (error) {
      console.error('❌ Erro ao inicializar cron jobs:', error)
      throw error
    }
  }

  // Configurar todos os cron jobs
  setupCronJobs() {
    // Job principal: verificar renovações a cada 4 horas
    this.jobs.set('main-renewal', cron.schedule('0 */4 * * *', async () => {
      console.log('🔄 Executando verificação automática de renovações...')
      try {
        const resultados = await budgetRenewalService.checkAndRenewBudgets()
        console.log(`✅ Verificação concluída: ${resultados.renovados} renovações, ${resultados.erros} erros`)
        
        // Log detalhado se houver renovações
        if (resultados.renovados > 0) {
          console.log('📋 Orçamentos renovados:')
          resultados.detalhes
            .filter(d => d.status === 'renovado')
            .forEach(d => console.log(`  - ${d.nome} (${d.usuario})`))
        }

      } catch (error) {
        console.error('❌ Erro na verificação automática:', error)
      }
    }, {
      scheduled: false, // Não iniciar automaticamente
      timezone: "America/Sao_Paulo"
    }))

    // Job de limpeza: executar limpeza de dados antigos toda segunda às 02:00
    this.jobs.set('cleanup', cron.schedule('0 2 * * 1', async () => {
      console.log('🧹 Executando limpeza de dados antigos...')
      try {
        await this.cleanupOldData()
        console.log('✅ Limpeza concluída')
      } catch (error) {
        console.error('❌ Erro na limpeza:', error)
      }
    }, {
      scheduled: false,
      timezone: "America/Sao_Paulo"
    }))

    // Job de relatório: gerar relatório semanal toda sexta às 18:00
    this.jobs.set('weekly-report', cron.schedule('0 18 * * 5', async () => {
      console.log('📊 Gerando relatório semanal de renovações...')
      try {
        await this.generateWeeklyReport()
        console.log('✅ Relatório semanal gerado')
      } catch (error) {
        console.error('❌ Erro ao gerar relatório:', error)
      }
    }, {
      scheduled: false,
      timezone: "America/Sao_Paulo"
    }))

    // Job de verificação de status: verificar saúde do sistema a cada hora
    this.jobs.set('health-check', cron.schedule('0 * * * *', async () => {
      try {
        await this.healthCheck()
      } catch (error) {
        console.error('❌ Erro no health check:', error)
      }
    }, {
      scheduled: false,
      timezone: "America/Sao_Paulo"
    }))

    console.log('⏰ Cron jobs configurados:')
    console.log('  - Renovação principal: a cada 4 horas')
    console.log('  - Limpeza: segundas às 02:00')
    console.log('  - Relatório semanal: sextas às 18:00')
    console.log('  - Health check: a cada hora')
  }

  // Iniciar todos os jobs
  startAll() {
    console.log('▶️ Iniciando todos os cron jobs...')
    this.jobs.forEach((job, name) => {
      job.start()
      console.log(`✅ Job "${name}" iniciado`)
    })
  }

  // Parar todos os jobs
  stopAll() {
    console.log('⏹️ Parando todos os cron jobs...')
    this.jobs.forEach((job, name) => {
      job.stop()
      console.log(`⏹️ Job "${name}" parado`)
    })
  }

  // Iniciar job específico
  start(jobName) {
    const job = this.jobs.get(jobName)
    if (job) {
      job.start()
      console.log(`▶️ Job "${jobName}" iniciado`)
    } else {
      console.log(`❌ Job "${jobName}" não encontrado`)
    }
  }

  // Parar job específico
  stop(jobName) {
    const job = this.jobs.get(jobName)
    if (job) {
      job.stop()
      console.log(`⏹️ Job "${jobName}" parado`)
    } else {
      console.log(`❌ Job "${jobName}" não encontrado`)
    }
  }

  // Executar verificação manual
  async runManualCheck() {
    console.log('🔧 Executando verificação manual...')
    try {
      const resultados = await budgetRenewalService.checkAndRenewBudgets()
      console.log('✅ Verificação manual concluída:', resultados)
      return resultados
    } catch (error) {
      console.error('❌ Erro na verificação manual:', error)
      throw error
    }
  }

  // Limpeza de dados antigos
  async cleanupOldData() {
    const Budget = require('../models/Budget')
    const Transaction = require('../models/Transaction')

    // Remover histórico muito antigo (mais de 2 anos) dos orçamentos
    const doisAnosAtras = new Date()
    doisAnosAtras.setFullYear(doisAnosAtras.getFullYear() - 2)

    const orcamentosComHistoricoAntigo = await Budget.find({
      'historico.data': { $lt: doisAnosAtras }
    })

    for (const orcamento of orcamentosComHistoricoAntigo) {
      orcamento.historico = orcamento.historico.filter(
        h => h.data >= doisAnosAtras
      )
      await orcamento.save()
    }

    console.log(`🧹 Limpou histórico antigo de ${orcamentosComHistoricoAntigo.length} orçamentos`)

    // Remover orçamentos finalizados há mais de 1 ano
    const umAnoAtras = new Date()
    umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1)

    const orcamentosAntigos = await Budget.deleteMany({
      status: 'finalizado',
      dataFim: { $lt: umAnoAtras },
      renovacaoAutomatica: false
    })

    console.log(`🧹 Removeu ${orcamentosAntigos.deletedCount} orçamentos finalizados antigos`)
  }

  // Gerar relatório semanal
  async generateWeeklyReport() {
    const Budget = require('../models/Budget')
    const User = require('../models/User')

    const umaSemanaAtras = new Date()
    umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7)

    // Buscar renovações da semana
    const renovacoesSemana = await Budget.find({
      ultimaRenovacao: { $gte: umaSemanaAtras }
    }).populate('userId', 'nome email')

    // Buscar orçamentos que vão vencer na próxima semana
    const proximaSemana = new Date()
    proximaSemana.setDate(proximaSemana.getDate() + 7)

    const vencendoProximaSemana = await Budget.find({
      dataFim: { 
        $gte: new Date(),
        $lte: proximaSemana 
      },
      status: 'ativo',
      renovacaoAutomatica: true
    }).populate('userId', 'nome email')

    const relatorio = {
      periodo: 'Relatório Semanal',
      data: new Date().toISOString(),
      renovacoesSemana: {
        total: renovacoesSemana.length,
        detalhes: renovacoesSemana.map(o => ({
          usuario: o.userId.nome,
          orcamento: o.nome,
          dataRenovacao: o.ultimaRenovacao,
          valorLimite: o.valorLimite
        }))
      },
      vencimentosProximos: {
        total: vencendoProximaSemana.length,
        detalhes: vencendoProximaSemana.map(o => ({
          usuario: o.userId.nome,
          orcamento: o.nome,
          dataVencimento: o.dataFim,
          valorLimite: o.valorLimite
        }))
      }
    }

    // Salvar relatório em arquivo (opcional)
    const fs = require('fs').promises
    const path = require('path')
    
    const relatoriosDir = path.join(__dirname, '../reports')
    await fs.mkdir(relatoriosDir, { recursive: true })
    
    const nomeArquivo = `budget-renewal-report-${new Date().toISOString().split('T')[0]}.json`
    const caminhoArquivo = path.join(relatoriosDir, nomeArquivo)
    
    await fs.writeFile(caminhoArquivo, JSON.stringify(relatorio, null, 2))
    
    console.log(`📊 Relatório salvo em: ${caminhoArquivo}`)
    console.log(`📈 Resumo: ${relatorio.renovacoesSemana.total} renovações, ${relatorio.vencimentosProximos.total} vencimentos próximos`)

    return relatorio
  }

  // Verificação de saúde do sistema
  async healthCheck() {
    try {
      const Budget = require('../models/Budget')
      
      // Verificar conexão com banco
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Banco de dados desconectado')
      }

      // Verificar orçamentos órfãos (sem usuário)
      const orcamentosOrfaos = await Budget.countDocuments({
        userId: { $exists: false }
      })

      if (orcamentosOrfaos > 0) {
        console.log(`⚠️ Encontrados ${orcamentosOrfaos} orçamentos órfãos`)
      }

      // Verificar orçamentos com datas inválidas
      const agora = new Date()
      const orcamentosDataInvalida = await Budget.countDocuments({
        dataInicio: { $gt: '$dataFim' }
      })

      if (orcamentosDataInvalida > 0) {
        console.log(`⚠️ Encontrados ${orcamentosDataInvalida} orçamentos com datas inválidas`)
      }

      // Log de status apenas se houver problemas
      if (orcamentosOrfaos === 0 && orcamentosDataInvalida === 0) {
        // Sistema saudável - log silencioso
        return true
      }

    } catch (error) {
      console.error('🚨 Health check falhou:', error.message)
      return false
    }
  }

  // Status dos jobs
  getStatus() {
    const status = {}
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.getStatus() === 'scheduled',
        nextRun: job.nextDates?.(1)?.[0]?.toISOString() || null
      }
    })
    return status
  }

  // Destruir todos os jobs (cleanup)
  destroy() {
    console.log('💥 Destruindo cron jobs...')
    this.jobs.forEach((job, name) => {
      job.destroy()
      console.log(`💥 Job "${name}" destruído`)
    })
    this.jobs.clear()
    this.isInitialized = false
  }
}

// Instância singleton
const cronManager = new BudgetRenewalCron()

// Função para inicializar e executar via CLI
async function main() {
  const args = process.argv.slice(2)
  
  try {
    await cronManager.initialize()

    if (args.includes('--start')) {
      cronManager.startAll()
      console.log('🟢 Todos os jobs estão rodando. Pressione Ctrl+C para parar.')
      
      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🛑 Recebido sinal de parada...')
        cronManager.stopAll()
        mongoose.disconnect()
        console.log('👋 Processo finalizado')
        process.exit(0)
      })

      // Manter o processo vivo
      process.stdin.resume()

    } else if (args.includes('--manual')) {
      console.log('🔧 Executando verificação manual...')
      const resultados = await cronManager.runManualCheck()
      console.log('✅ Verificação manual concluída')
      process.exit(0)

    } else if (args.includes('--status')) {
      const status = cronManager.getStatus()
      console.log('📊 Status dos jobs:')
      console.table(status)
      process.exit(0)

    } else if (args.includes('--cleanup')) {
      console.log('🧹 Executando limpeza manual...')
      await cronManager.cleanupOldData()
      console.log('✅ Limpeza concluída')
      process.exit(0)

    } else if (args.includes('--report')) {
      console.log('📊 Gerando relatório manual...')
      await cronManager.generateWeeklyReport()
      console.log('✅ Relatório gerado')
      process.exit(0)

    } else {
      console.log(`
🔧 Sistema de Cron Jobs para Renovação de Orçamentos

Uso: node scripts/budgetRenewalCron.js [opção]

Opções:
  --start     Iniciar todos os jobs e manter rodando
  --manual    Executar verificação de renovação manual
  --status    Mostrar status dos jobs
  --cleanup   Executar limpeza de dados antigos
  --report    Gerar relatório semanal
  --help      Mostrar esta ajuda

Exemplos:
  npm run cron:start     # Iniciar jobs automáticos
  npm run cron:manual    # Verificação manual
  npm run cron:status    # Ver status
      `)
      process.exit(0)
    }

  } catch (error) {
    console.error('❌ Erro:', error)
    process.exit(1)
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main()
}

module.exports = cronManager