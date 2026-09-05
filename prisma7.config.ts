import dotenv from "dotenv";
import path from "path";
import { defineConfig } from "prisma/config";

// Force dotenv to load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});