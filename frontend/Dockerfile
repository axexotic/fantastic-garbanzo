FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://api.flaskai.xyz
ARG NEXT_PUBLIC_WS_URL=wss://api.flaskai.xyz
ARG NEXT_PUBLIC_LIVEKIT_URL=wss://api.flaskai.xyz/lk

ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund --cache /tmp/.npm && rm -rf /tmp/.npm
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
