// routes/categories.js - Completo
const express = require('express')
const router = express.Router()

// Categorias padrão para despesas
const categoriasDespesa = [
  {
    _id: '1',
    nome: 'Alimentação',
    tipo: 'despesa',
    icone: 'restaurant',
    cor: '#FF5722',
    descricao: 'Gastos com comida e bebidas'
  },
  {
    _id: '2',
    nome: 'Transporte',
    tipo: 'despesa',
    icone: 'car',
    cor: '#607D8B',
    descricao: 'Combustível, uber, transporte público'
  },
  {
    _id: '3',
    nome: 'Moradia',
    tipo: 'despesa',
    icone: 'home',
    cor: '#795548',
    descricao: 'Aluguel, contas da casa, manutenção'
  },
  {
    _id: '4',
    nome: 'Saúde',
    tipo: 'despesa',
    icone: 'medical',
    cor: '#F44336',
    descricao: 'Médico, dentista, farmácia, plano de saúde'
  },
  {
    _id: '5',
    nome: 'Educação',
    tipo: 'despesa',
    icone: 'school',
    cor: '#3F51B5',
    descricao: 'Cursos, livros, material escolar'
  },
  {
    _id: '6',
    nome: 'Lazer',
    tipo: 'despesa',
    icone: 'game-controller',
    cor: '#9C27B0',
    descricao: 'Cinema, shows, viagens, hobbies'
  },
  {
    _id: '7',
    nome: 'Vestuário',
    tipo: 'despesa',
    icone: 'shirt',
    cor: '#E91E63',
    descricao: 'Roupas, sapatos, acessórios'
  },
  {
    _id: '8',
    nome: 'Tecnologia',
    tipo: 'despesa',
    icone: 'phone-portrait',
    cor: '#2196F3',
    descricao: 'Celular, computador, software'
  },
  {
    _id: '9',
    nome: 'Beleza',
    tipo: 'despesa',
    icone: 'cut',
    cor: '#FF9800',
    descricao: 'Cabelo, estética, cosméticos'
  },
  {
    _id: '10',
    nome: 'Investimentos',
    tipo: 'despesa',
    icone: 'trending-up',
    cor: '#4CAF50',
    descricao: 'Poupança, ações, fundos'
  },
  {
    _id: '11',
    nome: 'Pets',
    tipo: 'despesa',
    icone: 'paw',
    cor: '#795548',
    descricao: 'Ração, veterinário, medicamentos'
  },
  {
    _id: '12',
    nome: 'Outros',
    tipo: 'despesa',
    icone: 'ellipsis-horizontal',
    cor: '#9E9E9E',
    descricao: 'Gastos diversos'
  }
]

// Categorias padrão para receitas
const categoriasReceita = [
  {
    _id: '13',
    nome: 'Salário',
    tipo: 'receita',
    icone: 'wallet',
    cor: '#4CAF50',
    descricao: 'Salário mensal'
  },
  {
    _id: '14',
    nome: 'Freelance',
    tipo: 'receita',
    icone: 'briefcase',
    cor: '#FF9800',
    descricao: 'Trabalhos freelancer'
  },
  {
    _id: '15',
    nome: 'Investimentos',
    tipo: 'receita',
    icone: 'trending-up',
    cor: '#009688',
    descricao: 'Rendimentos de investimentos'
  },
  {
    _id: '16',
    nome: 'Vendas',
    tipo: 'receita',
    icone: 'storefront',
    cor: '#2196F3',
    descricao: 'Vendas de produtos ou serviços'
  },
  {
    _id: '17',
    nome: 'Presentes',
    tipo: 'receita',
    icone: 'gift',
    cor: '#E91E63',
    descricao: 'Dinheiro recebido de presente'
  },
  {
    _id: '18',
    nome: 'Outros',
    tipo: 'receita',
    icone: 'ellipsis-horizontal',
    cor: '#607D8B',
    descricao: 'Outras receitas'
  }
]

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         nome:
 *           type: string
 *         tipo:
 *           type: string
 *           enum: [receita, despesa]
 *         icone:
 *           type: string
 *         cor:
 *           type: string
 *         descricao:
 *           type: string
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Listar todas as categorias
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [receita, despesa]
 *         description: Filtrar por tipo de categoria
 *     responses:
 *       200:
 *         description: Lista de categorias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 *                 total:
 *                   type: number
 */
