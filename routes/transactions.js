const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')
const transactionController = require('../controllers/transactionController')

router.get('/', auth, transactionController.getAll)
router.post('/', auth, transactionController.create)
router.patch('/:id', auth, transactionController.update)
router.delete('/:id', auth, transactionController.remove)

module.exports = router
