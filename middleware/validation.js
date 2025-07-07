const { body } = require('express-validator')

// Validações para autenticação
const registerValidation = [
  body('nome')
    .trim()
    .notEmpty()
    .withMessage('Nome é obrigatório')
    .isLength({ min: 2, max: 50 })
    .withMessage('Nome deve ter entre 2 e 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Nome deve conter apenas letras e espaços'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email é obrigatório')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email muito longo'),

  body('senha')
    .notEmpty()
    .withMessage('Senha é obrigatória')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número')
]

const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email é obrigatório')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),

  body('senha')
    .notEmpty()
    .withMessage('Senha é obrigatória')
]

const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email é obrigatório')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
]

const resetPasswordValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email é obrigatório')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),

  body('code')
    .trim()
    .notEmpty()
    .withMessage('Código é obrigatório')
    .isLength({ min: 6, max: 6 })
    .withMessage('Código deve ter exatamente 6 dígitos')
    .isNumeric()
    .withMessage('Código deve conter apenas números'),

  body('novaSenha')
    .notEmpty()
    .withMessage('Nova senha é obrigatória')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Nova senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número')
]

// Validações para transações
const transactionValidation = [
  body('tipo')
    .notEmpty()
    .withMessage('Tipo é obrigatório')
    .isIn(['receita', 'despesa'])
    .withMessage('Tipo deve ser receita ou despesa'),

  body('descricao')
    .trim()
    .notEmpty()
    .withMessage('Descrição é obrigatória')
    .isLength({ min: 1, max: 200 })
    .withMessage('Descrição deve ter entre 1 e 200 caracteres'),

  body('valor')
    .notEmpty()
    .withMessage('Valor é obrigatório')
    .isFloat({ min: 0.01 })
    .withMessage('Valor deve ser maior que zero'),

  body('categoria')
    .notEmpty()
    .withMessage('Categoria é obrigatória')
    .isMongoId()
    .withMessage('ID da categoria inválido'),

  body('data')
    .optional()
    .isISO8601()
    .withMessage('Data deve estar em formato válido'),

  body('metodoPagamento')
    .optional()
    .isIn(['dinheiro', 'cartao_debito', 'cartao_credito', 'pix', 'transferencia', 'boleto'])
    .withMessage('Método de pagamento inválido'),

  body('observacoes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Observações não podem ter mais de 500 caracteres'),

  body('orcamentoId')
    .optional()
    .isMongoId()
    .withMessage('ID do orçamento inválido'),

  body('recorrente.ativo')
    .optional()
    .isBoolean()
    .withMessage('Campo recorrente.ativo deve ser booleano'),

  body('recorrente.tipo')
    .optional()
    .isIn(['diario', 'semanal', 'mensal', 'anual'])
    .withMessage('Tipo de recorrência inválido'),

  body('recorrente.intervalo')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Intervalo deve ser entre 1 e 365')
]

// Validações para orçamentos
const budgetValidation = [
  body('nome')
    .trim()
    .notEmpty()
    .withMessage('Nome é obrigatório')
    .isLength({ min: 1, max: 100 })
    .withMessage('Nome deve ter entre 1 e 100 caracteres'),

  body('categoria')
    .optional()
    .isMongoId()
    .withMessage('ID da categoria inválido'),

  body('valorLimite')
    .notEmpty()
    .withMessage('Valor limite é obrigatório')
    .isFloat({ min: 0.01 })
    .withMessage('Valor limite deve ser maior que zero'),

  body('periodo.tipo')
    .notEmpty()
    .withMessage('Tipo de período é obrigatório')
    .isIn(['semanal', 'mensal', 'trimestral', 'anual', 'personalizado'])
    .withMessage('Tipo de período inválido'),

  body('periodo.dataInicio')
    .notEmpty()
    .withMessage('Data de início é obrigatória')
    .isISO8601()
    .withMessage('Data de início deve estar em formato válido'),

  body('periodo.dataFim')
    .notEmpty()
    .withMessage('Data de fim é obrigatória')
    .isISO8601()
    .withMessage('Data de fim deve estar em formato válido')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.periodo.dataInicio)) {
        throw new Error('Data de fim deve ser posterior à data de início')
      }
      return true
    }),

  body('alertas.valor')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Valor do alerta deve ser entre 0 e 100'),

  body('alertas.email')
    .optional()
    .isBoolean()
    .withMessage('Campo alertas.email deve ser booleano'),

  body('alertas.push')
    .optional()
    .isBoolean()
    .withMessage('Campo alertas.push deve ser booleano')
]

