FROM node:22-alpine

WORKDIR /app

COPY . .

RUN corepack enable
RUN apk add --no-cache ffmpeg
