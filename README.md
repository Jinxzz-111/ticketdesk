# TicketDesk: Request Ticketing / Tracking
Docker + Jenkins CI/CD final project (System Architecture and Integration).

**Modules:** `proxy` (Nginx, only published port 8080), `frontend` (HTML/CSS/JS), `tickets-api` (Node/Express), `worker` (Node, writes notifications), `db` (PostgreSQL 16, named volume `db-data`). Jenkins lives in `infra/jenkins/` (separate compose).

## Run the app
    cp .env.example .env      # edit the password
    docker compose up -d --build
    # open http://localhost:8080

## Run Jenkins
    cd infra/jenkins && docker compose up -d --build
    docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
Open http://localhost:8081, install suggested plugins + Docker Pipeline. Add a **Secret file** credential with id `ticketdesk-env` (your real `.env`).

## Pipeline + trigger
New Item > Pipeline > Pipeline script from SCM > your GitHub repo, Script Path `Jenkinsfile`. Tick **GitHub hook trigger for GITScm polling**. In GitHub: Settings > Webhooks > `https://<ngrok-url>/github-webhook/` (JSON, push events). Fallback: Poll SCM `H/2 * * * *`.

## Demo helpers
- Break a test: change `title.trim().length < 3` in `tickets-api/src/app.js` to `< 30`, push; the pipeline fails at Test.
- Rollback: `TAG=<old build number> docker compose -p ticketdesk up -d --no-build`
- Persistence: `docker compose down` then `up -d` (no `-v`); tickets remain.

## Team
| Member | Roles |
|---|---|
| Adrian | Project Lead + DevOps / CI-CD (Jenkins, Jenkinsfile, webhook); owns `db/init.sql` and `worker/` |
| Ethan | Infrastructure (Dockerfiles, docker-compose.yml, proxy, architecture diagram); owns `tickets-api/` |
| Jovit | Frontend, QA and Documentation (frontend, tests, README, technical docs, slides) |

Jenkins testing build numb 9
