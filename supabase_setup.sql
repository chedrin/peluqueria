-- ============================================================================
-- SCRIPT DE BASE DE DATOS POSTGRESQL PARA SUPABASE
-- PROYECTO: GESTIÓN INTEGRAL DE PELUQUERÍA & SALÓN DE BELLEZA
-- NORMATIVA FISCAL: LEY ANTIFRAUDE 11/2021 Y VERI*FACTU (ESPAÑA)
-- ============================================================================
-- Instrucciones de uso en Supabase:
-- 1. Abre tu proyecto en Supabase (https://supabase.com).
-- 2. Dirígete a la pestaña "SQL Editor" en el menú lateral izquierdo.
-- 3. Crea una "New Query", pega todo el contenido de este archivo y pulsa "Run".
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- 1. ENUMS Y TIPOS DE DATOS PERSONALIZADOS
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'staff', 'client');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduling_required');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_type AS ENUM ('simplified', 'standard', 'rectificative');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'card', 'loyalty_points', 'bizum', 'mixed', 'gift_card');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE product_type AS ENUM ('internal_use', 'retail_showcase', 'mixed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE staff_status AS ENUM ('active', 'inactive', 'medical_leave', 'vacation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. TABLAS PRINCIPALES
-- ============================================================================

-- 2.1 Datos y Configuración General de la Peluquería (Título y Datos Fiscales)
CREATE TABLE IF NOT EXISTS salon_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL DEFAULT 'Peluquería Losan',
    commercial_name VARCHAR(150) NOT NULL DEFAULT 'Peluquería & Estilismo Losan',
    legal_name VARCHAR(200) NOT NULL DEFAULT 'Peluquería & Estilismo Losan S.L.',
    cif VARCHAR(20) NOT NULL DEFAULT 'B-87654321',
    tagline VARCHAR(255) DEFAULT 'Salón Boutique & Cuidado Capilar de Vanguardia',
    phone VARCHAR(30) DEFAULT '+34 912 345 678',
    whatsapp VARCHAR(30) DEFAULT '+34 611 223 344',
    email VARCHAR(100) DEFAULT 'contacto@peluquerialosan.es',
    address TEXT DEFAULT 'Calle Velázquez 42, 28001 Madrid',
    schedule_text TEXT DEFAULT 'Lunes a Viernes: 09:30 - 19:30 | Sábados: 09:00 - 14:00',
    default_vat_rate NUMERIC(5,2) DEFAULT 21.00,
    loyalty_stamps_required INT DEFAULT 8,
    loyalty_stamp_reward TEXT DEFAULT 'Tratamiento de Hidratación Profunda Olaplex o Corte Gratis',
    salon_qr_secret VARCHAR(100) DEFAULT 'LOSAN-STAMP-QR-2026',
    currency VARCHAR(10) DEFAULT 'EUR',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Usuarios y Perfiles (Sincronizable con auth.users de Supabase)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(30) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'client',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Ficha 360° de Clientas (Identificador Fundamental: DNI / NIE)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    dni VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    allergies TEXT DEFAULT 'Ninguna conocida',
    hair_type VARCHAR(100) DEFAULT 'Normal',
    general_notes TEXT,
    loyalty_points INT DEFAULT 0,
    loyalty_stamps INT DEFAULT 0,
    completed_cards_count INT DEFAULT 0,
    google_review_verified BOOLEAN DEFAULT FALSE,
    qr_code_hash VARCHAR(64) UNIQUE,
    marketing_consent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Personal y Estilistas (Gestión de Plantilla: Altas y Bajas)
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    specialty VARCHAR(150) NOT NULL,
    chair VARCHAR(100) DEFAULT 'Sillón General',
    phone VARCHAR(30),
    email VARCHAR(255),
    display_color VARCHAR(10) DEFAULT '#8B5CF6',
    is_active BOOLEAN DEFAULT TRUE,     -- Control de ALTA (true) o BAJA (false)
    status staff_status DEFAULT 'active',
    leave_reason TEXT DEFAULT '',
    notes TEXT,
    schedule_config JSONB NOT NULL DEFAULT '{
        "monday": {"start": "09:30", "end": "19:30"},
        "tuesday": {"start": "09:30", "end": "19:30"},
        "wednesday": {"start": "09:30", "end": "19:30"},
        "thursday": {"start": "09:30", "end": "19:30"},
        "friday": {"start": "09:30", "end": "19:30"},
        "saturday": {"start": "09:00", "end": "14:00"}
    }',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Historial de Bajas Médicas o Temporales de Estilistas
