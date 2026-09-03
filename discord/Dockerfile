# Team-Bot als Dauerprozess (Coolify / beliebiger Docker-Host).
# Bewusst ohne Port: der Bot spricht ausgehend über die Discord-Gateway-WebSocket,
# es gibt nichts zu proxien und keine Domain zu setzen.

FROM node:22-alpine

WORKDIR /app

# --omit=optional laesst sharp weg (nur fuer bot-avatar.mjs noetig, spart den nativen Build).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

COPY bot.mjs team-rules.mjs ./

ENV NODE_ENV=production
USER node

CMD ["node", "bot.mjs"]
