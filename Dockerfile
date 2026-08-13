FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY src ./src

RUN npm run build

EXPOSE 8080

CMD ["sh", "-c", "npm run migrate && npm start"]