# 🚌 BusTrack - School Bus Management System

A complete bus management system with real-time GPS tracking, route management, and push notifications for schools.

## ✨ Features

- **Admin Dashboard** - Manage buses, drivers, routes, students, complaints, and view reports
- **Driver Mobile App** - GPS tracking, turn-by-turn navigation, trip management, SOS alerts
- **Student Mobile App** - Live bus tracking, ETA, bus requests, push notifications
- **Real-time GPS** - Track bus locations with road-following navigation
- **Geofencing** - Auto-notify students when bus arrives at their stop
- **Push Notifications** - Firebase Cloud Messaging for instant alerts

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, PostgreSQL + PostGIS
- **Frontend:** Vanilla JS, Leaflet.js, Chart.js
- **Auth:** JWT + bcrypt
- **Maps:** OpenStreetMap + OSRM
- **Notifications:** Firebase FCM

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 14+ with PostGIS extension
- npm

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/isheanopa263/school-bus-management.git
cd school-bus-management/backend
npm install
```

### 2. Setup Database

```bash
psql -U postgres -c "CREATE DATABASE school_bus_db;"
psql -U postgres -d school_bus_db -f sql/schema.sql
```

### 3. Configure Environment

Create `backend/.env`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_bus_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
```

### 4. Run Backend

```bash
npm start
```

### 5. Open Frontend Apps

Use VS Code Live Server on:

- `admin-dashboard/index.html`
- `driver-app/index.html`
- `student-app/index.html`

## 🧪 Testing

```bash
cd backend
npm test
```

**152 automated tests across 13 test suites**

## 📁 Structure

```
bus_system_web/
├── backend/              # Node.js API
├── admin-dashboard/      # Admin web app
├── driver-app/           # Driver PWA
├── student-app/          # Student PWA
└── README.md
```

## 🌐 Deployment

- **Backend:** Railway
- **Database:** Supabase (PostgreSQL + PostGIS)
- **Frontend:** GitHub Pages

## 👤 Author

[isheanopa263](https://github.com/isheanopa263)
