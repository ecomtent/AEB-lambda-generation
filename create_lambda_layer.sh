#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Function to display usage information
usage() {
    echo "Usage: $0 -n LAYER_NAME -r RUNTIME -v RUNTIME_VERSION -p PACKAGES"
    echo "  -n LAYER_NAME         Name of the Lambda layer"
    echo "  -r RUNTIME            Runtime for the Lambda layer (nodejs or python)"
    echo "  -v RUNTIME_VERSION    Version of the runtime (e.g., nodejs18.x, python3.9)"
    echo "  -p PACKAGES           Comma-separated list of packages to install"
    exit 1
}

# Parse command line arguments
while getopts "n:r:v:p:" opt; do
    case $opt in
        n) LAYER_NAME=$OPTARG ;;
        r) RUNTIME=$OPTARG ;;
        v) RUNTIME_VERSION=$OPTARG ;;
        p) PACKAGES=$OPTARG ;;
        *) usage ;;
    esac
done

# Check if all arguments are provided
if [ -z "$LAYER_NAME" ] || [ -z "$RUNTIME" ] || [ -z "$RUNTIME_VERSION" ] || [ -z "$PACKAGES" ]; then
    usage
fi

# Create the layer directory structure
mkdir -p lambda-layer

# Install packages based on the specified runtime
if [ "$RUNTIME" == "nodejs" ]; then
    mkdir -p lambda-layer/nodejs
    cd lambda-layer/nodejs
    npm init -y
    npm install $(echo $PACKAGES | tr ',' ' ')
    cd ../..
elif [ "$RUNTIME" == "python" ]; then
    mkdir -p lambda-layer/python/lib/$RUNTIME_VERSION/site-packages
    cd lambda-layer/python/lib/$RUNTIME_VERSION/site-packages
    pip install $(echo $PACKAGES | tr ',' ' ') -t .
    cd ../../../../..
else
    echo "Unsupported runtime: $RUNTIME"
    exit 1
fi

# Zip the layer content from within the lambda-layer directory
cd lambda-layer
zip -r lambda-layer.zip .

# Publish the layer to AWS Lambda
aws lambda publish-layer-version --layer-name $LAYER_NAME --compatible-runtimes $RUNTIME_VERSION --zip-file fileb://lambda-layer.zip

# Cleanup
rm -rf nodejs python lambda-layer.zip

# Move back to the original directory
cd ..

echo "Lambda layer $LAYER_NAME published successfully!"