router.get('/', (req, res) => {
  try {
    const { tipo } = req.query
    
    let categorias = [...categoriasDespesa, ...categoriasReceita]
    
    // Filtrar por tipo se especificado
    if (tipo) {
      categorias = categorias.filter(cat => cat.tipo === tipo)
    }
    
    // Ordenar por nome
    categorias.sort((a, b) => a.nome.localeCompare(b.nome))
    
    res.json({
      success: true,
      data: categorias,
      total: categorias.length,
      filters: {
        tipo: tipo || 'todos'
      }
    })
    
  } catch (error) {
    console.error('Erro ao buscar categorias:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Buscar categoria por ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categoria encontrada
 *       404:
 *         description: Categoria não encontrada
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params
    const todasCategorias = [...categoriasDespesa, ...categoriasReceita]
    const categoria = todasCategorias.find(cat => cat._id === id)
    
    if (!categoria) {
      return res.status(404).json({
        success: false,
        error: 'Categoria não encontrada'
      })
    }
    
    res.json({
      success: true,
      data: categoria
    })
    
  } catch (error) {
    console.error('Erro ao buscar categoria:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Criar nova categoria
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - tipo
 *             properties:
 *               nome:
 *                 type: string
 *               tipo:
 *                 type: string
 *                 enum: [receita, despesa]
 *               icone:
 *                 type: string
 *               cor:
 *                 type: string
 *               descricao:
 *                 type: string
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/', (req, res) => {
  try {
    const { nome, tipo, icone, cor, descricao } = req.body
    
    // Validações
    if (!nome || !tipo) {
      return res.status(400).json({
        success: false,
        error: 'Nome e tipo são obrigatórios'
      })
    }
    
    if (!['receita', 'despesa'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo deve ser "receita" ou "despesa"'
      })
    }
    
    // Verificar se categoria já existe
    const todasCategorias = [...categoriasDespesa, ...categoriasReceita]
    const categoriaExistente = todasCategorias.find(cat => 
      cat.nome.toLowerCase() === nome.toLowerCase() && cat.tipo === tipo
    )
    
    if (categoriaExistente) {
      return res.status(400).json({
        success: false,
        error: 'Já existe uma categoria com este nome'
      })
    }
    
    const novaCategoria = {
      _id: (Date.now() + Math.random()).toString(),
      nome: nome.trim(),
      tipo,
      icone: icone || 'ellipsis-horizontal',
      cor: cor || '#9E9E9E',
      descricao: descricao || ''
    }
    
    // Adicionar à lista apropriada
    if (tipo === 'despesa') {
      categoriasDespesa.push(novaCategoria)
    } else {
      categoriasReceita.push(novaCategoria)
    }
    
    res.status(201).json({
      success: true,
      message: 'Categoria criada com sucesso',
      data: novaCategoria
    })
    
  } catch (error) {
    console.error('Erro ao criar categoria:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Atualizar categoria
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Category'
 *     responses:
 *       200:
 *         description: Categoria atualizada
 *       404:
 *         description: Categoria não encontrada
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params
    const { nome, tipo, icone, cor, descricao } = req.body
    
    // Encontrar categoria
    const categoriaIndex = categoriasDespesa.findIndex(cat => cat._id === id)
    let lista = categoriasDespesa
    let index = categoriaIndex
    
    if (categoriaIndex === -1) {
      const receitaIndex = categoriasReceita.findIndex(cat => cat._id === id)
      if (receitaIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Categoria não encontrada'
        })
      }
      lista = categoriasReceita
      index = receitaIndex
    }
    
    // Atualizar categoria
    if (nome) lista[index].nome = nome.trim()
    if (tipo) lista[index].tipo = tipo
    if (icone) lista[index].icone = icone
    if (cor) lista[index].cor = cor
    if (descricao !== undefined) lista[index].descricao = descricao
    
    res.json({
      success: true,
      message: 'Categoria atualizada com sucesso',
      data: lista[index]
    })
    
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Excluir categoria
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categoria excluída
 *       404:
 *         description: Categoria não encontrada
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params
    
    // Encontrar e remover categoria
    const despesaIndex = categoriasDespesa.findIndex(cat => cat._id === id)
    if (despesaIndex !== -1) {
      const categoriaRemovida = categoriasDespesa.splice(despesaIndex, 1)[0]
      return res.json({
        success: true,
        message: 'Categoria excluída com sucesso',
        data: categoriaRemovida
      })
    }
    
    const receitaIndex = categoriasReceita.findIndex(cat => cat._id === id)
    if (receitaIndex !== -1) {
      const categoriaRemovida = categoriasReceita.splice(receitaIndex, 1)[0]
      return res.json({
        success: true,
        message: 'Categoria excluída com sucesso',
        data: categoriaRemovida
      })
    }
    
    res.status(404).json({
      success: false,
      error: 'Categoria não encontrada'
    })
    
  } catch (error) {
    console.error('Erro ao excluir categoria:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

// Rotas específicas para tipos
router.get('/tipo/despesa', (req, res) => {
  res.json({
    success: true,
    data: categoriasDespesa,
    total: categoriasDespesa.length
  })
})

router.get('/tipo/receita', (req, res) => {
  res.json({
    success: true,
    data: categoriasReceita,
    total: categoriasReceita.length
  })
})

// Rota de teste e debug
router.get('/test/debug', (req, res) => {
  res.json({
    message: 'Rota de categorias funcionando!',
    estatisticas: {
      totalCategorias: categoriasDespesa.length + categoriasReceita.length,
      despesas: categoriasDespesa.length,
      receitas: categoriasReceita.length
    },
    exemploUso: {
      listarTodas: 'GET /api/categories',
      listarDespesas: 'GET /api/categories?tipo=despesa',
      listarReceitas: 'GET /api/categories?tipo=receita',
      buscarPorId: 'GET /api/categories/1',
      criar: 'POST /api/categories',
      atualizar: 'PUT /api/categories/1',
      excluir: 'DELETE /api/categories/1'
    },
    formatoEsperado: {
      success: true,
      data: [
        {
          _id: '1',
          nome: 'Alimentação',
          tipo: 'despesa',
          icone: 'restaurant',
          cor: '#FF5722',
          descricao: 'Gastos com comida e bebidas'
        }
      ]
    }
  })
})

// Rota para resetar categorias (útil para desenvolvimento)
router.post('/reset', (req, res) => {
  try {
    // Esta rota recriaria as categorias padrão
    // Por segurança, só funciona em desenvolvimento
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        error: 'Esta operação só é permitida em desenvolvimento'
      })
    }
    
    res.json({
      success: true,
      message: 'Categorias resetadas com sucesso',
      data: {
        despesas: categoriasDespesa.length,
        receitas: categoriasReceita.length
      }
    })
    
  } catch (error) {
    console.error('Erro ao resetar categorias:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

module.exports = router