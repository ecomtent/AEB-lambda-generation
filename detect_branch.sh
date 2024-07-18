#!/bin/bash

# Check if the branch name is available via webhook head ref
if [ -n "$CODEBUILD_WEBHOOK_HEAD_REF" ]; then
  BRANCH=$(echo $CODEBUILD_WEBHOOK_HEAD_REF | sed 's|refs/heads/||')
else
  # Fallback to checking CODEBUILD_SOURCE_VERSION
  if [ -n "$CODEBUILD_SOURCE_VERSION" ]; then
    BRANCH=$(echo $CODEBUILD_SOURCE_VERSION | sed 's|refs/heads/||')
  else
    BRANCH="unknown"
  fi
fi

if [ "$BRANCH" == "main" ]; then
  export STAGE=Prod
elif [ "$BRANCH" == "staging" ]; then
  export STAGE=Stage
elif [[ "$BRANCH" == feature-* ]]; then
  export STAGE=Feat-${BRANCH#feature-}
else
  export STAGE=Dev
fi

echo "Branch: $BRANCH"
echo "Stage: $STAGE"
