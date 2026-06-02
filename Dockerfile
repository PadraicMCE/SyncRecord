# SyncRecord Docker file.
# This sets up a Docker container to run the SyncRecord server.
# Check the docker-compose.yml file for port options.
FROM node:20-alpine

# Install Python and build tools (gcc is needed for compiling numpy/scipy)
RUN apk add --no-cache python3 py3-pip gcc musl-dev linux-headers

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Install ONLY the clean requirements
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# HTTPS Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const https = require('https'); const req = https.request({ hostname: 'localhost', port: 3000, path: '/', method: 'GET', rejectUnauthorized: false }, (res) => { process.exit(res.statusCode >= 200 && res.statusCode < 400 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

CMD ["node", "server.js"]