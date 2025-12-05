FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm ci || npm install
COPY . .
ENV PORT=4000
EXPOSE 4000
CMD ["node", "server.js"]
