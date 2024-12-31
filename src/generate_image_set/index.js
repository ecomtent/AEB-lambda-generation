const { putObjectToS3, dynamoDB, GetCommand, websocketNotifyClients, updateListing } = require('utils/aws_services');
const { jsonToBlob, jsonToBlobs, filledCanvasJSON, getBrowser, closeBrowser } = require('utils/image_utils');

const SELLER_TABLE = process.env.SELLER_TABLE_NAME;

exports.handler = async (event, context) => {
  console.log("Incoming event:", event);
  const { seller_id, listing_id, seller_email, s3benefit, s3dimension, s3lifestyle, s3stock } = event;

  if (!seller_id || !listing_id || !seller_email) {
    throw new Error('Bad request - Missing required fields');
  }

  const browser = await getBrowser();
  const baseKey = `images/${seller_email}/${listing_id}_${new Date().toISOString()}`;

  try {    
    console.log(`Generating image set for seller_id ${seller_id}, listing_id ${listing_id}.`);
    // benefit infographic: JSON (S3 link)
    const processBenefit = async () => {
      console.log("Processing benefit infographic: ", s3benefit)
      const jsonUrl = s3benefit;
      const pngUrl = `${process.env.S3_BUCKET_URL}/${baseKey}_benefit_design_out.png`;
      const templateJSON = await fetch(s3benefit).then(response => response.json());
      const png_blob = await jsonToBlob(templateJSON, browser);
      if (!png_blob || png_blob.length === 0) {
        console.log(`Failed to generate PNG for benefit template: ${pngUrl}.`);
        return { jsonUrl: "", pngUrl: "" };
      }
      await putObjectToS3(pngUrl, png_blob, "png", "image/png");
      console.log(`Successfully uploaded PNG file for benefit template: ${pngUrl}.`);
      return { jsonUrl, pngUrl };
    };

    // dimension infographic: JSON template
    const processDimension = async () => {
      console.log("Processing dimension infographic...")
      const dimensionKey = `${baseKey}_dimension_design_out`;
      const jsonUrl = `${process.env.S3_BUCKET_URL}/${dimensionKey}.json`;
      const pngUrl = `${process.env.S3_BUCKET_URL}/${dimensionKey}.png`;
      const json_data = JSON.stringify(s3dimension);
      const png_blob = await jsonToBlob(s3dimension, browser);
      if (!png_blob || png_blob.length === 0) {
        console.log(`Failed to generate PNG for benefit template: ${pngUrl}.`);
        return { jsonUrl: "", pngUrl: "" };
      }
      await putObjectToS3(dimensionKey, json_data, "json", "application/json");
      await putObjectToS3(dimensionKey, png_blob, "png", "image/png");
      console.log(`Successfully uploaded PNG file for dimension template: ${pngUrl}.`);
      return { jsonUrl, pngUrl };
    };

    // lifestyle infographic: JPEG
    const processLifestyle = async () => {
      console.log("Processing lifestyle infographic: ", s3lifestyle)
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
      console.log("Processing stock infographic: ", s3stock)
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
    const [benefitData, dimensionData, lifestyleData, stockData] = await Promise.allSettled([
      processBenefit(),
      processDimension(),
      processLifestyle(),
      processStock(),
    ]);
    
    console.log("Benefit Data:", benefitData);
    console.log("Dimension Data:", dimensionData);
    console.log("Lifestyle Data:", lifestyleData);
    console.log("Stock Data:", stockData);

    const combinedData = [
      ...(benefitData && benefitData.status === 'fulfilled' ? [{ image_url: benefitData.value.image_url, polotno_json: benefitData.value.polotno_json }] : []),
      ...(dimensionData && dimensionData.status === 'fulfilled' ? [{ image_url: dimensionData.value.image_url, polotno_json: dimensionData.value.polotno_json }] : []),
      ...(lifestyleData && lifestyleData.status === 'fulfilled' ? [{ image_url: lifestyleData.value.image_url, polotno_json: lifestyleData.value.polotno_json }] : []),
      ...(stockData && stockData.status === 'fulfilled' ? stockData.value : [])
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

    return combinedData;

  } catch (err) {
    console.error("Unable to process the request:", err.message);
    return { error: err.message };
  } finally {
    await closeBrowser();
  }
};