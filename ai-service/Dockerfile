FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY start.sh ./
ENV NODE_ENV=production
CMD ["sh", "start.sh"]