// Validações para metas
const goalValidation = [
  body('nome')
    .trim()
    .notEmpty()
    .withMessage('Nome é obrigatório')
    .isLength({ min: 1, max: 100 })
    .withMessage('Nome deve ter entre 1 e 100 caracteres'),

  body('descricao')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descrição não pode ter mais de 500 caracteres'),

  body('valorMeta')
    .notEmpty()
    .withMessage('Valor da meta é obrigatório')
    .isFloat({ min: 0.01 })
    .withMessage('Valor da meta deve ser maior que zero'),

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
    .optional()
    .isMongoId()
    .withMessage('ID da categoria inválido'),

  body('prioridade')
    .optional()
    .isIn(['baixa', 'media', 'alta'])
    .withMessage('Prioridade deve ser baixa, media ou alta'),

  body('lembretes.ativo')
    .optional()
    .isBoolean()
    .withMessage('Campo lembretes.ativo deve ser booleano'),

  body('lembretes.frequencia')
    .optional()
    .isIn(['diario', 'semanal', 'mensal'])
    .withMessage('Frequência de lembrete inválida')
]

// Validações para categorias
const categoryValidation = [
  body('nome')
    .trim()
    .notEmpty()
    .withMessage('Nome é obrigatório')
    .isLength({ min: 1, max: 50 })
    .withMessage('Nome deve ter entre 1 e 50 caracteres'),

  body('tipo')
    .notEmpty()
    .withMessage('Tipo é obrigatório')
    .isIn(['receita', 'despesa', 'ambos'])
    .withMessage('Tipo deve ser receita, despesa ou ambos'),

  body('icone')
    .notEmpty()
    .withMessage('Ícone é obrigatório')
    .isLength({ min: 1, max: 50 })
    .withMessage('Ícone deve ter entre 1 e 50 caracteres'),

  body('cor')
    .notEmpty()
    .withMessage('Cor é obrigatória')
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Cor deve estar em formato hexadecimal (#RRGGBB)')
]

// Validações para perfil do usuário
const updateProfileValidation = [
  body('nome')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nome deve ter entre 2 e 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Nome deve conter apenas letras e espaços'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email muito longo'),

  body('configuracoes.tema')
    .optional()
    .isIn(['claro', 'escuro', 'sistema'])
    .withMessage('Tema deve ser claro, escuro ou sistema'),

  body('configuracoes.moeda')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Código da moeda deve ter 3 caracteres'),

  body('configuracoes.notificacoes.email')
    .optional()
    .isBoolean()
    .withMessage('Configuração de email deve ser booleana'),

  body('configuracoes.notificacoes.push')
    .optional()
    .isBoolean()
    .withMessage('Configuração de push deve ser booleana'),

  body('configuracoes.notificacoes.orcamento')
    .optional()
    .isBoolean()
    .withMessage('Configuração de orçamento deve ser booleana'),

  body('configuracoes.notificacoes.metas')
    .optional()
    .isBoolean()
    .withMessage('Configuração de metas deve ser booleana')
]

const changePasswordValidation = [
  body('senhaAtual')
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),

  body('novaSenha')
    .notEmpty()
    .withMessage('Nova senha é obrigatória')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Nova senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número')
    .custom((value, { req }) => {
      if (value === req.body.senhaAtual) {
        throw new Error('Nova senha deve ser diferente da senha atual')
      }
      return true
    })
]

module.exports = {
  // Auth validations
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  
  // Transaction validations
  transactionValidation,
  
  // Budget validations
  budgetValidation,
  
  // Goal validations
  goalValidation,
  
  // Category validations
  categoryValidation,
  
  // User validations
  updateProfileValidation,
  changePasswordValidation
}