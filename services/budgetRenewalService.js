// services/budgetRenewalService.js
const Budget = require('../models/Budget')
const { sendEmail } = require('../config/mailer')

class BudgetRenewalService {
  constructor() {
    this.isRunning = false
  }

  // Verificar e renovar orçamentos vencidos
  async checkAndRenewBudgets() {
    if (this.isRunning) {
      console.log('⚠️ Serviço de renovação já está rodando')
      return
    }

    this.isRunning = true
    console.log('🔄 Iniciando verificação de renovação de orçamentos...')

    try {
      const agora = new Date()
      
      // Buscar orçamentos vencidos que têm renovação automática ativa
      const orcamentosVencidos = await Budget.find({
        dataFim: { $lt: agora },
        renovacaoAutomatica: true,
        status: { $in: ['ativo', 'excedido'] },
        // Evitar renovar orçamentos já renovados recentemente
        $or: [
          { ultimaRenovacao: { $exists: false } },
          { ultimaRenovacao: { $lt: new Date(agora.getTime() - 24 * 60 * 60 * 1000) } }
        ]
      }).populate('userId', 'nome email')

      console.log(`📊 Encontrados ${orcamentosVencidos.length} orçamentos para renovar`)

      const resultados = {
        renovados: 0,
        erros: 0,
        detalhes: []
      }

      for (const orcamento of orcamentosVencidos) {
        try {
          // Verificar se é um período válido para renovação
          if (!this.isPeriodoRenovavel(orcamento.periodo)) {
            console.log(`⚠️ Período ${orcamento.periodo} não é renovável para orçamento ${orcamento.nome}`)
            continue
          }

          // Calcular estatísticas do período anterior
          const estatisticasAnteriores = this.calcularEstatisticasPeriodo(orcamento)

          // Renovar o orçamento
          const sucesso = orcamento.renovar()
          
          if (sucesso) {
            // Marcar data da última renovação
            orcamento.ultimaRenovacao = agora
            
            // Adicionar estatísticas do período anterior ao histórico
            orcamento.adicionarHistorico('renovado', orcamento.valorLimite, 
              `Renovação automática - Período anterior: ${estatisticasAnteriores.resumo}`)

            await orcamento.save()

            resultados.renovados++
            resultados.detalhes.push({
              id: orcamento._id,
              nome: orcamento.nome,
              usuario: orcamento.userId.nome,
              status: 'renovado',
              novaDataInicio: orcamento.dataInicio,
              novaDataFim: orcamento.dataFim,
              estatisticasAnteriores
            })

            // Enviar notificação por email se o usuário tiver habilitado
            await this.enviarNotificacaoRenovacao(orcamento, estatisticasAnteriores)

            console.log(`✅ Orçamento renovado: ${orcamento.nome} (${orcamento.userId.nome})`)
          } else {
            console.log(`❌ Falha ao renovar orçamento: ${orcamento.nome}`)
            resultados.erros++
            resultados.detalhes.push({
              id: orcamento._id,
              nome: orcamento.nome,
              usuario: orcamento.userId.nome,
              status: 'erro',
              motivo: 'Falha na renovação'
            })
          }

        } catch (error) {
          console.error(`❌ Erro ao renovar orçamento ${orcamento.nome}:`, error)
          resultados.erros++
          resultados.detalhes.push({
            id: orcamento._id,
            nome: orcamento.nome,
            usuario: orcamento.userId?.nome || 'Usuário não encontrado',
            status: 'erro',
            motivo: error.message
          })
        }
      }

      console.log(`🎉 Renovação concluída: ${resultados.renovados} sucessos, ${resultados.erros} erros`)
      
      return resultados

    } catch (error) {
      console.error('❌ Erro geral no serviço de renovação:', error)
      throw error
    } finally {
      this.isRunning = false
    }
  }

  // Verificar se o período permite renovação automática
  isPeriodoRenovavel(periodo) {
    const periodosValidos = ['semanal', 'mensal', 'trimestral', 'semestral', 'anual']
    return periodosValidos.includes(periodo)
  }