CREATE TABLE IF NOT EXISTS staff_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    reason TEXT NOT NULL,
    reassigned_appointments_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 Catálogo de Servicios de Peluquería
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'corte',
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 30,
    price NUMERIC(10, 2) NOT NULL,
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 21.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.7 Citas y Reservas con Control Antisolapamiento
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status appointment_status DEFAULT 'confirmed',
    client_comments TEXT,
    internal_notes TEXT,
    reminder_sent_whatsapp_24h BOOLEAN DEFAULT FALSE,
    reminder_sent_whatsapp_2h BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_duration CHECK (end_time > start_time),
    -- Exclusión estricta de citas solapadas por estilista
    CONSTRAINT no_staff_overlap EXCLUDE USING gist (
        staff_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status NOT IN ('cancelled', 'rescheduling_required'))
);

-- 2.8 Servicios Contratados en la Cita (Relación N:M)
CREATE TABLE IF NOT EXISTS appointment_services (
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
    duration_applied INT NOT NULL,
    price_applied NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY (appointment_id, service_id)
);

-- 2.9 Expediente Técnico y Ficha Colorimétrica de Clienta
CREATE TABLE IF NOT EXISTS technical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    dye_formula TEXT,                -- Ej: "6.1 (30g) + 7.0 (15g) con oxidante 20vol (45g)"
    technique_used TEXT,             -- Ej: "Balayage a mano alzada con matiz ceniza"
    exposure_time_minutes INT,      -- Tiempo de exposición del tinte
    developer_volume VARCHAR(50),    -- 10vol, 20vol, 30vol
    observations TEXT,               -- Reacciones, porosidad capilar, etc.
    photo_urls TEXT[],               -- Galería de fotos del resultado
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.10 Facturación Fiscal Española (Ley Antifraude 11/2021 & Veri*Factu)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    series VARCHAR(10) NOT NULL,     -- 'FS2026-' (Simplificada) o 'F2026-' (Ordinaria)
    invoice_number INT NOT NULL,
    type invoice_type NOT NULL DEFAULT 'simplified',
    issue_date TIMESTAMPTZ DEFAULT NOW(),
    tax_base NUMERIC(10, 2) NOT NULL,
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 21.00,
    vat_amount NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_method payment_method NOT NULL DEFAULT 'card',
    previous_invoice_hash VARCHAR(64),
    record_hash VARCHAR(64) NOT NULL, -- SHA-256 inalterable encadenado
    qr_verifactu_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (series, invoice_number)
);

-- 2.11 Líneas de Factura (Desglose de Servicios y Productos TPV)
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    concept VARCHAR(200) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    tax_base NUMERIC(10, 2) NOT NULL,
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 21.00,
    vat_amount NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL
);

-- 2.12 Productos e Inventario (Uso Interno y Tienda de Muestra)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    barcode VARCHAR(100) UNIQUE,
    name VARCHAR(150) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100) NOT NULL,
    product_type product_type NOT NULL DEFAULT 'retail_showcase',
    cost_price NUMERIC(10, 2) NOT NULL,
    retail_price NUMERIC(10, 2) NOT NULL,
    current_stock INT NOT NULL DEFAULT 0,
    minimum_stock_alert INT NOT NULL DEFAULT 3,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.13 Historial de Transacciones del Club de Fidelización
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    points_delta INT NOT NULL,
    reason TEXT NOT NULL,            -- 'Compra en salón', 'Reseña verificada en Google (+150 pts)', 'Canje por tratamiento'
    balance_after INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.14 Bonos de Sesiones y Tarjetas Regalo
CREATE TABLE IF NOT EXISTS service_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    total_sessions INT NOT NULL DEFAULT 5,
    sessions_remaining INT NOT NULL DEFAULT 5,
    price_paid NUMERIC(10, 2) NOT NULL,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.15 Historial de Sellados de Fidelización (Sellado con QR del Salón / TPV)
