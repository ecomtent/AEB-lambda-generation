const AWS = require('aws-sdk');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

AWS.config.update({ region: 'us-east-1' });

const dynamoDB = new AWS.DynamoDB.DocumentClient();

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

async function websocketNotifyClients(sellerId, listingId) {
  const params = {
    FunctionName: process.env.WEBSOCKET_NOTIFY_CLIENTS_ARN,
    InvocationType: 'Event', // Asynchronous invocation
    Payload: JSON.stringify({
      body: JSON.stringify({
        seller_id: sellerId, 
        listing_id: listingId, 
        update_type: 'UPDATE_PRODUCT'
      })
    })
  };

  try {
    await lambdaClient.send(new InvokeCommand(params)); // Send the Lambda invocation asynchronously
    console.log(`WebSocket notification sent successfully for sellerId: ${sellerId}, listingId: ${listingId}`);
    return true;
  } catch (err) {
    console.error('Error invoking websocket notification Lambda', err);
    return false;
  }
}

module.exports = { putObjectToS3, dynamoDB, websocketNotifyClients };
