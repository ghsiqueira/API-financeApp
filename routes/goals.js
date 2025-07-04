const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')
const goalController = require('../controllers/goalController')

router.get('/', auth, goalController.getAll)
router.post('/', auth, goalController.create)
router.patch('/:id', auth, goalController.update)
router.delete('/:id', auth, goalController.remove)

module.exports = router