CREATE TABLE IF NOT EXISTS stamp_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    stamp_number INT NOT NULL,
    total_stamps_target INT NOT NULL DEFAULT 8,
    stamped_at TIMESTAMPTZ DEFAULT NOW(),
    method VARCHAR(50) NOT NULL DEFAULT 'QR_SALON_SCAN', -- 'QR_SALON_SCAN' o 'TPV_MANUAL_STAMP'
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    staff_name VARCHAR(100) DEFAULT 'Equipo Losan',
    reward_unlocked TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gift_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    purchased_by_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    recipient_name VARCHAR(150) NOT NULL,
    initial_balance NUMERIC(10, 2) NOT NULL,
    current_balance NUMERIC(10, 2) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. ÍNDICES DE RENDIMIENTO Y CONSULTA RÁPIDA
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_clients_dni ON clients(dni);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(is_active);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_date ON appointments(staff_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_invoices_hash ON invoices(record_hash);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_technical_records_client ON technical_records(client_id);

-- ============================================================================
-- 4. FUNCIONES PL/PGSQL Y TRIGGERS DE NEGOCIO
-- ============================================================================

-- 4.1 Actualización automática de la columna updated_at
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_salon_settings_updated
BEFORE UPDATE ON salon_settings
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_clients_updated
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_staff_updated
BEFORE UPDATE ON staff
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_services_updated
BEFORE UPDATE ON services
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_appointments_updated
BEFORE UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_products_updated
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- 4.2 Función de Encadenamiento SHA-256 Fiscal (Veri*Factu / Ley Antifraude 11/2021)
-- Garantiza encadenamiento criptográfico estricto e inalterabilidad de facturas
CREATE OR REPLACE FUNCTION fn_generate_verifactu_hash()
RETURNS TRIGGER AS $$
DECLARE
    v_previous_hash VARCHAR(64);
    v_salon_cif VARCHAR(20);
    v_raw_payload TEXT;
BEGIN
    -- Obtener CIF del salón
    SELECT cif INTO v_salon_cif FROM salon_settings LIMIT 1;
    IF v_salon_cif IS NULL THEN
        v_salon_cif := 'B-87654321';
    END IF;

    -- Obtener el hash de la última factura emitida de la misma serie
    SELECT record_hash INTO v_previous_hash 
    FROM invoices 
    WHERE series = NEW.series 
    ORDER BY invoice_number DESC 
    LIMIT 1;

    IF v_previous_hash IS NULL THEN
        v_previous_hash := 'GENESIS-HASH-00000000000000000000000000000000000000000000000000000000';
    END IF;

    NEW.previous_invoice_hash := v_previous_hash;

    -- Concatenar payload fiscal reglamentario
    v_raw_payload := CONCAT_WS('|',
        v_salon_cif,
        NEW.series,
        NEW.invoice_number::TEXT,
        to_char(NEW.issue_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        to_char(NEW.tax_base, 'FM999999990.00'),
        to_char(NEW.vat_amount, 'FM999999990.00'),
        to_char(NEW.total_amount, 'FM999999990.00'),
        v_previous_hash
    );

    -- Generar huella SHA-256 reglamentaria
    NEW.record_hash := encode(digest(v_raw_payload, 'sha256'), 'hex');

    -- Generar URL representativa del código QR Veri*Factu AEAT
    NEW.qr_verifactu_url := 'https://sede.agenciatributaria.gob.es/veri-factu/qr?nif=' || v_salon_cif || 
                            '&series=' || NEW.series || 
                            '&num=' || NEW.invoice_number || 
                            '&fecha=' || to_char(NEW.issue_date, 'YYYY-MM-DD') || 
                            '&total=' || to_char(NEW.total_amount, 'FM999999990.00') || 
                            '&hash=' || substring(NEW.record_hash from 1 for 16);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoices_verifactu_hash
BEFORE INSERT ON invoices
FOR EACH ROW EXECUTE FUNCTION fn_generate_verifactu_hash();

-- 4.3 Acumulación Automática de Puntos de Fidelización al Facturar
CREATE OR REPLACE FUNCTION fn_award_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
    v_points_earned INT;
    v_new_balance INT;
BEGIN
    IF NEW.client_id IS NOT NULL THEN
        -- Regla del salón: 1 punto por cada euro gastado (redondeo al alza)
        v_points_earned := CEIL(NEW.total_amount);

        UPDATE clients 
        SET loyalty_points = loyalty_points + v_points_earned 
        WHERE id = NEW.client_id
        RETURNING loyalty_points INTO v_new_balance;

        INSERT INTO loyalty_transactions (client_id, invoice_id, points_delta, reason, balance_after)
        VALUES (
            NEW.client_id, 
            NEW.id, 
            v_points_earned, 
            'Puntos acumulados por factura ' || NEW.series || NEW.invoice_number, 
            v_new_balance
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoices_award_loyalty
AFTER INSERT ON invoices
FOR EACH ROW EXECUTE FUNCTION fn_award_loyalty_points();

-- 4.4 Función RPC: Consulta de Disponibilidad en Tiempo Real
-- Calcula huecos libres continuos de acuerdo a la duración del servicio
CREATE OR REPLACE FUNCTION fn_get_staff_availability(
    p_staff_id UUID,
    p_date DATE,
    p_duration_minutes INT DEFAULT 30
)
RETURNS TABLE (
    slot_time VARCHAR,
    is_available BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_staff staff%ROWTYPE;
    v_day_of_week INT; -- 0=Domingo, 6=Sábado
    v_shift_morning_end TIMESTAMPTZ;
    v_shift_afternoon_end TIMESTAMPTZ;
    v_intervals TEXT[] := ARRAY[
        '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
        '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'
    ];
    v_t TEXT;
    v_slot_start TIMESTAMPTZ;
    v_slot_end TIMESTAMPTZ;
    v_conflict_count INT;
    v_conflict_name TEXT;
BEGIN
    SELECT * INTO v_staff FROM staff WHERE id = p_staff_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Si la trabajadora está de baja
    IF v_staff.is_active = FALSE THEN
        FOREACH v_t IN ARRAY v_intervals LOOP
            slot_time := v_t;
            is_available := FALSE;
            reason := v_staff.name || ' se encuentra actualmente de BAJA y no está disponible';
            RETURN NEXT;
        END LOOP;
        RETURN;
    END IF;

    v_day_of_week := EXTRACT(DOW FROM p_date);

    -- Domingo: Cerrado
    IF v_day_of_week = 0 THEN
        FOREACH v_t IN ARRAY v_intervals LOOP
            slot_time := v_t;
            is_available := FALSE;
            reason := 'El salón permanece cerrado los domingos por descanso semanal.';
            RETURN NEXT;
        END LOOP;
        RETURN;
    END IF;

    v_shift_morning_end := (p_date || ' 14:00:00')::TIMESTAMPTZ;
    v_shift_afternoon_end := (p_date || ' 19:30:00')::TIMESTAMPTZ;

    FOREACH v_t IN ARRAY v_intervals LOOP
        slot_time := v_t;
        v_slot_start := (p_date || ' ' || v_t || ':00')::TIMESTAMPTZ;
        v_slot_end := v_slot_start + (p_duration_minutes || ' minutes')::INTERVAL;

        -- 1. Reglas de turno
        IF v_day_of_week = 6 AND v_t >= '14:00' THEN
            is_available := FALSE;
            reason := 'Los sábados no hay turno de tarde en el salón (cierre a las 14:00).';
            RETURN NEXT;
            CONTINUE;
        END IF;

        IF v_t < '14:00' AND v_slot_end > v_shift_morning_end THEN
            is_available := FALSE;
            reason := 'Excede el turno de mañana (cierre a las 14:00). Requiere ' || p_duration_minutes || ' min.';
            RETURN NEXT;
            CONTINUE;
        END IF;

        IF v_t >= '14:00' AND v_slot_end > v_shift_afternoon_end THEN
            is_available := FALSE;
            reason := 'Excede el horario de cierre (19:30). Requiere ' || p_duration_minutes || ' min.';
            RETURN NEXT;
            CONTINUE;
        END IF;

        -- 2. Comprobar colisiones con citas activas
        SELECT COUNT(*), COALESCE(MAX(c.name), 'otra clienta') 
        INTO v_conflict_count, v_conflict_name
        FROM appointments a
        JOIN clients c ON c.id = a.client_id
        WHERE a.staff_id = p_staff_id
          AND a.status NOT IN ('cancelled', 'rescheduling_required')
          AND v_slot_start < a.end_time 
          AND v_slot_end > a.start_time;

        IF v_conflict_count > 0 THEN
            is_available := FALSE;
            reason := 'Solapa con cita previa de ' || v_conflict_name;
        ELSE
            is_available := TRUE;
            reason := 'Hueco libre (' || v_t || ' - ' || to_char(v_slot_end, 'HH24:MI') || ')';
        END IF;

        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) PARA SUPABASE
-- ============================================================================
ALTER TABLE salon_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own stamp history" ON stamp_history FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE dni = current_setting('request.jwt.claim.dni', true)) OR
    auth.role() = 'service_role' OR auth.role() = 'anon'
);
CREATE POLICY "Admin full access stamp history" ON stamp_history FOR ALL USING (true);

-- 5.1 Políticas Públicas / Acceso Anónimo (Portal Clientas - Solo Lectura General)
CREATE POLICY "Public read salon settings" ON salon_settings FOR SELECT USING (true);
CREATE POLICY "Public read active services" ON services FOR SELECT USING (is_active = true);
CREATE POLICY "Public read active staff" ON staff FOR SELECT USING (is_active = true);
CREATE POLICY "Public read products showcase" ON products FOR SELECT USING (is_active = true AND product_type IN ('retail_showcase', 'mixed'));

-- 5.2 Políticas de Clientas (Acceso a sus propios datos por DNI o auth.uid())
CREATE POLICY "Clients read own profile" ON clients FOR SELECT USING (
    dni = current_setting('request.jwt.claim.dni', true) OR 
    profile_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid()) OR
    auth.role() = 'service_role' OR auth.role() = 'anon'
);

CREATE POLICY "Clients read own appointments" ON appointments FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE dni = current_setting('request.jwt.claim.dni', true)) OR
    auth.role() = 'service_role' OR auth.role() = 'anon'
);

