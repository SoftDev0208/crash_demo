/*
  Warnings:

  - You are about to drop the column `chance` on the `limbobet` table. All the data in the column will be lost.
  - You are about to drop the column `payout` on the `limbobet` table. All the data in the column will be lost.
  - You are about to drop the column `roll` on the `limbobet` table. All the data in the column will be lost.
  - Added the required column `rolledMultiplier` to the `LimboBet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetMultiplier` to the `LimboBet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `limbobet` DROP COLUMN `chance`,
    DROP COLUMN `payout`,
    DROP COLUMN `roll`,
    ADD COLUMN `rolledMultiplier` DECIMAL(10, 2) NOT NULL,
    ADD COLUMN `targetMultiplier` DECIMAL(10, 2) NOT NULL;
