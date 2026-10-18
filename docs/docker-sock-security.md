# docker.sock Security Notes

## Why we use it

Jenkins builds and deploys TicketDesk by running `docker compose` commands. To do that from inside a container, it needs to talk to the Docker daemon on the host. We do this by mounting the Docker socket into the Jenkins container:

```yaml
# infra/jenkins/docker-compose.yml
user: root   # lab only: lets Jenkins use the Docker socket
ports: ["8081:8080", "50000:50000"]
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

The Jenkins container runs as root so it can use the socket. The socket is mounted read-write. Jenkins is published on host port 8081 (web UI) and 50000 (agent connections).

Jenkins then starts, stops and rebuilds the TicketDesk services (proxy, frontend, tickets-api, worker, db) on the host.

## The risk

`/var/run/docker.sock` is the control channel for the Docker daemon, and the daemon runs as root on the host. Anything that can write to the socket can:

- start a new container with the host filesystem mounted (`-v /:/host`)
- start a privileged container
- read secrets such as the `.env` file (DB credentials) and the contents of other containers
- stop or delete any container and volume, including `db-data`

In practice, **access to docker.sock is equivalent to root on the host.** If an attacker takes over the Jenkins container (a malicious Jenkinsfile, a vulnerable plugin, a leaked login), they take over the host.

## What we do about it

- **Only Jenkins gets the socket.** None of the TicketDesk services (proxy, frontend, tickets-api, worker, db) mount it.
- **The app exposes one port.** The proxy publishes host port 8080. The API, worker and db are reachable only inside the `ticket-net` network.
- **Secrets live in `.env`**, which is not committed to git (`.env.example` shows the variable names only).
- **Tests gate the deployment.** A failing test stops the Jenkins pipeline before it deploys.
- **Review pipeline changes.** Changes to the `Jenkinsfile` go through pull requests, because anyone who can change it can run commands through the socket.

## Known weaknesses (accepted for this lab)

- Jenkins runs as **root** inside its container (marked "lab only" in the compose file).
- The socket is mounted **read-write**. A `:ro` flag would not help, because the Docker API can still be called through a read-only socket.
- Jenkins is **published on the host** (8081 UI, 50000 agents). Anyone who can reach those ports and log in or exploit Jenkins gets root on the host. In a real deployment, restrict them with a firewall or VPN, and don't expose them to the internet.

## Possible improvements (not implemented)

- Put a socket proxy (for example `tecnativa/docker-socket-proxy`) between Jenkins and Docker, so Jenkins can only call the API endpoints it needs.
- Run Jenkins on a separate build host from the production services.
- Run Jenkins as a non-root user with a limited Docker group, or use rootless Docker.
- Close port 50000 if no remote agents are used, and put the Jenkins UI (8081) behind a firewall or VPN.
- Only trigger builds from trusted branches and verified GitHub webhooks.

## Summary

We accept this risk because this is a lab project and Jenkins is the only component that needs to deploy. We reduce the exposure by limiting who gets the socket, keeping the other services off public ports, and protecting the pipeline definition through code review.
