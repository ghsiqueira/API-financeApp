require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

// Conexão
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error(err))

// Rotas
app.use('/api/auth', require('./routes/auth'))
app.use('/api/user', require('./routes/user'))
app.use('/api/transactions', require('./routes/transactions'))
app.use('/api/budgets', require('./routes/budgets'))
app.use('/api/goals', require('./routes/goals'))

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
