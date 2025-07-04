const User = require('../models/User')
const Transaction = require('../models/Transaction')
const Budget = require('../models/Budget')
const Goal = require('../models/Goal')
const bcrypt = require('bcrypt')
const { validationResult } = require('express-validator')

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-senhaHash -codigoResetSenha -resetSenhaExpira')
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    // Calcular estatísticas básicas do usuário
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    
    const [transacoesCount, budgetsCount, goalsCount, saldoMensal] = await Promise.all([
      Transaction.countDocuments({ userId: req.userId }),
      Budget.countDocuments({ userId: req.userId }),
      Goal.countDocuments({ userId: req.userId }),
      Transaction.aggregate([
        {
          $match: {
            userId: user._id,
            data: { $gte: inicioMes }
          }
        },
        {
          $group: {
            _id: '$tipo',
            total: { $sum: '$valor' }
          }
        }
      ])
    ])

    const receitas = saldoMensal.find(s => s._id === 'receita')?.total || 0
    const despesas = saldoMensal.find(s => s._id === 'despesa')?.total || 0

    const estatisticas = {
      totalTransacoes: transacoesCount,
      totalOrcamentos: budgetsCount,
      totalMetas: goalsCount,
      saldoMensal: receitas - despesas,
      receitasMes: receitas,
      despesasMes: despesas
    }

    res.json({
      success: true,
      data: {
        user: user.toSafeObject(),
        estatisticas
      }
    })

  } catch (err) {
    console.error('Erro ao buscar perfil:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.updateMe = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados inválidos',
        detalhes: errors.array()
      })
    }

    const { nome, email, senha, configuracoes } = req.body
    const user = await User.findById(req.userId)

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    // Atualizar nome se fornecido
    if (nome && nome.trim() !== '') {
      user.nome = nome.trim()
    }

    // Atualizar email se fornecido e diferente
    if (email && email.toLowerCase() !== user.email) {
      // Verificar se o novo email já está em uso
      const emailExistente = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: req.userId }
      })
      
      if (emailExistente) {
        return res.status(400).json({ error: 'Este email já está em uso' })
      }
      
      user.email = email.toLowerCase()
      user.emailVerificado = false // Requer nova verificação
    }

    // Atualizar senha se fornecida
    if (senha && senha.length >= 6) {
      user.senhaHash = await bcrypt.hash(senha, 12)
    } else if (senha && senha.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' })
    }

    // Atualizar configurações se fornecidas
    if (configuracoes) {
      user.configuracoes = {
        ...user.configuracoes,
        ...configuracoes
      }
    }

    await user.save()

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: user.toSafeObject()
    })

  } catch (err) {
    console.error('Erro ao atualizar perfil:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.updateConfiguracoes = async (req, res) => {
  try {
    const { tema, moeda, notificacoes, privacidade } = req.body

    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    // Atualizar apenas as configurações fornecidas
    if (tema) user.configuracoes.tema = tema
    if (moeda) user.configuracoes.moeda = moeda
    if (notificacoes) {
      user.configuracoes.notificacoes = {
        ...user.configuracoes.notificacoes,
        ...notificacoes
      }
    }
    if (privacidade) {
      user.configuracoes.privacidade = {
        ...user.configuracoes.privacidade,
        ...privacidade
      }
    }

    await user.save()

    res.json({
      success: true,
      message: 'Configurações atualizadas com sucesso',
      data: user.configuracoes
    })

  } catch (err) {
    console.error('Erro ao atualizar configurações:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.changePassword = async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' })
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' })
    }

    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    // Verificar senha atual
    const senhaValida = await bcrypt.compare(senhaAtual, user.senhaHash)
    if (!senhaValida) {
      return res.status(400).json({ error: 'Senha atual incorreta' })
    }

    // Verificar se a nova senha é diferente da atual
    const mesmaSeha = await bcrypt.compare(novaSenha, user.senhaHash)
    if (mesmaSeha) {
      return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual' })
    }

    // Atualizar senha
    user.senhaHash = await bcrypt.hash(novaSenha, 12)
    await user.save()

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    })

  } catch (err) {
    console.error('Erro ao alterar senha:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.deleteAccount = async (req, res) => {
  try {
    const { senha, confirmacao } = req.body

    if (!senha) {
      return res.status(400).json({ error: 'Senha é obrigatória para excluir a conta' })
    }

    if (confirmacao !== 'EXCLUIR CONTA') {
      return res.status(400).json({ 
        error: 'Digite "EXCLUIR CONTA" para confirmar a exclusão' 
      })
    }

    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, user.senhaHash)
    if (!senhaValida) {
      return res.status(400).json({ error: 'Senha incorreta' })
    }

    // Deletar todos os dados do usuário
    await Promise.all([
      Transaction.deleteMany({ userId: req.userId }),
      Budget.deleteMany({ userId: req.userId }),
      Goal.deleteMany({ userId: req.userId }),
      User.deleteOne({ _id: req.userId })
    ])

    res.json({
      success: true,
      message: 'Conta excluída com sucesso'
    })

  } catch (err) {
    console.error('Erro ao excluir conta:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getEstatisticasGerais = async (req, res) => {
  try {
    const { periodo = 'ano' } = req.query
    
    // Definir período
    let dataInicio, dataFim
    const agora = new Date()

    switch (periodo) {
      case 'mes':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
        dataFim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
        break
      case 'trimestre':
        const trimestreAtual = Math.floor(agora.getMonth() / 3)
        dataInicio = new Date(agora.getFullYear(), trimestreAtual * 3, 1)
        dataFim = new Date(agora.getFullYear(), (trimestreAtual + 1) * 3, 0)
        break
      case 'ano':
        dataInicio = new Date(agora.getFullYear(), 0, 1)
        dataFim = new Date(agora.getFullYear(), 11, 31)
        break
      case 'tudo':
        // Buscar primeira transação para definir início
        const primeiraTransacao = await Transaction.findOne({ userId: req.userId }).sort({ data: 1 })
        dataInicio = primeiraTransacao ? primeiraTransacao.data : new Date()
        dataFim = agora
        break
    }

    // Buscar estatísticas em paralelo
    const [
      transacoes,
      orcamentosAtivos,
      metasAtivas,
      categoriasMaisUsadas,
      evolucaoMensal
    ] = await Promise.all([
      // Resumo de transações
      Transaction.aggregate([
        {
          $match: {
            userId: req.userId,
            data: { $gte: dataInicio, $lte: dataFim }
          }
        },
        {
          $group: {
            _id: '$tipo',
            total: { $sum: '$valor' },
            count: { $sum: 1 },
            media: { $avg: '$valor' }
          }
        }
      ]),

      // Orçamentos ativos
      Budget.find({
        userId: req.userId,
        dataInicio: { $lte: dataFim },
        dataFim: { $gte: dataInicio }
      }),

      // Metas ativas
      Goal.find({
        userId: req.userId,
        status: 'ativa'
      }),

      // Categorias mais usadas
      Transaction.aggregate([
        {
          $match: {
            userId: req.userId,
            data: { $gte: dataInicio, $lte: dataFim }
          }
        },
        {
          $group: {
            _id: '$categoria',
            total: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 5 }
      ]),

      // Evolução mensal
      Transaction.aggregate([
        {
          $match: {
            userId: req.userId,
            data: { $gte: dataInicio, $lte: dataFim }
          }
        },
        {
          $group: {
            _id: {
              ano: { $year: '$data' },
              mes: { $month: '$data' },
              tipo: '$tipo'
            },
            total: { $sum: '$valor' }
          }
        },
        { $sort: { '_id.ano': 1, '_id.mes': 1 } }
      ])
    ])

    // Processar dados das transações
    const receitas = transacoes.find(t => t._id === 'receita') || { total: 0, count: 0, media: 0 }
    const despesas = transacoes.find(t => t._id === 'despesa') || { total: 0, count: 0, media: 0 }
    const saldo = receitas.total - despesas.total

    // Processar orçamentos
    const orcamentosResumo = orcamentosAtivos.reduce((acc, orc) => {
      acc.total += orc.valorLimite
      acc.gasto += orc.valorGasto
      acc.count++
      if (orc.valorGasto > orc.valorLimite) acc.excedidos++
      return acc
    }, { total: 0, gasto: 0, count: 0, excedidos: 0 })

    // Processar metas
    const metasResumo = metasAtivas.reduce((acc, meta) => {
      acc.totalAlvo += meta.valorAlvo
      acc.totalAtual += meta.valorAtual
      acc.count++
      if (meta.valorAtual >= meta.valorAlvo) acc.concluidas++
      return acc
    }, { totalAlvo: 0, totalAtual: 0, count: 0, concluidas: 0 })

    // Calcular tendências
    const tendencias = calcularTendencias(evolucaoMensal)

    // Calcular score financeiro
    const scoreFinanceiro = calcularScoreFinanceiro({
      saldo,
      receitas: receitas.total,
      despesas: despesas.total,
      orcamentosExcedidos: orcamentosResumo.excedidos,
      totalOrcamentos: orcamentosResumo.count,
      metasConcluidas: metasResumo.concluidas,
      totalMetas: metasResumo.count
    })

    res.json({
      success: true,
      data: {
        periodo: {
          inicio: dataInicio,
          fim: dataFim,
          tipo: periodo
        },
        resumoFinanceiro: {
          receitas: receitas.total,
          despesas: despesas.total,
          saldo,
          totalTransacoes: receitas.count + despesas.count,
          mediaReceitas: receitas.media,
          mediaDespesas: despesas.media
        },
        orcamentos: {
          ativos: orcamentosResumo.count,
          totalLimite: orcamentosResumo.total,
          totalGasto: orcamentosResumo.gasto,
          excedidos: orcamentosResumo.excedidos,
          eficiencia: orcamentosResumo.total > 0 ? 
            Math.round(((orcamentosResumo.total - orcamentosResumo.gasto) / orcamentosResumo.total) * 100) : 0
        },
        metas: {
          ativas: metasResumo.count,
          totalAlvo: metasResumo.totalAlvo,
          totalAtual: metasResumo.totalAtual,
          concluidas: metasResumo.concluidas,
          progresso: metasResumo.totalAlvo > 0 ? 
            Math.round((metasResumo.totalAtual / metasResumo.totalAlvo) * 100) : 0
        },
        categoriasMaisUsadas,
        tendencias,
        scoreFinanceiro
      }
    })

  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.exportData = async (req, res) => {
  try {
    const { formato = 'json', incluir = 'todos' } = req.query

    const dadosExport = {}

    // Buscar dados baseado no que foi solicitado
    if (incluir === 'todos' || incluir.includes('transacoes')) {
      dadosExport.transacoes = await Transaction.find({ userId: req.userId }).sort({ data: -1 })
    }

    if (incluir === 'todos' || incluir.includes('orcamentos')) {
      dadosExport.orcamentos = await Budget.find({ userId: req.userId }).sort({ dataInicio: -1 })
    }

    if (incluir === 'todos' || incluir.includes('metas')) {
      dadosExport.metas = await Goal.find({ userId: req.userId }).sort({ dataLimite: 1 })
    }

    if (incluir === 'todos' || incluir.includes('perfil')) {
      const user = await User.findById(req.userId).select('-senhaHash -codigoResetSenha -resetSenhaExpira')
      dadosExport.perfil = user
    }

    // Adicionar metadados
    dadosExport.metadados = {
      dataExportacao: new Date(),
      versao: '1.0',
      usuario: req.userId,
      totalItens: {
        transacoes: dadosExport.transacoes?.length || 0,
        orcamentos: dadosExport.orcamentos?.length || 0,
        metas: dadosExport.metas?.length || 0
      }
    }

    if (formato === 'csv') {
      // Converter para CSV (apenas transações por simplicidade)
      if (dadosExport.transacoes) {
        const csv = converterParaCSV(dadosExport.transacoes)
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename="dados-financeiros.csv"')
        return res.send(csv)
      }
    }

    // Retornar JSON por padrão
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', 'attachment; filename="dados-financeiros.json"')
    res.json({
      success: true,
      data: dadosExport
    })

  } catch (err) {
    console.error('Erro ao exportar dados:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.importData = async (req, res) => {
  try {
    const { dados, sobrescrever = false } = req.body

    if (!dados || typeof dados !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos para importação' })
    }

    const resultado = {
      transacoes: { criadas: 0, erros: 0 },
      orcamentos: { criados: 0, erros: 0 },
      metas: { criadas: 0, erros: 0 }
    }

    // Importar transações
    if (dados.transacoes && Array.isArray(dados.transacoes)) {
      for (const transacao of dados.transacoes) {
        try {
          const transacaoData = {
            ...transacao,
            userId: req.userId,
            _id: undefined // Gerar novo ID
          }
          
          await Transaction.create(transacaoData)
          resultado.transacoes.criadas++
        } catch (err) {
          console.error('Erro ao importar transação:', err)
          resultado.transacoes.erros++
        }
      }
    }

    // Importar orçamentos
    if (dados.orcamentos && Array.isArray(dados.orcamentos)) {
      for (const orcamento of dados.orcamentos) {
        try {
          const orcamentoData = {
            ...orcamento,
            userId: req.userId,
            _id: undefined
          }
          
          await Budget.create(orcamentoData)
          resultado.orcamentos.criados++
        } catch (err) {
          console.error('Erro ao importar orçamento:', err)
          resultado.orcamentos.erros++
        }
      }
    }

    // Importar metas
    if (dados.metas && Array.isArray(dados.metas)) {
      for (const meta of dados.metas) {
        try {
          const metaData = {
            ...meta,
            userId: req.userId,
            _id: undefined
          }
          
          await Goal.create(metaData)
          resultado.metas.criadas++
        } catch (err) {
          console.error('Erro ao importar meta:', err)
          resultado.metas.erros++
        }
      }
    }

    res.json({
      success: true,
      message: 'Importação concluída',
      data: resultado
    })

  } catch (err) {
    console.error('Erro ao importar dados:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

// Funções auxiliares
function calcularTendencias(evolucaoMensal) {
  const receitasPorMes = {}
  const despesasPorMes = {}

  evolucaoMensal.forEach(item => {
    const chave = `${item._id.ano}-${String(item._id.mes).padStart(2, '0')}`
    
    if (item._id.tipo === 'receita') {
      receitasPorMes[chave] = item.total
    } else {
      despesasPorMes[chave] = item.total
    }
  })

  const meses = Object.keys({ ...receitasPorMes, ...despesasPorMes }).sort()
  
  if (meses.length < 2) {
    return {
      receitas: 'estavel',
      despesas: 'estavel',
      saldo: 'estavel'
    }
  }

  // Calcular tendência simples (últimos 2 meses)
  const ultimoMes = meses[meses.length - 1]
  const penultimoMes = meses[meses.length - 2]

  const receitasUltimo = receitasPorMes[ultimoMes] || 0
  const receitasPenultimo = receitasPorMes[penultimoMes] || 0
  const despesasUltimo = despesasPorMes[ultimoMes] || 0
  const despesasPenultimo = despesasPorMes[penultimoMes] || 0

  const tendenciaReceitas = receitasUltimo > receitasPenultimo ? 'crescente' : 
                           receitasUltimo < receitasPenultimo ? 'decrescente' : 'estavel'
  
  const tendenciaDespesas = despesasUltimo > despesasPenultimo ? 'crescente' : 
                           despesasUltimo < despesasPenultimo ? 'decrescente' : 'estavel'

  const saldoUltimo = receitasUltimo - despesasUltimo
  const saldoPenultimo = receitasPenultimo - despesasPenultimo
  const tendenciaSaldo = saldoUltimo > saldoPenultimo ? 'melhorando' : 
                        saldoUltimo < saldoPenultimo ? 'piorando' : 'estavel'

  return {
    receitas: tendenciaReceitas,
    despesas: tendenciaDespesas,
    saldo: tendenciaSaldo,
    variacao: {
      receitas: receitasPenultimo > 0 ? ((receitasUltimo - receitasPenultimo) / receitasPenultimo) * 100 : 0,
      despesas: despesasPenultimo > 0 ? ((despesasUltimo - despesasPenultimo) / despesasPenultimo) * 100 : 0,
      saldo: saldoPenultimo !== 0 ? ((saldoUltimo - saldoPenultimo) / Math.abs(saldoPenultimo)) * 100 : 0
    }
  }
}

function calcularScoreFinanceiro(dados) {
  let score = 0
  const fatores = []

  // Fator 1: Saldo positivo (0-25 pontos)
  if (dados.saldo > 0) {
    const pontos = Math.min(25, Math.round((dados.saldo / dados.receitas) * 25))
    score += pontos
    fatores.push({ nome: 'Saldo Positivo', pontos, maximo: 25 })
  } else {
    fatores.push({ nome: 'Saldo Positivo', pontos: 0, maximo: 25 })
  }

  // Fator 2: Controle de orçamentos (0-25 pontos)
  if (dados.totalOrcamentos > 0) {
    const eficiencia = 1 - (dados.orcamentosExcedidos / dados.totalOrcamentos)
    const pontos = Math.round(eficiencia * 25)
    score += pontos
    fatores.push({ nome: 'Controle de Orçamentos', pontos, maximo: 25 })
  } else {
    fatores.push({ nome: 'Controle de Orçamentos', pontos: 10, maximo: 25 })
    score += 10
  }

  // Fator 3: Progresso em metas (0-25 pontos)
  if (dados.totalMetas > 0) {
    const eficienciaMetas = dados.metasConcluidas / dados.totalMetas
    const pontos = Math.round(eficienciaMetas * 25)
    score += pontos
    fatores.push({ nome: 'Progresso em Metas', pontos, maximo: 25 })
  } else {
    fatores.push({ nome: 'Progresso em Metas', pontos: 5, maximo: 25 })
    score += 5
  }

  // Fator 4: Proporção receitas/despesas (0-25 pontos)
  if (dados.despesas > 0) {
    const proporcao = dados.receitas / dados.despesas
    let pontos = 0
    if (proporcao >= 1.3) pontos = 25 // 30% de sobra
    else if (proporcao >= 1.1) pontos = 20 // 10% de sobra
    else if (proporcao >= 1.0) pontos = 15 // Equilibrado
    else if (proporcao >= 0.9) pontos = 10 // 10% de déficit
    else pontos = 5 // Mais de 10% de déficit
    
    score += pontos
    fatores.push({ nome: 'Equilíbrio Financeiro', pontos, maximo: 25 })
  } else {
    fatores.push({ nome: 'Equilíbrio Financeiro', pontos: 25, maximo: 25 })
    score += 25
  }

  let classificacao = 'Ruim'
  let cor = '#FF3B30'
  
  if (score >= 80) {
    classificacao = 'Excelente'
    cor = '#34C759'
  } else if (score >= 60) {
    classificacao = 'Bom'
    cor = '#30D158'
  } else if (score >= 40) {
    classificacao = 'Regular'
    cor = '#FF9500'
  } else if (score >= 20) {
    classificacao = 'Ruim'
    cor = '#FF6B35'
  }

  return {
    score,
    classificacao,
    cor,
    fatores,
    dicas: gerarDicasFinanceiras(dados, score)
  }
}

function gerarDicasFinanceiras(dados, score) {
  const dicas = []

  if (dados.saldo <= 0) {
    dicas.push({
      tipo: 'alerta',
      titulo: 'Saldo Negativo',
      mensagem: 'Revise seus gastos e tente aumentar suas receitas'
    })
  }

  if (dados.orcamentosExcedidos > 0) {
    dicas.push({
      tipo: 'atencao',
      titulo: 'Orçamentos Excedidos',
      mensagem: 'Você excedeu alguns orçamentos. Revise seus limites ou controle seus gastos'
    })
  }

  if (dados.totalMetas === 0) {
    dicas.push({
      tipo: 'sugestao',
      titulo: 'Defina Metas',
      mensagem: 'Criar metas financeiras ajuda a manter o foco nos seus objetivos'
    })
  }

  if (dados.receitas > 0 && dados.despesas > 0) {
    const proporcao = dados.receitas / dados.despesas
    if (proporcao < 1.1) {
      dicas.push({
        tipo: 'atencao',
        titulo: 'Margem Apertada',
        mensagem: 'Tente manter pelo menos 10% das receitas como reserva'
      })
    }
  }

  if (score < 50) {
    dicas.push({
      tipo: 'motivacao',
      titulo: 'Continue Melhorando',
      mensagem: 'Pequenos ajustes nos seus hábitos podem fazer uma grande diferença!'
    })
  }

  return dicas
}

function converterParaCSV(transacoes) {
  const cabecalho = ['Data', 'Tipo', 'Descrição', 'Valor', 'Categoria', 'Método Pagamento']
  const linhas = [cabecalho.join(',')]

  transacoes.forEach(t => {
    const linha = [
      t.data.toISOString().split('T')[0],
      t.tipo,
      `"${t.descricao.replace(/"/g, '""')}"`,
      t.valor,
      t.categoria,
      t.metodoPagamento
    ]
    linhas.push(linha.join(','))
  })

  return linhas.join('\n')
}