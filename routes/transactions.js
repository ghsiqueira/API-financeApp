const express = require('express')
const router = express.Router()
const { body, query } = require('express-validator')
const auth = require('../middleware/authMiddleware')
const transactionController = require('../controllers/transactionController')

// Middleware de autenticação para todas as rotas
router.use(auth)

// Validações
const transactionValidation = [
  body('tipo')
    .isIn(['receita', 'despesa'])
    .withMessage('Tipo deve ser receita ou despesa'),
  
  body('descricao')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Descrição deve ter entre 1 e 200 caracteres'),
  
  body('valor')
    .isFloat({ min: 0.01 })
    .withMessage('Valor deve ser maior que 0'),
  
  body('categoria')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Categoria é obrigatória'),
  
  body('metodoPagamento')
    .isIn(['dinheiro', 'cartao_debito', 'cartao_credito', 'pix', 'transferencia', 'boleto', 'cheque'])
    .withMessage('Método de pagamento inválido'),
  
  body('data')
    .optional()
    .isISO8601()
    .withMessage('Data inválida'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags devem ser um array'),
  
  body('observacoes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Observações não podem ter mais de 500 caracteres')
]

/**
 * @swagger
 * components:
 *   schemas:
 *     Transaction:
 *       type: object
 *       required:
 *         - tipo
 *         - descricao
 *         - valor
 *         - categoria
 *         - metodoPagamento
 *       properties:
 *         tipo:
 *           type: string
 *           enum: [receita, despesa]
 *         descricao:
 *           type: string
 *           maxLength: 200
 *         valor:
 *           type: number
 *           minimum: 0.01
 *         categoria:
 *           type: string
 *         subcategoria:
 *           type: string
 *         metodoPagamento:
 *           type: string
 *           enum: [dinheiro, cartao_debito, cartao_credito, pix, transferencia, boleto, cheque]
 *         data:
 *           type: string
 *           format: date-time
 *         recorrente:
 *           type: object
 *           properties:
 *             ativo:
 *               type: boolean
 *             tipo:
 *               type: string
 *               enum: [diario, semanal, mensal, anual]
 *             intervalo:
 *               type: number
 *             dataFim:
 *               type: string
 *               format: date-time
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         observacoes:
 *           type: string
 *           maxLength: 500
 */

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Listar transações com filtros e paginação
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [receita, despesa, todos]
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *       - in: query
 *         name: dataInicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dataFim
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: metodoPagamento
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: data
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lista de transações com paginação
 */
router.get('/', transactionController.getAll)

/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     summary: Obter transação por ID
 *     tags: [Transactions]
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
 *         description: Transação encontrada
 *       404:
 *         description: Transação não encontrada
 */
router.get('/:id', transactionController.getById)

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Criar nova transação
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Transaction'
 *           example:
 *             tipo: despesa
 *             descricao: Almoço no restaurante
 *             valor: 25.50
 *             categoria: Alimentação
 *             subcategoria: Restaurantes
 *             metodoPagamento: cartao_debito
 *             data: 2024-01-15T12:30:00Z
 *             tags: [almoço, trabalho]
 *             observacoes: Almoço de negócios
 *     responses:
 *       201:
 *         description: Transação criada com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/', transactionValidation, transactionController.create)

/**
 * @swagger
 * /api/transactions/{id}:
 *   patch:
 *     summary: Atualizar transação
 *     tags: [Transactions]
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
 *             $ref: '#/components/schemas/Transaction'
 *     responses:
 *       200:
 *         description: Transação atualizada com sucesso
 *       404:
 *         description: Transação não encontrada
 */
router.patch('/:id', transactionController.update)

/**
 * @swagger
 * /api/transactions/{id}:
 *   delete:
 *     summary: Remover transação
 *     tags: [Transactions]
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
 *         description: Transação removida com sucesso
 *       404:
 *         description: Transação não encontrada
 */
router.delete('/:id', transactionController.remove)

/**
 * @swagger
 * /api/transactions/bulk/create:
 *   post:
 *     summary: Criar múltiplas transações
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transacoes:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Transaction'
 *     responses:
 *       201:
 *         description: Transações criadas com sucesso
 *       400:
 *         description: Lista de transações inválida
 */
router.post('/bulk/create', transactionController.bulkCreate)

/**
 * @swagger
 * /api/transactions/bulk/update:
 *   patch:
 *     summary: Atualizar múltiplas transações
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *               updates:
 *                 type: object
 *     responses:
 *       200:
 *         description: Transações atualizadas com sucesso
 */
router.patch('/bulk/update', transactionController.bulkUpdate)

/**
 * @swagger
 * /api/transactions/bulk/delete:
 *   delete:
 *     summary: Remover múltiplas transações
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Transações removidas com sucesso
 */
router.delete('/bulk/delete', transactionController.bulkDelete)

/**
 * @swagger
 * /api/transactions/statistics:
 *   get:
 *     summary: Obter estatísticas das transações
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [semana, mes, ano]
 *           default: mes
 *       - in: query
 *         name: ano
 *         schema:
 *           type: integer
 *       - in: query
 *         name: mes
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estatísticas das transações
 */
router.get('/statistics/summary', transactionController.getStatistics)

module.exports = router