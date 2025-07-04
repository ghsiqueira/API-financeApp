const Category = require('../models/Category')
const Transaction = require('../models/Transaction')
const { validationResult } = require('express-validator')

exports.getAll = async (req, res) => {
  try {
    const { tipo, ativas = true, incluirEstatisticas = false } = req.query
    
    const filtro = {
      $or: [
        { userId: req.userId },
        { padrao: true }
      ]
    }
    
    if (ativas === 'true') {
      filtro.ativa = true
    }
    
    if (tipo && tipo !== 'ambos') {
      filtro.$and = [
        {
          $or: [
            { tipo: tipo },
            { tipo: 'ambos' }
          ]
        }
      ]
    }
    
    let categories = await Category.find(filtro).sort({ ordem: 1, nome: 1 }).lean()
    
    // Incluir estatísticas se solicitado
    if (incluirEstatisticas === 'true') {
      categories = await Promise.all(
        categories.map(async (categoria) => {
          const estatisticas = await Transaction.aggregate([
            {
              $match: {
                userId: req.userId,
                categoria: categoria.nome
              }
            },
            {
              $group: {
                _id: '$tipo',
                total: { $sum: '$valor' },
                count: { $sum: 1 },
                ultimaTransacao: { $max: '$data' }
              }
            }
          ])

          const totalGeral = estatisticas.reduce((sum, stat) => sum + stat.total, 0)
          const countGeral = estatisticas.reduce((sum, stat) => sum + stat.count, 0)
          const ultimaTransacao = estatisticas.reduce((latest, stat) => {
            return !latest || stat.ultimaTransacao > latest ? stat.ultimaTransacao : latest
          }, null)

          return {
            ...categoria,
            estatisticas: {
              totalTransacoes: countGeral,
              totalValor: totalGeral,
              ultimaTransacao,
              porTipo: estatisticas
            }
          }
        })
      )
    }
    
    res.json({
      success: true,
      data: categories
    })
    
  } catch (err) {
    console.error('Erro ao buscar categorias:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getById = async (req, res) => {
  try {
    const { id } = req.params

    const categoria = await Category.findOne({
      _id: id,
      $or: [
        { userId: req.userId },
        { padrao: true }
      ]
    })

    if (!categoria) {
      return res.status(404).json({ error: 'Categoria não encontrada' })
    }

    // Buscar estatísticas detalhadas
    const [estatisticas, transacoesRecentes] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId: req.userId,
            categoria: categoria.nome
          }
        },
        {
          $facet: {
            porTipo: [
              {
                $group: {
                  _id: '$tipo',
                  total: { $sum: '$valor' },
                  count: { $sum: 1 },
                  media: { $avg: '$valor' },
                  maior: { $max: '$valor' },
                  menor: { $min: '$valor' }
                }
              }
            ],
            porMes: [
              {
                $group: {
                  _id: {
                    ano: { $year: '$data' },
                    mes: { $month: '$data' },
                    tipo: '$tipo'
                  },
                  total: { $sum: '$valor' },
                  count: { $sum: 1 }
                }
              },
              { $sort: { '_id.ano': -1, '_id.mes': -1 } },
              { $limit: 12 }
            ],
            porMetodoPagamento: [
              {
                $group: {
                  _id: '$metodoPagamento',
                  total: { $sum: '$valor' },
                  count: { $sum: 1 }
                }
              },
              { $sort: { total: -1 } }
            ]
          }
        }
      ]),

      Transaction.find({
        userId: req.userId,
        categoria: categoria.nome
      }).sort({ data: -1 }).limit(10)
    ])

    res.json({
      success: true,
      data: {
        categoria,
        estatisticas: estatisticas[0],
        transacoesRecentes
      }
    })

  } catch (err) {
    console.error('Erro ao buscar categoria:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.create = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados inválidos',
        detalhes: errors.array()
      })
    }
    
    const { nome, tipo, icone, cor, subcategorias = [] } = req.body
    
    // Verificar se já existe categoria com mesmo nome para o usuário
    const existente = await Category.findOne({
      $or: [
        { userId: req.userId, nome: nome.trim() },
        { padrao: true, nome: nome.trim() }
      ],
      ativa: true
    })
    
    if (existente) {
      return res.status(400).json({ error: 'Já existe uma categoria com este nome' })
    }
    
    const category = new Category({
      userId: req.userId,
      nome: nome.trim(),
      tipo,
      icone,
      cor,
      subcategorias: subcategorias.map(sub => ({
        nome: sub.nome.trim(),
        icone: sub.icone || icone,
        cor: sub.cor || cor,
        ativa: true
      })),
      ativa: true,
      padrao: false
    })
    
    await category.save()
    
    res.status(201).json({
      success: true,
      message: 'Categoria criada com sucesso',
      data: category
    })
    
  } catch (err) {
    console.error('Erro ao criar categoria:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.update = async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    // Não permitir atualizar categorias padrão
    const category = await Category.findOne({
      _id: id,
      userId: req.userId
    })
    
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' })
    }
    
    if (category.padrao) {
      return res.status(403).json({ error: 'Não é possível editar categorias padrão' })
    }

    // Verificar se o novo nome já existe (se está sendo alterado)
    if (updates.nome && updates.nome !== category.nome) {
      const existente = await Category.findOne({
        $or: [
          { userId: req.userId, nome: updates.nome.trim() },
          { padrao: true, nome: updates.nome.trim() }
        ],
        _id: { $ne: id },
        ativa: true
      })
      
      if (existente) {
        return res.status(400).json({ error: 'Já existe uma categoria com este nome' })
      }
    }
    
    // Aplicar atualizações
    Object.keys(updates).forEach(key => {
      if (key !== 'userId' && key !== 'padrao') {
        category[key] = updates[key]
      }
    })
    
    await category.save()
    
    // Se o nome mudou, atualizar transações relacionadas
    if (updates.nome && updates.nome !== category.nome) {
      await Transaction.updateMany(
        { userId: req.userId, categoria: category.nome },
        { categoria: updates.nome }
      )
    }
    
    res.json({
      success: true,
      message: 'Categoria atualizada com sucesso',
      data: category
    })
    
  } catch (err) {
    console.error('Erro ao atualizar categoria:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.remove = async (req, res) => {
  try {
    const { id } = req.params
    
    const category = await Category.findOne({
      _id: id,
      userId: req.userId
    })
    
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' })
    }
    
    if (category.padrao) {
      return res.status(403).json({ error: 'Não é possível excluir categorias padrão' })
    }

    // Verificar se há transações usando esta categoria
    const transacoesCount = await Transaction.countDocuments({
      userId: req.userId,
      categoria: category.nome
    })

    if (transacoesCount > 0) {
      return res.status(400).json({ 
        error: `Não é possível excluir esta categoria pois ela possui ${transacoesCount} transação(ões) associada(s)`,
        sugestao: 'Você pode desativar a categoria ao invés de excluí-la'
      })
    }
    
    await Category.deleteOne({ _id: id, userId: req.userId })
    
    res.json({
      success: true,
      message: 'Categoria removida com sucesso'
    })
    
  } catch (err) {
    console.error('Erro ao remover categoria:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.addSubcategoria = async (req, res) => {
  try {
    const { id } = req.params
    const { nome, icone, cor } = req.body

    if (!nome || nome.trim() === '') {
      return res.status(400).json({ error: 'Nome da subcategoria é obrigatório' })
    }

    const category = await Category.findOne({
      _id: id,
      userId: req.userId
    })

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' })
    }

    if (category.padrao) {
      return res.status(403).json({ error: 'Não é possível adicionar subcategorias em categorias padrão' })
    }

    // Verificar se subcategoria já existe
    const subcategoriaExiste = category.subcategorias.some(sub => 
      sub.nome.toLowerCase() === nome.trim().toLowerCase()
    )

    if (subcategoriaExiste) {
      return res.status(400).json({ error: 'Subcategoria já existe' })
    }

    category.adicionarSubcategoria(nome.trim(), icone, cor)
    await category.save()

    res.json({
      success: true,
      message: 'Subcategoria adicionada com sucesso',
      data: category
    })

  } catch (err) {
    console.error('Erro ao adicionar subcategoria:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.updateSubcategoria = async (req, res) => {
  try {
    const { id, subcategoriaId } = req.params
    const { nome, icone, cor, ativa } = req.body

    const category = await Category.findOne({
      _id: id,
      userId: req.userId
    })

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' })
    }

    if (category.padrao) {
      return res.status(403).json({ error: 'Não é possível editar subcategorias de categorias padrão' })
    }

    const subcategoria = category.subcategorias.id(subcategoriaId)
    if (!subcategoria) {
      return res.status(404).json({ error: 'Subcategoria não encontrada' })
    }

    // Atualizar campos fornecidos
    if (nome) subcategoria.nome = nome.trim()
    if (icone) subcategoria.icone = icone
    if (cor) subcategoria.cor = cor
    if (ativa !== undefined) subcategoria.ativa = ativa

    await category.save()

    res.json({
      success: true,
      message: 'Subcategoria atualizada com sucesso',
      data: category
    })

  } catch (err) {
    console.error('Erro ao atualizar subcategoria:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.removeSubcategoria = async (req, res) => {
  try {
    const { id, subcategoriaId } = req.params

    const category = await Category.findOne({
      _id: id,
      userId: req.userId
    })

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' })
    }

    if (category.padrao) {
      return res.status(403).json({ error: 'Não é possível remover subcategorias de categorias padrão' })
    }

    const subcategoria = category.subcategorias.id(subcategoriaId)
    if (!subcategoria) {
      return res.status(404).json({ error: 'Subcategoria não encontrada' })
    }

    // Verificar se há transações usando esta subcategoria
    const transacoesCount = await Transaction.countDocuments({
      userId: req.userId,
      subcategoria: subcategoria.nome
    })

    if (transacoesCount > 0) {
      return res.status(400).json({ 
        error: `Não é possível excluir esta subcategoria pois ela possui ${transacoesCount} transação(ões) associada(s)`,
        sugestao: 'Você pode desativar a subcategoria ao invés de excluí-la'
      })
    }

    category.subcategorias.pull(subcategoriaId)
    await category.save()

    res.json({
      success: true,
      message: 'Subcategoria removida com sucesso',
      data: category
    })

  } catch (err) {
    console.error('Erro ao remover subcategoria:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.getEstatisticas = async (req, res) => {
  try {
    const { periodo = 'mes' } = req.query

    // Definir período
    let dataInicio, dataFim
    const agora = new Date()

    switch (periodo) {
      case 'semana':
        dataInicio = new Date(agora)
        dataInicio.setDate(agora.getDate() - 6)
        dataFim = agora
        break
      case 'mes':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
        dataFim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
        break
      case 'trimestre':
        const trimestre = Math.floor(agora.getMonth() / 3)
        dataInicio = new Date(agora.getFullYear(), trimestre * 3, 1)
        dataFim = new Date(agora.getFullYear(), (trimestre + 1) * 3, 0)
        break
      case 'ano':
        dataInicio = new Date(agora.getFullYear(), 0, 1)
        dataFim = new Date(agora.getFullYear(), 11, 31)
        break
    }

    const estatisticas = await Transaction.aggregate([
      {
        $match: {
          userId: req.userId,
          data: { $gte: dataInicio, $lte: dataFim }
        }
      },
      {
        $group: {
          _id: {
            categoria: '$categoria',
            tipo: '$tipo'
          },
          total: { $sum: '$valor' },
          count: { $sum: 1 },
          media: { $avg: '$valor' },
          maior: { $max: '$valor' },
          menor: { $min: '$valor' }
        }
      },
      {
        $group: {
          _id: '$_id.categoria',
          tipos: {
            $push: {
              tipo: '$_id.tipo',
              total: '$total',
              count: '$count',
              media: '$media',
              maior: '$maior',
              menor: '$menor'
            }
          },
          totalGeral: { $sum: '$total' },
          transacoesGeral: { $sum: '$count' }
        }
      },
      { $sort: { totalGeral: -1 } }
    ])

    // Buscar informações das categorias
    const categoriasInfo = await Category.find({
      $or: [
        { userId: req.userId },
        { padrao: true }
      ],
      ativa: true
    }).select('nome tipo icone cor').lean()

    // Combinar estatísticas com informações das categorias
    const resultado = estatisticas.map(stat => {
      const categoriaInfo = categoriasInfo.find(cat => cat.nome === stat._id) || {
        nome: stat._id,
        tipo: 'ambos',
        icone: 'folder',
        cor: '#007AFF'
      }

      return {
        categoria: stat._id,
        info: categoriaInfo,
        totalGeral: stat.totalGeral,
        transacoesGeral: stat.transacoesGeral,
        mediaGeral: stat.totalGeral / stat.transacoesGeral,
        tipos: stat.tipos,
        receitas: stat.tipos.find(t => t.tipo === 'receita') || { total: 0, count: 0 },
        despesas: stat.tipos.find(t => t.tipo === 'despesa') || { total: 0, count: 0 }
      }
    })

    // Calcular totais gerais
    const totais = resultado.reduce((acc, cat) => {
      acc.totalReceitas += cat.receitas.total
      acc.totalDespesas += cat.despesas.total
      acc.totalTransacoes += cat.transacoesGeral
      return acc
    }, { totalReceitas: 0, totalDespesas: 0, totalTransacoes: 0 })

    // Adicionar porcentagens
    resultado.forEach(cat => {
      cat.porcentagemReceitas = totais.totalReceitas > 0 ? 
        Math.round((cat.receitas.total / totais.totalReceitas) * 100) : 0
      cat.porcentagemDespesas = totais.totalDespesas > 0 ? 
        Math.round((cat.despesas.total / totais.totalDespesas) * 100) : 0
      cat.porcentagemTransacoes = totais.totalTransacoes > 0 ? 
        Math.round((cat.transacoesGeral / totais.totalTransacoes) * 100) : 0
    })

    res.json({
      success: true,
      data: {
        periodo: {
          inicio: dataInicio,
          fim: dataFim,
          tipo: periodo
        },
        categorias: resultado,
        totais,
        resumo: {
          categoriasMaisUsadas: resultado.slice(0, 5),
          categoriaComMaiorReceita: resultado.find(c => c.receitas.total > 0) || null,
          categoriaComMaiorDespesa: resultado.find(c => c.despesas.total > 0) || null,
          totalCategorias: resultado.length
        }
      }
    })

  } catch (err) {
    console.error('Erro ao buscar estatísticas de categorias:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.updateOrdem = async (req, res) => {
  try {
    const { categorias } = req.body

    if (!Array.isArray(categorias)) {
      return res.status(400).json({ error: 'Lista de categorias inválida' })
    }

    // Atualizar ordem das categorias do usuário
    const updates = categorias.map((cat, index) => ({
      updateOne: {
        filter: { _id: cat.id, userId: req.userId },
        update: { ordem: index }
      }
    }))

    if (updates.length > 0) {
      await Category.bulkWrite(updates)
    }

    res.json({
      success: true,
      message: 'Ordem das categorias atualizada com sucesso'
    })

  } catch (err) {
    console.error('Erro ao atualizar ordem:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.duplicar = async (req, res) => {
  try {
    const { id } = req.params
    const { nome } = req.body

    if (!nome || nome.trim() === '') {
      return res.status(400).json({ error: 'Nome da nova categoria é obrigatório' })
    }

    const categoriaOriginal = await Category.findOne({
      _id: id,
      $or: [
        { userId: req.userId },
        { padrao: true }
      ]
    })

    if (!categoriaOriginal) {
      return res.status(404).json({ error: 'Categoria não encontrada' })
    }

    // Verificar se já existe categoria com o novo nome
    const existente = await Category.findOne({
      $or: [
        { userId: req.userId, nome: nome.trim() },
        { padrao: true, nome: nome.trim() }
      ],
      ativa: true
    })

    if (existente) {
      return res.status(400).json({ error: 'Já existe uma categoria com este nome' })
    }

    // Criar nova categoria baseada na original
    const novaCategoria = new Category({
      userId: req.userId,
      nome: nome.trim(),
      tipo: categoriaOriginal.tipo,
      icone: categoriaOriginal.icone,
      cor: categoriaOriginal.cor,
      subcategorias: categoriaOriginal.subcategorias.map(sub => ({
        nome: sub.nome,
        icone: sub.icone,
        cor: sub.cor,
        ativa: sub.ativa
      })),
      ativa: true,
      padrao: false
    })

    await novaCategoria.save()

    res.status(201).json({
      success: true,
      message: 'Categoria duplicada com sucesso',
      data: novaCategoria
    })

  } catch (err) {
    console.error('Erro ao duplicar categoria:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.buscar = async (req, res) => {
  try {
    const { q, tipo, limite = 10 } = req.query

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Termo de busca deve ter pelo menos 2 caracteres' })
    }

    const filtro = {
      $or: [
        { userId: req.userId },
        { padrao: true }
      ],
      ativa: true,
      nome: { $regex: q.trim(), $options: 'i' }
    }

    if (tipo && tipo !== 'ambos') {
      filtro.$and = [
        {
          $or: [
            { tipo: tipo },
            { tipo: 'ambos' }
          ]
        }
      ]
    }

    const categorias = await Category.find(filtro)
      .limit(parseInt(limite))
      .sort({ nome: 1 })
      .lean()

    // Também buscar em subcategorias
    const categoriasComSubcategorias = await Category.find({
      $or: [
        { userId: req.userId },
        { padrao: true }
      ],
      ativa: true,
      'subcategorias.nome': { $regex: q.trim(), $options: 'i' }
    }).lean()

    const subcategoriasEncontradas = []
    categoriasComSubcategorias.forEach(cat => {
      cat.subcategorias.forEach(sub => {
        if (sub.nome.toLowerCase().includes(q.trim().toLowerCase()) && sub.ativa) {
          subcategoriasEncontradas.push({
            ...cat,
            subcategoriaEncontrada: sub
          })
        }
      })
    })

    res.json({
      success: true,
      data: {
        categorias,
        subcategorias: subcategoriasEncontradas.slice(0, parseInt(limite)),
        total: categorias.length + subcategoriasEncontradas.length
      }
    })

  } catch (err) {
    console.error('Erro ao buscar categorias:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.importarPadrao = async (req, res) => {
  try {
    const { sobrescrever = false } = req.body

    // Buscar categorias padrão
    const categoriasPadrao = await Category.find({ padrao: true })

    if (categoriasPadrao.length === 0) {
      // Criar categorias padrão se não existirem
      await Category.criarCategoriasPadrao()
      return res.json({
        success: true,
        message: 'Categorias padrão criadas com sucesso'
      })
    }

    let criadas = 0
    let existentes = 0

    for (const categoriaPadrao of categoriasPadrao) {
      // Verificar se o usuário já tem esta categoria
      const existeParaUsuario = await Category.findOne({
        userId: req.userId,
        nome: categoriaPadrao.nome
      })

      if (existeParaUsuario) {
        if (sobrescrever) {
          await Category.findByIdAndUpdate(existeParaUsuario._id, {
            tipo: categoriaPadrao.tipo,
            icone: categoriaPadrao.icone,
            cor: categoriaPadrao.cor,
            subcategorias: categoriaPadrao.subcategorias
          })
          criadas++
        } else {
          existentes++
        }
      } else {
        // Criar nova categoria para o usuário
        await Category.create({
          ...categoriaPadrao.toObject(),
          _id: undefined,
          userId: req.userId,
          padrao: false
        })
        criadas++
      }
    }

    res.json({
      success: true,
      message: `Importação concluída: ${criadas} categorias processadas, ${existentes} já existentes`,
      data: {
        criadas,
        existentes,
        sobrescrever
      }
    })

  } catch (err) {
    console.error('Erro ao importar categorias padrão:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

exports.exportar = async (req, res) => {
  try {
    const { formato = 'json' } = req.query

    const categorias = await Category.find({
      userId: req.userId
    }).lean()

    // Remover campos internos
    const categoriasLimpas = categorias.map(cat => {
      const { _id, userId, criadoEm, atualizadoEm, ...categoriaLimpa } = cat
      return categoriaLimpa
    })

    if (formato === 'csv') {
      // Converter para CSV
      const csv = converterCategoriasParaCSV(categoriasLimpas)
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="categorias.csv"')
      return res.send(csv)
    }

    // JSON por padrão
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', 'attachment; filename="categorias.json"')
    res.json({
      success: true,
      data: {
        categorias: categoriasLimpas,
        exportadoEm: new Date(),
        total: categoriasLimpas.length
      }
    })

  } catch (err) {
    console.error('Erro ao exportar categorias:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

// Função auxiliar para converter categorias para CSV
function converterCategoriasParaCSV(categorias) {
  const cabecalho = ['Nome', 'Tipo', 'Ícone', 'Cor', 'Ativa', 'Subcategorias']
  const linhas = [cabecalho.join(',')]

  categorias.forEach(cat => {
    const subcategorias = cat.subcategorias?.map(sub => sub.nome).join(';') || ''
    const linha = [
      `"${cat.nome.replace(/"/g, '""')}"`,
      cat.tipo,
      cat.icone,
      cat.cor,
      cat.ativa,
      `"${subcategorias}"`
    ]
    linhas.push(linha.join(','))
  })

  return linhas.join('\n')
}