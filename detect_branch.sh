#!/bin/bash

if [[ "$CODEBUILD_SOURCE_VERSION" == "refs/heads/main" ]]; then
  export STAGE=Prod
elif [[ "$CODEBUILD_SOURCE_VERSION" == "refs/heads/staging" ]]; then
  export STAGE=Stage
elif [[ "$CODEBUILD_SOURCE_VERSION" == refs/heads/feature-* ]]; then
  export STAGE=Feat-${CODEBUILD_SOURCE_VERSION#refs/heads/feature-}
else
  export STAGE=Dev
fi

echo "Stage: $STAGE"
