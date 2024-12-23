const AWS = require('aws-sdk');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

AWS.config.update({ region: 'us-east-1' });

const dynamoDB = new AWS.DynamoDB.DocumentClient();

const s3Client = new S3Client({
  region: 'us-east-1',
  useAccelerateEndpoint: true,
});

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

module.exports = { putObjectToS3, dynamoDB };
