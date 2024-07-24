const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    console.log('event:', event);
    const tableName = process.env.ADMIN_TABLE_NAME;
    const partition_key = 'sets';
    const sort_key = 'all_users_set';
    console.log('tableName:', tableName);

    const params = {
        TableName: tableName,
        Key: {
            "data_class": partition_key,
            "id": sort_key
        },
    };

    try {
        const command = new GetCommand(params);
        const data = await dynamoDB.send(command);
        const response = {
            statusCode: 200,
            body: JSON.stringify(data.Item),
        };
        return response;
    } catch (error) {
        console.error('Error:', error);
        const response = {
            statusCode: 500,
            body: JSON.stringify('Error querying DynamoDB'),
        };
        return response;
    }
};