const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')

// Remover temporariamente a importação do dashboardController para debug
// const dashboardController = require('../controllers/dashboardController')

// Middleware de autenticação para todas as rotas
router.use(auth)

/**
 * @swagger
 * /api/reports/complete:
 *   get:
 *     summary: Gerar relatório completo detalhado
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/complete', (req, res) => {
  // Implementação temporária até corrigir o controller
  res.json({
    success: true,
    message: 'Relatório completo - Em desenvolvimento',
    data: {
      periodo: {
        inicio: req.query.dataInicio || new Date().toISOString(),
        fim: req.query.dataFim || new Date().toISOString(),
        diasNoPeriodo: 30
      },
      resumo: {
        totalReceitas: 0,
        totalDespesas: 0,
        saldoFinal: 0,
        mediaDiariaReceitas: 0,
        mediaDiariaDespesas: 0,
        frequenciaTransacoes: {}
      },
      extremos: {
        maiorReceita: null,
        maiorDespesa: null,
        menorReceita: null,
        menorDespesa: null
      },
      categorias: [],
      tendencias: [],
      orcamentos: [],
      metas: [],
      transacoes: []
    }
  })
})

/**
 * @swagger
 * /api/reports/financial-summary:
 *   get:
 *     summary: Relatório resumido financeiro
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/financial-summary', (req, res) => {
  const { periodo = 'mes_atual', comparar = true } = req.query
  
  res.json({
    success: true,
    data: {
      periodo_atual: {
        receitas: 0,
        despesas: 0,
        saldo: 0,
        transacoes: 0
      },
      periodo_anterior: comparar ? {
        receitas: 0,
        despesas: 0,
        saldo: 0,
        transacoes: 0
      } : null,
      comparacao: comparar ? {
        receitas_variacao: 0,
        despesas_variacao: 0,
        saldo_variacao: 0
      } : null,
      insights: [
        {
          tipo: 'info',
          titulo: 'Relatório em desenvolvimento',
          mensagem: 'Este endpoint será implementado com dados reais em breve'
        }
      ]
    }
  })
})

/**
 * @swagger
 * /api/reports/categories:
 *   get:
 *     summary: Relatório por categorias
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/categories', (req, res) => {
  const { periodo = 'mes', tipo = 'ambos', limite = 10 } = req.query
  
  res.json({
    success: true,
    data: {
      periodo,
      tipo,
      categorias: [],
      total_categorias: 0,
      resumo: {
        categoria_maior_gasto: null,
        categoria_maior_receita: null,
        categoria_mais_transacoes: null
      }
    }
  })
})

/**
 * @swagger
 * /api/reports/trends:
 *   get:
 *     summary: Relatório de tendências
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/trends', (req, res) => {
  const { meses = 6 } = req.query
  
  res.json({
    success: true,
    data: {
      periodo_analise: {
        meses: parseInt(meses),
        data_inicio: new Date(Date.now() - (meses * 30 * 24 * 60 * 60 * 1000)),
        data_fim: new Date()
      },
      tendencias: {
        receitas: 'estavel',
        despesas: 'estavel',
        saldo: 'estavel',
        variacoes: {
          receitas_percentual: 0,
          despesas_percentual: 0,
          saldo_percentual: 0
        }
      },
      projecoes: {
        proximo_mes: {
          receitas_estimadas: 0,
          despesas_estimadas: 0,
          saldo_estimado: 0
        }
      },
      recomendacoes: []
    }
  })
})

/**
 * @swagger
 * /api/reports/export:
 *   post:
 *     summary: Exportar relatório em diferentes formatos
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/export', (req, res) => {
  const { tipo_relatorio, formato, parametros, configuracoes } = req.body
  
  if (!tipo_relatorio || !formato) {
    return res.status(400).json({
      success: false,
      error: 'Tipo de relatório e formato são obrigatórios'
    })
  }
  
  res.json({
    success: true,
    message: 'Exportação de relatórios será implementada em breve',
    data: {
      tipo_relatorio,
      formato,
      status: 'em_desenvolvimento',
      estimativa_implementacao: '2024-02-01'
    }
  })
})

/**
 * @swagger
 * /api/reports/schedule:
 *   post:
 *     summary: Agendar relatório automático
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/schedule', (req, res) => {
  const { nome, tipo_relatorio, frequencia, email_destino, formato = 'pdf', ativo = true } = req.body
  
  if (!nome || !tipo_relatorio || !frequencia || !email_destino) {
    return res.status(400).json({
      success: false,
      error: 'Nome, tipo de relatório, frequência e email são obrigatórios'
    })
  }
  
  res.status(201).json({
    success: true,
    message: 'Agendamento de relatórios será implementado em breve',
    data: {
      id: 'temp_' + Date.now(),
      nome,
      tipo_relatorio,
      frequencia,
      email_destino,
      formato,
      ativo,
      criado_em: new Date().toISOString(),
      proximo_envio: null
    }
  })
})

/**
 * @swagger
 * /api/reports/templates:
 *   get:
 *     summary: Listar templates de relatórios disponíveis
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/templates', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'financeiro_basico',
        nome: 'Relatório Financeiro Básico',
        descricao: 'Resumo de receitas, despesas e saldo',
        campos: ['receitas', 'despesas', 'saldo', 'transacoes_count']
      },
      {
        id: 'analise_categorias',
        nome: 'Análise por Categorias',
        descricao: 'Distribuição de gastos por categoria',
        campos: ['categorias', 'percentuais', 'comparacao_periodo']
      },
      {
        id: 'performance_orcamentos',
        nome: 'Performance de Orçamentos',
        descricao: 'Análise do cumprimento de orçamentos',
        campos: ['orcamentos', 'utilizacao', 'alertas']
      },
      {
        id: 'progresso_metas',
        nome: 'Progresso de Metas',
        descricao: 'Acompanhamento das metas financeiras',
        campos: ['metas', 'progresso', 'projecoes']
      }
    ]
  })
})

/**
 * @swagger
 * /api/reports/budget-performance:
 *   get:
 *     summary: Relatório de performance de orçamentos
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/budget-performance', (req, res) => {
  const { periodo = 'mes_atual', status = 'todos' } = req.query
  
  res.json({
    success: true,
    data: {
      periodo,
      status_filtro: status,
      resumo: {
        total_orcamentos: 0,
        dentro_limite: 0,
        excedidos: 0,
        proximo_limite: 0,
        economia_total: 0,
        excesso_total: 0
      },
      orcamentos_detalhados: [],
      alertas: [],
      recomendacoes: []
    }
  })
})

/**
 * @swagger
 * /api/reports/goals-progress:
 *   get:
 *     summary: Relatório de progresso de metas
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/goals-progress', (req, res) => {
  const { status = 'todas', ordenar_por = 'progresso' } = req.query
  
  res.json({
    success: true,
    data: {
      status_filtro: status,
      ordenacao: ordenar_por,
      resumo: {
        total_metas: 0,
        ativas: 0,
        concluidas: 0,
        vencidas: 0,
        progresso_medio: 0,
        valor_total_objetivos: 0,
        valor_total_poupado: 0
      },
      metas_detalhadas: [],
      insights: [],
      projecoes: {
        metas_possiveis_cumprir_mes: 0,
        valor_necessario_mes_metas_ativas: 0
      }
    }
  })
})

/**
 * @swagger
 * /api/reports/cash-flow:
 *   get:
 *     summary: Relatório de fluxo de caixa
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/cash-flow', (req, res) => {
  const { periodo = 'mes', granularidade = 'diario' } = req.query
  
  res.json({
    success: true,
    data: {
      periodo,
      granularidade,
      fluxo_caixa: [],
      resumo: {
        saldo_inicial: 0,
        total_entradas: 0,
        total_saidas: 0,
        saldo_final: 0,
        maior_entrada_dia: 0,
        maior_saida_dia: 0,
        dias_saldo_positivo: 0,
        dias_saldo_negativo: 0
      },
      tendencias: {
        crescimento_receitas: 0,
        crescimento_despesas: 0,
        volatilidade: 'baixa'
      }
    }
  })
})

module.exports = router

/**
 * @swagger
 * /api/reports/financial-summary:
 *   get:
 *     summary: Relatório resumido financeiro
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [mes_atual, mes_anterior, trimestre, ano, personalizado]
 *           default: mes_atual
 *       - in: query
 *         name: comparar
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Incluir comparação com período anterior
 *     responses:
 *       200:
 *         description: Resumo financeiro obtido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     periodo_atual:
 *                       type: object
 *                     periodo_anterior:
 *                       type: object
 *                     comparacao:
 *                       type: object
 *                     insights:
 *                       type: array
 */
