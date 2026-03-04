FROM node:20

WORKDIR /app

# Copy package files and install deps
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --production

# Copy backend source
COPY backend/ ./backend/

# Copy widget (served as static files via path.join(__dirname, '..', 'widget'))
COPY widget/ ./widget/

# Create data directory for SQLite
RUN mkdir -p /app/backend/data

# Environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/backend

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
