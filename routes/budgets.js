const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')
const budgetController = require('../controllers/budgetController')

router.get('/', auth, budgetController.getAll)
router.post('/', auth, budgetController.create)
router.patch('/:id', auth, budgetController.update)
router.delete('/:id', auth, budgetController.remove)

module.exports = router
