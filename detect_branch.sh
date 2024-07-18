#!/bin/sh

# Initialize BRANCH variable
BRANCH="unknown"

# Print environment variables for debugging
echo "CODEBUILD_WEBHOOK_BASE_REF: $CODEBUILD_WEBHOOK_BASE_REF"
echo "CODEBUILD_WEBHOOK_HEAD_REF: $CODEBUILD_WEBHOOK_HEAD_REF"
echo "CODEBUILD_WEBHOOK_TRIGGER: $CODEBUILD_WEBHOOK_TRIGGER"
echo "CODEBUILD_SOURCE_VERSION: $CODEBUILD_SOURCE_VERSION"
echo "CODEBUILD_SOURCE_REPO_URL: $CODEBUILD_SOURCE_REPO_URL"

# Determine the branch name from CODEBUILD_SOURCE_VERSION if it is an S3 ARN
if echo "$CODEBUILD_SOURCE_VERSION" | grep -q "arn:aws:s3:::"; then
  # Use the commit ID as a fallback if branch information is unavailable
  BRANCH="commit-$(basename "$CODEBUILD_SOURCE_VERSION")"
elif echo "$CODEBUILD_SOURCE_VERSION" | grep -q "refs/heads/"; then
  BRANCH=$(echo "$CODEBUILD_SOURCE_VERSION" | sed 's|refs/heads/||')
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
