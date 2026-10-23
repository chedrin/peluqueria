-- ============================================================================
-- 💈 PELUQUERÍA - ESQUEMA DE BASE DE DATOS COMPLETO PARA SUPABASE (POSTGRESQL)
-- ============================================================================
-- Este script crea todas las tablas, relaciones, índices, triggers de actualización,
-- configuración de Row Level Security (RLS) y datos iniciales para Supabase.
-- ============================================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TIPOS PERSONALIZADOS (ENUMS)
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'staff', 'client');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM ('card', 'cash', 'bizum', 'mixed', 'package', 'gift_card');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE time_record_status AS ENUM ('open', 'completed', 'adjusted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 3. FUNCIÓN TRIGGER PARA ACTUALIZACIÓN AUTOMÁTICA DE 'updated_at'
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLA 1: salon_info (Datos Comerciales y Fiscales del Salón)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.salon_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL DEFAULT 'Peluquería',
  commercial_name VARCHAR(200) NOT NULL DEFAULT 'Peluquería & Estilismo',
  legal_name VARCHAR(200) NOT NULL DEFAULT 'Peluquería & Estilismo S.L.',
  cif VARCHAR(50) NOT NULL DEFAULT 'B-87654321',
  tagline VARCHAR(255) DEFAULT 'Salón Boutique & Cuidado Capilar de Vanguardia',
  phone VARCHAR(50) DEFAULT '+34 912 345 678',
  whatsapp VARCHAR(50) DEFAULT '+34 611 223 344',
  email VARCHAR(150) DEFAULT 'contacto@peluqueria.es',
  address VARCHAR(255) DEFAULT 'Calle Alcalá 124, 28009 Madrid',
  schedule VARCHAR(255) DEFAULT 'Lunes a Viernes: 09:30 - 20:00 | Sábados: 09:00 - 15:00',
  vat_rate_default NUMERIC(5,2) DEFAULT 21.00,
  currency VARCHAR(10) DEFAULT 'EUR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA 2: users (Acceso y Roles: Admin, Estilistas, Clientas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('usr-' || gen_random_uuid()),
  username VARCHAR(100) UNIQUE,
  email VARCHAR(150) UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  dni VARCHAR(50) UNIQUE,
  phone VARCHAR(50),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  display_name VARCHAR(200),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_dni ON public.users(dni);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ============================================================================
-- TABLA 3: staff (Equipo Profesional y Estilistas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('stf-' || gen_random_uuid()),
  user_id VARCHAR(100) REFERENCES public.users(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  dni VARCHAR(50),
  phone VARCHAR(50),
  email VARCHAR(150),
  display_color VARCHAR(50) DEFAULT '#8B5CF6',
  specialty VARCHAR(150) DEFAULT 'Estilismo & Peluquería',
  chair VARCHAR(100) DEFAULT 'Sillón Principal',
  is_available BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  status VARCHAR(50) DEFAULT 'active',
  leave_reason TEXT,
  rating NUMERIC(3,2) DEFAULT 5.00,
  reviews_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_active ON public.staff(is_active);

-- ============================================================================
-- TABLA 4: staff_schedules (Configuración Horaria Semanal de Estilistas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id VARCHAR(100) NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  work_days INT[] DEFAULT '{1,2,3,4,5,6}', -- 0: Dom, 1: Lun, ..., 6: Sáb
  rest_days INT[] DEFAULT '{0}',
  start_time TIME DEFAULT '09:30:00',
  end_time TIME DEFAULT '19:30:00',
  break_start TIME DEFAULT '14:00:00',
  break_end TIME DEFAULT '15:00:00',
  shift_type VARCHAR(100) DEFAULT 'Jornada Completa',
  vacation_dates DATE[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_staff_schedule UNIQUE (staff_id)
);

-- ============================================================================
-- TABLA 5: staff_extra_days (Días Extra / Refuerzo de Fin de Semana o Campañas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_extra_days (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('xd-' || gen_random_uuid()),
  staff_id VARCHAR(100) NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift VARCHAR(100) NOT NULL DEFAULT 'Jornada Completa',
  reason TEXT DEFAULT 'Refuerzo de servicio',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_extra_days_staff_date ON public.staff_extra_days(staff_id, date);

-- ============================================================================
-- TABLA 6: staff_overtime (Registro de Horas Extras de Estilistas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_overtime (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('ot-' || gen_random_uuid()),
  staff_id VARCHAR(100) NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours NUMERIC(4,2) NOT NULL,
  reason TEXT DEFAULT 'Prolongación de servicio de peluquería',
  is_approved BOOLEAN DEFAULT TRUE,
  approved_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_overtime_staff_date ON public.staff_overtime(staff_id, date);

-- ============================================================================
-- TABLA 7: staff_schedule_overrides (Franjas Concretas Desactivadas por Día)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id VARCHAR(100) NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  disabled_slots TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_staff_override UNIQUE (staff_id, date)
);

-- ============================================================================
-- TABLA 8: clients (Ficha 360° de Clientas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('cli-' || gen_random_uuid()),
  user_id VARCHAR(100) REFERENCES public.users(id) ON DELETE SET NULL,
  dni VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(150),
  birth_date DATE,
  allergies TEXT,
  general_notes TEXT,
  hair_type TEXT,
  scalp_type TEXT,
  technical_formulas TEXT,
  preferred_stylist VARCHAR(150),
  beverage_preference VARCHAR(150),
  loyalty_tier VARCHAR(50) DEFAULT 'Club Salón',
  loyalty_points INT DEFAULT 0,
  stamps_count INT DEFAULT 0,
  completed_cards_count INT DEFAULT 0,
  active_rewards JSONB DEFAULT '[]'::jsonb,
  google_review_verified BOOLEAN DEFAULT FALSE,
  qr_code_hash VARCHAR(150) UNIQUE,
  marketing_consent BOOLEAN DEFAULT TRUE,
  gdpr_consent BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_dni ON public.clients(dni);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);

-- ============================================================================
-- TABLA 9: technical_records (Historial Técnico Capilar y de Coloración)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.technical_records (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('tec-' || gen_random_uuid()),
  client_id VARCHAR(100) NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  staff_id VARCHAR(100) REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_name VARCHAR(150) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  dye_formula TEXT,
  technique_used TEXT,
  exposure_time_minutes INT,
  observations TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technical_records_client ON public.technical_records(client_id);

-- ============================================================================
-- TABLA 10: services (Catálogo de Servicios, Duraciones y Consumibles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.services (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('srv-' || gen_random_uuid()),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'corte',
  duration_minutes INT NOT NULL DEFAULT 30,
  price NUMERIC(10,2) NOT NULL,
  vat_rate NUMERIC(5,2) DEFAULT 21.00,
  required_materials TEXT,
  description TEXT,
  is_online_booking BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);

-- ============================================================================
-- TABLA 11: appointments (Agenda Maestra Multicanal y Citas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('apt-' || gen_random_uuid()),
  client_id VARCHAR(100) REFERENCES public.clients(id) ON DELETE SET NULL,
  client_dni VARCHAR(50),
  client_name VARCHAR(150) NOT NULL,
  staff_id VARCHAR(100) NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  staff_name VARCHAR(150) NOT NULL,
  service_ids TEXT[] DEFAULT '{}',
  service_names TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status appointment_status DEFAULT 'confirmed',
  total_price NUMERIC(10,2) DEFAULT 0.00,
  payment_status VARCHAR(50) DEFAULT 'pending',
  client_comments TEXT,
  reminder_sent_24h BOOLEAN DEFAULT FALSE,
  reminder_sent_2h BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_staff_time ON public.appointments(staff_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

-- ============================================================================
-- TABLA 12: appointment_audit_logs (Auditoría de Cambios y Reubicación de Citas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.appointment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id VARCHAR(100) NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'RESCHEDULED', 'STATUS_CHANGE', 'CANCELLED', etc.
  performed_by VARCHAR(150) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_appointment ON public.appointment_audit_logs(appointment_id);

-- ============================================================================
-- TABLA 13: products (Inventario de Productos y Stock de Reventa / Consumo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('prd-' || gen_random_uuid()),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  brand VARCHAR(150),
  supplier VARCHAR(200),
  category VARCHAR(100) DEFAULT 'Capilar',
  price NUMERIC(10,2) NOT NULL, -- PVP Venta
  cost_price NUMERIC(10,2) NOT NULL, -- Precio Compra Actual
  last_cost_price NUMERIC(10,2), -- Precio Compra Anterior
  stock INT NOT NULL DEFAULT 0,
  min_stock INT DEFAULT 3,
  vat_rate NUMERIC(5,2) DEFAULT 21.00,
  is_showcase BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  barcode VARCHAR(100),
  img TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);

-- ============================================================================
-- TABLA 14: product_purchases (Histórico de Compras y Entradas de Almacén)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_purchases (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('pch-' || gen_random_uuid()),
  product_id VARCHAR(100) NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier VARCHAR(200) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(10,2) NOT NULL,
  total_cost NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  invoice_number VARCHAR(100),
  purchase_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_purchases_prod ON public.product_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_date ON public.product_purchases(purchase_date);

-- ============================================================================
-- TABLA 15: packages (Catálogo de Bonos de Sesiones y Regalos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.packages (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('pkg-' || gen_random_uuid()),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) DEFAULT 'Tratamientos',
  description TEXT,
  total_sessions INT NOT NULL CHECK (total_sessions > 0),
  price NUMERIC(10,2) NOT NULL, -- Precio con descuento del bono
  regular_price NUMERIC(10,2) NOT NULL, -- Precio regular sumado
  discount_amount NUMERIC(10,2) GENERATED ALWAYS AS (regular_price - price) STORED,
  discount_percent NUMERIC(5,2),
  valid_days INT DEFAULT 180,
  included_services TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA 16: client_packages (Bonos Adquiridos por Clientas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_packages (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('cpkg-' || gen_random_uuid()),
  package_id VARCHAR(100) REFERENCES public.packages(id) ON DELETE SET NULL,
  package_name VARCHAR(200) NOT NULL,
  client_id VARCHAR(100) REFERENCES public.clients(id) ON DELETE CASCADE,
  client_dni VARCHAR(50),
  client_name VARCHAR(150) NOT NULL,
  client_phone VARCHAR(50),
  client_email VARCHAR(150),
  total_sessions INT NOT NULL,
  used_sessions INT NOT NULL DEFAULT 0,
  remaining_sessions INT NOT NULL,
  regular_price NUMERIC(10,2),
  package_price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2),
  discount_amount NUMERIC(10,2),
  purchase_date DATE DEFAULT CURRENT_DATE,
  expires_at DATE,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'expired'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_packages_client ON public.client_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_client_packages_status ON public.client_packages(status);

-- ============================================================================
-- TABLA 17: package_redemptions (Histórico de Canjes y Sesiones Consumidas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.package_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_package_id VARCHAR(100) NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
  session_number INT NOT NULL,
  redemption_date DATE DEFAULT CURRENT_DATE,
  redemption_time TIME DEFAULT CURRENT_TIME,
  staff_name VARCHAR(150) NOT NULL,
  notes TEXT,
  notified_via VARCHAR(50) DEFAULT 'whatsapp_and_email',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_package_redemptions_pkg ON public.package_redemptions(client_package_id);

-- ============================================================================
-- TABLA 18: gift_cards (Tarjetas Regalo del Salón)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('gc-' || gen_random_uuid()),
  code VARCHAR(100) UNIQUE NOT NULL,
  initial_balance NUMERIC(10,2) NOT NULL,
  remaining_balance NUMERIC(10,2) NOT NULL,
  buyer_name VARCHAR(150) NOT NULL,
  buyer_email VARCHAR(150),
  recipient_name VARCHAR(150) NOT NULL,
  recipient_dni VARCHAR(50),
  message TEXT,
  expires_at DATE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON public.gift_cards(code);

-- ============================================================================
-- TABLA 19: loyalty_config (Parámetros de la Tarjeta de Sellos y Club VIP)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loyalty_config (
  id INT PRIMARY KEY DEFAULT 1,
  total_stamps INT NOT NULL DEFAULT 8,
  reward_description TEXT NOT NULL DEFAULT 'Tratamiento de Hidratación Profunda Olaplex o Corte Gratis',
  salon_qr_secret VARCHAR(100) NOT NULL DEFAULT 'PELU-STAMP-QR-2026',
  points_per_euro NUMERIC(5,2) DEFAULT 1.00,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA 20: loyalty_transactions (Histórico de Movimientos de Puntos y Sellos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('lt-' || gen_random_uuid()),
  client_id VARCHAR(100) NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name VARCHAR(150) NOT NULL,
  client_dni VARCHAR(50),
  type VARCHAR(50) NOT NULL, -- 'stamp_added', 'points_added', 'reward_redeemed', 'manual_adjustment'
  stamps_delta INT DEFAULT 0,
  points_delta INT DEFAULT 0,
  reason TEXT NOT NULL,
  staff_id VARCHAR(100) REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_trans_client ON public.loyalty_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_trans_created ON public.loyalty_transactions(created_at);

-- ============================================================================
-- TABLA 21: stamp_history (Histórico de Sellado Manual y QR)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stamp_history (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('stmp-' || gen_random_uuid()),
  client_id VARCHAR(100) NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_dni VARCHAR(50),
  date DATE DEFAULT CURRENT_DATE,
  time TIME DEFAULT CURRENT_TIME,
  staff_name VARCHAR(150) NOT NULL,
  appointment_id VARCHAR(100),
  service_name VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stamp_history_client ON public.stamp_history(client_id);

-- ============================================================================
-- TABLA 22: time_records (Control Horario y Fichajes Legales de Estilistas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.time_records (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('tr-' || gen_random_uuid()),
  staff_id VARCHAR(100) NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  staff_dni VARCHAR(50),
  staff_name VARCHAR(150) NOT NULL,
  chair VARCHAR(100),
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  breaks JSONB DEFAULT '[]'::jsonb, -- Array de { start: timestamp, end: timestamp }
  break_minutes INT DEFAULT 0,
  effective_minutes INT DEFAULT 0,
  effective_hours NUMERIC(5,2) DEFAULT 0.00,
  overtime_hours NUMERIC(5,2) DEFAULT 0.00,
  status time_record_status DEFAULT 'open',
  device VARCHAR(100) DEFAULT 'TouchScreen TPV Salón',
  notes TEXT,
  verified_by_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_records_staff_date ON public.time_records(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_time_records_date ON public.time_records(date);

-- ============================================================================
-- TABLA 23: staff_tips (Control de Propinas por Empleada)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_tips (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('tip-' || gen_random_uuid()),
  staff_id VARCHAR(100) NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method payment_method_type NOT NULL DEFAULT 'bizum',
  reason TEXT NOT NULL,
  client_name VARCHAR(150),
  date DATE DEFAULT CURRENT_DATE,
  time TIME DEFAULT CURRENT_TIME,
  appointment_id VARCHAR(100) REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_tips_staff ON public.staff_tips(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_tips_date ON public.staff_tips(date);

-- ============================================================================
-- TABLA 24: invoices (Facturación Legal y Veri*Factu - Ley 11/2021)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('inv-' || gen_random_uuid()),
  series VARCHAR(50) NOT NULL DEFAULT 'FS2026',
  invoice_number INT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'simplified', -- 'simplified', 'standard'
  issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  appointment_id VARCHAR(100) REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_id VARCHAR(100) REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name VARCHAR(150) NOT NULL,
  client_nif VARCHAR(50) DEFAULT 'N/A',
  tax_base NUMERIC(10,2) NOT NULL,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 21.00,
  vat_amount NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  payment_method payment_method_type NOT NULL DEFAULT 'card',
  previous_invoice_hash VARCHAR(100),
  record_hash VARCHAR(100) NOT NULL,
  qr_url TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de { name, qty, price, vat, total }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_series_invoice_number UNIQUE (series, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_hash ON public.invoices(record_hash);

-- ============================================================================
-- TABLA 25: notifications (Avisos de Cobro en Caja y Alertas Internas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('notif-' || gen_random_uuid()),
  type VARCHAR(100) NOT NULL DEFAULT 'SERVICE_COMPLETED',
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  staff_name VARCHAR(150),
  client_name VARCHAR(150),
  appointment_id VARCHAR(100) REFERENCES public.appointments(id) ON DELETE CASCADE,
  amount NUMERIC(10,2),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);

-- ============================================================================
-- TABLA 26: consultations (Diagnóstico Capilar y Cuestionario Previo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.consultations (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('con-' || gen_random_uuid()),
  client_id VARCHAR(100) NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_dni VARCHAR(50),
  client_name VARCHAR(150) NOT NULL,
  hair_type TEXT,
  scalp_condition TEXT,
  chemical_history TEXT,
  wash_frequency VARCHAR(100),
  main_goal TEXT,
  allergies_confirmed BOOLEAN DEFAULT TRUE,
  patch_test_verified BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_client ON public.consultations(client_id);

-- ============================================================================
-- TABLA 27: gallery_looks (Lookbook y Catálogo Visual de Trabajos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gallery_looks (
  id VARCHAR(100) PRIMARY KEY DEFAULT ('look-' || gen_random_uuid()),
  title VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Coloración',
  stylist_id VARCHAR(100) REFERENCES public.staff(id) ON DELETE SET NULL,
  stylist_name VARCHAR(150) NOT NULL,
  before_img TEXT,
  after_img TEXT NOT NULL,
  description TEXT,
  formula_summary TEXT,
  duration_minutes INT DEFAULT 60,
  price_estimate NUMERIC(10,2),
  service_ids TEXT[] DEFAULT '{}',
  likes_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA DE updated_at
-- ============================================================================
CREATE OR REPLACE TRIGGER trg_salon_info_updated_at BEFORE UPDATE ON public.salon_info FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER trg_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER trg_staff_schedules_updated_at BEFORE UPDATE ON public.staff_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER trg_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER trg_client_packages_updated_at BEFORE UPDATE ON public.client_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER trg_gift_cards_updated_at BEFORE UPDATE ON public.gift_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER trg_time_records_updated_at BEFORE UPDATE ON public.time_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. POLÍTICAS DE ROW LEVEL SECURITY (RLS) PARA SUPABASE
-- ============================================================================
-- Habilitamos RLS en todas las tablas
ALTER TABLE public.salon_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_extra_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_overtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_looks ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas por defecto para el backend y API pública
-- (En producción con Supabase Auth se pueden restringir por auth.jwt() ->> 'role')
CREATE POLICY "Acceso total para administradores y backend autenticado" ON public.salon_info FOR ALL USING (true);
CREATE POLICY "Lectura pública del salón" ON public.salon_info FOR SELECT USING (true);

CREATE POLICY "Acceso de usuarios" ON public.users FOR ALL USING (true);
CREATE POLICY "Acceso de staff" ON public.staff FOR ALL USING (true);
CREATE POLICY "Lectura de servicios" ON public.services FOR SELECT USING (true);
CREATE POLICY "Gestión de servicios por admin" ON public.services FOR ALL USING (true);
CREATE POLICY "Gestión de citas" ON public.appointments FOR ALL USING (true);
CREATE POLICY "Gestión de clientas" ON public.clients FOR ALL USING (true);
CREATE POLICY "Lectura de catálogo productos" ON public.products FOR SELECT USING (true);
CREATE POLICY "Gestión de productos" ON public.products FOR ALL USING (true);
CREATE POLICY "Lectura de bonos catálogo" ON public.packages FOR SELECT USING (true);
CREATE POLICY "Gestión de bonos de clientes" ON public.client_packages FOR ALL USING (true);
CREATE POLICY "Gestión de lookbook" ON public.gallery_looks FOR ALL USING (true);
CREATE POLICY "Lectura pública de lookbook" ON public.gallery_looks FOR SELECT USING (true);
CREATE POLICY "Control horario y fichajes" ON public.time_records FOR ALL USING (true);
CREATE POLICY "Facturas VeriFactu" ON public.invoices FOR ALL USING (true);
CREATE POLICY "Notificaciones" ON public.notifications FOR ALL USING (true);
CREATE POLICY "Fidelización" ON public.loyalty_transactions FOR ALL USING (true);
CREATE POLICY "Fichas técnicas" ON public.technical_records FOR ALL USING (true);

-- ============================================================================
-- 6. DATOS INICIALES (SEED DATA)
-- ============================================================================

-- A. Datos del Salón
INSERT INTO public.salon_info (id, name, commercial_name, legal_name, cif, phone, whatsapp, email, address)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Peluquería',
  'Peluquería & Estilismo',
  'Peluquería & Estilismo S.L.',
  'B-87654321',
  '+34 912 345 678',
  '+34 611 223 344',
  'contacto@peluqueria.es',
  'Calle Alcalá 124, 28009 Madrid'
) ON CONFLICT DO NOTHING;

-- B. Configuración de Fidelización
INSERT INTO public.loyalty_config (id, total_stamps, reward_description, salon_qr_secret)
VALUES (
  1,
  8,
  'Tratamiento de Hidratación Profunda Olaplex o Corte Gratis',
  'PELU-STAMP-QR-2026'
) ON CONFLICT (id) DO NOTHING;

-- C. Usuarios Requeridos (Admin y Estilistas)
INSERT INTO public.users (id, username, email, password_hash, role, first_name, last_name, display_name, phone, is_active)
VALUES
  ('usr-admin-1', 'admin', 'admin@peluqueria.es', 'admin123', 'admin', 'Marisa', 'Garrido', 'Marisa Garrido (Gerente)', '34611111111', TRUE),
  ('usr-staff-1', 'elena', 'elena@peluqueria.es', 'elena1234', 'staff', 'Elena', 'Gómez', 'Elena Gómez (Colorimetría)', '34622222222', TRUE),
  ('usr-staff-2', 'raquel', 'raquel@peluqueria.es', 'raquel1234', 'staff', 'Raquel', 'Santos', 'Raquel Santos (Cortes & Estilismo)', '34633333333', TRUE),
  ('usr-staff-3', 'carmen', 'carmen@peluqueria.es', 'carmen1234', 'staff', 'Carmen', 'Vidal', 'Carmen Vidal (Tratamientos)', '34644444444', TRUE),
  ('usr-client-1', 'laura', 'laura.martinez@email.com', 'client123', 'client', 'Laura', 'Martínez', 'Laura Martínez', '34655555555', TRUE)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash;

-- D. Estilistas Profesionales
INSERT INTO public.staff (id, user_id, name, dni, phone, email, display_color, specialty, chair, is_available, is_active, status)
VALUES
  ('stf-1', 'usr-staff-1', 'Elena Gómez', '54321678E', '+34 622 222 222', 'elena@peluqueria.es', '#8B5CF6', 'Colorimetría & Balayage', 'Sillón 1 (Color)', TRUE, TRUE, 'active'),
  ('stf-2', 'usr-staff-2', 'Raquel Santos', '43218765R', '+34 633 333 333', 'raquel@peluqueria.es', '#EC4899', 'Corte de Precisión & Styling', 'Sillón 2 (Corte)', TRUE, TRUE, 'active'),
  ('stf-3', 'usr-staff-3', 'Carmen Vidal', '32165498C', '+34 644 444 444', 'carmen@peluqueria.es', '#10B981', 'Tratamientos Capilares & Brushing', 'Sillón 3 (Spa Capilar)', TRUE, TRUE, 'active')
ON CONFLICT (id) DO NOTHING;

-- E. Horarios Base de Estilistas
INSERT INTO public.staff_schedules (staff_id, work_days, rest_days, start_time, end_time, break_start, break_end, shift_type)
VALUES
  ('stf-1', '{1,2,3,4,5}', '{0,6}', '09:00:00', '19:00:00', '14:00:00', '15:00:00', 'Jornada Completa'),
  ('stf-2', '{1,2,3,4,5,6}', '{0}', '09:30:00', '19:30:00', '13:30:00', '14:30:00', 'Jornada Completa'),
  ('stf-3', '{1,2,3,4,5}', '{0,6}', '10:00:00', '18:00:00', '14:00:00', '15:00:00', 'Turno Intensivo')
ON CONFLICT (staff_id) DO NOTHING;

-- F. Catálogo de Servicios Iniciales
INSERT INTO public.services (id, name, category, duration_minutes, price, vat_rate, required_materials, description)
VALUES
  ('srv-1', 'Corte y Estilismo', 'corte', 30, 22.00, 21.00, 'Tijeras ergonómicas, capa desechable, champú neutro dermo-protector', 'Corte personalizado con asesoría de visagismo y lavado relajante.'),
  ('srv-2', 'Coloración Completa (Tinte)', 'coloracion', 60, 38.00, 21.00, 'Tinte Igora Royal (60ml), oxidante 20vol (60ml), paletina, toalla negra', 'Tinte homogéneo con cobertura 100% de canas y brillo espejo.'),
  ('srv-3', 'Mechas Balayage & Matiz Gloss', 'coloracion', 90, 68.00, 21.00, 'Decoloración Blondme (45g), oxidante 20vol (90ml), matizador 9.5-1, papel térmico', 'Degradado sutil efecto luz natural sin efecto raíz.'),
  ('srv-4', 'Tratamiento Botox Capilar Rejuvenecedor', 'tratamiento', 45, 45.00, 21.00, 'Vial Botox Capilar Ácido Hialurónico (30ml), gorro térmico', 'Ritual de relleno y nutrición profunda para cabellos secos o dañados.'),
  ('srv-5', 'Peinado & Brushing Glamour', 'peinado', 30, 18.00, 21.00, 'Cepillo redondo cerdas naturales, protector térmico Moroccanoil, secador', 'Lavado, masaje craneal y secado profesional pulido o con ondas.')
ON CONFLICT (id) DO NOTHING;

-- G. Clientas Iniciales de Muestra
INSERT INTO public.clients (id, dni, user_id, name, phone, email, allergies, general_notes, hair_type, scalp_type, technical_formulas, preferred_stylist, beverage_preference, loyalty_tier, loyalty_points, stamps_count, qr_code_hash)
VALUES
  ('cli-1', '12345678Z', 'usr-client-1', 'Laura Martínez', '34655555555', 'laura.martinez@email.com', 'Sensibilidad al amoniaco concentrado', 'Prefiere tonos cobrizos sutiles. Suele pedir café con leche sin azúcar.', 'Fino, ondulado', 'Sensible reactivo', 'Igora Royal 9.5-1 + Ox 20vol + 5ml Olaplex', 'Elena Gómez', 'Café con leche de avena', 'Club VIP Oro', 120, 3, 'QR-12345678Z-77492-HASH'),
  ('cli-2', '87654321X', NULL, 'Sofía Morales', '34666666666', 'sofia.morales@email.com', 'Sin alergias conocidas', 'Corte en capas para aportar volumen.', 'Liso muy fino', 'Normal', 'Corte a navaja y tijera de entresacar', 'Raquel Santos', 'Agua con gas y limón', 'Club Salón', 50, 1, 'QR-87654321X-88319-HASH'),
  ('cli-3', '45678912C', NULL, 'Carmen Sánchez', '34677777777', 'carmen.sanchez@email.com', 'Alergia al níquel', 'Prefiere cortes despuntados y flequillo cortina.', 'Ondulado grueso', 'Normal', 'Brushing liso con plancha GHD', 'Elena Gómez', 'Té verde', 'Club Salón', 75, 4, 'QR-45678912C-99214-HASH')
ON CONFLICT (id) DO NOTHING;

-- H. Catálogo de Bonos de Sesiones
INSERT INTO public.packages (id, name, category, description, total_sessions, price, regular_price, valid_days, included_services)
VALUES
  ('pkg-1', 'Bono 5 Sesiones Peinado & Brushing (1 Gratis)', 'Peinados', 'Pagas 4 y disfrutas 5 sesiones con lavado e hidratación exprés incluidos.', 5, 72.00, 90.00, 180, '{"Peinado & Brushing Glamour"}'),
  ('pkg-2', 'Bono 4 Sesiones Ritual Spa & Hidratación Capilar', 'Tratamientos', 'Tratamiento profundo mensual de nutrición celular con ácido hialurónico.', 4, 135.00, 180.00, 240, '{"Tratamiento Botox Capilar Rejuvenecedor"}'),
  ('pkg-3', 'Bono 6 Cortes de Pelo Estilismo', 'Cortes', 'Mantenimiento semestral de corte de precisión y peinado.', 6, 105.60, 132.00, 365, '{"Corte y Estilismo"}')
ON CONFLICT (id) DO NOTHING;

-- I. Inventario de Productos Inicial
INSERT INTO public.products (id, sku, name, brand, supplier, price, cost_price, last_cost_price, stock, min_stock, vat_rate, is_showcase)
VALUES
  ('prd-1', 'COS-001', 'Champú Hidratante Argán Bio (250ml)', 'Moroccanoil', 'Moroccanoil España S.L.', 24.50, 12.00, 11.50, 8, 3, 21.00, TRUE),
  ('prd-2', 'COS-002', 'Mascarilla Reparación Intensa Olaplex Nº3', 'Olaplex', 'Distribuidora Belleza Pro', 29.90, 15.20, 14.80, 5, 2, 21.00, TRUE),
  ('prd-3', 'COS-003', 'Aceite Tratamiento Moroccanoil Original 100ml', 'Moroccanoil', 'Moroccanoil España S.L.', 46.00, 24.00, 23.50, 6, 2, 21.00, TRUE),
  ('prd-4', 'TINT-951', 'Tubo Tinte Igora Royal 9.5-1 Rubio Platino (60ml)', 'Schwarzkopf Pro', 'Schwarzkopf Professional', 9.50, 4.30, 4.10, 18, 5, 21.00, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- FIN DEL ESQUEMA SUPABASE
-- ============================================================================
