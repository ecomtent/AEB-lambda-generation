const { putObjectToS3, dynamoDB, websocketNotifyClients, updateListing } = require('utils/aws_services');
const { jsonToBlobs } = require('utils/image_utils');
const isEmpty = require('lodash/isEmpty');
const axios = require('axios');

exports.handler = async (event, context) => {
  const { seller_id, listing_id, seller_email, language } = event;

  if (!seller_id || !listing_id || !seller_email || !language ) {
    throw new Error('Bad request - Missing required fields');
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
        throw new Error('Item not found');
      }
      
      const aplusParams = { user_email: seller_email, listing_id, seller_id, target_language: language };
      console.log("Triggering A+ content processing with params: ", aplusParams);

      setImmediate(async() => {
        try {
          console.log("Sending request to trigger A+ content processing...");
          const executionResponse = await axios.post(`${process.env.LISTING_GATEWAY}/trigger-aplus-sm`, { input: aplusParams });
          const execution_arn = executionResponse.data.execution_arn;
          console.log("Execution ARN: ", execution_arn);
          await new Promise(resolve => setTimeout(resolve, 25000)); // 25 seconds
          console.log("Polling for result...");

          let result;
          try {
            result = await axios.post(`${process.env.LISTING_GATEWAY}/polling`, { execution_arn });
            console.log("Polling result:", result.data);
          } catch (err) {
            const errorData = err.response.data;
            console.error("Error while polling:", errorData);
            return;
          }

          const s3Url = result.data.output;
          console.log("S3 URL for A+ template:", s3Url);
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
            listing_updates: { aplus: aplusData }
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
      });

      return { message: `A+ content processing started for seller ${seller_id} and listing ${listing_id}.` };

  } catch (err) {
    console.error("Unable to process the request. Error JSON:", JSON.stringify(err, null, 2));
    throw new Error('Internal Server Error: ' + err.message);
  }
};