  // Calcular estatísticas do período que está terminando
  calcularEstatisticasPeriodo(orcamento) {
    const porcentagemGasta = orcamento.valorLimite > 0 ? 
      Math.round((orcamento.valorGasto / orcamento.valorLimite) * 100) : 0
    
    const valorRestante = Math.max(0, orcamento.valorLimite - orcamento.valorGasto)
    const valorExcedido = orcamento.valorGasto > orcamento.valorLimite ? 
      orcamento.valorGasto - orcamento.valorLimite : 0

    let status = 'ok'
    if (orcamento.valorGasto > orcamento.valorLimite) {
      status = 'excedido'
    } else if (porcentagemGasta >= 90) {
      status = 'critico'
    } else if (porcentagemGasta >= 80) {
      status = 'atencao'
    }

    const resumo = valorExcedido > 0 ? 
      `Excedeu em R$ ${valorExcedido.toFixed(2)} (${porcentagemGasta}%)` :
      `Gastou ${porcentagemGasta}% do limite (R$ ${orcamento.valorGasto.toFixed(2)} de R$ ${orcamento.valorLimite.toFixed(2)})`

    return {
      valorGasto: orcamento.valorGasto,
      valorLimite: orcamento.valorLimite,
      valorRestante,
      valorExcedido,
      porcentagemGasta,
      status,
      resumo
    }
  }

  // Enviar notificação de renovação por email
  async enviarNotificacaoRenovacao(orcamento, estatisticas) {
    try {
      const usuario = orcamento.userId

      if (!usuario.email || !usuario.configuracoes?.notificacoes?.email) {
        return // Usuário não quer receber emails
      }

      const emailTemplate = this.gerarTemplateEmailRenovacao(orcamento, estatisticas)

      await sendEmail({
        to: usuario.email,
        subject: `💰 Orçamento "${orcamento.nome}" foi renovado automaticamente`,
        html: emailTemplate
      })

      console.log(`📧 Email de renovação enviado para ${usuario.email}`)

    } catch (error) {
      console.error('❌ Erro ao enviar email de renovação:', error)
      // Não interromper o processo se o email falhar
    }
  }

  // Gerar template HTML para email de renovação
  gerarTemplateEmailRenovacao(orcamento, estatisticas) {
    const formatarData = (data) => {
      return new Date(data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    }

    const formatarMoeda = (valor) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valor)
    }

