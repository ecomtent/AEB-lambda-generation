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

        console.log('Raw data from DynamoDB:', data);

        if (!data.Item) {
            throw new Error('Item not found');
        }

        // Convert sets to arrays
        const item = data.Item;
        if (item.users_set instanceof Set) {
            item.users_set = Array.from(item.users_set);
        }

        const response = {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(item),
        };
        return response;
    } catch (error) {
        console.error('Error:', error);
        const response = {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ message: 'Error querying DynamoDB', error: error.message }),
        };
        return response;
    }
};
