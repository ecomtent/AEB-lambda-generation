const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const tableName = process.env.ADMIN_TABLE_NAME; // Use the global environment variable for the table name
    const primaryKey = 'sets'; // replace with your table's primary key attribute name
    const primaryKeyValue = 'all_users_set'; // replace with the value you want to query
    
    const params = {
        TableName: tableName,
        Key: {
            [primaryKey]: primaryKeyValue
        }
    };
    
    try {
        const data = await dynamoDB.get(params).promise();
        logger.info(`Queried item: ${JSON.stringify(data.Item)}`);
        const response = {
            statusCode: 200,
            body: JSON.stringify(data.Item),
        };
        return response;
    } catch (error) {
        logger.error(`Error querying DynamoDB: ${error.message}`);
        const response = {
            statusCode: 500,
            body: JSON.stringify('Error querying DynamoDB'),
        };
        return response;
    }
};