router.get('/financial-summary', (req, res) => {
  const { periodo = 'mes_atual', comparar = true } = req.query
  
  // Implementação básica
  res.json({
    success: true,
    data: {
      periodo_atual: {
        receitas: 0,
        despesas: 0,
        saldo: 0,
        transacoes: 0
      },
      periodo_anterior: comparar ? {
        receitas: 0,
        despesas: 0,
        saldo: 0,
        transacoes: 0
      } : null,
      comparacao: comparar ? {
        receitas_variacao: 0,
        despesas_variacao: 0,
        saldo_variacao: 0
      } : null,
      insights: [
        {
          tipo: 'info',
          titulo: 'Relatório em desenvolvimento',
          mensagem: 'Este endpoint será implementado com dados reais em breve'
        }
      ]
    }
  })
})

/**
 * @swagger
 * /api/reports/categories:
 *   get:
 *     summary: Relatório por categorias
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [mes, trimestre, ano]
 *           default: mes
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [receita, despesa, ambos]
 *           default: ambos
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Número máximo de categorias no relatório
 *     responses:
 *       200:
 *         description: Relatório de categorias obtido com sucesso
 */
router.get('/categories', (req, res) => {
  const { periodo = 'mes', tipo = 'ambos', limite = 10 } = req.query
  
  res.json({
    success: true,
    data: {
      periodo,
      tipo,
      categorias: [],
      total_categorias: 0,
      resumo: {
        categoria_maior_gasto: null,
        categoria_maior_receita: null,
        categoria_mais_transacoes: null
      }
    }
  })
})

