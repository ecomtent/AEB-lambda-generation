const { putObjectToS3, dynamoDB, GetCommand, websocketNotifyClients, updateListing } = require('utils/aws_services');
const { jsonToBlob, jsonToBlobs, filledCanvasJSON, getBrowser, closeBrowser } = require('utils/image_utils');

const SELLER_TABLE = process.env.SELLER_TABLE_NAME;

exports.handler = async (event, context) => {
  console.log("Incoming event:", event);
  const { seller_id, listing_id, seller_email, s3benefit, s3dimension, s3lifestyle, s3stock } = event;

  if (!seller_id || !listing_id || !seller_email || !s3benefit || !s3dimension || !s3lifestyle || !s3stock) {
    throw new Error('Bad request - Missing required fields');
  }

  const baseKey = `images/${seller_email}/${listing_id}_${new Date().toISOString()}`;

  try {
    const browser = await getBrowser();
    console.log("S3 URLs for image set templates:", s3benefit, s3dimension, s3lifestyle);
    // benefit and dimension infographic: JSON
    const templates = [
      { url: s3benefit, type: 'infographic' },
      { url: s3dimension, type: 'dimension' },
    ];

    const imageUrlsAndJsons = await Promise.all(
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

    // lifestyle infographic: JPEG
    const lifestyleKey = `${baseKey}_lifestyle_design_out`;
    const lifestyleJsonUrl = `${process.env.S3_BUCKET_URL}/${lifestyleKey}.json`;
    const image_JSON = filledCanvasJSON(s3lifestyle);
    const json_str = JSON.stringify(image_JSON);
    await putObjectToS3(lifestyleKey, json_str, "json", "application/json");

    const lifestyleData = {
      image_url: s3lifestyle,
      polotno_json: lifestyleJsonUrl,
    };

    // stock infographic: multipage JSON
    const stockKey = `${baseKey}_stock_design_out`;
    const stockJSON = await fetch(s3stock).then(response => response.json());
    const stockImageBlobsAndJsons = await jsonToBlobs(stockJSON, stockKey, browser);

    const pageCount = Array.isArray(stockImageBlobsAndJsons) ? stockImageBlobsAndJsons.length : 1;
    const stockUrls = Array.from({ length: pageCount }, (_, i) => `${process.env.S3_BUCKET_URL}/${stockKey}_${i}`);
    const pngUrls = stockUrls.map(url => `${url}.png`);
    const jsonUrls = stockUrls.map(url => `${url}.json`);

    await Promise.all([
      ...stockImageBlobsAndJsons.map(({ idx, json_str }) => putObjectToS3(idx, json_str, "json", "application/json")),
      ...stockImageBlobsAndJsons.map(({ idx, png_blob }) => putObjectToS3(idx, png_blob, "png", "image/png"))
    ]);

    const stockData = {};
    pngUrls.forEach((url, idx) => {
      stockData[`page_${idx + 1}`] = {
        image_url: url,
        polotno_json: jsonUrls[idx]
      };
    });

    const combinedData = [
      ...imageUrlsAndJsons.map(({ jsonUrl, pngUrl }) => ({
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