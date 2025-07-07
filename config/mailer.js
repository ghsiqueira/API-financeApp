const nodemailer = require('nodemailer')

// Configuração do transporter de email
const transporter = nodemailer.createTransport({  // ✅ createTransport (sem "er")
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || '465'),
  secure: process.env.MAIL_ENCRYPTION === 'ssl', // true para SSL, false para TLS
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // Para desenvolvimento
  }
})

// Verificar conexão
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Erro na configuração do email:', error.message)
  } else {
    console.log('✅ Servidor de email configurado')
  }
})

module.exports = transporter