/**
 * @swagger
 * /api/reports/trends:
 *   get:
 *     summary: Relatório de tendências
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: meses
 *         schema:
 *           type: integer
 *           default: 6
 *           minimum: 3
 *           maximum: 24
 *         description: Número de meses para análise de tendência
 *     responses:
 *       200:
 *         description: Relatório de tendências obtido com sucesso
 */
router.get('/trends', (req, res) => {
  const { meses = 6 } = req.query
  
  res.json({
    success: true,
    data: {
      periodo_analise: {
        meses: parseInt(meses),
        data_inicio: new Date(Date.now() - (meses * 30 * 24 * 60 * 60 * 1000)),
        data_fim: new Date()
      },
      tendencias: {
        receitas: 'estavel',
        despesas: 'estavel',
        saldo: 'estavel',
        variacoes: {
          receitas_percentual: 0,
          despesas_percentual: 0,
          saldo_percentual: 0
        }
      },
      projecoes: {
        proximo_mes: {
          receitas_estimadas: 0,
          despesas_estimadas: 0,
          saldo_estimado: 0
        }
      },
      recomendacoes: []
    }
  })
})

/**
 * @swagger
 * /api/reports/export:
 *   post:
 *     summary: Exportar relatório em diferentes formatos
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipo_relatorio
 *               - formato
 *             properties:
 *               tipo_relatorio:
 *                 type: string
 *                 enum: [completo, financeiro, categorias, tendencias]
 *               formato:
 *                 type: string
 *                 enum: [pdf, excel, csv]
 *               parametros:
 *                 type: object
 *                 properties:
 *                   dataInicio:
 *                     type: string
 *                     format: date
 *                   dataFim:
 *                     type: string
 *                     format: date
 *                   incluirGraficos:
 *                     type: boolean
 *                     default: true
 *               configuracoes:
 *                 type: object
 *                 properties:
 *                   incluir_logo:
 *                     type: boolean
 *                     default: true
 *                   incluir_assinatura:
 *                     type: boolean
 *                     default: false
 *           example:
 *             tipo_relatorio: completo
 *             formato: pdf
 *             parametros:
 *               dataInicio: "2024-01-01"
 *               dataFim: "2024-01-31"
 *               incluirGraficos: true
 *             configuracoes:
 *               incluir_logo: true
 *               incluir_assinatura: false
 *     responses:
 *       200:
 *         description: Relatório exportado com sucesso
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Parâmetros de exportação inválidos
 *       501:
 *         description: Formato de exportação não implementado
 */
router.post('/export', (req, res) => {
  const { tipo_relatorio, formato, parametros, configuracoes } = req.body
  
  if (!tipo_relatorio || !formato) {
    return res.status(400).json({
      success: false,
      error: 'Tipo de relatório e formato são obrigatórios'
    })
  }
  
  // Por enquanto, retorna apenas confirmação
  res.json({
    success: true,
    message: 'Exportação de relatórios será implementada em breve',
    data: {
      tipo_relatorio,
      formato,
      status: 'em_desenvolvimento',
      estimativa_implementacao: '2024-02-01'
    }
  })
})

/**
 * @swagger
 * /api/reports/schedule:
 *   post:
 *     summary: Agendar relatório automático
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - tipo_relatorio
 *               - frequencia
 *               - email_destino
 *             properties:
 *               nome:
 *                 type: string
 *                 maxLength: 100
 *               tipo_relatorio:
 *                 type: string
 *                 enum: [completo, financeiro, categorias]
 *               frequencia:
 *                 type: string
 *                 enum: [semanal, mensal, trimestral]
 *               email_destino:
 *                 type: string
 *                 format: email
 *               formato:
 *                 type: string
 *                 enum: [pdf, excel]
 *                 default: pdf
 *               ativo:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Relatório agendado com sucesso
 *       400:
 *         description: Dados inválidos para agendamento
 */
