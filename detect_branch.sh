#!/bin/sh

# Initialize BRANCH variable
BRANCH="unknown"

# Print environment variables for debugging
echo "CODEBUILD_WEBHOOK_BASE_REF: $CODEBUILD_WEBHOOK_BASE_REF"
echo "CODEBUILD_WEBHOOK_HEAD_REF: $CODEBUILD_WEBHOOK_HEAD_REF"
echo "CODEBUILD_WEBHOOK_TRIGGER: $CODEBUILD_WEBHOOK_TRIGGER"
echo "CODEBUILD_SOURCE_VERSION: $CODEBUILD_SOURCE_VERSION"
echo "CODEBUILD_RESOLVED_SOURCE_VERSION: $CODEBUILD_RESOLVED_SOURCE_VERSION"
echo "CODEBUILD_SOURCE_REPO_URL: $CODEBUILD_SOURCE_REPO_URL"

# Determine the branch from CODEBUILD_WEBHOOK_TRIGGER if available
if [ -n "$CODEBUILD_WEBHOOK_TRIGGER" ]; then
  TRIGGER_TYPE=$(echo "$CODEBUILD_WEBHOOK_TRIGGER" | cut -d'/' -f1)
  if [ "$TRIGGER_TYPE" = "branch" ]; then
    BRANCH=$(echo "$CODEBUILD_WEBHOOK_TRIGGER" | cut -d'/' -f2)
  elif [ "$TRIGGER_TYPE" = "pr" ]; then
    BRANCH="pull-request"
  elif [ "$TRIGGER_TYPE" = "tag" ]; then
    BRANCH="tag"
  fi
elif [ -n "$CODEBUILD_WEBHOOK_HEAD_REF" ]; then
  BRANCH=$(echo "$CODEBUILD_WEBHOOK_HEAD_REF" | sed 's|refs/heads/||')
elif echo "$CODEBUILD_SOURCE_VERSION" | grep -q "refs/heads/"; then
  BRANCH=$(echo "$CODEBUILD_SOURCE_VERSION" | sed 's|refs/heads/||')
elif [ -n "$CODEBUILD_RESOLVED_SOURCE_VERSION" ]; then
  BRANCH="$CODEBUILD_RESOLVED_SOURCE_VERSION"
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
