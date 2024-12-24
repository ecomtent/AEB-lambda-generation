
const { putObjectToS3, dynamoDB } = require('utils/aws_services');
const { jsonToBlob } = require('utils/image_utils');
const _ = require('lodash');
const axios = require('axios');

exports.handler = async (event, context) => {
  const body = JSON.parse(event.body);  
  const { seller_id, listing_id, seller_email, language } = body;

    if (!seller_id || !listing_id || !seller_email || !language ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Bad request - Missing required fields' })
    };
    }

    const Key = `images/${seller_email}/${listing_id}_${new Date().toISOString().trim()}_infographic_design_out`
    const jsonUrl = process.env.S3_BUCKET_URL + "/" + Key + ".json";
    const pngUrl = process.env.S3_BUCKET_URL + "/" + Key + ".png";

    const params = {
        TableName: process.env.SELLER_TABLE,
        Key: { seller_id, listing_id }
    };

    try {
        const data = await dynamoDB.get(params).promise();
        if (_.isEmpty(data)) {
          return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Item not found' })
        };
        }

        const benefitsParams = { user_email: seller_email, listing_id, seller_id, target_language: language }

        try {
            benefitsOutput = await axios.post(`${process.env.LISTING_GATEWAY}/trigger-benefits-sm`, { input: benefitsParams });
        } catch (err) {
            console.error("Error generating benefit infographic:", err);
            return {
              statusCode: 500,
              body: JSON.stringify({ message: 'Error generating benefit infographic', error: err.message })
          };
        }

        const s3Url = JSON.parse(benefitsOutput.data).s3_url;
        const benefitsTemplate = await (await fetch(s3Url)).json();

        const json_str = JSON.stringify(benefitsTemplate);
        const png_blob = await jsonToBlob(benefitsTemplate);

        await putObjectToS3(Key, json_str, "json", "application/json"); // put json to s3
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