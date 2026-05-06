-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    userid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'student', 'driver')),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    fcm_token TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Buses
CREATE TABLE IF NOT EXISTS buses (
    bid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_number VARCHAR(20) UNIQUE NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    model VARCHAR(50),
    gps_device_id VARCHAR(100) UNIQUE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','maintenance','inactive'))
);

-- 3. Routes
CREATE TABLE IF NOT EXISTS routes (
    rid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    route_path GEOMETRY(LINESTRING, 4326),
    total_distance_km DECIMAL(6,2),
    estimated_duration_min INT,
    is_active BOOLEAN DEFAULT true
);

-- 4. Stops
CREATE TABLE IF NOT EXISTS stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES routes(rid) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    location GEOMETRY(POINT, 4326) NOT NULL,
    sequence_number INT NOT NULL,
    scheduled_arrival_time TIME,
    UNIQUE(route_id, sequence_number)
);

-- 5. Students
CREATE TABLE IF NOT EXISTS students (
    sid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userid UUID REFERENCES users(userid) ON DELETE CASCADE,
    roll VARCHAR(50),
    assigned_stop_id UUID REFERENCES stops(id),
    bus_request_status VARCHAR(20) DEFAULT 'pending' CHECK (bus_request_status IN ('pending','approved','rejected','inactive')),
    emergency_contact_phone VARCHAR(20)
);

-- 6. Drivers
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userid UUID REFERENCES users(userid) ON DELETE CASCADE,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_expiry DATE NOT NULL,
    employment_status VARCHAR(20) DEFAULT 'active' CHECK (employment_status IN ('active','on_leave','inactive')),
    current_bus_id UUID REFERENCES buses(bid)
);

-- 7. Route_assignments
CREATE TABLE IF NOT EXISTS route_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES routes(rid) ON DELETE CASCADE,
    bus_id UUID REFERENCES buses(bid) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    effective_date DATE NOT NULL,
    end_date DATE,
    shift VARCHAR(20) CHECK (shift IN ('morning','afternoon','both')),
    UNIQUE(bus_id, effective_date, shift),
    UNIQUE(driver_id, effective_date, shift)
);

-- 8. trips
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES route_assignments(id),
    trip_date DATE NOT NULL,
    trip_type VARCHAR(20) CHECK (trip_type IN ('pickup','drop')),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','ongoing','completed','cancelled')),
    delay_minutes INT DEFAULT 0
);

-- 9. live_locations
CREATE TABLE IF NOT EXISTS live_locations (
    id BIGSERIAL PRIMARY KEY,
    bus_id UUID REFERENCES buses(bid) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    location GEOMETRY(POINT, 4326) NOT NULL,
    speed_kmh DECIMAL(5,2),
    heading DECIMAL(5,2),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_locations_bus_time ON live_locations(bus_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_locations_gis ON live_locations USING GIST(location);

-- 10. trip_events
CREATE TABLE IF NOT EXISTS trip_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    bus_id UUID REFERENCES buses(bid),
    event_type VARCHAR(30) CHECK (event_type IN ('overspeeding','route_deviation','breakdown','geofence_exit','harsh_braking')),
    severity VARCHAR(10) CHECK (severity IN ('low','medium','high')),
    location GEOMETRY(POINT, 4326),
    details JSONB,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. student_attendance
CREATE TABLE IF NOT EXISTS student_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(sid) ON DELETE CASCADE,
    stop_id UUID REFERENCES stops(id),
    event_type VARCHAR(10) CHECK (event_type IN ('pickup','drop')),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    marked_by_driver_id UUID REFERENCES drivers(id),
    UNIQUE(trip_id, student_id, event_type)
);

-- 12. notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(userid) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id),
    type VARCHAR(30),
    title VARCHAR(100),
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. complaints
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raised_by UUID REFERENCES users(userid) ON DELETE SET NULL,
    trip_id UUID REFERENCES trips(id),
    driver_id UUID REFERENCES drivers(id),
    bus_id UUID REFERENCES buses(bid),
    category VARCHAR(30),
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 14. daily_route_stats
CREATE TABLE IF NOT EXISTS daily_route_stats (
    stat_date DATE,
    route_id UUID REFERENCES routes(rid),
    on_time_percentage DECIMAL(5,2),
    avg_delay_min DECIMAL(5,2),
    total_trips INT,
    total_students INT,
    PRIMARY KEY (stat_date, route_id)
);