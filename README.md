aws codepipeline update-pipeline --cli-input-json file://template-pipeline.json





./create-lambda-layer.sh -n my-custom-layer -r nodejs -v nodejs18.x -p @aws-sdk/client-dynamodb,@aws-sdk/lib-dynamodb

./create-lambda-layer.sh -n my-python-layer -r python -v python3.9 -p requests,boto3
./create-publish-lambda-layer.sh -n numpy-python3.9-layer -r python -v python3.9 -p numpy



chmod +x create_lambda_layer.sh
./create_lambda_layer.sh -n numpy_python39_layer -r python -v python3.9 -p numpy


package-name-runtime-layer

ex: aws-sdk-v3-dynamodb-node18-layer
ex: numpy-python3.9-layer

aws lambda list-layers