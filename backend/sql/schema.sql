--
-- PostgreSQL database dump
--

\restrict 2748buXpYwVmgaqAv5QigZ7QfA8jfxYCKK7xqiRLWuwlQOwcMfK7rJg12u4hNcA

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bus_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bus_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    student_id uuid,
    requested_stop_id uuid,
    requested_route_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying,
    notes text,
    requested_by uuid,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    home_location public.geometry(Point,4326),
    auto_assigned boolean DEFAULT false,
    CONSTRAINT bus_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.bus_requests OWNER TO postgres;

--
-- Name: buses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.buses (
    bid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    registration_number character varying(20) NOT NULL,
    capacity integer NOT NULL,
    model character varying(50),
    gps_device_id character varying(100),
    status character varying(20) DEFAULT 'active'::character varying,
    CONSTRAINT buses_capacity_check CHECK ((capacity > 0)),
    CONSTRAINT buses_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'maintenance'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.buses OWNER TO postgres;

--
-- Name: complaints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.complaints (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    raised_by uuid,
    trip_id uuid,
    driver_id uuid,
    bus_id uuid,
    category character varying(30),
    description text NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying,
    priority character varying(10) DEFAULT 'medium'::character varying,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    CONSTRAINT complaints_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[]))),
    CONSTRAINT complaints_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[])))
);


ALTER TABLE public.complaints OWNER TO postgres;

--
-- Name: daily_route_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_route_stats (
    stat_date date NOT NULL,
    route_id uuid NOT NULL,
    on_time_percentage numeric(5,2),
    avg_delay_min numeric(5,2),
    total_trips integer,
    total_students integer
);


ALTER TABLE public.daily_route_stats OWNER TO postgres;

--
-- Name: drivers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drivers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    userid uuid,
    license_number character varying(50) NOT NULL,
    license_expiry date NOT NULL,
    employment_status character varying(20) DEFAULT 'active'::character varying,
    current_bus_id uuid,
    CONSTRAINT drivers_employment_status_check CHECK (((employment_status)::text = ANY ((ARRAY['active'::character varying, 'on_leave'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.drivers OWNER TO postgres;

--
-- Name: live_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.live_locations (
    id bigint NOT NULL,
    bus_id uuid,
    trip_id uuid,
    location public.geometry(Point,4326) NOT NULL,
    speed_kmh numeric(5,2),
    heading numeric(5,2),
    recorded_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.live_locations OWNER TO postgres;

--
-- Name: live_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.live_locations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.live_locations_id_seq OWNER TO postgres;

--
-- Name: live_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.live_locations_id_seq OWNED BY public.live_locations.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    trip_id uuid,
    type character varying(30),
    title character varying(100),
    message text NOT NULL,
    sent_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: route_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.route_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    route_id uuid,
    bus_id uuid,
    driver_id uuid,
    effective_date date NOT NULL,
    end_date date,
    shift character varying(20),
    CONSTRAINT route_assignments_shift_check CHECK (((shift)::text = ANY ((ARRAY['morning'::character varying, 'afternoon'::character varying, 'both'::character varying])::text[])))
);


ALTER TABLE public.route_assignments OWNER TO postgres;

--
-- Name: routes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.routes (
    rid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    route_path public.geometry(LineString,4326),
    total_distance_km numeric(6,2),
    estimated_duration_min integer,
    is_active boolean DEFAULT true
);


ALTER TABLE public.routes OWNER TO postgres;

--
-- Name: schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedules (
    id integer NOT NULL,
    bus_id uuid,
    route_id uuid,
    driver_id uuid,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT valid_time_range CHECK ((end_time > start_time))
);


ALTER TABLE public.schedules OWNER TO postgres;

--
-- Name: schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schedules_id_seq OWNER TO postgres;

--
-- Name: schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.schedules_id_seq OWNED BY public.schedules.id;


--
-- Name: stops; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stops (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    route_id uuid,
    name character varying(100) NOT NULL,
    location public.geometry(Point,4326) NOT NULL,
    sequence_number integer NOT NULL,
    scheduled_arrival_time time without time zone
);


ALTER TABLE public.stops OWNER TO postgres;

--
-- Name: student_attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_attendance (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    trip_id uuid,
    student_id uuid,
    stop_id uuid,
    event_type character varying(10),
    "timestamp" timestamp with time zone DEFAULT now(),
    marked_by_driver_id uuid,
    CONSTRAINT student_attendance_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['pickup'::character varying, 'drop'::character varying])::text[])))
);


ALTER TABLE public.student_attendance OWNER TO postgres;

--
-- Name: students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students (
    sid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    userid uuid,
    roll character varying(50),
    assigned_stop_id uuid,
    bus_request_status character varying(20) DEFAULT 'inactive'::character varying,
    emergency_contact_phone character varying(20),
    home_location public.geometry(Point,4326),
    CONSTRAINT students_bus_request_status_check CHECK (((bus_request_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.students OWNER TO postgres;

--
-- Name: trip_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trip_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    trip_id uuid,
    bus_id uuid,
    event_type character varying(30),
    severity character varying(10),
    location public.geometry(Point,4326),
    details jsonb,
    occurred_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trip_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['overspeeding'::character varying, 'route_deviation'::character varying, 'breakdown'::character varying, 'geofence_exit'::character varying, 'harsh_braking'::character varying, 'sos'::character varying])::text[]))),
    CONSTRAINT trip_events_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[])))
);


