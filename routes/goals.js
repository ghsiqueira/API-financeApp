const express = require('express')
const router = express.Router()
const { body } = require('express-validator')
const auth = require('../middleware/authMiddleware')
const goalController = require('../controllers/goalController')

// Middleware de autenticação para todas as rotas
router.use(auth)

// Validações completas
const goalValidation = [
  body('titulo')
    .trim()
    .notEmpty()
    .withMessage('Título é obrigatório')
    .isLength({ min: 1, max: 100 })
    .withMessage('Título deve ter entre 1 e 100 caracteres'),
  
  body('valorAlvo')
    .notEmpty()
    .withMessage('Valor alvo é obrigatório')
    .isFloat({ min: 0.01 })
    .withMessage('Valor alvo deve ser maior que 0'),
  
  body('dataLimite')
    .notEmpty()
    .withMessage('Data limite é obrigatória')
    .isISO8601()
    .withMessage('Data limite deve estar em formato válido')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Data limite deve ser futura')
      }
      return true
    }),
  
  body('categoria')
    .notEmpty()
    .withMessage('Categoria é obrigatória')
    .isIn(['emergencia', 'viagem', 'casa', 'educacao', 'aposentadoria', 'investimento', 'saude', 'outro'])
    .withMessage('Categoria deve ser: emergencia, viagem, casa, educacao, aposentadoria, investimento, saude ou outro'),
  
  body('prioridade')
    .optional()
    .isIn(['baixa', 'media', 'alta'])
    .withMessage('Prioridade deve ser: baixa, media ou alta'),
  
  body('descricao')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descrição não pode ter mais de 500 caracteres'),

  body('cor')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Cor deve estar em formato hexadecimal (#RRGGBB)'),

  body('icone')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Ícone deve ter entre 1 e 50 caracteres')
]

const goalUpdateValidation = [
  body('titulo')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Título deve ter entre 1 e 100 caracteres'),
  
  body('valorAlvo')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Valor alvo deve ser maior que 0'),
  
  body('dataLimite')
    .optional()
    .isISO8601()
    .withMessage('Data limite deve estar em formato válido')
    .custom((value) => {
      if (value && new Date(value) <= new Date()) {
        throw new Error('Data limite deve ser futura')
      }
      return true
    }),
  
  body('categoria')
    .optional()
    .isIn(['emergencia', 'viagem', 'casa', 'educacao', 'aposentadoria', 'investimento', 'saude', 'outro'])
    .withMessage('Categoria inválida'),
  
  body('prioridade')
    .optional()
    .isIn(['baixa', 'media', 'alta'])
    .withMessage('Prioridade inválida'),
  
  body('descricao')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descrição não pode ter mais de 500 caracteres'),

  body('status')
    .optional()
    .isIn(['ativa', 'pausada', 'concluida', 'cancelada'])
    .withMessage('Status deve ser: ativa, pausada, concluida ou cancelada')
]

const contribuicaoValidation = [
  body('valor')
    .notEmpty()
    .withMessage('Valor é obrigatório')
    .isFloat({ min: 0.01 })
    .withMessage('Valor deve ser maior que 0'),
  
  body('nota')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Nota não pode ter mais de 200 caracteres'),
  
  body('tipo')
    .optional()
    .isIn(['contribuicao', 'retirada', 'ajuste'])
    .withMessage('Tipo deve ser: contribuicao, retirada ou ajuste'),

  body('data')
    .optional()
    .isISO8601()
    .withMessage('Data deve estar em formato válido')
]

const statusValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status é obrigatório')
    .isIn(['ativa', 'pausada', 'concluida', 'cancelada'])
    .withMessage('Status deve ser: ativa, pausada, concluida ou cancelada')
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
 *         _id:
 *           type: string
 *           description: ID único da meta
 *         titulo:
 *           type: string
 *           maxLength: 100
 *           description: Título da meta
 *         descricao:
 *           type: string
 *           maxLength: 500
 *           description: Descrição detalhada da meta
 *         valorAlvo:
 *           type: number
 *           minimum: 0.01
 *           description: Valor que se deseja atingir
 *         valorAtual:
 *           type: number
 *           minimum: 0
 *           description: Valor atual já alcançado
 *         dataInicio:
 *           type: string
 *           format: date-time
 *           description: Data de início da meta
 *         dataLimite:
 *           type: string
 *           format: date-time
 *           description: Data limite para atingir a meta
 *         categoria:
 *           type: string
 *           enum: [emergencia, viagem, casa, educacao, aposentadoria, investimento, saude, outro]
 *           description: Categoria da meta
 *         prioridade:
 *           type: string
 *           enum: [baixa, media, alta]
 *           default: media
 *           description: Prioridade da meta
 *         status:
 *           type: string
 *           enum: [ativa, pausada, concluida, cancelada]
 *           default: ativa
 *           description: Status atual da meta
 *         cor:
 *           type: string
 *           pattern: ^#[0-9A-F]{6}$
 *           description: Cor da meta em hexadecimal
 *         icone:
 *           type: string
 *           description: Ícone da meta
 *         contribuicoes:
 *           type: array
 *           description: Lista de contribuições para a meta
 *           items:
 *             type: object
 *             properties:
 *               valor:
 *                 type: number
 *                 description: Valor da contribuição
 *               nota:
 *                 type: string
 *                 description: Nota sobre a contribuição
 *               data:
 *                 type: string
 *                 format: date-time
 *                 description: Data da contribuição
 *               tipo:
 *                 type: string
 *                 enum: [contribuicao, retirada, ajuste]
 *                 description: Tipo da movimentação
 *         configuracoes:
 *           type: object
 *           description: Configurações da meta
 *           properties:
 *             lembretes:
 *               type: object
 *               properties:
 *                 ativo:
 *                   type: boolean
 *                   description: Se lembretes estão ativos
 *                 frequencia:
 *                   type: string
 *                   enum: [diario, semanal, mensal]
 *                   description: Frequência dos lembretes
 *         criadoEm:
 *           type: string
 *           format: date-time
 *           description: Data de criação
 *         atualizadoEm:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização
 *
 *     GoalSummary:
 *       type: object
 *       properties:
 *         total:
 *           type: number
 *           description: Total de metas
 *         ativas:
 *           type: number
 *           description: Metas ativas
 *         concluidas:
 *           type: number
 *           description: Metas concluídas
 *         pausadas:
 *           type: number
 *           description: Metas pausadas
 *         valorTotalAlvo:
 *           type: number
 *           description: Valor total de todas as metas
 *         valorTotalAtual:
 *           type: number
 *           description: Valor total já alcançado
 *         progressoMedio:
 *           type: number
 *           description: Progresso médio em porcentagem
 */

/**
 * @swagger
 * tags:
 *   name: Goals
 *   description: Gestão de metas financeiras
 */

/**
 * @swagger
 * /api/goals:
 *   get:
 *     summary: Listar todas as metas do usuário
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ativa, pausada, concluida, cancelada]
 *         description: Filtrar por status
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *           enum: [emergencia, viagem, casa, educacao, aposentadoria, investimento, saude, outro]
 *         description: Filtrar por categoria
 *       - in: query
 *         name: prioridade
 *         schema:
 *           type: string
 *           enum: [baixa, media, alta]
 *         description: Filtrar por prioridade
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [mes, trimestre, ano]
 *         description: Filtrar por período de criação
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por título ou descrição
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Página para paginação
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Limite de itens por página
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [dataLimite, titulo, valorAlvo, valorAtual, status, prioridade]
 *           default: dataLimite
 *         description: Campo para ordenação
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista de metas obtida com sucesso
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
 *                     $ref: '#/components/schemas/Goal'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: number
 *                     pages:
 *                       type: number
 *                     total:
 *                       type: number
 *       401:
 *         description: Não autorizado
 */
router.get('/', goalController.getAll)

/**
 * @swagger
 * /api/goals/summary/overview:
 *   get:
 *     summary: Obter resumo geral das metas
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
 *         description: Período para calcular estatísticas
 *     responses:
 *       200:
 *         description: Resumo obtido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/GoalSummary'
 */
router.get('/summary/overview', goalController.getResumo)

/**
 * @swagger
 * /api/goals/stats/overview:
 *   get:
 *     summary: Obter estatísticas das metas
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [semana, mes, trimestre, ano]
 *           default: mes
 *         description: Período para estatísticas
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *         description: Filtrar por categoria específica
 *     responses:
 *       200:
 *         description: Estatísticas obtidas com sucesso
 */
router.get('/stats/overview', goalController.getStats)

/**
 * @swagger
 * /api/goals/report/detailed:
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
 *         description: Data de início do período
 *       - in: query
 *         name: dataFim
 *         schema:
 *           type: string
 *           format: date
 *         description: Data de fim do período
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *         description: Filtrar por categoria
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ativa, pausada, concluida, cancelada]
 *         description: Filtrar por status
 *       - in: query
 *         name: formato
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Formato do relatório
 *     responses:
 *       200:
 *         description: Relatório gerado com sucesso
 */
router.get('/report/detailed', goalController.getRelatorio)

/**
 * @swagger
 * /api/goals/{id}:
 *   get:
 *     summary: Obter meta específica por ID
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da meta
 *     responses:
 *       200:
 *         description: Meta encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Goal'
 *       404:
 *         description: Meta não encontrada
 */
router.get('/:id', goalController.getById)

