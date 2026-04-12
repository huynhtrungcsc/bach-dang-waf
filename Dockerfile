FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="Bach Dang WAF — Reverse Proxy Gateway"
LABEL org.opencontainers.image.description="Standalone Nginx gateway for Bach Dang WAF (no ModSecurity). Suitable for trusted-network deployments or behind an existing WAF layer."
LABEL org.opencontainers.image.vendor="0xDragon"

RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime && \
    echo "Asia/Ho_Chi_Minh" > /etc/timezone && \
    apk del tzdata

COPY ./config/nginx.conf /etc/nginx/conf.d/default.conf

RUN nginx -t

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
