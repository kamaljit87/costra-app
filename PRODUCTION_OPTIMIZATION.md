# Production Optimization Guide

This document outlines production optimizations applied to Costra for ECS deployment.

## Docker Optimizations

### Multi-Stage Build
- **Frontend Builder Stage**: Isolated build environment
- **Production Stage**: Minimal image with only runtime dependencies
- **Result**: Smaller final image (~200MB vs ~800MB)

### Security Enhancements
- **Non-root User**: Container runs as `nodejs` user (UID 1001)
- **Minimal Base Image**: Alpine Linux for smaller attack surface
- **Dependency Cleanup**: Removed build tools and cache after installation
- **File Permissions**: Proper ownership and permissions set

### Performance Optimizations
- **Layer Caching**: Dependencies installed before source code copy
- **npm ci**: Faster, more reliable installs in CI/CD
- **Compression**: Gzip compression enabled for responses
- **Health Checks**: Proper health check configuration for ECS

## Application Optimizations

### Server Configuration
- **Compression**: Gzip compression for all responses
- **Security Headers**: Helmet.js configured with CSP, HSTS, etc.
- **Rate Limiting**: API rate limiting to prevent abuse
- **Request Timeout**: 30-second timeout for long-running requests
- **Connection Pooling**: PostgreSQL connection pooling enabled

### Static File Serving
- **Production Mode**: Frontend served as static files from Express
- **SPA Routing**: All non-API routes serve `index.html` for React Router
- **Caching Headers**: Static assets cached appropriately

### Database Optimizations
- **Connection Pooling**: Reuse database connections
- **Indexes**: Proper indexes on frequently queried columns
- **Query Optimization**: Parameterized queries prevent SQL injection

### Monitoring & Observability
- **Health Endpoints**: `/api/health` for load balancer health checks
- **Metrics**: Prometheus metrics endpoint at `/metrics`
- **Logging**: Structured logging with Winston
- **Error Tracking**: Sentry integration for error monitoring

## ECS-Specific Optimizations

### Task Definition
- **Resource Allocation**: 512 CPU units, 1024 MB memory (adjustable)
- **Health Checks**: Configured with proper timeouts and intervals
- **Logging**: CloudWatch logs integration
- **Secrets**: AWS Secrets Manager integration

### Service Configuration
- **Auto Scaling**: Configured for high availability (2+ tasks)
- **Load Balancing**: Application Load Balancer with health checks
- **Deployment Strategy**: Rolling updates with zero downtime
- **Circuit Breaker**: Automatic rollback on deployment failures

### Network Configuration
- **VPC**: Isolated network environment
- **Security Groups**: Least privilege access
- **Private Subnets**: Tasks can run in private subnets (with NAT)

## Performance Metrics

### Expected Performance
- **Cold Start**: ~10-15 seconds (first request)
- **Response Time**: <200ms for API requests (p95)
- **Throughput**: 100+ requests/second per task
- **Memory Usage**: ~400-600 MB per task
- **CPU Usage**: ~20-40% under normal load

### Scaling Recommendations
- **Start**: 2 tasks (high availability)
- **Scale Up**: When CPU > 70% or Memory > 80%
- **Scale Down**: When CPU < 30% and Memory < 50%
- **Max Tasks**: Based on expected load (10-20 tasks for high traffic)

## Cost Optimization

### Fargate Spot
- Use Fargate Spot for non-critical workloads (50-70% savings)
- Mix of Fargate and Fargate Spot for cost/availability balance

### Right-Sizing
- Monitor actual usage and adjust CPU/memory
- Start with 512 CPU / 1024 MB, adjust based on metrics
- Use CloudWatch Container Insights for recommendations

### Reserved Capacity
- Consider Reserved Capacity for predictable workloads
- Savings Plans for long-term commitments

## Security Best Practices

1. **Secrets Management**: All secrets in AWS Secrets Manager
2. **Network Security**: Private subnets, security groups, VPC isolation
3. **IAM Roles**: Least privilege principle
4. **Image Scanning**: ECR image scanning enabled
5. **HTTPS**: SSL/TLS termination at ALB
6. **Security Headers**: Helmet.js configured
7. **Input Validation**: All inputs validated
8. **SQL Injection**: Parameterized queries only

## Monitoring & Alerts

### CloudWatch Metrics
- CPU utilization
- Memory utilization
- Request count
- Error rate
- Response time

### Recommended Alarms
- High CPU utilization (>80%)
- High memory utilization (>90%)
- High error rate (>5%)
- Health check failures
- Task failures

### Logging
- Application logs: CloudWatch Logs
- Access logs: ALB access logs
- Error tracking: Sentry

## Backup & Disaster Recovery

### Database Backups
- Automated RDS snapshots (if using RDS)
- Manual backups for external databases
- Point-in-time recovery enabled

### Application Backups
- ECR image versioning
- Task definition versioning
- Infrastructure as Code (CloudFormation)

### Disaster Recovery Plan
1. Restore database from latest backup
2. Deploy application from ECR
3. Update DNS to point to new infrastructure
4. Verify health checks pass

## Maintenance

### Regular Tasks
- **Security Updates**: Update base images monthly
- **Dependency Updates**: Update npm packages quarterly
- **Database Maintenance**: Vacuum and analyze weekly
- **Log Rotation**: CloudWatch log retention (30 days)
- **Cost Review**: Review and optimize costs monthly

### Deployment Best Practices
1. Test in staging environment first
2. Deploy during low-traffic periods
3. Monitor metrics during deployment
4. Have rollback plan ready
5. Document changes and versions

## Troubleshooting

### Common Issues

**High Memory Usage**
- Increase task memory allocation
- Check for memory leaks
- Review application logs

**Slow Response Times**
- Check database query performance
- Review connection pool settings
- Consider adding caching (Redis)

**Health Check Failures**
- Verify health endpoint is accessible
- Check security group rules
- Review application startup logs

**Task Failures**
- Check CloudWatch logs
- Verify secrets are accessible
- Check IAM role permissions
- Review task definition configuration

## Next Steps

1. Set up CloudWatch alarms
2. Configure auto-scaling policies
3. Set up SSL certificate in ACM
4. Configure custom domain
5. Set up CI/CD pipeline
6. Configure backup automation
7. Set up monitoring dashboards
