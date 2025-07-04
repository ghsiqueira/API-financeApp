const express = require('express')
const router = express.Router()
const { body } = require('express-validator')
const auth = require('../middleware/authMiddleware')
const categoryController = require('../controllers/categoryController')

// Middleware de autenticação
router.use(auth)

// Validações
const categoryValidation = [
  body('nome').trim().isLength({ min: 1, max: 50 }).withMessage('Nome deve ter entre 1 e 50 caracteres'),
  body('tipo').isIn(['receita', 'despesa', 'ambos']).withMessage('Tipo deve ser receita, despesa ou ambos'),
  body('icone').trim().isLength({ min: 1 }).withMessage('Ícone é obrigatório'),
  body('cor').matches(/^#[0-9A-F]{6}$/i).withMessage('Cor deve estar em formato hexadecimal')
]

const subcategoryValidation = [
  body('nome').trim().isLength({ min: 1, max: 50 }).withMessage('Nome deve ter entre 1 e 50 caracteres'),
  body('icone').optional().trim(),
  body('cor').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Cor deve estar em formato hexadecimal')
]

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       required:
 *         - nome
 *         - tipo
 *         - icone
 *         - cor
 *       properties:
 *         nome:
 *           type: string
 *           maxLength: 50
 *         tipo:
 *           type: string
 *           enum: [receita, despesa, ambos]
 *         icone:
 *           type: string
 *         cor:
 *           type: string
 *           pattern: ^#[0-9A-F]{6}$
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
 *         ordem:
 *           type: number
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Listar categorias do usuário
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [receita, despesa, ambos]
 *         description: Filtrar por tipo
 *       - in: query
 *         name: ativas
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filtrar apenas categorias ativas
 *       - in: query
 *         name: incluirEstatisticas
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Incluir estatísticas de uso
 *     responses:
 *       200:
 *         description: Lista de categorias
 */
router.get('/', categoryController.getAll)

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Obter categoria por ID com detalhes
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categoria com estatísticas e transações recentes
 *       404:
 *         description: Categoria não encontrada
 */
router.get('/:id', categoryController.getById)

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
 *             $ref: '#/components/schemas/Category'
 *           example:
 *             nome: Freelance
 *             tipo: receita
 *             icone: laptop
 *             cor: "#007AFF"
 *             subcategorias:
 *               - nome: Desenvolvimento Web
 *                 icone: code
 *                 cor: "#007AFF"
 *               - nome: Design Gráfico
 *                 icone: palette
 *                 cor: "#34C759"
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso
 *       400:
 *         description: Dados inválidos ou categoria já existe
 */
router.post('/', categoryValidation, categoryController.create)

/**
 * @swagger
 * /api/categories/{id}:
 *   patch:
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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Category'
 *     responses:
 *       200:
 *         description: Categoria atualizada com sucesso
 *       403:
 *         description: Não é possível editar categorias padrão
 *       404:
 *         description: Categoria não encontrada
 */
router.patch('/:id', categoryController.update)

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Remover categoria
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categoria removida com sucesso
 *       400:
 *         description: Categoria possui transações associadas
 *       403:
 *         description: Não é possível excluir categorias padrão
 *       404:
 *         description: Categoria não encontrada
 */
router.delete('/:id', categoryController.remove)

/**
 * @swagger
 * /api/categories/{id}/subcategories:
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
 *                 maxLength: 50
 *               icone:
 *                 type: string
 *               cor:
 *                 type: string
 *                 pattern: ^#[0-9A-F]{6}$
 *           example:
 *             nome: E-commerce
 *             icone: shopping-cart
 *             cor: "#FF9500"
 *     responses:
 *       200:
 *         description: Subcategoria adicionada com sucesso
 *       400:
 *         description: Subcategoria já existe
 *       403:
 *         description: Não é possível adicionar subcategorias em categorias padrão
 *       404:
 *         description: Categoria não encontrada
 */
router.post('/:id/subcategories', subcategoryValidation, categoryController.addSubcategoria)

/**
 * @swagger
 * /api/categories/{id}/subcategories/{subcategoriaId}:
 *   patch:
 *     summary: Atualizar subcategoria
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: subcategoriaId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
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
 *     responses:
 *       200:
 *         description: Subcategoria atualizada com sucesso
 *       403:
 *         description: Não é possível editar subcategorias de categorias padrão
 *       404:
 *         description: Categoria ou subcategoria não encontrada
 */
router.patch('/:id/subcategories/:subcategoriaId', categoryController.updateSubcategoria)

/**
 * @swagger
 * /api/categories/{id}/subcategories/{subcategoriaId}:
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
 *       - in: path
 *         name: subcategoriaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subcategoria removida com sucesso
 *       400:
 *         description: Subcategoria possui transações associadas
 *       403:
 *         description: Não é possível remover subcategorias de categorias padrão
 *       404:
 *         description: Categoria ou subcategoria não encontrada
 */
router.delete('/:id/subcategories/:subcategoriaId', categoryController.removeSubcategoria)

/**
 * @swagger
 * /api/categories/statistics:
 *   get:
 *     summary: Obter estatísticas das categorias
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [semana, mes, trimestre, ano]
 *           default: mes
 *     responses:
 *       200:
 *         description: Estatísticas detalhadas por categoria
 */
router.get('/statistics/overview', categoryController.getEstatisticas)

/**
 * @swagger
 * /api/categories/order:
 *   patch:
 *     summary: Atualizar ordem das categorias
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
 *               - categorias
 *             properties:
 *               categorias:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     ordem:
 *                       type: number
 *           example:
 *             categorias:
 *               - id: "60f1b2c3d4e5f6789abcdef0"
 *                 ordem: 0
 *               - id: "60f1b2c3d4e5f6789abcdef1"
 *                 ordem: 1
 *     responses:
 *       200:
 *         description: Ordem das categorias atualizada com sucesso
 *       400:
 *         description: Lista de categorias inválida
 */
router.patch('/order/update', categoryController.updateOrdem)

/**
 * @swagger
 * /api/categories/{id}/duplicate:
 *   post:
 *     summary: Duplicar categoria
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
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
 *             type: object
 *             required:
 *               - nome
 *             properties:
 *               nome:
 *                 type: string
 *                 maxLength: 50
 *           example:
 *             nome: Alimentação Trabalho
 *     responses:
 *       201:
 *         description: Categoria duplicada com sucesso
 *       400:
 *         description: Já existe categoria com este nome
 *       404:
 *         description: Categoria não encontrada
 */
router.post('/:id/duplicate', categoryController.duplicar)

/**
 * @swagger
 * /api/categories/search:
 *   get:
 *     summary: Buscar categorias por nome
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Termo de busca
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [receita, despesa, ambos]
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Resultados da busca
 *       400:
 *         description: Termo de busca deve ter pelo menos 2 caracteres
 */
router.get('/search/find', categoryController.buscar)

/**
 * @swagger
 * /api/categories/import/defaults:
 *   post:
 *     summary: Importar categorias padrão
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sobrescrever:
 *                 type: boolean
 *                 default: false
 *                 description: Sobrescrever categorias existentes
 *     responses:
 *       200:
 *         description: Categorias padrão importadas com sucesso
 */
router.post('/import/defaults', categoryController.importarPadrao)

/**
 * @swagger
 * /api/categories/export:
 *   get:
 *     summary: Exportar categorias do usuário
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formato
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *     responses:
 *       200:
 *         description: Categorias exportadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export/data', categoryController.exportar)

module.exports = router