FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY public ./public

RUN chown -R node:node /app

USER node

EXPOSE 5008

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:5008/health || exit 1

CMD ["node", "src/server.ts"]
