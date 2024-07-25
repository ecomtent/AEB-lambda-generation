# AEB-lambda-template

This is a template repository containing example serverless API functions using AWS Lambda and API Gateway.

## API Endpoints

- **Production**: `https://[API_ID].execute-api.us-east-1.amazonaws.com/main`
- **Development**: `https://[API_ID].execute-api.us-east-1.amazonaws.com/staging`

## Available Functions

1. **Hello World (JavaScript)**
   - Path: `/function-hello-world-js`
   - Method: `GET`

2. **Query DB (JavaScript)**
   - Path: `/function-query-db-js`
   - Method: `POST`

3. **Query DB (Python)**
   - Path: `/function-query-db-python`
   - Method: `POST`

## Development Workflow

1. For new features, create a branch named `feature-*`
2. Develop and test on the feature branch
3. Create a pull request to merge into `staging`
4. Once tested on staging, create a pull request to merge into `main`

## Deployment

- Pushing to `main` updates the production API.
- Pushing to `staging` updates the development API.
- Pushing to `feature-*` creates a separate API for testing.

The CI/CD pipeline is managed by AWS CodePipeline and uses the AEB-lambda-build-project for building and deploying.

## Lambda Layers

To add new dependencies, use the `create_lambda_layer.sh` script:

```bash
./create_lambda_layer.sh -n LAYER_NAME -r RUNTIME -v RUNTIME_VERSION -p PACKAGES
```
Example:
```
./create_lambda_layer.sh -n aws-sdk-v3-dynamodb-node18-layer -r nodejs -v nodejs18.x -p @aws-sdk/client-dynamodb,@aws-sdk/lib-dynamodb
```
## Environment
- Node.js: 18.x
- Python: 3.9

For more detailed information, refer to the full documentation.

## Documentation
- [Working with Serverless API Repository](!https://ecomtent.atlassian.net/wiki/spaces/~712020196c5fc91fbb4eb0afcd306a8fd75f7a/pages/14123023/Working+with+Serverless+API+Repository)
- [Creating a Serverless API Repository](https://ecomtent.atlassian.net/wiki/spaces/~712020196c5fc91fbb4eb0afcd306a8fd75f7a/pages/13238273/Creating+a+Serverless+API+Repository)