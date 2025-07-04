const Budget = require('../models/Budget')

exports.getAll = async (req, res) => {
  const items = await Budget.find({ userId: req.userId })
  res.json(items)
}

exports.create = async (req, res) => {
  const data = { ...req.body, userId: req.userId }
  const created = await Budget.create(data)
  res.status(201).json(created)
}

exports.update = async (req, res) => {
  const { id } = req.params
  const updated = await Budget.findOneAndUpdate(
    { _id: id, userId: req.userId },
    req.body,
    { new: true }
  )
  res.json(updated)
}

exports.remove = async (req, res) => {
  const { id } = req.params
  await Budget.deleteOne({ _id: id, userId: req.userId })
  res.json({ message: 'Removido com sucesso' })
}
