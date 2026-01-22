/**
 * Swagger/OpenAPI configuration
 * Day 8: Documentation & Configuration
 */

import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Costra API',
      version: '1.0.0',
      description: 'Multi-cloud cost management platform API',
      contact: {
        name: 'Costra Support',
        email: 'support@costra.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: process.env.PRODUCTION_URL || 'https://api.costra.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            code: {
              type: 'string',
              description: 'Error code',
            },
            requestId: {
              type: 'string',
              description: 'Request ID for tracking',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID',
            },
            name: {
              type: 'string',
              description: 'User name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email',
            },
            avatar_url: {
              type: 'string',
              format: 'uri',
              description: 'User avatar URL',
              nullable: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
            },
          },
        },
        CostData: {
          type: 'object',
          properties: {
            provider: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                icon: { type: 'string' },
              },
            },
            currentMonth: { type: 'number' },
            lastMonth: { type: 'number' },
            forecast: { type: 'number' },
            credits: { type: 'number' },
            savings: { type: 'number' },
            services: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  cost: { type: 'number' },
                  change: { type: 'number' },
                },
              },
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              description: 'Array of items',
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
                hasMore: { type: 'boolean' },
                hasPrev: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './server/routes/*.js',
    './server/server.js',
  ],
}

export const swaggerSpec = swaggerJsdoc(options)

export const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Costra API Documentation',
}

export const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions))
}
