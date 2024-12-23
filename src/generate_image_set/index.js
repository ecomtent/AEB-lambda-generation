const { dynamoDB } = require('../utils/aws_services');
const axios = require('axios');

const { handler: benefitHandler } = require('./benefit_infographic');
const { handler: dimensionHandler } = require('./dimension_infographic');
const { handler: lifestyleHandler } = require('./lifestyle_infographic');

const invokeHandler = async (handler, event) => {
    try {
      const result = await handler(event);
      return result;
    } catch (err) {
      return { error: err.message };
    }
};

exports.handler = async (event, context) => {
    const body = JSON.parse(event.body);
    const { seller_id, listing_id, seller_email, language } = body;

    if (!seller_id || !listing_id || !seller_email || !language) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Bad request - Missing required fields' })
        };
    }

    const dbParams = {
        TableName: process.env.SELLER_TABLE,
        Key: { seller_id, listing_id }
    };

    const data = await dynamoDB.get(dbParams).promise();
        if (_.isEmpty(data)) {
            return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Item not found' })
        };
    }

    const params = {
        seller_id,
        listing_id,
        seller_email,
        language
    };

    const promises = [
        invokeHandler(benefitHandler, { ...params, functionType: 'benefit_infographic' }),
        invokeHandler(dimensionHandler, { ...params, functionType: 'dimension_infographic' }),
        invokeHandler(lifestyleHandler, { ...params, functionType: 'lifestyle_infographic' }),
      ];

    try {
        const imageResponses = await Promise.allSettled(promises);

        const successfulResponses = imageResponses
            .filter((promise) => promise.status === 'fulfilled')
            .map((promise) => promise.value);

        const failedResponses = imageResponses
            .filter((promise) => promise.status === 'rejected')
            .map((promise) => promise.reason);

        const combinedData = successfulResponses
            .map((response) => response.body)
            .filter((data) => data?.image_url && data?.polotno_json);
        
        failedResponses.forEach((response, index) => {
            console.error(`Error in lambda function [${['benefit_infographic', 'dimension_infographic', 'lifestyle_infographic'][index]}]:`, response.message || response);
            });

        return {
            statusCode: 200,
            body: JSON.stringify({ images: combinedData }),
        };

    } catch (err) {
        console.error("Error processing the request:", JSON.stringify(err, null, 2));
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', error: err.message })
        };
    }
};
