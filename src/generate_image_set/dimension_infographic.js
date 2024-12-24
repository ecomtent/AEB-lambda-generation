const { putObjectToS3, dynamoDB } = require('utils/aws_services');
const { jsonToBlob } = require('utils/image_utils');
const isEmpty = require('lodash/isEmpty');
const axios = require('axios');

exports.handler = async (event, context) => {
  const body = JSON.parse(event.body);  
  const { seller_id, listing_id, seller_email } = body;  
  
    if (!seller_id || !listing_id || !seller_email || !language ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Bad request - Missing required fields' })
    };
    }

    const Key = `images/${seller_email}/${listing_id}_${new Date().toISOString().trim()}_dimension_design_out`
    const jsonUrl = process.env.S3_BUCKET_URL + "/" + Key + ".json";
    const pngUrl = process.env.S3_BUCKET_URL + "/" + Key + ".png";

    const params = {
        TableName: process.env.SELLER_TABLE,
        Key: { seller_id, listing_id }
    };

    try {
        const data = await dynamoDB.get(params).promise();
        if (isEmpty(data)) {
          return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Item not found' })
        };
        }

        // TODO: add error handling for empty dimensions
        const dimensionParams = { user_email: seller_email, listing_id, seller_id }

        let dimensionJSON = {};
        try {
            const result = await axios.post(`${process.env.LISTING_GATEWAY}/generate-dimension-infographic`, dimensionParams);
            dimensionJSON = result.data.template;
        } catch (err) {
          return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error generating dimension infographic', error: err.message })
        };
        }

        if (_.isEmpty(dimensionJSON)) {
          return {
            statusCode: 200,
            body: JSON.stringify({
              "image_url": "",
              "polotno_json": ""
          })
        }; 
        }

        const json_str = JSON.stringify(dimensionJSON);
        const json_data = json_str;

        if (!json_data || !json_data.trim()) {
          return {
            statusCode: 200,
            body: JSON.stringify({
              "image_url": "",
              "polotno_json": ""
          })
        }; 
        }

        const png_blob = await jsonToBlob(dimensionJSON);

        if (!png_blob || png_blob.length === 0) {
          return {
            statusCode: 200,
            body: JSON.stringify({
              "image_url": "",
              "polotno_json": ""
          })
        }; 
        }

        await putObjectToS3(Key, json_data, "json", "application/json"); // put json to s3
        await putObjectToS3(Key, png_blob, "png", "image/png"); // put png to s3

        const png_json_pair = {
            "image_url": pngUrl,
            "polotno_json": jsonUrl
        };

        return {
          statusCode: 200,
          body: JSON.stringify(png_json_pair)
      };

    } catch (err) {
      console.error("Unable to process the request. Error JSON:", JSON.stringify(err, null, 2));
      return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Internal Server Error', error: err.message })
      };
    }
};