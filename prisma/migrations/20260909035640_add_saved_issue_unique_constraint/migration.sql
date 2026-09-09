/*
  Warnings:

  - A unique constraint covering the columns `[user_id,issue_id]` on the table `saved_issues` will be added. If there are existing duplicate values, this will fail.
  - Made the column `comments_count` on table `issues` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_assigned` on table `issues` required. This step will fail if there are existing NULL values in that column.
  - Made the column `has_linked_pr` on table `issues` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `issues` required. This step will fail if there are existing NULL values in that column.
  - Made the column `number` on table `issues` required. This step will fail if there are existing NULL values in that column.
  - Made the column `url` on table `issues` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "issues" ALTER COLUMN "comments_count" SET NOT NULL,
ALTER COLUMN "comments_count" SET DEFAULT 0,
ALTER COLUMN "is_assigned" SET NOT NULL,
ALTER COLUMN "is_assigned" SET DEFAULT false,
ALTER COLUMN "has_linked_pr" SET NOT NULL,
ALTER COLUMN "has_linked_pr" SET DEFAULT false,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "number" SET NOT NULL,
ALTER COLUMN "url" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "saved_issues_user_id_issue_id_key" ON "saved_issues"("user_id", "issue_id");
