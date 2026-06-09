FROM node:22-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm install
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/dist ./dist
RUN npm install --omit=dev
CMD ["node", "dist/apps/api/src/main.js"]