/**
 * @swagger
 * /api/goals:
 *   post:
 *     summary: Criar nova meta
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - valorAlvo
 *               - dataLimite
 *               - categoria
 *             properties:
 *               titulo:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Viagem para Europa"
 *               descricao:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Economizar para uma viagem de 15 dias pela Europa"
 *               valorAlvo:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 15000.00
 *               dataLimite:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-12-31T23:59:59.000Z"
 *               categoria:
 *                 type: string
 *                 enum: [emergencia, viagem, casa, educacao, aposentadoria, investimento, saude, outro]
 *                 example: "viagem"
 *               prioridade:
 *                 type: string
 *                 enum: [baixa, media, alta]
 *                 example: "alta"
 *               cor:
 *                 type: string
 *                 pattern: ^#[0-9A-F]{6}$
 *                 example: "#FF6B6B"
 *               icone:
 *                 type: string
 *                 example: "airplane"
 *               configuracoes:
 *                 type: object
 *                 properties:
 *                   lembretes:
 *                     type: object
 *                     properties:
 *                       ativo:
 *                         type: boolean
 *                         example: true
 *                       frequencia:
 *                         type: string
 *                         enum: [diario, semanal, mensal]
 *                         example: "mensal"
 *     responses:
 *       201:
 *         description: Meta criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Goal'
 *       400:
 *         description: Dados inválidos
 */
router.post('/', goalValidation, goalController.create)

/**
 * @swagger
 * /api/goals/{id}:
 *   put:
 *     summary: Atualizar meta existente
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da meta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               titulo:
 *                 type: string
 *                 maxLength: 100
 *               descricao:
 *                 type: string
 *                 maxLength: 500
 *               valorAlvo:
 *                 type: number
 *                 minimum: 0.01
 *               dataLimite:
 *                 type: string
 *                 format: date-time
 *               categoria:
 *                 type: string
 *                 enum: [emergencia, viagem, casa, educacao, aposentadoria, investimento, saude, outro]
 *               prioridade:
 *                 type: string
 *                 enum: [baixa, media, alta]
 *               cor:
 *                 type: string
 *                 pattern: ^#[0-9A-F]{6}$
 *               icone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Meta atualizada com sucesso
 *       404:
 *         description: Meta não encontrada
 */
router.put('/:id', goalUpdateValidation, goalController.update)

/**
 * @swagger
 * /api/goals/{id}:
 *   delete:
 *     summary: Excluir meta
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da meta
 *     responses:
 *       200:
 *         description: Meta excluída com sucesso
 *       404:
 *         description: Meta não encontrada
 */
router.delete('/:id', goalController.delete)

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
 *         description: ID da meta
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
 *                 example: 500.00
 *               nota:
 *                 type: string
 *                 maxLength: 200
 *                 example: "Contribuição mensal de janeiro"
 *               tipo:
 *                 type: string
 *                 enum: [contribuicao, retirada, ajuste]
 *                 default: contribuicao
 *                 example: "contribuicao"
 *               data:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-01-15T10:30:00.000Z"
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
 * /api/goals/{id}/contribution/{contributionId}:
 *   delete:
 *     summary: Remover contribuição específica
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da meta
 *       - in: path
 *         name: contributionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da contribuição
 *     responses:
 *       200:
 *         description: Contribuição removida com sucesso
 *       404:
 *         description: Meta ou contribuição não encontrada
 */
router.delete('/:id/contribution/:contributionId', goalController.removeContribuicao)

/**
 * @swagger
 * /api/goals/{id}/status:
 *   post:
 *     summary: Atualizar status da meta
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da meta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ativa, pausada, concluida, cancelada]
 *                 example: "pausada"
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *       404:
 *         description: Meta não encontrada
 */
router.post('/:id/status', statusValidation, goalController.updateStatus)

/**
 * @swagger
 * /api/goals/{id}/pause:
 *   post:
 *     summary: Pausar meta ativa
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da meta
 *     responses:
 *       200:
 *         description: Meta pausada com sucesso
 *       404:
 *         description: Meta não encontrada ou não pode ser pausada
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
 *         description: ID da meta
 *     responses:
 *       200:
 *         description: Meta reativada com sucesso
 *       404:
 *         description: Meta não encontrada ou não está pausada
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
 *         description: ID da meta
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               forcar:
 *                 type: boolean
 *                 description: Forçar conclusão mesmo sem atingir valor alvo
 *                 example: false
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
 * /api/goals/{id}/duplicate:
 *   post:
 *     summary: Duplicar meta existente
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da meta a ser duplicada
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sufixo:
 *                 type: string
 *                 default: " (Cópia)"
 *                 example: " - 2025"
 *                 description: Sufixo a ser adicionado ao título
 *     responses:
 *       201:
 *         description: Meta duplicada com sucesso
 *       404:
 *         description: Meta não encontrada
 */
router.post('/:id/duplicate', goalController.duplicate)

module.exports = router