// services/emailService.js
const nodemailer = require('nodemailer')

class EmailService {
  constructor() {
    this.transporter = null
    this.initialize()
  }

  initialize() {
    try {
      // Configurar transporter com suas configurações
      this.transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 465,
        secure: true, // SSL
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      })

      console.log('✅ Serviço de email configurado')
    } catch (error) {
      console.error('❌ Erro ao configurar email:', error)
    }
  }

  async sendEmail({ to, subject, html, text }) {
    if (!this.transporter) {
      console.warn('⚠️ Transporter de email não configurado')
      return false
    }

    try {
      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || 'Finance App',
          address: process.env.EMAIL_FROM_ADDRESS
        },
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, '') // Fallback text
      }

      const result = await this.transporter.sendMail(mailOptions)
      console.log(`📧 Email enviado para ${to}: ${subject}`)
      return result
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error)
      return false
    }
  }

  async testConnection() {
    if (!this.transporter) {
      return false
    }

    try {
      await this.transporter.verify()
      console.log('✅ Conexão de email verificada')
      return true
    } catch (error) {
      console.error('❌ Erro na verificação de email:', error)
      return false
    }
  }
}

// Exportar instância única
const emailService = new EmailService()

module.exports = {
  sendEmail: (options) => emailService.sendEmail(options),
  testConnection: () => emailService.testConnection()
}