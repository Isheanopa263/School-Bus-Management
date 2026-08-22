# ==========================================
# STAGE 1: Build React Admin
# ==========================================
FROM node:20-alpine AS build-admin
WORKDIR /build
COPY admin-react/package*.json ./
RUN npm install
COPY admin-react/ ./
RUN npm run build

# ==========================================
# STAGE 2: Install Backend Dependencies
# ==========================================
FROM node:20-alpine AS build-backend
WORKDIR /build
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./

# ==========================================
# STAGE 3: Production Image (Nginx + Node + Frontends)
# ==========================================
FROM node:20-alpine

RUN apk add --no-cache nginx supervisor

RUN mkdir -p /app/data/uploads \
    /var/www/html/admin-dashboard \
    /var/www/html/driver-app \
    /var/www/html/student-app \
    /run/nginx

COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisord.conf

# Copy compiled React admin
COPY --from=build-admin /build/dist /var/www/html/admin-dashboard

# Copy static PWAs
COPY driver-app /var/www/html/driver-app
COPY student-app /var/www/html/student-app

# Copy backend
COPY --from=build-backend /build /app/backend

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]