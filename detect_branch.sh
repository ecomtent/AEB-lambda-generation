#!/bin/bash

# Check for branch name using webhook head ref
if [ -n "$CODEBUILD_WEBHOOK_HEAD_REF" ]; then
  BRANCH=$(echo $CODEBUILD_WEBHOOK_HEAD_REF | sed 's|refs/heads/||')
else
  BRANCH="unknown"
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
