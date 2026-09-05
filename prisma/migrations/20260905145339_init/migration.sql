-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "github_id" TEXT NOT NULL,
    "github_username" TEXT NOT NULL,
    "avatar_url" TEXT,
    "access_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repos" (
    "id" TEXT NOT NULL,
    "github_repo_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "description" TEXT,
    "stars" INTEGER NOT NULL,
    "language" TEXT,
    "owner_login" TEXT NOT NULL,
    "created_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "repos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "github_issue_id" TEXT NOT NULL,
    "repo_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body_preview" TEXT,
    "state" TEXT NOT NULL,
    "author_association" TEXT NOT NULL,
    "comments_count" INTEGER,
    "is_assigned" BOOLEAN,
    "has_linked_pr" BOOLEAN,
    "created_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repo_health" (
    "id" TEXT NOT NULL,
    "repo_id" TEXT NOT NULL,
    "pr_merge_rate" DOUBLE PRECISION,
    "avg_first_response_hours" DOUBLE PRECISION,
    "avg_comments_before_merge" DOUBLE PRECISION,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "repo_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_issues" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "saved_at" TIMESTAMP(3),

    CONSTRAINT "saved_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scores" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "scored_at" TIMESTAMP(3),

    CONSTRAINT "ai_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "repos_github_repo_id_key" ON "repos"("github_repo_id");

-- CreateIndex
CREATE UNIQUE INDEX "issues_github_issue_id_key" ON "issues"("github_issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "repo_health_repo_id_key" ON "repo_health"("repo_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_scores_issue_id_key" ON "ai_scores"("issue_id");

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_health" ADD CONSTRAINT "repo_health_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_issues" ADD CONSTRAINT "saved_issues_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_issues" ADD CONSTRAINT "saved_issues_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scores" ADD CONSTRAINT "ai_scores_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
