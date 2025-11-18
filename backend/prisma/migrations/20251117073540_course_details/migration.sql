-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "currency" TEXT DEFAULT 'EGP',
ADD COLUMN     "fullDescription" TEXT,
ADD COLUMN     "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "previewVideoUrl" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "subtitleLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CourseLearningOutcome" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLearningOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCurriculumSection" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "totalDurationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseCurriculumSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLecture" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "previewUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLecture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseLearningOutcome_courseId_idx" ON "CourseLearningOutcome"("courseId");

-- CreateIndex
CREATE INDEX "CourseLearningOutcome_courseId_position_idx" ON "CourseLearningOutcome"("courseId", "position");

-- CreateIndex
CREATE INDEX "CourseCurriculumSection_courseId_idx" ON "CourseCurriculumSection"("courseId");

-- CreateIndex
CREATE INDEX "CourseCurriculumSection_courseId_position_idx" ON "CourseCurriculumSection"("courseId", "position");

-- CreateIndex
CREATE INDEX "CourseLecture_sectionId_idx" ON "CourseLecture"("sectionId");

-- CreateIndex
CREATE INDEX "CourseLecture_sectionId_position_idx" ON "CourseLecture"("sectionId", "position");

-- AddForeignKey
ALTER TABLE "CourseLearningOutcome" ADD CONSTRAINT "CourseLearningOutcome_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCurriculumSection" ADD CONSTRAINT "CourseCurriculumSection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLecture" ADD CONSTRAINT "CourseLecture_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseCurriculumSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
