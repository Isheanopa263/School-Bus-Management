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