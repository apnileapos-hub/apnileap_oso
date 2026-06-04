# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
# Copy package files
COPY frontend/frontend/package.json ./
# Install frontend dependencies
RUN npm install --legacy-peer-deps
# Copy all frontend files
COPY frontend/frontend/ ./
# Build the production React app
RUN npm run build

# Stage 2: Set up the production Node.js server
FROM node:20-alpine
WORKDIR /app
# Copy package files
COPY package.json ./
COPY backend/package.json ./backend/
# Install backend dependencies
RUN npm install --prefix backend
# Copy backend code
COPY backend/ ./backend/
# Copy compiled frontend static files from the builder stage
COPY --from=frontend-builder /app/frontend/build ./frontend/frontend/build

# Expose default application port
EXPOSE 5000

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=5000

# Start server
CMD ["node", "backend/server.js"]