ALTER TABLE public.trip_events OWNER TO postgres;

--
-- Name: trip_stop_visits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trip_stop_visits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    trip_id uuid,
    stop_id uuid,
    arrived_at timestamp with time zone DEFAULT now(),
    notified_students_count integer DEFAULT 0
);


ALTER TABLE public.trip_stop_visits OWNER TO postgres;

--
-- Name: trips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trips (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    assignment_id uuid,
    trip_date date NOT NULL,
    trip_type character varying(20),
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    delay_minutes integer DEFAULT 0,
    CONSTRAINT trips_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'ongoing'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT trips_trip_type_check CHECK (((trip_type)::text = ANY ((ARRAY['pickup'::character varying, 'drop'::character varying])::text[])))
);


ALTER TABLE public.trips OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    userid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    role character varying(20) NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(255),
    phone character varying(20) NOT NULL,
    password_hash character varying(255) NOT NULL,
    fcm_token text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'student'::character varying, 'driver'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: live_locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_locations ALTER COLUMN id SET DEFAULT nextval('public.live_locations_id_seq'::regclass);


--
-- Name: schedules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedules ALTER COLUMN id SET DEFAULT nextval('public.schedules_id_seq'::regclass);


--
-- Name: bus_requests bus_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bus_requests
    ADD CONSTRAINT bus_requests_pkey PRIMARY KEY (id);


--
-- Name: bus_requests bus_requests_student_id_status_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bus_requests
    ADD CONSTRAINT bus_requests_student_id_status_key UNIQUE (student_id, status);


--
-- Name: buses buses_gps_device_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buses
    ADD CONSTRAINT buses_gps_device_id_key UNIQUE (gps_device_id);


--
-- Name: buses buses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buses
    ADD CONSTRAINT buses_pkey PRIMARY KEY (bid);


--
-- Name: buses buses_registration_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buses
    ADD CONSTRAINT buses_registration_number_key UNIQUE (registration_number);


--
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (id);


--
-- Name: daily_route_stats daily_route_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_route_stats
    ADD CONSTRAINT daily_route_stats_pkey PRIMARY KEY (stat_date, route_id);


--
-- Name: drivers drivers_license_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_license_number_key UNIQUE (license_number);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: live_locations live_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_locations
    ADD CONSTRAINT live_locations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: route_assignments route_assignments_bus_id_effective_date_shift_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_assignments
    ADD CONSTRAINT route_assignments_bus_id_effective_date_shift_key UNIQUE (bus_id, effective_date, shift);


--
-- Name: route_assignments route_assignments_driver_id_effective_date_shift_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_assignments
    ADD CONSTRAINT route_assignments_driver_id_effective_date_shift_key UNIQUE (driver_id, effective_date, shift);


--
-- Name: route_assignments route_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_assignments
    ADD CONSTRAINT route_assignments_pkey PRIMARY KEY (id);


--
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (rid);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: stops stops_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stops
    ADD CONSTRAINT stops_pkey PRIMARY KEY (id);


--
-- Name: stops stops_route_id_sequence_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stops
    ADD CONSTRAINT stops_route_id_sequence_number_key UNIQUE (route_id, sequence_number);


--
-- Name: student_attendance student_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT student_attendance_pkey PRIMARY KEY (id);


--
-- Name: student_attendance student_attendance_trip_id_student_id_event_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT student_attendance_trip_id_student_id_event_type_key UNIQUE (trip_id, student_id, event_type);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (sid);


--
-- Name: trip_events trip_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_events
    ADD CONSTRAINT trip_events_pkey PRIMARY KEY (id);


--
-- Name: trip_stop_visits trip_stop_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_stop_visits
    ADD CONSTRAINT trip_stop_visits_pkey PRIMARY KEY (id);


--
-- Name: trip_stop_visits trip_stop_visits_trip_id_stop_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_stop_visits
    ADD CONSTRAINT trip_stop_visits_trip_id_stop_id_key UNIQUE (trip_id, stop_id);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (userid);


