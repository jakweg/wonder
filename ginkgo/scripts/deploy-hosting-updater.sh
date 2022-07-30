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
if [[ "$KEY_FILE" == "" ]]; then
  echo "Missing KEY_FILE variable name"
  exit 1
fi
CONTAINER_NAME="hosting-updater"

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

output=$(gcloud config get account 2>&1| tail -1)
if [[ "$output" == "(unset)" ]]; then
  echo "Sign in using: gcloud auth login"
  exit 1
fi
echo "Using account $output"

output=$(gcloud config get project 2>&1| tail -1)
if [[ "$output" != "$GCP_PROJECT" ]]; then
  echo "Current selected project is $output, switching to $GCP_PROJECT"
  gcloud config set project "$GCP_PROJECT"
  if [[ $? -ne 0 ]]; then
    echo "Project change failed"
    exit 1
  fi
  output=$(gcloud config get project 2>&1| tail -1)
  if [[ "$output" != "$GCP_PROJECT" ]]; then
    echo "Project doesn't seem to be changed to $GCP_PROJECT"
    exit 1
  fi
fi
echo "Using project $output"


AVAILABLE_SERVICES=$(gcloud services list | tail +2)
if [[ $(echo "$AVAILABLE_SERVICES" | grep " cloudbuild.googleapis.com$") == "" ]]; then
  echo "CloudBuild is not enabled, use command: "
  echo "gcloud services enable cloudbuild.googleapis.com"
  echo "And try again in a few minutes"
  exit 1
fi

if [[ $(gcloud pubsub topics list --filter "name:projects/$GCP_PROJECT/topics/hosting-update" | tail +2) == "" ]]; then
  echo "Creating pubsub topic"
  gcloud pubsub topics create "projects/$GCP_PROJECT/topics/hosting-update"
  if [[ $? -ne 0 ]]; then
    echo "pubsub topic creation failed"
    exit 1
  fi
fi

echo "Submitting $CONTAINER_NAME to Cloud Build"
cp "$KEY_FILE" $CONTAINER_NAME/private-key.json
gcloud builds submit "$CONTAINER_NAME" --tag "gcr.io/$GCP_PROJECT/$CONTAINER_NAME" >"logs/build_submit_$CONTAINER_NAME.log" 2>&1
if [[ $? -ne 0 ]]; then
  rm $CONTAINER_NAME/private-key.json
  echo "gcloud builds submit failed for $CONTAINER_NAME, see logs for more details"
  exit 1
fi
rm $CONTAINER_NAME/private-key.json
echo "Done"

echo "Deploying container to Cloud Run"
gcloud run deploy "$CONTAINER_NAME" --image="gcr.io/$GCP_PROJECT/$CONTAINER_NAME" --region="$REGION" --no-allow-unauthenticated --concurrency=1 --cpu=1 --memory=512Mi --max-instances=1 >"logs/run_deploy_$CONTAINER_NAME.log" 2>&1
if [[ $? -ne 0 ]]; then
  echo "gcloud run deploy failed for $CONTAINER_NAME, see logs for more details"
  exit 1
fi

if [[ "$(gcloud iam service-accounts list --filter "EMAIL:hosting-updater-pubsub-invoker@$GCP_PROJECT.iam.gserviceaccount.com" 2>&1 | tail +2)" == "" ]]; then
  gcloud iam service-accounts create "hosting-updater-pubsub-invoker" --display-name "Hosting refresh invoker"
  if [[ $? -ne 0 ]]; then
    echo "pubsub-invoker account creation failed"
    exit 1
  fi
  gcloud run services add-iam-policy-binding "$CONTAINER_NAME" --region "$REGION" "--member=serviceAccount:hosting-updater-pubsub-invoker@$GCP_PROJECT.iam.gserviceaccount.com" --role=roles/run.invoker
fi

if [[ $(gcloud pubsub subscriptions list --filter "name:projects/$GCP_PROJECT/subscriptions/hosting-updater-subscription" --format "csv(name)" 2>&1 | tail +2) == "" ]]; then
  gcloud pubsub subscriptions create hosting-updater-subscription --topic "projects/$GCP_PROJECT/topics/hosting-update" \
    --message-retention-duration=10m \
    --ack-deadline=180 --min-retry-delay=1m \
    --push-endpoint="$(gcloud run services list --filter="SERVICE:hosting-updater" --format "csv(URL)" | tail +2)" "--push-auth-service-account=hosting-updater-pubsub-invoker@$GCP_PROJECT.iam.gserviceaccount.com"
fi

exit 0
