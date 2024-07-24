import json
import os
import boto3
import logging
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')

def handler(event, context):
    logger.info(f"Received event: {json.dumps(event)}")
    
    table_name = os.environ['ADMIN_TABLE_NAME']  # Use the global environment variable for the table name
    table = dynamodb.Table(table_name)
    primary_key = 'sets'  # replace with your table's primary key attribute name
    primary_key_value = 'all_users_set'  # replace with the value you want to query

    try:
        response = table.get_item(Key={primary_key: primary_key_value})
        item = response.get('Item', {})
        logger.info(f"Queried item: {json.dumps(item)}")
        return {
            'statusCode': 200,
            'body': json.dumps(item)
        }
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        return {
            'statusCode': 500,
            'body': json.dumps('Error querying DynamoDB')
        }