CREATE POLICY "Clients create appointments" ON appointments FOR INSERT WITH CHECK (
    true -- Permitir reservas desde el portal
);

-- 5.3 Políticas de Estilistas (Acceso a sus citas y expedientes técnicos)
CREATE POLICY "Staff read appointments" ON appointments FOR SELECT USING (
    staff_id IN (SELECT id FROM staff WHERE profile_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())) OR
    auth.role() = 'service_role' OR auth.role() = 'anon'
);

CREATE POLICY "Staff manage technical records" ON technical_records FOR ALL USING (
    true
);

-- 5.4 Políticas de Administración (Acceso Total)
CREATE POLICY "Admin full access salon settings" ON salon_settings FOR ALL USING (true);
CREATE POLICY "Admin full access profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Admin full access clients" ON clients FOR ALL USING (true);
CREATE POLICY "Admin full access staff" ON staff FOR ALL USING (true);
CREATE POLICY "Admin full access staff leaves" ON staff_leaves FOR ALL USING (true);
CREATE POLICY "Admin full access services" ON services FOR ALL USING (true);
CREATE POLICY "Admin full access appointments" ON appointments FOR ALL USING (true);
CREATE POLICY "Admin full access technical records" ON technical_records FOR ALL USING (true);
CREATE POLICY "Admin full access invoices" ON invoices FOR ALL USING (true);
CREATE POLICY "Admin full access invoice items" ON invoice_items FOR ALL USING (true);
CREATE POLICY "Admin full access products" ON products FOR ALL USING (true);
CREATE POLICY "Admin full access loyalty" ON loyalty_transactions FOR ALL USING (true);
CREATE POLICY "Admin full access packages" ON service_packages FOR ALL USING (true);
CREATE POLICY "Admin full access gift cards" ON gift_cards FOR ALL USING (true);

