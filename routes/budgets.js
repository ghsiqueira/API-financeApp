const express = require('express')
const router = express.Router()
const { body } = require('express-validator')
const auth = require('../middleware/authMiddleware')
const budgetController = require('../controllers/budgetController')

// Middleware de autenticação para todas as rotas
router.use(auth)

// Validações
const budgetValidation = [
  body('nome')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Nome deve ter entre 1 e 100 caracteres'),
  
  body('categoria')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Categoria é obrigatória'),
  
  body('valorLimite')
    .isFloat({ min: 0 })
    .withMessage('Valor limite deve ser positivo'),
  
  body('periodo')
    .isIn(['semanal', 'mensal', 'trimestral', 'semestral', 'anual', 'personalizado'])
    .withMessage('Período inválido'),
  
  body('dataInicio')
    .isISO8601()
    .withMessage('Data de início inválida'),
  
  body('dataFim')
    .isISO8601()
    .withMessage('Data de fim inválida'),
  
  body('renovacaoAutomatica')
    .optional()
    .isBoolean()
    .withMessage('Renovação automática deve ser true ou false')
]

/**
 * @swagger
 * components:
 *   schemas:
 *     Budget:
 *       type: object
 *       required:
 *         - nome
 *         - categoria
 *         - valorLimite
 *         - periodo
 *         - dataInicio
 *         - dataFim
 *       properties:
 *         nome:
 *           type: string
 *           maxLength: 100
 *         categoria:
 *           type: string
 *         valorLimite:
 *           type: number
 *           minimum: 0
 *         valorGasto:
 *           type: number
 *           minimum: 0
 *         periodo:
 *           type: string
 *           enum: [semanal, mensal, trimestral, semestral, anual, personalizado]
 *         dataInicio:
 *           type: string
 *           format: date-time
 *         dataFim:
 *           type: string
 *           format: date-time
 *         renovacaoAutomatica:
 *           type: boolean
 *         configuracoes:
 *           type: object
 *           properties:
 *             alertas:
 *               type: object
 *               properties:
 *                 ativo:
 *                   type: boolean
 *                 porcentagens:
 *                   type: array
 *                   items:
 *                     type: number
 *         status:
 *           type: string
 *           enum: [ativo, pausado, finalizado, excedido]
 *         cor:
 *           type: string
 *           pattern: ^#[0-9A-F]{6}$
 *         icone:
 *           type: string
 */

/**
 * @swagger
 * /api/budgets:
 *   get:
 *     summary: Listar orçamentos com filtros e paginação
 *     tags: [Budgets]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ativo, pausado, finalizado, excedido]
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *       - in: query
 *         name: ativo
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: dataInicio
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lista de orçamentos com estatísticas
 */
router.get('/', budgetController.getAll)

/**
 * @swagger
 * /api/budgets/{id}:
 *   get:
 *     summary: Obter orçamento por ID com detalhes
 *     tags: [Budgets]
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
 *         description: Orçamento com detalhes e transações relacionadas
 *       404:
 *         description: Orçamento não encontrado
 */
router.get('/:id', budgetController.getById)

/**
 * @swagger
 * /api/budgets:
 *   post:
 *     summary: Criar novo orçamento
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Budget'
 *           example:
 *             nome: Orçamento Alimentação Dezembro
 *             categoria: Alimentação
 *             valorLimite: 800.00
 *             periodo: mensal
 *             dataInicio: 2024-12-01T00:00:00Z
 *             dataFim: 2024-12-31T23:59:59Z
 *             renovacaoAutomatica: true
 *             configuracoes:
 *               alertas:
 *                 ativo: true
 *                 porcentagens: [50, 80, 100]
 *             cor: "#FF3B30"
 *             icone: "utensils"
 *     responses:
 *       201:
 *         description: Orçamento criado com sucesso
 *       400:
 *         description: Dados inválidos ou conflito com orçamento existente
 */
router.post('/', budgetValidation, budgetController.create)

/**
 * @swagger
 * /api/budgets/{id}:
 *   patch:
 *     summary: Atualizar orçamento
 *     tags: [Budgets]
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
 *             $ref: '#/components/schemas/Budget'
 *     responses:
 *       200:
 *         description: Orçamento atualizado com sucesso
 *       404:
 *         description: Orçamento não encontrado
 */
router.patch('/:id', budgetController.update)

/**
 * @swagger
 * /api/budgets/{id}:
 *   delete:
 *     summary: Remover orçamento
 *     tags: [Budgets]
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
 *         description: Orçamento removido com sucesso
 *       404:
 *         description: Orçamento não encontrado
 */
router.delete('/:id', budgetController.remove)

/**
 * @swagger
 * /api/budgets/{id}/renew:
 *   post:
 *     summary: Renovar orçamento para próximo período
 *     tags: [Budgets]
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
 *         description: Orçamento renovado com sucesso
 *       400:
 *         description: Orçamento não configurado para renovação automática
 *       404:
 *         description: Orçamento não encontrado
 */
router.post('/:id/renew', budgetController.renovar)

/**
 * @swagger
 * /api/budgets/{id}/pause:
 *   post:
 *     summary: Pausar orçamento
 *     tags: [Budgets]
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
 *         description: Orçamento pausado com sucesso
 *       404:
 *         description: Orçamento não encontrado
 */
router.post('/:id/pause', budgetController.pausar)

/**
 * @swagger
 * /api/budgets/{id}/reactivate:
 *   post:
 *     summary: Reativar orçamento pausado
 *     tags: [Budgets]
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
 *         description: Orçamento reativado com sucesso
 *       404:
 *         description: Orçamento não encontrado
 */
router.post('/:id/reactivate', budgetController.reativar)

/**
 * @swagger
 * /api/budgets/summary:
 *   get:
 *     summary: Obter resumo geral dos orçamentos
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumo com estatísticas e alertas dos orçamentos
 */
router.get('/summary/overview', budgetController.getResumo)

/**
 * @swagger
 * /api/budgets/{id}/history:
 *   get:
 *     summary: Obter histórico de alterações do orçamento
 *     tags: [Budgets]
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
 *         description: Histórico de alterações do orçamento
 *       404:
 *         description: Orçamento não encontrado
 */
router.get('/:id/history', budgetController.getHistorico)

/**
 * @swagger
 * /api/budgets/process/expirations:
 *   post:
 *     summary: Processar orçamentos vencidos (renovar ou finalizar)
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vencimentos processados com sucesso
 */
router.post('/process/expirations', budgetController.processarVencimentos)

module.exports = router