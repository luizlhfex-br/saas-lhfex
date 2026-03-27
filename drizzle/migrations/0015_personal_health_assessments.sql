CREATE TABLE "personal_health_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "entry_date" date NOT NULL,
  "calculation_profile" varchar(20) DEFAULT 'male' NOT NULL,
  "activity_level" varchar(30) DEFAULT 'moderate' NOT NULL,
  "custom_activity_factor" numeric(4, 3),
  "height_cm" numeric(6, 2),
  "weight_kg" numeric(6, 2),
  "neck_cm" numeric(6, 2),
  "chest_cm" numeric(6, 2),
  "waist_cm" numeric(6, 2),
  "hip_cm" numeric(6, 2),
  "left_arm_cm" numeric(6, 2),
  "right_arm_cm" numeric(6, 2),
  "left_thigh_cm" numeric(6, 2),
  "right_thigh_cm" numeric(6, 2),
  "left_calf_cm" numeric(6, 2),
  "right_calf_cm" numeric(6, 2),
  "body_fat_percent" numeric(5, 2),
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE UNIQUE INDEX "personal_health_assessment_user_date_uidx"
  ON "personal_health_assessments" ("user_id", "entry_date");

CREATE INDEX "personal_health_assessment_user_idx"
  ON "personal_health_assessments" ("user_id");

CREATE INDEX "personal_health_assessment_entry_date_idx"
  ON "personal_health_assessments" ("entry_date");

CREATE TABLE "personal_health_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "assessment_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "pose" varchar(20) NOT NULL,
  "file_url" text NOT NULL,
  "file_size" integer,
  "taken_at" date,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE UNIQUE INDEX "personal_health_photo_assessment_pose_uidx"
  ON "personal_health_photos" ("assessment_id", "pose");

CREATE INDEX "personal_health_photo_assessment_idx"
  ON "personal_health_photos" ("assessment_id");

CREATE INDEX "personal_health_photo_user_idx"
  ON "personal_health_photos" ("user_id");

ALTER TABLE "personal_health_photos"
  ADD CONSTRAINT "personal_health_photos_assessment_fk"
  FOREIGN KEY ("assessment_id") REFERENCES "public"."personal_health_assessments"("id") ON DELETE no action ON UPDATE no action;