-- ============================================================================
-- 6. DATOS SEMILLA (SEED DATA REALISTA PARA EL SALÓN)
-- ============================================================================

-- 6.1 Datos de la Peluquería
INSERT INTO salon_settings (name, commercial_name, legal_name, cif, tagline, phone, whatsapp, email, address, schedule_text)
VALUES (
    'Peluquería Losan',
    'Peluquería & Estilismo Losan',
    'Peluquería & Estilismo Losan S.L.',
    'B-87654321',
    'Salón Boutique & Cuidado Capilar de Vanguardia',
    '+34 912 345 678',
    '+34 611 223 344',
    'contacto@peluquerialosan.es',
    'Calle Velázquez 42, 28001 Madrid',
    'Lunes a Viernes: 09:30 - 19:30 | Sábados: 09:00 - 14:00'
) ON CONFLICT DO NOTHING;

-- 6.2 Perfiles y Usuarios
INSERT INTO profiles (id, email, phone, role, first_name, last_name, is_active) VALUES
('a0000000-0000-0000-0000-000000000001', 'gerencia@peluquerialosan.es', '+34 611 111 111', 'admin', 'Marisa', 'Garrido (Gerente)', true),
('a0000000-0000-0000-0000-000000000002', 'elena@peluquerialosan.es', '+34 622 222 222', 'staff', 'Elena', 'Gómez', true),
('a0000000-0000-0000-0000-000000000003', 'raquel@peluquerialosan.es', '+34 633 333 333', 'staff', 'Raquel', 'Santos', true),
('a0000000-0000-0000-0000-000000000004', 'carmen@peluquerialosan.es', '+34 644 444 444', 'staff', 'Carmen', 'Vidal', true),
('a0000000-0000-0000-0000-000000000005', 'laura@gmail.com', '+34 655 555 555', 'client', 'Laura', 'Martínez', true),
('a0000000-0000-0000-0000-000000000006', 'sofia@gmail.com', '+34 666 666 666', 'client', 'Sofía', 'Morales', true)
ON CONFLICT (phone) DO NOTHING;

