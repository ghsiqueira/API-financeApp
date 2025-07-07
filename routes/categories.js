const express = require('express')
const router = express.Router()
const Category = require('../models/Category')
const authMiddleware = require('../middleware/authMiddleware')
const { categoryValidation } = require('../middleware/validation')
const { validationResult } = require('express-validator')

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware)

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
 *           enum: [receita, despesa, ambos]
 *         icone:
 *           type: string
 *         cor:
 *           type: string
 *         subcategorias:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               icone:
 *                 type: string
 *               cor:
 *                 type: string
 *               ativa:
 *                 type: boolean
 *         ativa:
 *           type: boolean
 *         padrao:
 *           type: boolean
 *         estatisticas:
 *           type: object
 *           properties:
 *             totalTransacoes:
 *               type: number
 *             totalValor:
 *               type: number
 *             ultimaTransacao:
 *               type: string
 *               format: date-time
 */

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Gestão de categorias
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Listar todas as categorias do usuário
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [receita, despesa, ambos]
 *         description: Filtrar por tipo de categoria
 *       - in: query
 *         name: ativa
 *         schema:
 *           type: boolean
 *         description: Filtrar por categorias ativas/inativas
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
 */
router.get('/', async (req, res) => {
  try {
    const { tipo, ativa } = req.query
    
    const filtros = {
      $or: [
        { userId: req.userId },
        { padrao: true, userId: null }
      ]
    }
    
    if (ativa !== undefined) {
      filtros.ativa = ativa === 'true'
    }
    
    if (tipo && tipo !== 'ambos') {
      filtros.$and = [
        { $or: [{ tipo }, { tipo: 'ambos' }] }
      ]
    }
    
    const categorias = await Category.find(filtros)
      .sort({ ordem: 1, nome: 1 })
      .lean()
    
    res.json({
      success: true,
      data: categorias
    })
    
  } catch (err) {
    console.error('Erro ao buscar categorias:', err)
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
 *               - tipo
 *               - icone
 *               - cor
 *             properties:
 *               nome:
 *                 type: string
 *                 example: Freelance
 *               tipo:
 *                 type: string
 *                 enum: [receita, despesa, ambos]
 *                 example: receita
 *               icone:
 *                 type: string
 *                 example: laptop
 *               cor:
 *                 type: string
 *                 example: "#2196F3"
 *               subcategorias:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     nome:
 *                       type: string
 *                     icone:
 *                       type: string
 *                     cor:
 *                       type: string
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/', categoryValidation, async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        detalhes: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      })
    }
    
    const categoria = await Category.create({
      ...req.body,
      userId: req.userId
    })
    
    res.status(201).json({
      success: true,
      message: 'Categoria criada com sucesso',
      data: categoria
    })
    
  } catch (err) {
    console.error('Erro ao criar categoria:', err)
    
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Categoria com este nome já existe'
      })
    }
    
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
 *     summary: Obter categoria por ID
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da categoria
 *     responses:
 *       200:
 *         description: Categoria encontrada
 *       404:
 *         description: Categoria não encontrada
 */