router.post('/schedule', (req, res) => {
  const { nome, tipo_relatorio, frequencia, email_destino, formato = 'pdf', ativo = true } = req.body
  
  if (!nome || !tipo_relatorio || !frequencia || !email_destino) {
    return res.status(400).json({
      success: false,
      error: 'Nome, tipo de relatório, frequência e email são obrigatórios'
    })
  }
  
  res.status(201).json({
    success: true,
    message: 'Agendamento de relatórios será implementado em breve',
    data: {
      id: 'temp_' + Date.now(),
      nome,
      tipo_relatorio,
      frequencia,
      email_destino,
      formato,
      ativo,
      criado_em: new Date().toISOString(),
      proximo_envio: null
    }
  })
})

/**
 * @swagger
 * /api/reports/templates:
 *   get:
 *     summary: Listar templates de relatórios disponíveis
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Templates disponíveis
 */
router.get('/templates', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'financeiro_basico',
        nome: 'Relatório Financeiro Básico',
        descricao: 'Resumo de receitas, despesas e saldo',
        campos: ['receitas', 'despesas', 'saldo', 'transacoes_count']
      },
      {
        id: 'analise_categorias',
        nome: 'Análise por Categorias',
        descricao: 'Distribuição de gastos por categoria',
        campos: ['categorias', 'percentuais', 'comparacao_periodo']
      },
      {
        id: 'performance_orcamentos',
        nome: 'Performance de Orçamentos',
        descricao: 'Análise do cumprimento de orçamentos',
        campos: ['orcamentos', 'utilizacao', 'alertas']
      },
      {
        id: 'progresso_metas',
        nome: 'Progresso de Metas',
        descricao: 'Acompanhamento das metas financeiras',
        campos: ['metas', 'progresso', 'projecoes']
      }
    ]
  })
})

/**
 * @swagger
 * /api/reports/budget-performance:
 *   get:
 *     summary: Relatório de performance de orçamentos
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [mes_atual, trimestre_atual, ano_atual]
 *           default: mes_atual
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [todos, excedido, proximo_limite, dentro_limite]
 *           default: todos
 *     responses:
 *       200:
 *         description: Performance de orçamentos obtida com sucesso
 */
router.get('/budget-performance', (req, res) => {
  const { periodo = 'mes_atual', status = 'todos' } = req.query
  
  res.json({
    success: true,
    data: {
      periodo,
      status_filtro: status,
      resumo: {
        total_orcamentos: 0,
        dentro_limite: 0,
        excedidos: 0,
        proximo_limite: 0,
        economia_total: 0,
        excesso_total: 0
      },
      orcamentos_detalhados: [],
      alertas: [],
      recomendacoes: []
    }
  })
})

/**
 * @swagger
 * /api/reports/goals-progress:
 *   get:
 *     summary: Relatório de progresso de metas
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [todas, ativas, concluidas, vencidas]
 *           default: todas
 *       - in: query
 *         name: ordenar_por
 *         schema:
 *           type: string
 *           enum: [progresso, data_limite, valor_alvo]
 *           default: progresso
 *     responses:
 *       200:
 *         description: Progresso de metas obtido com sucesso
 */
router.get('/goals-progress', (req, res) => {
  const { status = 'todas', ordenar_por = 'progresso' } = req.query
  
  res.json({
    success: true,
    data: {
      status_filtro: status,
      ordenacao: ordenar_por,
      resumo: {
        total_metas: 0,
        ativas: 0,
        concluidas: 0,
        vencidas: 0,
        progresso_medio: 0,
        valor_total_objetivos: 0,
        valor_total_poupado: 0
      },
      metas_detalhadas: [],
      insights: [],
      projecoes: {
        metas_possiveis_cumprir_mes: 0,
        valor_necessario_mes_metas_ativas: 0
      }
    }
  })
})

/**
 * @swagger
 * /api/reports/cash-flow:
 *   get:
 *     summary: Relatório de fluxo de caixa
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [mes, trimestre, semestre, ano]
 *           default: mes
 *       - in: query
 *         name: granularidade
 *         schema:
 *           type: string
 *           enum: [diario, semanal, mensal]
 *           default: diario
 *     responses:
 *       200:
 *         description: Fluxo de caixa obtido com sucesso
 */
router.get('/cash-flow', (req, res) => {
  const { periodo = 'mes', granularidade = 'diario' } = req.query
  
  res.json({
    success: true,
    data: {
      periodo,
      granularidade,
      fluxo_caixa: [],
      resumo: {
        saldo_inicial: 0,
        total_entradas: 0,
        total_saidas: 0,
        saldo_final: 0,
        maior_entrada_dia: 0,
        maior_saida_dia: 0,
        dias_saldo_positivo: 0,
        dias_saldo_negativo: 0
      },
      tendencias: {
        crescimento_receitas: 0,
        crescimento_despesas: 0,
        volatilidade: 'baixa'
      }
    }
  })
})

module.exports = router