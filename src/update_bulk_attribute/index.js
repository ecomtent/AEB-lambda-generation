const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();
const updateListingArn = process.env.UPDATE_LISTING_ARN;


exports.handler = async (event) => {
  const { seller_id, listing_id, is_bulk_generating } = event
  if (!seller_id || !listing_id || !is_bulk_generating) {
    throw new Error('Bad request - Missing required fields');
  }

  try {
    const payload = {
      seller_id,
      listing_id,
      listing_updates: {
        is_bulk_generating: is_bulk_generating
      }
    };

    const response = await lambda.invoke({
      FunctionName: updateListingArn,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ 
        body: JSON.stringify(payload)
       })
    }).promise();

    const responsePayload = JSON.parse(response.Payload);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully invoked the Lambda function to update is_bulk_generating attribute in DynamoDB',
        data: responsePayload
      })
    };
  } catch (error) {
    console.error('Error invoking Lambda function:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error invoking Lambda function',
        error: error.message
      })
    };
  }
};