router.get('/:id', async (req, res) => {
  try {
    const categoria = await Category.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.userId },
        { padrao: true, userId: null }
      ]
    })
    
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
    
  } catch (err) {
    console.error('Erro ao buscar categoria:', err)
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
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da categoria
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               tipo:
 *                 type: string
 *                 enum: [receita, despesa, ambos]
 *               icone:
 *                 type: string
 *               cor:
 *                 type: string
 *               ativa:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Categoria atualizada com sucesso
 *       404:
 *         description: Categoria não encontrada
 */
router.put('/:id', categoryValidation, async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        detalhes: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      })
    }
    
    const categoria = await Category.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.userId // Só pode editar próprias categorias
      },
      { ...req.body, atualizadoEm: new Date() },
      { new: true, runValidators: true }
    )
    
    if (!categoria) {
      return res.status(404).json({
        success: false,
        error: 'Categoria não encontrada ou sem permissão'
      })
    }
    
    res.json({
      success: true,
      message: 'Categoria atualizada com sucesso',
      data: categoria
    })
    
  } catch (err) {
    console.error('Erro ao atualizar categoria:', err)
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
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da categoria
 *     responses:
 *       200:
 *         description: Categoria excluída com sucesso
 *       404:
 *         description: Categoria não encontrada
 *       400:
 *         description: Categoria possui transações vinculadas
 */
router.delete('/:id', async (req, res) => {
  try {
    // Verificar se a categoria tem transações vinculadas
    const Transaction = require('../models/Transaction')
    const transacoesVinculadas = await Transaction.countDocuments({
      categoria: req.params.id,
      userId: req.userId
    })
    
    if (transacoesVinculadas > 0) {
      return res.status(400).json({
        success: false,
        error: `Não é possível excluir. Categoria possui ${transacoesVinculadas} transações vinculadas.`
      })
    }
    
    const categoria = await Category.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId, // Só pode excluir próprias categorias
      padrao: false // Não pode excluir categorias padrão
    })
    
    if (!categoria) {
      return res.status(404).json({
        success: false,
        error: 'Categoria não encontrada ou sem permissão'
      })
    }
    
    res.json({
      success: true,
      message: 'Categoria excluída com sucesso'
    })
    
  } catch (err) {
    console.error('Erro ao excluir categoria:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/categories/{id}/subcategoria:
 *   post:
 *     summary: Adicionar subcategoria
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da categoria
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *             properties:
 *               nome:
 *                 type: string
 *               icone:
 *                 type: string
 *               cor:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subcategoria adicionada com sucesso
 */
router.post('/:id/subcategoria', async (req, res) => {
  try {
    const { nome, icone, cor } = req.body
    
    if (!nome || nome.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nome da subcategoria é obrigatório'
      })
    }
    
    const categoria = await Category.findOne({
      _id: req.params.id,
      userId: req.userId
    })
    
    if (!categoria) {
      return res.status(404).json({
        success: false,
        error: 'Categoria não encontrada'
      })
    }
    
    // Verificar se subcategoria já existe
    const subcategoriaExistente = categoria.subcategorias.find(
      sub => sub.nome.toLowerCase() === nome.toLowerCase()
    )
    
    if (subcategoriaExistente) {
      return res.status(400).json({
        success: false,
        error: 'Subcategoria já existe'
      })
    }
    
    await categoria.adicionarSubcategoria({
      nome: nome.trim(),
      icone: icone || categoria.icone,
      cor: cor || categoria.cor
    })
    
    res.json({
      success: true,
      message: 'Subcategoria adicionada com sucesso',
      data: categoria
    })
    
  } catch (err) {
    console.error('Erro ao adicionar subcategoria:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/categories/{id}/subcategoria/{subId}:
 *   delete:
 *     summary: Remover subcategoria
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da categoria
 *       - in: path
 *         name: subId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da subcategoria
 *     responses:
 *       200:
 *         description: Subcategoria removida com sucesso
 */
router.delete('/:id/subcategoria/:subId', async (req, res) => {
  try {
    const categoria = await Category.findOne({
      _id: req.params.id,
      userId: req.userId
    })
    
    if (!categoria) {
      return res.status(404).json({
        success: false,
        error: 'Categoria não encontrada'
      })
    }
    
    await categoria.removerSubcategoria(req.params.subId)
    
    res.json({
      success: true,
      message: 'Subcategoria removida com sucesso',
      data: categoria
    })
    
  } catch (err) {
    console.error('Erro ao remover subcategoria:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/categories/populares:
 *   get:
 *     summary: Obter categorias mais usadas
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Número máximo de categorias
 *     responses:
 *       200:
 *         description: Categorias populares
 */
router.get('/populares', async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 5
    
    const categorias = await Category.buscarPopulares(req.userId, limite)
    
    res.json({
      success: true,
      data: categorias
    })
    
  } catch (err) {
    console.error('Erro ao buscar categorias populares:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/categories/{id}/estatisticas:
 *   get:
 *     summary: Obter estatísticas da categoria
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da categoria
 *     responses:
 *       200:
 *         description: Estatísticas da categoria
 */
router.get('/:id/estatisticas', async (req, res) => {
  try {
    const categoria = await Category.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.userId },
        { padrao: true, userId: null }
      ]
    })
    
    if (!categoria) {
      return res.status(404).json({
        success: false,
        error: 'Categoria não encontrada'
      })
    }
    
    await categoria.atualizarEstatisticas()
    
    res.json({
      success: true,
      data: {
        categoria: categoria.nome,
        estatisticas: categoria.estatisticas
      }
    })
    
  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

/**
 * @swagger
 * /api/categories/recriar-padroes:
 *   post:
 *     summary: Recriar categorias padrão (se não existirem)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categorias padrão recriadas
 */
router.post('/recriar-padroes', async (req, res) => {
  try {
    const categoriasCriadas = await Category.criarCategoriasPadrao(req.userId)
    
    res.json({
      success: true,
      message: categoriasCriadas.length > 0 
        ? `${categoriasCriadas.length} categorias padrão criadas`
        : 'Categorias já existem',
      data: categoriasCriadas
    })
    
  } catch (err) {
    console.error('Erro ao recriar categorias padrão:', err)
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    })
  }
})

module.exports = router