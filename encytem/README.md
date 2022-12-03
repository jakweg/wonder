# Running the project

Everything is run inside docker containers, you need to have docker-compose installed

##### Run containers using:

`docker-compose up --build`

|    Option     | Example value |                                          Meaning                                           |
| :-----------: | :-----------: | :----------------------------------------------------------------------------------------: |
|      DEV      |   anything    | Enables debug mode, disables minification, watches files... incompatible with WEBHOOK_PORT |
|     SERVE     |     8080      |                            Enables HTTP server on a given port                             |
|     DIST      |    ./dist     |                           Outputs compiled files into directory                            |
| WEBHOOK_PORT  |     8081      |               Enables github webhook on port, takes precedence over DEV flag               |
| GITHUB_SECRET |     abcd      |                            Verifies requests coming from GitHub                            |

#### Example debug server command:

`DEV= SERVE=3000 DIST=./dist docker-compose up --build`
