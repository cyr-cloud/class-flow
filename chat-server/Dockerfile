FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY auth.mjs store.mjs server.mjs index.mjs ./
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3400
CMD ["node", "index.mjs"]
