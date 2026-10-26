CREATE SCHEMA IF NOT EXISTS forma;
SET search_path TO forma, public;

CREATE TABLE IF NOT EXISTS roles (
  id smallserial PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code IN ('customer','catalog_manager','order_manager','admin')),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id smallint NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,role_id)
);

CREATE TABLE IF NOT EXISTS user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  address_line text NOT NULL,
  postal_code text,
  is_default boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS user_default_address_unique ON user_addresses(user_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id smallserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text UNIQUE,
  parent_id smallint REFERENCES categories(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  category_id smallint NOT NULL REFERENCES categories(id),
  name text NOT NULL,
  price numeric(12,2) NOT NULL CHECK (price > 0),
  old_price numeric(12,2) CHECK (old_price IS NULL OR old_price > 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= stock),
  rating numeric(3,1) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  reviews integer NOT NULL DEFAULT 0 CHECK (reviews >= 0),
  badge text,
  short_description text NOT NULL,
  description text NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(features) = 'array'),
  art text NOT NULL DEFAULT 'lamp',
  color text NOT NULL DEFAULT '#d9d4ff',
  accent text NOT NULL DEFAULT '#6558e8',
  popularity integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id) WHERE active;
CREATE INDEX IF NOT EXISTS products_name_idx ON products(lower(name)) WHERE active;

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  alt_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS product_primary_image_unique ON product_images(product_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS product_characteristics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  value text NOT NULL,
  UNIQUE(product_id,name)
);

CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  guest_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NULL) <> (guest_token IS NULL)),
  UNIQUE(user_id)
);
CREATE TABLE IF NOT EXISTS cart_items (
  cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cart_id,product_id)
);

CREATE TABLE IF NOT EXISTS delivery_methods (
  id smallserial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  base_price numeric(12,2) NOT NULL CHECK (base_price >= 0),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS payment_methods (
  id smallserial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Нове' CHECK (status IN ('Нове','Підтверджене','Комплектується','Відправлене','Виконане','Скасоване')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  city text NOT NULL,
  branch text NOT NULL,
  delivery text NOT NULL CHECK (delivery IN ('Нова пошта','Кур’єр')),
  payment text NOT NULL CHECK (payment IN ('Оплата карткою','Післяплата')),
  delivery_method_id smallint NOT NULL REFERENCES delivery_methods(id) ON DELETE RESTRICT,
  payment_method_id smallint NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  payment_status text NOT NULL DEFAULT 'Очікується',
  comment text NOT NULL DEFAULT '',
  subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  delivery_fee numeric(12,2) NOT NULL CHECK (delivery_fee >= 0),
  total numeric(12,2) NOT NULL CHECK (total = subtotal + delivery_fee),
  idempotency_key text UNIQUE,
  request_hash text,
  guest_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS order_number_seq;
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric(12,2) NOT NULL CHECK (price > 0),
  UNIQUE(order_id, product_id)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider_reference text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','FAILED','REFUNDED')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,provider_reference)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id bigserial PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('RESERVE','RELEASE','FULFILL','ADJUST')),
  stock_delta integer NOT NULL DEFAULT 0,
  reserved_delta integer NOT NULL DEFAULT 0,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (stock_delta <> 0 OR reserved_delta <> 0)
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'EMAIL' CHECK (channel = 'EMAIL'),
  recipient text NOT NULL,
  template_code text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_pending_idx ON notification_outbox(next_attempt_at) WHERE status='PENDING';
