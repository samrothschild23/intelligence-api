FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --include=dev

COPY . .

RUN npm run build

CMD ["node", "dist/mcp-stdio.js"]
