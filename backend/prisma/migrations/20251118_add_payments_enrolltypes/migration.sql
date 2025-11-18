-- Migration: add Payment model and extend Enrollment & Course pricing
ALTER TABLE "Enrollment" ADD COLUMN "enrollType" TEXT NOT NULL DEFAULT 'RECORDED';
ALTER TABLE "Enrollment" ADD COLUMN "selectedStartDate" TIMESTAMP(3);
-- Drop old unique constraint
DROP INDEX IF EXISTS "Enrollment_userId_courseId_key";
-- New unique constraint includes enrollType
CREATE UNIQUE INDEX "Enrollment_userId_courseId_enrollType_key" ON "Enrollment" ("userId","courseId","enrollType");

-- Extend Course with multi pricing columns
ALTER TABLE "Course" ADD COLUMN "priceRecordedEgp" DOUBLE PRECISION;
ALTER TABLE "Course" ADD COLUMN "priceRecordedUsd" DOUBLE PRECISION;
ALTER TABLE "Course" ADD COLUMN "priceOnlineEgp" DOUBLE PRECISION;
ALTER TABLE "Course" ADD COLUMN "priceOnlineUsd" DOUBLE PRECISION;

-- Create Payment table
CREATE TABLE "Payment" (
  "id" SERIAL PRIMARY KEY,
  "userId" INT NOT NULL,
  "courseId" INT NOT NULL,
  "enrollType" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerOrderId" TEXT,
  "status" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL,
  "selectedStartDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Payment_courseId_idx" ON "Payment"("courseId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");