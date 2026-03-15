FROM node:18-alpine
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Expose port
EXPOSE 8000

# Start server
CMD ["npm", "start"]
