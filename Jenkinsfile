// Declarative pipeline: push -> Test -> Build -> Deploy -> Smoke Test
pipeline {
  agent any
  environment {
    COMPOSE_PROJECT_NAME = 'ticketdesk'
    TAG = "${env.BUILD_NUMBER}"            // image tag = build number (rollback)
  }
  triggers { githubPush() }                // fired by the GitHub webhook
  options { disableConcurrentBuilds() }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Test') {                        // failing test stops the pipeline here
      steps {
        sh 'docker build --target test -t ticketdesk/tickets-api:test ./tickets-api'
        sh 'docker build --target test -t ticketdesk/worker:test ./worker'
      }
    }
    stage('Build Images') { steps { sh 'docker compose build' } }
    stage('Deploy') {
      steps {
        withCredentials([file(credentialsId: 'ticketdesk-env', variable: 'ENV_FILE')]) {
          sh 'cp "$ENV_FILE" .env'
          sh 'docker compose up -d --no-build --remove-orphans'
        }
      }
    }
    stage('Smoke Test') {
      steps {
        sh '''
          for i in $(seq 1 12); do
            if docker compose exec -T proxy wget -qO- http://localhost/api/tickets/health; then
              echo "Smoke test passed"; exit 0
            fi
            echo "Waiting for services..."; sleep 5
          done
          echo "Smoke test failed"; exit 1
        '''
      }
    }
  }
  post {
    success { echo "TicketDesk build ${TAG} is live at http://localhost:8080" }
    failure { echo "Build ${TAG} failed. Roll back: TAG=<previous> docker compose -p ticketdesk up -d --no-build" }
    always  { sh 'rm -f .env' }
  }
}
