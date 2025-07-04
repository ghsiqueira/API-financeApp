const express = require('express')
const router = express.Router()
const { body } = require('express-validator')
const auth = require('../middleware/authMiddleware')
const userController = require('../controllers/userController')

// Middleware de autenticação para todas as rotas
router.use(auth)

// Validações
const updateUserValidation = [
  body('nome')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nome deve ter entre 2 e 50 caracteres'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('senha')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres')
]

const changePasswordValidation = [
  body('senhaAtual')
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  
  body('novaSenha')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Nova senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número')
]

const deleteAccountValidation = [
  body('senha')
    .notEmpty()
    .withMessage('Senha é obrigatória'),
  
  body('confirmacao')
    .equals('EXCLUIR CONTA')
    .withMessage('Digite "EXCLUIR CONTA" para confirmar')
]

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         nome:
 *           type: string
 *         email:
 *           type: string
 *         emailVerificado:
 *           type: boolean
 *         configuracoes:
 *           type: object
 *           properties:
 *             tema:
 *               type: string
 *               enum: [claro, escuro, sistema]
 *             moeda:
 *               type: string
 *             notificacoes:
 *               type: object
 *               properties:
 *                 email:
 *                   type: boolean
 *                 push:
 *                   type: boolean
 *                 orcamento:
 *                   type: boolean
 *                 metas:
 *                   type: boolean
 */

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Obter perfil do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil do usuário com estatísticas
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
 *                     user:
 *                       $ref: '#/components/schemas/UserProfile'
 *                     estatisticas:
 *                       type: object
 *                       properties:
 *                         totalTransacoes:
 *                           type: number
 *                         totalOrcamentos:
 *                           type: number
 *                         totalMetas:
 *                           type: number
 *                         saldoMensal:
 *                           type: number
 *       404:
 *         description: Usuário não encontrado
 */
router.get('/profile', userController.getMe)

/**
 * @swagger
 * /api/user/profile:
 *   patch:
 *     summary: Atualizar perfil do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *               senha:
 *                 type: string
 *                 minLength: 6
 *               configuracoes:
 *                 type: object
 *                 properties:
 *                   tema:
 *                     type: string
 *                     enum: [claro, escuro, sistema]
 *                   moeda:
 *                     type: string
 *                   notificacoes:
 *                     type: object
 *           example:
 *             nome: João Silva
 *             email: joao.novo@email.com
 *             configuracoes:
 *               tema: escuro
 *               moeda: BRL
 *               notificacoes:
 *                 email: true
 *                 push: false
 *     responses:
 *       200:
 *         description: Perfil atualizado com sucesso
 *       400:
 *         description: Dados inválidos ou email já em uso
 */
router.patch('/profile', updateUserValidation, userController.updateMe)

/**
 * @swagger
 * /api/user/settings:
 *   patch:
 *     summary: Atualizar configurações do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tema:
 *                 type: string
 *                 enum: [claro, escuro, sistema]
 *               moeda:
 *                 type: string
 *               notificacoes:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                   push:
 *                     type: boolean
 *                   orcamento:
 *                     type: boolean
 *                   metas:
 *                     type: boolean
 *               privacidade:
 *                 type: object
 *                 properties:
 *                   perfilPublico:
 *                     type: boolean
 *                   compartilharDados:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Configurações atualizadas com sucesso
 */
router.patch('/settings', userController.updateConfiguracoes)

/**
 * @swagger
 * /api/user/change-password:
 *   post:
 *     summary: Alterar senha do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - senhaAtual
 *               - novaSenha
 *             properties:
 *               senhaAtual:
 *                 type: string
 *               novaSenha:
 *                 type: string
 *                 minLength: 6
 *             example:
 *               senhaAtual: MinhaSenh@123
 *               novaSenha: NovaSenh@456
 *     responses:
 *       200:
 *         description: Senha alterada com sucesso
 *       400:
 *         description: Senha atual incorreta ou nova senha inválida
 */
router.post('/change-password', changePasswordValidation, userController.changePassword)

/**
 * @swagger
 * /api/user/delete-account:
 *   delete:
 *     summary: Excluir conta do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - senha
 *               - confirmacao
 *             properties:
 *               senha:
 *                 type: string
 *               confirmacao:
 *                 type: string
 *                 enum: ["EXCLUIR CONTA"]
 *             example:
 *               senha: MinhaSenh@123
 *               confirmacao: EXCLUIR CONTA
 *     responses:
 *       200:
 *         description: Conta excluída com sucesso
 *       400:
 *         description: Senha incorreta ou confirmação inválida
 */
router.delete('/delete-account', deleteAccountValidation, userController.deleteAccount)

/**
 * @swagger
 * /api/user/statistics:
 *   get:
 *     summary: Obter estatísticas gerais do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [mes, trimestre, ano, tudo]
 *           default: ano
 *     responses:
 *       200:
 *         description: Estatísticas detalhadas do usuário
 */
router.get('/statistics/overview', userController.getEstatisticasGerais)

/**
 * @swagger
 * /api/user/export:
 *   get:
 *     summary: Exportar dados do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formato
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *       - in: query
 *         name: incluir
 *         schema:
 *           type: string
 *           enum: [todos, transacoes, orcamentos, metas, perfil]
 *           default: todos
 *     responses:
 *       200:
 *         description: Dados exportados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export/data', userController.exportData)

/**
 * @swagger
 * /api/user/import:
 *   post:
 *     summary: Importar dados do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dados
 *             properties:
 *               dados:
 *                 type: object
 *                 properties:
 *                   transacoes:
 *                     type: array
 *                   orcamentos:
 *                     type: array
 *                   metas:
 *                     type: array
 *               sobrescrever:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Dados importados com sucesso
 *       400:
 *         description: Dados inválidos para importação
 */
router.post('/import/data', userController.importData)

module.exports = router