const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const dynamoDBClient = new DynamoDBClient({ region: 'us-east-1' });
const dynamoDB = DynamoDBDocumentClient.from(dynamoDBClient);

const s3Client = new S3Client({
  region: 'us-east-1',
  useAccelerateEndpoint: true,
});

const lambdaClient = new LambdaClient({ region: 'us-east-1' });

async function putObjectToS3(key, body, extention, contentType) {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key + "." + extention,
    Body: body,
    ContentType: contentType,
  };

  try {
    await s3Client.send(new PutObjectCommand(params));
    return true;
  } catch (err) {
    console.error("Error uploading to S3", err);
    return false;
  }
}

async function websocketNotifyClients(seller_id, listing_id) {
  const requestPayload = {
    body: JSON.stringify({
      seller_id: seller_id,
      listing_id: listing_id,
      update_type: 'UPDATE_PRODUCT'
    })
  };

  const params = {
    FunctionName: process.env.WEBSOCKET_NOTIFY_CLIENTS_ARN,  // Lambda ARN for WebSocket notifications
    InvocationType: 'Event',  // Asynchronous invocation
    Payload: JSON.stringify(requestPayload)
  };

  try {
    await lambdaClient.send(new InvokeCommand(params)); // Send the Lambda invocation asynchronously
    console.log(`WebSocket notification sent successfully for seller_id: ${seller_id}, listing_id: ${listing_id}`);
    return true;
  } catch (err) {
    console.error('Error invoking websocket notification Lambda', err);
    return false;
  }
}

async function updateListing({ seller_id, listing_id, listing_updates }) {
  const requestPayload = {
    body: JSON.stringify({
      seller_id: seller_id,
      listing_id: listing_id,
      listing_updates: listing_updates
    })
  };

  const params = {
    FunctionName: process.env.LISTING_CRUD_LAMBDA_ARN, 
    InvocationType: 'RequestResponse',  // Synchronous invocation
    Payload: JSON.stringify(requestPayload)
  };

  try {
    const result = await lambdaClient.send(new InvokeCommand(params));

    // The result will contain the Payload, which is the Lambda's response
    const responsePayload = JSON.parse(new TextDecoder().decode(result.Payload));
    return responsePayload;
  } catch (error) {
    console.error("Error invoking update listing Lambda:", error);
    return null;
  }
}


module.exports = { putObjectToS3, dynamoDB, GetCommand, websocketNotifyClients, updateListing };
