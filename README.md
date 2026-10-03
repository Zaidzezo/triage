# Triage

**Discover GitHub issues worth contributing to.**

Triage helps developers find open-source issues that match their interests and experience without spending hours searching through GitHub.

Search repositories and issues, filter by language, stars, assignment status, pull-request activity, and other signals, then use AI to estimate issue difficulty. Save promising issues and organize them in a contribution workspace.

**[Live Demo](https://triage-ewhp.onrender.com)**

<br>

<p align="center">
  <img src="https://github.com/user-attachments/assets/c57c10cb-8d2f-4541-8df8-a5274f90b987" width="95%" />
</p>

<br>

<p align="center">
  <img src="https://github.com/user-attachments/assets/df5b716a-9c7f-45a2-a0ac-c442727e91e3" width="95%" />
</p>

<br>

<p align="center">
  <img src="https://github.com/user-attachments/assets/a737c210-99d9-4722-875b-48c3afa27d20" width="95%" />
</p>


---

## What Triage Does

Finding a good open-source issue is often harder than solving one.

A repository may contain hundreds or thousands of open issues, and important context is spread across issue metadata, repository activity, and GitHub discussions.

Triage brings that information into one workflow:

**Discover → Filter → Evaluate → Save → Plan → Contribute**

### Core Features

* **GitHub authentication** — Sign in securely with GitHub OAuth.
* **Issue discovery** — Search GitHub repositories and open issues.
* **Advanced filtering** — Narrow results using language, repository stars, comments, linked pull requests, author information, and more.
* **Sorting & pagination** — Browse results efficiently instead of loading an unbounded issue list.
* **AI difficulty scoring** — Get an estimated difficulty level and explanation for an issue.
* **Saved issues** — Keep issues you're interested in for later.
* **Contribution workspace** — Organize saved issues through workflow statuses such as Saved, Planned, In Progress, and Completed.
* **Persistent storage** — User accounts, saved issues, repository data, and AI scores are stored in PostgreSQL.

---

## How It Works

```text
                        ┌─────────────────────┐
                        │      Browser        │
                        └──────────┬──────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │      Next.js        │
                        │   App Router / UI   │
                        └──────────┬──────────┘
                                   │
                   ┌───────────────┼────────────────┐
                   ▼               ▼                ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │   Auth.js   │ │ API Routes  │ │ PostgreSQL  │
            │ GitHub OAuth│ │             │ │   + Prisma  │
            └──────┬──────┘ └──────┬──────┘ └─────────────┘
                   │               │
                   │        ┌──────┴─────────┐
                   │        ▼                ▼
                   │  ┌─────────────┐ ┌─────────────┐
                   │  │ GitHub REST │ │ AI Scoring  │
                   │  │ + GraphQL   │ │   Service   │
                   │  └─────────────┘ └─────────────┘
                   │
                   ▼
              GitHub OAuth
```

Triage uses GitHub REST and GraphQL APIs for issue and repository data, Auth.js for authentication, PostgreSQL with Prisma for persistence, and an OpenAI-compatible API for AI difficulty scoring.

---

## Tech Stack

| Layer              | Technology                          |
| ------------------ | ----------------------------------- |
| Framework          | Next.js                             |
| UI                 | React                               |
| Language           | TypeScript                          |
| Authentication     | Auth.js + GitHub OAuth              |
| Database           | PostgreSQL                          |
| ORM                | Prisma                              |
| GitHub Integration | GitHub REST API + GraphQL API       |
| AI                 | OrcaRouter + DeepSeek               |
| Styling / UI       | Tailwind CSS, Framer Motion, Lucide |
| Production         | Docker                              |
| Deployment         | Render                              |

---

# Getting Started

## Prerequisites

Make sure you have:

* Node.js 22+
* npm
* PostgreSQL
* A GitHub OAuth application
* An OrcaRouter API key if you want AI scoring
* Docker Desktop if you want to run the production container locally

---

## 1. Clone the repository

```bash
git clone https://github.com/Zaidzezo/triage.git
cd triage
```

Install dependencies:

```bash
npm ci
```

---

## 2. Configure environment variables

Create:

```text
.env.local
```

Do **not** commit this file.

Use the following variables:

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

DATABASE_URL=

ENCRYPTION_KEY=

ORCAROUTER_API_KEY=

AUTH_TRUST_HOST=true
```

### What each variable does

| Variable               | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `GITHUB_CLIENT_ID`     | GitHub OAuth application client ID                           |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth application client secret                       |
| `NEXTAUTH_SECRET`      | Auth.js session/signing secret                               |
| `NEXTAUTH_URL`         | Base URL of the application                                  |
| `DATABASE_URL`         | PostgreSQL connection string                                 |
| `ENCRYPTION_KEY`       | 32-byte hexadecimal key used to encrypt GitHub access tokens |
| `ORCAROUTER_API_KEY`   | API key used for AI issue scoring                            |
| `AUTH_TRUST_HOST`      | Allows Auth.js to trust the deployment host                  |

### Generate an encryption key

`ENCRYPTION_KEY` must contain exactly **64 hexadecimal characters**.

You can generate one with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Generate an Auth.js secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## 3. Configure GitHub OAuth

Create a GitHub OAuth App and configure the local callback URL as:

```text
http://localhost:3000/api/auth/callback/github
```

For the deployed application, use:

```text
https://triage-ewhp.onrender.com/api/auth/callback/github
```

The production application URL is:

```text
https://triage-ewhp.onrender.com
```

---

## 4. Generate Prisma Client

```bash
npm run db:generate
```

---

## 5. Apply database migrations

Make sure `DATABASE_URL` points to your PostgreSQL database, then run:

```bash
npm run db:migrate
```

This applies the migrations in:

```text
prisma/migrations
```

---

# Run in Development

Start the Next.js development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

For a production-style local run:

```bash
npm run build
npm run start
```

---

# Run with Docker

Triage includes a production multi-stage Dockerfile.

The image contains:

* a dependency stage
* a Next.js build stage
* a minimal production runtime
* Prisma-generated client
* the Next.js standalone server
* a non-root runtime user
* a Docker health check

## 1. Build the image

```bash
docker build -t triage .
```

## 2. Run the container

Use your environment file at runtime:

```bash
docker run --rm --name triage --env-file .env.local -p 3000:3000 triage
```

Then open:

```text
http://localhost:3000
```

Your secrets are intentionally supplied at runtime rather than copied into the Docker image.

For production deployments, the platform should provide the environment variables to the container.

---

# Production Deployment

Triage is deployed as a Dockerized Next.js application.

Production configuration should provide:

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

NEXTAUTH_SECRET=
NEXTAUTH_URL=https://your-production-domain.com

DATABASE_URL=

ENCRYPTION_KEY=

ORCAROUTER_API_KEY=

AUTH_TRUST_HOST=true
```

The production container listens on the platform-provided `PORT` and binds to `0.0.0.0`.

---

# API

Triage exposes server-side route handlers for the main application workflows.

| Endpoint         | Method        | Purpose                             |
| ---------------- | ------------- | ----------------------------------- |
| `/api/issues`    | `POST`        | Search and retrieve GitHub issues   |
| `/api/saved`     | `GET`         | Retrieve saved issues               |
| `/api/saved`     | `POST`        | Save or unsave an issue             |
| `/api/workspace` | `GET`         | Retrieve the contribution workspace |
| `/api/workspace` | `PATCH`       | Update an issue's workspace status  |
| `/api/scores`    | `POST`        | Generate AI difficulty scores       |
| `/api/auth/*`    | `GET`, `POST` | Auth.js authentication flow         |

---

# Security

Triage is designed so sensitive configuration stays outside the source tree.

Some of the security measures include:

* GitHub OAuth authentication
* Encrypted storage of GitHub access tokens
* Runtime environment variables for secrets
* Input validation in API routes
* PostgreSQL persistence through Prisma
* Non-root Docker runtime
* Docker health checks
* Production-only Next.js standalone output

**Never commit `.env.local`, OAuth secrets, API keys, database credentials, or encryption keys to the repository.**

---

## License

See [`LICENSE`](./LICENSE).
