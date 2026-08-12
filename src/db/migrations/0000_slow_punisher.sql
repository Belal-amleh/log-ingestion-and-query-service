CREATE TYPE "public"."log_level" AS ENUM('info', 'warn', 'error', 'debug');--> statement-breakpoint
CREATE TABLE "logs" (
	"id" bigserial NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"level" "log_level" NOT NULL,
	"service" text NOT NULL,
	"message" text NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "logs_pkey" PRIMARY KEY("id","timestamp")
)PARTITION BY RANGE ("timestamp");

CREATE TABLE "logs_2026_08"
PARTITION OF "logs"
FOR VALUES FROM ('2026-08-01 00:00:00+00')
           TO ('2026-09-01 00:00:00+00');

CREATE TABLE "logs_2026_09"
PARTITION OF "logs"
FOR VALUES FROM ('2026-09-01 00:00:00+00')
           TO ('2026-10-01 00:00:00+00');

CREATE TABLE "logs_2026_10"
PARTITION OF "logs"
FOR VALUES FROM ('2026-10-01 00:00:00+00')
           TO ('2026-11-01 00:00:00+00');

CREATE TABLE "logs_default"
PARTITION OF "logs"
DEFAULT;
--> statement-breakpoint
CREATE INDEX "logs_timestamp_idx" ON "logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "logs_service_idx" ON "logs" USING btree ("service");--> statement-breakpoint
CREATE INDEX "logs_level_idx" ON "logs" USING btree ("level");