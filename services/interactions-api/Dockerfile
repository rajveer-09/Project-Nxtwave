# syntax=docker/dockerfile:1
#
# Author : Rajveer Sharma
# Date : 17 Nov 2026
# @ Nxtwave
#

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production PORT=8090
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY db ./db
USER node
EXPOSE 8090
CMD ["node", "dist/server.js"]
