const express = require('express')
const router = express.Router()
const { body } = require('express-validator')
const auth = require('../middleware/authMiddleware')
const goalController = require('../controllers/goalController')

// Middleware de autenticação para todas as rotas
router.use(auth)

// Validações
const goalValidation = [
  body('titulo')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Título deve ter entre 1 e 100 caracteres'),
  
  body('valorAlvo')
    .isFloat({ min: 0.01 })
    .withMessage('Valor alvo deve ser maior que 0'),
  
  body('dataLimite')
    .isISO8601()
    .withMessage('Data limite inválida')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Data limite deve ser futura')
      }
      return true
    }),
  
  body('categoria')
    .isIn(['emergencia', 'viagem', 'casa', 'educacao', 'aposentadoria', 'investimento', 'saude', 'outro'])
    .withMessage('Categoria inválida'),
  
  body('prioridade')
    .optional()
    .isIn(['baixa', 'media', 'alta'])
    .withMessage('Prioridade inválida'),
  
  body('descricao')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Descrição não pode ter mais de 500 caracteres')
]

const contribuicaoValidation = [
  body('valor')
    .isFloat({ min: 0.01 })
    .withMessage('Valor deve ser maior que 0'),
  
  body('nota')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Nota não pode ter mais de 200 caracteres'),
  
  body('tipo')
    .optional()
    .isIn(['contribuicao', 'retirada', 'ajuste'])
    .withMessage('Tipo inválido')
]

/**
 * @swagger
 * components:
 *   schemas:
 *     Goal:
 *       type: object
 *       required:
 *         - titulo
 *         - valorAlvo
 *         - dataLimite
 *         - categoria
 *       properties:
 *         titulo:
 *           type: string
 *           maxLength: 100
 *         descricao:
 *           type: string
 *           maxLength: 500
 *         valorAlvo:
 *           type: number
 *           minimum: 0.01
 *         valorAtual:
 *           type: number
 *           minimum: 0
 *         dataInicio:
 *           type: string
 *           format: date-time
 *         dataLimite:
 *           type: string
 *           format: date-time
 *         categoria:
 *           type: string
 *           enum: [emergencia, viagem, casa, educacao, aposentadoria, investimento, saude, outro]
 *         prioridade:
 *           type: string
 *           enum: [baixa, media, alta]
 *         contribuicoes:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               valor:
 *                 type: number
 *               nota:
 *                 type: string
 *               data:
 *                 type: string
 *                 format: date-time
 *               tipo:
 *                 type: string
 *                 enum: [contribuicao, retirada, ajuste]
 *         configuracoes:
 *           type: object
 *           properties:
 *             lembretes:
 *               type: object
 *               properties:
 *                 ativo:
 *                   type: boolean
 *                 frequencia:
 *                   type: string
 *                   enum: [diario, semanal, mensal]
 *         status:
 *           type: string
 *           enum: [ativa, pausada, concluida, cancelada]
 *         cor:
 *           type: string
 *           pattern: ^#[0-9A-F]{6}$
 *         icone:
 *           type: string
 */

/**
 * @swagger
 * /api/goals:
 *   get:
 *     summary: Listar metas com filtros e paginação
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [mes, trimestre, ano, todas]
 *           default: todas
 *     responses:
 *       200:
 *         description: Resumo geral das metas
 */
router.get('/summary/overview', goalController.getResumo)

/**
 * @swagger
 * /api/goals/{id}/contribution:
 *   post:
 *     summary: Adicionar contribuição à meta
 *     tags: [Goals]
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
 *               - valor
 *             properties:
 *               valor:
 *                 type: number
 *                 minimum: 0.01
 *               nota:
 *                 type: string
 *                 maxLength: 200
 *               tipo:
 *                 type: string
 *                 enum: [contribuicao, retirada, ajuste]
 *                 default: contribuicao
 *           example:
 *             valor: 500.00
 *             nota: Contribuição mensal de janeiro
 *             tipo: contribuicao
 *     responses:
 *       200:
 *         description: Contribuição adicionada com sucesso
 *       400:
 *         description: Dados inválidos ou meta inativa
 *       404:
 *         description: Meta não encontrada
 */
router.post('/:id/contribution', contribuicaoValidation, goalController.addContribuicao)

/**
 * @swagger
 * /api/goals/{id}/pause:
 *   post:
 *     summary: Pausar meta
 *     tags: [Goals]
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
 *         description: Meta pausada com sucesso
 *       404:
 *         description: Meta não encontrada
 */
router.post('/:id/pause', goalController.pausar)

/**
 * @swagger
 * /api/goals/{id}/reactivate:
 *   post:
 *     summary: Reativar meta pausada
 *     tags: [Goals]
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
 *         description: Meta reativada com sucesso
 *       404:
 *         description: Meta não encontrada
 */
router.post('/:id/reactivate', goalController.reativar)

/**
 * @swagger
 * /api/goals/{id}/complete:
 *   post:
 *     summary: Marcar meta como concluída
 *     tags: [Goals]
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
 *         description: Meta concluída com sucesso
 *       400:
 *         description: Meta não pode ser concluída (valor alvo não atingido)
 *       404:
 *         description: Meta não encontrada
 */
router.post('/:id/complete', goalController.concluir)

/**
 * @swagger
 * /api/goals/report:
 *   get:
 *     summary: Obter relatório detalhado das metas
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: categoria
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Relatório detalhado das metas
 */
router.get('/report/detailed', goalController.getRelatorio)

module.exports = router