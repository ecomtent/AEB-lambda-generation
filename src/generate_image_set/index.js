const { putObjectToS3, dynamoDB, GetCommand, websocketNotifyClients, updateListing } = require('utils/aws_services');
const { jsonToBlob, jsonToBlobs, filledCanvasJSON, getBrowser, closeBrowser } = require('utils/image_utils');

const SELLER_TABLE = process.env.SELLER_TABLE_NAME;

exports.handler = async (event, context) => {
  console.log("Incoming event:", event);
  const { seller_id, listing_id, seller_email, s3benefit, s3dimension, s3lifestyle, s3stock } = event;

  if (!seller_id || !listing_id || !seller_email || !s3benefit || !s3dimension || !s3lifestyle || !s3stock) {
    throw new Error('Bad request - Missing required fields');
  }

  const browser = await getBrowser();
  const baseKey = `images/${seller_email}/${listing_id}_${new Date().toISOString()}`;

  try {    
    console.log("S3 URLs for image set templates:", s3benefit, s3dimension, s3lifestyle);
    // benefit and dimension infographic: JSON
    const processBenefitAndDimension = async () => {
      const templates = [
        { url: s3benefit, type: 'infographic' },
        { url: s3dimension, type: 'dimension' },
      ];

      return Promise.all(
        templates.map(async ({ url, type }) => {
          const key = `${baseKey}_${type}_design_out`;
          const jsonUrl = url;
          const pngUrl = `${process.env.S3_BUCKET_URL}/${key}.png`;
          const templateJSON = await fetch(url).then(response => response.json());
          const png_blob = await jsonToBlob(templateJSON, browser);
          await putObjectToS3(pngUrl, png_blob, "png", "image/png");
          console.log(`Successfully uploaded PNG file for ${type} template: ${pngUrl}.`)
          return { jsonUrl, pngUrl };
        })
      );
    };

    // lifestyle infographic: JPEG
    const processLifestyle = async () => {
      const lifestyleKey = `${baseKey}_lifestyle_design_out`;
      const lifestyleJsonUrl = `${process.env.S3_BUCKET_URL}/${lifestyleKey}.json`;
      const json_str = JSON.stringify(filledCanvasJSON(s3lifestyle));
      await putObjectToS3(lifestyleKey, json_str, "json", "application/json");

      return {
        image_url: s3lifestyle,
        polotno_json: lifestyleJsonUrl,
      };
    };
    
    // stock infographic: multipage JSON
    const processStock = async () => {
      const stockKey = `${baseKey}_stock_design_out`;
      const stockJSON = await fetch(s3stock).then(response => response.json());
      const stockImageBlobsAndJsons = await jsonToBlobs(stockJSON, stockKey, browser);

      return Promise.all(stockImageBlobsAndJsons.map(async ({ idx, json_str, png_blob }) => {
        const jsonUrl = `${process.env.S3_BUCKET_URL}/${idx}.json`;
        const pngUrl = `${process.env.S3_BUCKET_URL}/${idx}.png`;
        await Promise.all([
          putObjectToS3(idx, json_str, "json", "application/json"),
          putObjectToS3(idx, png_blob, "png", "image/png")
        ]);
        return { image_url: pngUrl, polotno_json: jsonUrl };
      }));
    };

    // run all processes in parallel
    const [benefitAndDimensionData, lifestyleData, stockData] = await Promise.all([
      processBenefitAndDimension(),
      processLifestyle(),
      processStock(),
    ]);

    const combinedData = [
      ...benefitAndDimensionData.map(({ jsonUrl, pngUrl }) => ({
        image_url: pngUrl,
        polotno_json: jsonUrl
      })),
      lifestyleData,
      ...stockData
    ];

    const getListingParams = {
      TableName: SELLER_TABLE,
      Key: { seller_id, listing_id },
    };
    const { Item } = await dynamoDB.send(new GetCommand(getListingParams));
    if (!Item) {
      throw new Error(`Listing with seller_id ${seller_id} and listing_id ${listing_id} not found`);
    }
    const images = Item.listing_images || [];
    const updateResult = await updateListing({
      seller_id,
      listing_id,
      listing_updates: {
        listing_images: [...images, ...combinedData] // append new images to existing listing images
      }
    });

    if (updateResult) {
      console.log('Listing updated successfully');
      const websocketResult = await websocketNotifyClients(seller_id, listing_id);
      if (websocketResult) {
        console.log('WebSocket notification sent successfully');
      } else {
        console.error('WebSocket notification failed');
      }
    } else {
      console.error('Listing update failed, skipping WebSocket notification');
    }

    return { combinedData: combinedData };

  } catch (err) {
    console.error("Unable to process the request:", err.message);
    return { error: err.message };
  } finally {
    await closeBrowser();
  }
};