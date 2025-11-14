-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Course_position_idx" ON "Course"("position");
