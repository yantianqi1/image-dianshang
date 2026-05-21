FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY server/ ./server/
COPY index.html app.js api-client.js gallery-cases.js style.css ./

EXPOSE 8080
CMD ["node", "server/main.js"]
