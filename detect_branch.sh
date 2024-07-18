#!/bin/sh

# Initialize BRANCH variable
BRANCH="unknown"

# Check if the branch name is available via webhook trigger
if [ -n "$CODEBUILD_WEBHOOK_TRIGGER" ]; then
  TRIGGER_TYPE=$(echo "$CODEBUILD_WEBHOOK_TRIGGER" | cut -d'/' -f1)
  if [ "$TRIGGER_TYPE" = "branch" ]; then
    BRANCH=$(echo "$CODEBUILD_WEBHOOK_TRIGGER" | cut -d'/' -f2)
  elif [ "$TRIGGER_TYPE" = "pr" ]; then
    BRANCH="pull-request"
  elif [ "$TRIGGER_TYPE" = "tag" ]; then
    BRANCH="tag"
  fi
else
  # Fallback to checking CODEBUILD_SOURCE_VERSION for branch
  if echo "$CODEBUILD_SOURCE_VERSION" | grep -q "refs/heads/"; then
    BRANCH=$(echo "$CODEBUILD_SOURCE_VERSION" | sed 's|refs/heads/||')
  elif [ -n "$CODEBUILD_SOURCE_REPO_URL" ]; then
    BRANCH=$(echo "$CODEBUILD_SOURCE_REPO_URL" | awk -F'/' '{print $NF}')
  fi
fi

# Determine the STAGE based on the branch name
if [ "$BRANCH" = "main" ]; then
  export STAGE=Prod
elif [ "$BRANCH" = "staging" ]; then
  export STAGE=Stage
elif echo "$BRANCH" | grep -q "^feature-"; then
  export STAGE=Feat-${BRANCH#feature-}
else
  export STAGE=Dev
fi

echo "Branch: $BRANCH"
echo "Stage: $STAGE"
