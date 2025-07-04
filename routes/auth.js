const express = require('express')
const router = express.Router()
const { body } = require('express-validator')
const authController = require('../controllers/authController')

// Validações
const registerValidation = [
  body('nome')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nome deve ter entre 2 e 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Nome deve conter apenas letras'),
  
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('senha')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número')
]

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('senha')
    .notEmpty()
    .withMessage('Senha é obrigatória')
]

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
]

const resetPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('codigo')
    .isLength({ min: 6, max: 6 })
    .withMessage('Código deve ter 6 dígitos')
    .isNumeric()
    .withMessage('Código deve conter apenas números'),
  
  body('novaSenha')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
]

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - nome
 *         - email
 *         - senha
 *       properties:
 *         nome:
 *           type: string
 *           description: Nome completo do usuário
 *         email:
 *           type: string
 *           format: email
 *           description: Email único do usuário
 *         senha:
 *           type: string
 *           minLength: 6
 *           description: Senha do usuário
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               description: JWT token
 *             refreshToken:
 *               type: string
 *               description: Refresh token
 *             user:
 *               $ref: '#/components/schemas/User'
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar novo usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - email
 *               - senha
 *             properties:
 *               nome:
 *                 type: string
 *                 example: João Silva
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao@email.com
 *               senha:
 *                 type: string
 *                 minLength: 6
 *                 example: MinhaSenh@123
 *     responses:
 *       201:
 *         description: Usuário registrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Dados inválidos ou email já existe
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/register', registerValidation, authController.register)

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Fazer login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - senha
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao@email.com
 *               senha:
 *                 type: string
 *                 example: MinhaSenh@123
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Credenciais inválidas
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/login', loginValidation, authController.login)

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicitar código de recuperação de senha
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao@email.com
 *     responses:
 *       200:
 *         description: Código enviado para o email
 *       400:
 *         description: Email inválido
 *       500:
 *         description: Erro ao enviar email
 */
router.post('/forgot-password', forgotPasswordValidation, authController.forgotPassword)

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Redefinir senha com código
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - codigo
 *               - novaSenha
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao@email.com
 *               codigo:
 *                 type: string
 *                 example: "123456"
 *               novaSenha:
 *                 type: string
 *                 minLength: 6
 *                 example: NovaSenh@123
 *     responses:
 *       200:
 *         description: Senha redefinida com sucesso
 *       400:
 *         description: Código inválido ou expirado
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/reset-password', resetPasswordValidation, authController.resetPassword)

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Renovar token de acesso
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *               - userId
 *             properties:
 *               refreshToken:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 *       401:
 *         description: Refresh token inválido
 */
router.post('/refresh-token', authController.refreshToken)

/**
 * @swagger
 * /api/auth/verify-email/{token}:
 *   get:
 *     summary: Verificar email do usuário
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de verificação
 *     responses:
 *       200:
 *         description: Email verificado com sucesso
 *       400:
 *         description: Token inválido ou expirado
 */
router.get('/verify-email/:token', authController.verifyEmail)

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Fazer logout
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 */
router.post('/logout', authController.logout)

module.exports = router