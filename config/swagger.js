const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finance App API',
      version: '1.0.0',
      description: 'API completa para aplicativo de gestão financeira',
      contact: {
        name: 'API Support',
        email: 'support@financeapp.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.financeapp.com' 
          : `http://localhost:${process.env.PORT || 5000}`,
        description: process.env.NODE_ENV === 'production' 
          ? 'Production server' 
          : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./routes/*.js', './models/*.js'] // Caminhos para os arquivos que contêm anotações do Swagger
}

const specs = swaggerJsdoc(options)

const swaggerConfig = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
    .swagger-ui .info .title { color: #1a1a2e }
  `,
  customSiteTitle: 'Finance App API Documentation',
  customfavIcon: '/favicon.ico'
}

module.exports = {
  specs,
  swaggerUi,
  swaggerConfig
}