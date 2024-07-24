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
    partition_key = 'sets'  # replace with your table's primary key attribute name
    sort_key = 'all_users_set'  # replace with the value you want to query

    try:
        response = table.get_item(Key={
            "data_class": partition_key,
            "id": sort_key
        })
        item = response.get('Item', {})
        
        # Convert set to list if present in item
        for key, value in item.items():
            if isinstance(value, set):
                item[key] = list(value)
        
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
    except TypeError as e:
        logger.error(str(e))
        return {
            'statusCode': 500,
            'body': json.dumps('Error processing item data')
        }