    const corStatus = {
      'ok': '#4CAF50',
      'atencao': '#FF9800',
      'critico': '#FF5722',
      'excedido': '#F44336'
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Orçamento Renovado</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .budget-card { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid ${orcamento.cor}; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
          .stat-card { background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e0e0e0; }
          .stat-value { font-size: 24px; font-weight: bold; color: ${corStatus[estatisticas.status]}; }
          .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
          .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; color: white; background: ${corStatus[estatisticas.status]}; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Orçamento Renovado!</h1>
            <p>Seu orçamento foi renovado automaticamente para o próximo período</p>
          </div>
          
          <div class="content">
            <div class="budget-card">
              <h2 style="margin-top: 0; color: ${orcamento.cor};">💰 ${orcamento.nome}</h2>
              <p><strong>Novo período:</strong> ${formatarData(orcamento.dataInicio)} até ${formatarData(orcamento.dataFim)}</p>
              <p><strong>Limite:</strong> ${formatarMoeda(orcamento.valorLimite)}</p>
              <p><strong>Período:</strong> ${orcamento.periodo}</p>
            </div>

            <h3>📊 Resultado do Período Anterior</h3>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">${formatarMoeda(estatisticas.valorGasto)}</div>
                <div class="stat-label">Total Gasto</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${estatisticas.porcentagemGasta}%</div>
                <div class="stat-label">Do Limite</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${formatarMoeda(estatisticas.valorRestante)}</div>
                <div class="stat-label">Economia</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">
                  <span class="status-badge">${estatisticas.status.toUpperCase()}</span>
                </div>
                <div class="stat-label">Status</div>
              </div>
            </div>

            <p><strong>Resumo:</strong> ${estatisticas.resumo}</p>

            ${estatisticas.status === 'excedido' ? `
              <div style="background: #ffebee; border: 1px solid #ffcdd2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #d32f2f; margin-top: 0;">⚠️ Atenção!</h4>
                <p>Você excedeu o orçamento no período anterior. Considere revisar seus gastos para o novo período.</p>
              </div>
            ` : ''}

            ${estatisticas.status === 'ok' ? `
              <div style="background: #e8f5e8; border: 1px solid #c8e6c9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #388e3c; margin-top: 0;">🎉 Parabéns!</h4>
                <p>Você manteve os gastos dentro do orçamento. Continue assim!</p>
              </div>
            ` : ''}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL || 'https://seuapp.com'}/budgets" class="button">
                Ver Detalhes no App
              </a>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
            
            <h4>💡 Dicas para o Novo Período:</h4>
            <ul>
              <li>Acompanhe seus gastos regularmente no app</li>
              <li>Configure alertas em 50%, 80% e 90% do limite</li>
              <li>Revise e ajuste o orçamento se necessário</li>
              ${estatisticas.status === 'excedido' ? '<li><strong>Importante:</strong> Analise onde você gastou mais que o esperado</li>' : ''}
            </ul>
          </div>

          <div class="footer">
            <p>Esta é uma mensagem automática do seu App de Finanças Pessoais</p>
            <p>Para desativar estas notificações, acesse as configurações do app</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  // Agendar renovações futuras (para uso com cron jobs)
  async agendarVerificacoes() {
    console.log('📅 Agendando verificações de renovação...')
    
    // Executar verificação a cada 4 horas
    setInterval(async () => {
      try {
        await this.checkAndRenewBudgets()
      } catch (error) {
        console.error('❌ Erro na verificação agendada:', error)
      }
    }, 4 * 60 * 60 * 1000) // 4 horas

    console.log('✅ Verificações agendadas para rodar a cada 4 horas')
  }

  // Método para verificar orçamentos específicos de um usuário
  async renovarOrcamentosUsuario(userId) {
    const agora = new Date()
    
    const orcamentosUsuario = await Budget.find({
      userId,
      dataFim: { $lt: agora },
      renovacaoAutomatica: true,
      status: { $in: ['ativo', 'excedido'] }
    })

    const resultados = []

    for (const orcamento of orcamentosUsuario) {
      try {
        const estatisticas = this.calcularEstatisticasPeriodo(orcamento)
        const sucesso = orcamento.renovar()
        
        if (sucesso) {
          orcamento.ultimaRenovacao = agora
          await orcamento.save()
          
          resultados.push({
            id: orcamento._id,
            nome: orcamento.nome,
            status: 'renovado',
            estatisticas
          })
        }
      } catch (error) {
        resultados.push({
          id: orcamento._id,
          nome: orcamento.nome,
          status: 'erro',
          erro: error.message
        })
      }
    }

    return resultados
  }

  // Método para desativar renovação automática
  async desativarRenovacaoAutomatica(budgetId, userId) {
    const orcamento = await Budget.findOneAndUpdate(
      { _id: budgetId, userId },
      { 
        renovacaoAutomatica: false,
        $push: {
          historico: {
            data: new Date(),
            acao: 'renovacao_desativada',
            observacao: 'Renovação automática desativada pelo usuário'
          }
        }
      },
      { new: true }
    )

    return orcamento
  }

  // Relatório de renovações
  async relatorioRenovacoes(userId, periodo = 30) {
    const dataInicio = new Date()
    dataInicio.setDate(dataInicio.getDate() - periodo)

    const orcamentos = await Budget.find({
      userId,
      ultimaRenovacao: { $gte: dataInicio }
    }).sort({ ultimaRenovacao: -1 })

    const relatorio = {
      periodo: `Últimos ${periodo} dias`,
      totalRenovacoes: orcamentos.length,
      orcamentosRenovados: orcamentos.map(o => ({
        nome: o.nome,
        dataRenovacao: o.ultimaRenovacao,
        valorLimite: o.valorLimite,
        periodo: o.periodo
      }))
    }

    return relatorio
  }
}

module.exports = new BudgetRenewalService()