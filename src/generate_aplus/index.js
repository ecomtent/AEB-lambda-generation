const { putObjectToS3, dynamoDB, websocketNotifyClients, updateListing } = require('utils/aws_services');
const { jsonToBlobs } = require('utils/image_utils');
const isEmpty = require('lodash/isEmpty');
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

    const baseKey = `images/${seller_email}/${listing_id}_${new Date().toISOString().trim()}_aplus_design_out`;
    const baseUrls = [0, 1, 2, 3].map(i => `${process.env.S3_BUCKET_URL}/${baseKey}_${i}`);
    const pngUrls = baseUrls.map(url => `${url}.png`);
    const jsonUrls = baseUrls.map(url => `${url}.json`);

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
        
        const aplusParams = { user_email: seller_email, listing_id, seller_id, target_language: language };
        console.log("Triggering A+ content processing with params: ", aplusParams);

        setImmediate(async() => {
          try {
            const executionResponse = await axios.post(`${process.env.LISTING_GATEWAY}/trigger-aplus-sm`, { input: aplusParams });
            const execution_arn = executionResponse.data.execution_arn;
            console.log("Execution ARN: ", execution_arn);
            await new Promise(resolve => setTimeout(resolve, 25000)); // 25 seconds

            let result;
            try {
              result = await axios.post(`${process.env.LISTING_GATEWAY}/polling`, { execution_arn });
            } catch (err) {
              const errorData = err.response.data;
              console.error("Error while polling:", errorData);
              return;
            }

            const s3Url = result.data.output;
            const aplusTemplate = await (await fetch(s3Url)).json();
            const imageBlobsAndJsons = await jsonToBlobs(aplusTemplate, baseKey);

            await Promise.all([
              ...imageBlobsAndJsons.map(({ idx, json_str }) => putObjectToS3(idx, json_str, "json", "application/json")),
              ...imageBlobsAndJsons.map(({ idx, png_blob }) => putObjectToS3(idx, png_blob, "png", "image/png"))
            ]);

            const aplusData = {};
            pngUrls.forEach((url, idx) => {
              aplusData[`page_${idx + 1}`] = {
                image_url: url,
                polotno_json: jsonUrls[idx]
              };
            });

            const updateResult = await updateListing({
              seller_id,
              listing_id,
              listing_updates: {
                aplus: aplusData
              }
            });

            if (updateResult) {
              console.log('Listing updated successfully');
              const websocketResult = await websocketNotifyClients(seller_id, listing_id);
              if (!websocketResult) {
                console.error('WebSocket notification failed');
              }
            } else {
              console.error('Listing update failed, skipping WebSocket notification');
            }

          } catch (err) {
            console.error("Unable to process the request. Error JSON:", JSON.stringify(err, null, 2));
        }
        })

        return {
          statusCode: 200,
          body: JSON.stringify({ message: `set-aplus triggered for seller ${seller_id} listing ${listing_id}`})
      };

    } catch (err) {
      console.error("Unable to process the request. Error JSON:", JSON.stringify(err, null, 2));
      return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Internal Server Error', error: err.message })
      };
    }
};