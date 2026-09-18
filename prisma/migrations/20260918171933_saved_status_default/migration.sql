-- AlterTable
ALTER TABLE "saved_issues" ALTER COLUMN "status" SET DEFAULT 'SAVED';

-- Remap any legacy rows so they show up in the workspace
UPDATE "saved_issues" SET "status" = 'SAVED' WHERE "status" = 'TO_EXPLORE';
UPDATE "saved_issues" SET "status" = 'IN_PROGRESS' WHERE "status" = 'SUBMITTED';