CREATE TABLE IF NOT EXISTS bus_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(sid) ON DELETE CASCADE,
    requested_stop_id UUID REFERENCES stops(id),
    requested_route_id UUID REFERENCES routes(rid),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
    notes TEXT,
    requested_by UUID REFERENCES users(userid), -- student userid
    approved_by UUID REFERENCES users(userid), -- admin userid
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, status) -- Only 1 pending request per student
);

-- Add home_location to students for distance calc
ALTER TABLE students ADD COLUMN IF NOT EXISTS home_location GEOMETRY(POINT, 4326);

-- Add home_location to bus_requests for auto-assign
ALTER TABLE bus_requests ADD COLUMN IF NOT EXISTS home_location GEOMETRY(POINT, 4326);
ALTER TABLE bus_requests ADD COLUMN IF NOT EXISTS auto_assigned BOOLEAN DEFAULT false;

-- Index for fast geo queries
CREATE INDEX IF NOT EXISTS idx_stops_location_gis ON stops USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_students_home_location_gis ON students USING GIST(home_location);