--
-- Name: idx_live_locations_bus_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_live_locations_bus_time ON public.live_locations USING btree (bus_id, recorded_at DESC);


--
-- Name: idx_live_locations_gis; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_live_locations_gis ON public.live_locations USING gist (location);


--
-- Name: idx_schedules_bus_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_schedules_bus_day ON public.schedules USING btree (bus_id, day_of_week);


--
-- Name: idx_schedules_driver_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_schedules_driver_day ON public.schedules USING btree (driver_id, day_of_week);


--
-- Name: idx_schedules_route; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_schedules_route ON public.schedules USING btree (route_id);


--
-- Name: idx_stops_location_gis; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stops_location_gis ON public.stops USING gist (location);


--
-- Name: idx_students_home_location_gis; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_home_location_gis ON public.students USING gist (home_location);


--
-- Name: idx_trip_stop_visits_trip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_trip_stop_visits_trip ON public.trip_stop_visits USING btree (trip_id);


--
-- Name: bus_requests bus_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bus_requests
    ADD CONSTRAINT bus_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(userid);


--
-- Name: bus_requests bus_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bus_requests
    ADD CONSTRAINT bus_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(userid);


--
-- Name: bus_requests bus_requests_requested_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bus_requests
    ADD CONSTRAINT bus_requests_requested_route_id_fkey FOREIGN KEY (requested_route_id) REFERENCES public.routes(rid);


--
-- Name: bus_requests bus_requests_requested_stop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bus_requests
    ADD CONSTRAINT bus_requests_requested_stop_id_fkey FOREIGN KEY (requested_stop_id) REFERENCES public.stops(id);


--
-- Name: bus_requests bus_requests_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bus_requests
    ADD CONSTRAINT bus_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(sid) ON DELETE CASCADE;


--
-- Name: complaints complaints_bus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES public.buses(bid);


--
-- Name: complaints complaints_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: complaints complaints_raised_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.users(userid) ON DELETE SET NULL;


--
-- Name: complaints complaints_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: daily_route_stats daily_route_stats_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_route_stats
    ADD CONSTRAINT daily_route_stats_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(rid);


--
-- Name: drivers drivers_current_bus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_current_bus_id_fkey FOREIGN KEY (current_bus_id) REFERENCES public.buses(bid);


--
-- Name: drivers drivers_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: live_locations live_locations_bus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_locations
    ADD CONSTRAINT live_locations_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES public.buses(bid) ON DELETE CASCADE;


--
-- Name: live_locations live_locations_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_locations
    ADD CONSTRAINT live_locations_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: route_assignments route_assignments_bus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_assignments
    ADD CONSTRAINT route_assignments_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES public.buses(bid) ON DELETE CASCADE;


--
-- Name: route_assignments route_assignments_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_assignments
    ADD CONSTRAINT route_assignments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: route_assignments route_assignments_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_assignments
    ADD CONSTRAINT route_assignments_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(rid) ON DELETE CASCADE;


--
-- Name: schedules schedules_bus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES public.buses(bid) ON DELETE CASCADE;


--
-- Name: schedules schedules_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: schedules schedules_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(rid) ON DELETE CASCADE;


--
-- Name: stops stops_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stops
    ADD CONSTRAINT stops_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(rid) ON DELETE CASCADE;


--
-- Name: student_attendance student_attendance_marked_by_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT student_attendance_marked_by_driver_id_fkey FOREIGN KEY (marked_by_driver_id) REFERENCES public.drivers(id);


--
-- Name: student_attendance student_attendance_stop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT student_attendance_stop_id_fkey FOREIGN KEY (stop_id) REFERENCES public.stops(id);


--
-- Name: student_attendance student_attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT student_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(sid) ON DELETE CASCADE;


--
-- Name: student_attendance student_attendance_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT student_attendance_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: students students_assigned_stop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_assigned_stop_id_fkey FOREIGN KEY (assigned_stop_id) REFERENCES public.stops(id);


--
-- Name: students students_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: trip_events trip_events_bus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_events
    ADD CONSTRAINT trip_events_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES public.buses(bid);


--
-- Name: trip_events trip_events_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_events
    ADD CONSTRAINT trip_events_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trip_stop_visits trip_stop_visits_stop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_stop_visits
    ADD CONSTRAINT trip_stop_visits_stop_id_fkey FOREIGN KEY (stop_id) REFERENCES public.stops(id) ON DELETE CASCADE;


--
-- Name: trip_stop_visits trip_stop_visits_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_stop_visits
    ADD CONSTRAINT trip_stop_visits_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trips trips_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.route_assignments(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 2748buXpYwVmgaqAv5QigZ7QfA8jfxYCKK7xqiRLWuwlQOwcMfK7rJg12u4hNcA

