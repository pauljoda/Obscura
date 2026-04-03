FROM node:22-alpine

WORKDIR /app

COPY . .

RUN corepack enable

EXPOSE 3000

