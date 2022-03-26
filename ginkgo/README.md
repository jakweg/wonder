# Ginkgo

### CI/CD pipeline for project Wonder

Pipeline works on GCP using [Cloud Run](https://cloud.google.com/run/) and [PubSub](https://cloud.google.com/pubsub/).
You need to have a Firebase project created and billing enabled in order to run that.

You might have different project for hosting and different for cloud run instances. The one with hosting doesn't require
billing enabled. The other one may generate small costs (Cloud run has free tier).

You can host frontend on any server (like apache or nginx) just make sure to
set [appropriate headers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements)
for SharedArrayBuffer to work.

#### To initialize GCP pipeline with GitHub webhook follow these steps:

1. Generate random GitHub webhook secret and save it into file, then set path to that file as environment
   variable `GITHUB_SECRET`.
2. Set `REGION` variable to Cloud Run region, eg. `us-central1`.
3. Set `GCP_PROJECT` variable to indicate which project you want to work on.
4. Create service account that updates Firebase hosting via `./scripts/prepare-hosting.sh` with `KEY_FILE` variable set
   to a path. Service account key will be generated and saved into the path. This step needs to be executed
   with `GCP_PROJECT` that you want to host project on. This step is executed once.
5. Create service account that sends pubsub message after receiving push signal from GitHub.
   Use `./scripts/prepare-github-webhook.sh` with **different** `KEY_FILE` path. This step is executed once.
6. Deploy container which builds frontend and publishes it on hosting. Invoke `./scripts/build-deploy-image.sh`
   with `KEY_FILE` pointing to file from step 4.
7. Deploy container which acts as a webhook. Invoke `./scripts/deploy-github-webhook.sh`
   with `KEY_FILE` pointing to file from step 5.
8. You'll get URL in a console which you can add in GitHub as a webhook. Use secret generated in step 1. Please
   choose `application/json` as content type.
9. Done, you can trigger hosting upload by pushing into `master` branch or publish any message on `hosting-update`
   topic.

#### Too difficult? Grab this tldr version:

```bash
#!/bin/bash
GCP_PROJECT1="<project name which you want to host on>"
GCP_PROJECT2="<project name with billing enabled>" # can be the same as above

echo -n "<replace me with something random>" > /tmp/github-secret.txt
KEY_FILE="/tmp/hosting-updater-key.json" GCP_PROJECT=$GCP_PROJECT1 ./scripts/prepare-hosting.sh
KEY_FILE="/tmp/hosting-updater-key.json" REGION="us-central1" GCP_PROJECT=$GCP_PROJECT2 ./scripts/build-deploy-image.sh
KEY_FILE="/tmp/github-key.json" GCP_PROJECT=$GCP_PROJECT2 ./scripts/prepare-github-webhook.sh
GITHUB_SECRET="/tmp/github-secret.txt" KEY_FILE="/tmp/github-key.json" REGION="us-central1" GCP_PROJECT=$GCP_PROJECT2 ./scripts/deploy-github-webhook.sh
```

##### Now every time you push to `master` new frontend gets published automatically 😃
