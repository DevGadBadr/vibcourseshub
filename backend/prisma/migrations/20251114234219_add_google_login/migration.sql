/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleEmailVerified" BOOLEAN,
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "googlePicture" TEXT,
ADD COLUMN     "provider" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