-- 6.3 Plantilla de Estilistas (Altas Activas)
INSERT INTO staff (id, profile_id, name, specialty, chair, phone, email, display_color, is_active, status, notes) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Elena Gómez', 'Colorimetría & Balayage', 'Sillón 1 (Color)', '+34 622 222 222', 'elena@peluquerialosan.es', '#8B5CF6', true, 'active', 'Especialista Máster en Balayage y Colorimetría avanzada'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Raquel Santos', 'Cortes & Estilismo', 'Sillón 2 (Cortes)', '+34 633 333 333', 'raquel@peluquerialosan.es', '#EC4899', true, 'active', 'Corte de diseño, peinados y recogidos de novia'),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'Carmen Vidal', 'Tratamientos & Salud Capilar', 'Sillón 3 (Tratamientos)', '+34 644 444 444', 'carmen@peluquerialosan.es', '#10B981', true, 'active', 'Tratamientos capilares, keratina e hidratación profunda')
ON CONFLICT DO NOTHING;

-- 6.4 Clientas con DNI / NIE Fundamental
INSERT INTO clients (id, profile_id, dni, name, phone, email, allergies, hair_type, loyalty_points, google_review_verified, qr_code_hash, marketing_consent) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', '12345678Z', 'Laura Martínez', '+34 655 555 555', 'laura@gmail.com', 'Sensibilidad leve a amoníacos fuertes', 'Fino, teñido previo tono 7', 320, true, 'QR-12345678Z-HASH9988', true),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000006', '87654321A', 'Sofía Morales', '+34 666 666 666', 'sofia@gmail.com', 'Ninguna conocida', 'Rizado, decolorado balayage', 180, true, 'QR-87654321A-HASH7766', true),
('c0000000-0000-0000-0000-000000000003', null, '45678912B', 'Carmen Sánchez', '+34 677 777 777', 'carmens@gmail.com', 'Alergia al níquel', 'Grueso, liso natural', 90, false, 'QR-45678912B-HASH5544', true)
ON CONFLICT (dni) DO NOTHING;

-- 6.5 Catálogo de Servicios
INSERT INTO services (id, name, category, duration_minutes, price, vat_rate) VALUES
('d0000000-0000-0000-0000-000000000001', 'Corte y Estilismo', 'corte', 30, 22.00, 21.00),
('d0000000-0000-0000-0000-000000000002', 'Coloración Completa (Tinte)', 'coloracion', 60, 38.00, 21.00),
('d0000000-0000-0000-0000-000000000003', 'Mechas Balayage & Matiz', 'coloracion', 90, 65.00, 21.00),
('d0000000-0000-0000-0000-000000000004', 'Peinado & Brushing', 'peinado', 30, 18.00, 21.00),
('d0000000-0000-0000-0000-000000000005', 'Tratamiento Olaplex / Keratina', 'tratamiento', 45, 35.00, 21.00)
ON CONFLICT DO NOTHING;

