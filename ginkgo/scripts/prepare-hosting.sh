#!/bin/bash
mkdir -p logs

SERVICE_ACCOUNT_NAME="hosting-updater"

if [[ "$GCP_PROJECT" == "" ]]; then
  echo "Missing GCP_PROJECT variable name"
  exit 1
fi
if [[ "$KEY_FILE" == "" ]]; then
  echo "Missing KEY_FILE variable name"
  exit 1
fi
if [[ "$REGION" == "" ]]; then
  echo "Missing REGION variable name"
  exit 1
fi

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

if [[ $(gcloud iam service-accounts list --filter "EMAIL:$SERVICE_ACCOUNT_NAME@$GCP_PROJECT.iam.gserviceaccount.com" 2>&1 | tail +2) == "" ]]; then
  echo "Hosting updater account not created, creating..."
  gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" --display-name "Frontend updater" --description "This service account is used to publish new frontend"
  if [[ $? -ne 0 ]]; then
    echo "service account creation failed"
    exit 1
  fi
  gcloud iam service-accounts keys create "$KEY_FILE" --iam-account "$SERVICE_ACCOUNT_NAME@$GCP_PROJECT.iam.gserviceaccount.com"
  if [[ $? -ne 0 ]]; then
    echo "service account keys creation failed"
    exit 1
  fi
  echo "WARNING: Private key has been created and saved into $KEY_FILE"
  echo "Please delete it as soon as possible"
  gcloud projects add-iam-policy-binding "$GCP_PROJECT" --member="serviceAccount:$SERVICE_ACCOUNT_NAME@$GCP_PROJECT.iam.gserviceaccount.com" --role="roles/firebasehosting.admin" >/dev/null
  if [[ $? -ne 0 ]]; then
    echo "granting hosting permissions failed"
    exit 1
  fi
fi
