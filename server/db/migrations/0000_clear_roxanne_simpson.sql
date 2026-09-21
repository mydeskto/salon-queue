CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'checked_in', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."chair_status" AS ENUM('free', 'occupied', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'upi', 'other');--> statement-breakpoint
CREATE TYPE "public"."salon_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."token_source" AS ENUM('kiosk', 'appointment', 'reception');--> statement-breakpoint
CREATE TYPE "public"."token_status" AS ENUM('waiting', 'in_service', 'awaiting_payment', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'salon_admin', 'receptionist', 'employee');--> statement-breakpoint
CREATE TABLE "appointment_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"service_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"customer_name" varchar(120) NOT NULL,
	"customer_phone" varchar(40) NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"requested_employee_id" uuid,
	"notes" varchar(500),
	"token_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"salon_id" uuid NOT NULL,
	"receptionist_id" uuid,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"label" varchar(60) NOT NULL,
	"status" "chair_status" DEFAULT 'free' NOT NULL,
	"current_token_id" uuid,
	"current_employee_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_employee_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"stat_date" date NOT NULL,
	"customers_served" integer DEFAULT 0 NOT NULL,
	"services_completed" integer DEFAULT 0 NOT NULL,
	"revenue_generated" numeric(12, 2) DEFAULT '0' NOT NULL,
	"average_service_minutes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"service_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"salon_id" uuid NOT NULL,
	"shift_start" time,
	"shift_end" time,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"address" varchar(400),
	"phone" varchar(40),
	"logo_url" varchar(500),
	"status" "salon_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(500),
	"category" varchar(80),
	"price" numeric(10, 2) NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"price_at_booking" numeric(10, 2) NOT NULL,
	"duration_at_booking" integer DEFAULT 30 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"token_number" varchar(20) NOT NULL,
	"token_date" date DEFAULT CURRENT_DATE NOT NULL,
	"sequence" integer NOT NULL,
	"customer_name" varchar(120),
	"customer_phone" varchar(40),
	"chair_id" uuid,
	"employee_id" uuid,
	"requested_employee_id" uuid,
	"status" "token_status" DEFAULT 'waiting' NOT NULL,
	"source" "token_source" DEFAULT 'kiosk' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"service_started_at" timestamp with time zone,
	"service_completed_at" timestamp with time zone,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid,
	"name" varchar(120) NOT NULL,
	"email" varchar(200) NOT NULL,
	"phone" varchar(40),
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_requested_employee_id_employees_id_fk" FOREIGN KEY ("requested_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_receptionist_id_users_id_fk" FOREIGN KEY ("receptionist_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chairs" ADD CONSTRAINT "chairs_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chairs" ADD CONSTRAINT "chairs_current_employee_id_employees_id_fk" FOREIGN KEY ("current_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_employee_stats" ADD CONSTRAINT "daily_employee_stats_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_employee_stats" ADD CONSTRAINT "daily_employee_stats_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_services" ADD CONSTRAINT "employee_services_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_services" ADD CONSTRAINT "employee_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_services" ADD CONSTRAINT "token_services_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_services" ADD CONSTRAINT "token_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_chair_id_chairs_id_fk" FOREIGN KEY ("chair_id") REFERENCES "public"."chairs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_requested_employee_id_employees_id_fk" FOREIGN KEY ("requested_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_services_pair_unique" ON "appointment_services" USING btree ("appointment_id","service_id");--> statement-breakpoint
CREATE INDEX "appointments_salon_idx" ON "appointments" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "appointments_salon_schedule_idx" ON "appointments" USING btree ("salon_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "bill_items_bill_idx" ON "bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_token_unique" ON "bills" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "bills_salon_idx" ON "bills" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "bills_salon_created_idx" ON "bills" USING btree ("salon_id","created_at");--> statement-breakpoint
CREATE INDEX "chairs_salon_idx" ON "chairs" USING btree ("salon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chairs_salon_label_unique" ON "chairs" USING btree ("salon_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_employee_stats_unique" ON "daily_employee_stats" USING btree ("employee_id","stat_date");--> statement-breakpoint
CREATE INDEX "daily_employee_stats_salon_date_idx" ON "daily_employee_stats" USING btree ("salon_id","stat_date");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_services_pair_unique" ON "employee_services" USING btree ("employee_id","service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_user_unique" ON "employees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "employees_salon_idx" ON "employees" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "services_salon_idx" ON "services" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "token_services_token_idx" ON "token_services" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "token_services_service_idx" ON "token_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "tokens_salon_idx" ON "tokens" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "tokens_salon_status_idx" ON "tokens" USING btree ("salon_id","status");--> statement-breakpoint
CREATE INDEX "tokens_salon_created_idx" ON "tokens" USING btree ("salon_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tokens_salon_date_number_unique" ON "tokens" USING btree ("salon_id","token_date","token_number");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_salon_idx" ON "users" USING btree ("salon_id");