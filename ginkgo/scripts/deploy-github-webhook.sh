#!/bin/bash
mkdir -p logs

if [[ "$GCP_PROJECT" == "" ]]; then
  echo "Missing GCP_PROJECT variable name"
  exit 1
fi
if [[ "$REGION" == "" ]]; then
  echo "Missing REGION variable name"
  exit 1
fi
if [[ "$GITHUB_SECRET" == "" ]]; then
  echo "Missing GITHUB_SECRET variable name"
  exit 1
fi
CONTAINER_NAME="github-webhook"

output=$(docker --version 2>/dev/null)
if [[ $? -ne 0 ]]; then
  echo "You appear not to have docker installed"
  exit 1
fi
echo "Using $output" | head -1

output=$(gcloud --version 2>/dev/null)
if [[ $? -ne 0 ]]; then
  echo "You appear not to have gcloud installed"
  exit 1
fi
echo "Using $output" | head -1

output=$(gcloud config get account 2>&1)
if [[ "$output" == "(unset)" ]]; then
  echo "Sign in using: gcloud auth login"
  exit 1
fi
echo "Using account $output"

output=$(gcloud config get project 2>&1)
if [[ "$output" != "$GCP_PROJECT" ]]; then
  echo "Current selected project is $output, switching to $GCP_PROJECT"
  gcloud config set project "$GCP_PROJECT"
  if [[ $? -ne 0 ]]; then
    echo "Project change failed"
    exit 1
  fi
  output=$(gcloud config get project 2>&1)
  if [[ "$output" != "$GCP_PROJECT" ]]; then
    echo "Project doesn't seem to be changed to $GCP_PROJECT"
    exit 1
  fi
fi
echo "Using project $output"

AVAILABLE_SERVICES=$(gcloud services list | tail +2 | cut -f1 -d" ")
if [[ $(echo "$AVAILABLE_SERVICES" | grep ^cloudbuild.googleapis.com$) == "" ]]; then
  echo "CloudBuild is not enabled, use command: "
  echo "gcloud services enable cloudbuild.googleapis.com"
  echo "And try again in a few minutes"
  exit 1
fi

if [[ $(gcloud pubsub topics list --filter "name:projects/$GCP_PROJECT/topics/hosting-update" | tail +2) == "" ]]; then
  echo "There should be already created pubsub topic"
  exit 1
fi

echo "Submitting $CONTAINER_NAME to Cloud Build"
cp "$GITHUB_SECRET" $CONTAINER_NAME/github-secret.txt
gcloud builds submit "$CONTAINER_NAME" --tag "gcr.io/$GCP_PROJECT/$CONTAINER_NAME" >"logs/build_submit_$CONTAINER_NAME.log" 2>&1
if [[ $? -ne 0 ]]; then
  rm $CONTAINER_NAME/github-secret.txt
  echo "gcloud builds submit failed for $CONTAINER_NAME, see logs for more details"
  exit 1
fi
rm $CONTAINER_NAME/github-secret.txt
echo "Done"

echo "Deploying container to Cloud Run"
gcloud run deploy "$CONTAINER_NAME" \
  --service-account="github-webhook@$GCP_PROJECT.iam.gserviceaccount.com" \
  --image="gcr.io/$GCP_PROJECT/$CONTAINER_NAME" --concurrency=1 --region="$REGION" \
  --allow-unauthenticated --cpu=1 --memory=128Mi \
  --max-instances=1 >"logs/run_deploy_$CONTAINER_NAME.log" 2>&1

if [[ $? -ne 0 ]]; then
  echo "gcloud run deploy failed for $CONTAINER_NAME, see logs for more details"
  exit 1
fi
gcloud run services list --filter="SERVICE:$CONTAINER_NAME"

exit 0