-- 6.6 Citas de Ejemplo
INSERT INTO appointments (id, client_id, staff_id, start_time, end_time, status, client_comments) VALUES
('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2026-10-23 10:00:00+00', '2026-10-23 11:30:00+00', 'confirmed', 'Repasar mechas y corte de puntas'),
('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-10-23 12:00:00+00', '2026-10-23 12:30:00+00', 'confirmed', 'Corte rápido y peinado express'),
('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '2026-10-23 11:00:00+00', '2026-10-23 11:30:00+00', 'confirmed', 'Peinado para evento')
ON CONFLICT DO NOTHING;

-- 6.7 Expedientes Técnicos (Colorimetría y Fórmulas)
INSERT INTO technical_records (client_id, staff_id, appointment_id, dye_formula, technique_used, exposure_time_minutes, developer_volume, observations) VALUES
('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '6.1 (30g) + 7.0 (15g) con oxidante 20vol (45g)', 'Balayage a mano alzada + matiz ceniza 9.12', 35, '20vol', 'Cabello respondió de forma óptima. Muy brillante tras aplicar Olaplex n°2.'),
('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'Matiz perlado 10.21 (20g) con revelador 6vol (40g)', 'Gloss de brillo y neutralización de cobrizos', 15, '6vol', 'Evitar oxidantes superiores a 20vol en raíces.')
ON CONFLICT DO NOTHING;

-- 6.8 Productos en Stock (Uso Interno y Escaparate)
INSERT INTO products (barcode, name, brand, category, product_type, cost_price, retail_price, current_stock, minimum_stock_alert, description) VALUES
('8410001112223', 'Champú Reparación Intensiva Olaplex N°4', 'Olaplex', 'Cuidado Capilar', 'retail_showcase', 14.50, 29.90, 8, 3, 'Champú reparador con tecnología de enlace molecular'),
('8410002223334', 'Acondicionador Reconstituyente Olaplex N°5', 'Olaplex', 'Cuidado Capilar', 'retail_showcase', 14.50, 29.90, 6, 2, 'Nutrición profunda para cabellos tratados y teñidos'),
('8410003334445', 'Aceite Serum Argán MoroccanOil 100ml', 'MoroccanOil', 'Acabado & Styling', 'retail_showcase', 19.00, 39.50, 4, 2, 'Tratamiento original nutritivo con infusión de aceite de argán'),
('8410004445556', 'Oxidante en Crema 20 Volúmenes 1000ml', 'L Oreal Professionnel', 'Coloración Técnica', 'internal_use', 6.20, 12.00, 15, 5, 'Oxidante profesional exclusivo para servicio de salón')
ON CONFLICT (barcode) DO NOTHING;

-- 6.9 Factura Inicial con Hash Encadenado (Dispara Trigger de Veri*Factu)
INSERT INTO invoices (series, invoice_number, type, issue_date, tax_base, vat_rate, vat_amount, total_amount, payment_method)
VALUES (
    'FS2026-',
    1001,
    'simplified',
    '2026-10-22 18:30:00+00',
    49.59,
    21.00,
    10.41,
    60.00,
    'card'
) ON CONFLICT (series, invoice_number) DO NOTHING;

-- 6.10 Historial Semilla de Sellados
INSERT INTO stamp_history (client_id, stamp_number, total_stamps_target, stamped_at, method, staff_name, reward_unlocked) VALUES
('c0000000-0000-0000-0000-000000000001', 1, 8, '2026-09-15 11:00:00+00', 'QR_SALON_SCAN', 'Elena Gómez', null),
('c0000000-0000-0000-0000-000000000001', 2, 8, '2026-09-28 16:30:00+00', 'QR_SALON_SCAN', 'Elena Gómez', null),
('c0000000-0000-0000-0000-000000000001', 3, 8, '2026-10-12 10:15:00+00', 'TPV_MANUAL_STAMP', 'Raquel Santos', null)
ON CONFLICT DO NOTHING;

-- 6.11 Tarjetas Regalo y Bonos
INSERT INTO gift_cards (code, purchased_by_client_id, recipient_name, initial_balance, current_balance, expires_at)
VALUES (
    'REGALO-LOSAN-50',
    'c0000000-0000-0000-0000-000000000001',
    'Marta Sánchez',
    50.00,
    50.00,
    '2027-10-23 23:59:59+00'
) ON CONFLICT (code) DO NOTHING;

INSERT INTO service_packages (client_id, name, total_sessions, sessions_remaining, price_paid, expires_at)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'Bono 5x Lavado, Mascarilla & Peinado Brushing',
    5,
    4,
    75.00,
    '2027-04-23 23:59:59+00'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- FIN DEL SCRIPT DE BASE DE DATOS PARA SUPABASE
-- ============================================================================
