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
      console.log("Processing benefit infographic: ", s3benefit);
      if (!isValidS3Url(s3benefit)) {
        console.log("Invalid S3 URL for benefit infographic, skipping...");
        return { image_url: "", polotno_json: "" };
      }
      const benefitJsonUrl = s3benefit;
      const benefitKey = `${baseKey}_benefit_design_out`;
      const benefitPngUrl = `${process.env.S3_BUCKET_URL}/${benefitKey}.png`;
      const benefitTemplateJSON = await fetchJson(s3benefit);
      const benefitPngBlob = await jsonToBlob(benefitTemplateJSON, browser);
      if (!benefitPngBlob || benefitPngBlob.length === 0) {
        console.log(`Failed to generate PNG for benefit template: ${benefitPngUrl}.`);
        return { image_url: "", polotno_json: "" };
      }
      await putObjectToS3(benefitKey, benefitPngBlob, "png", "image/png");
      console.log(`Successfully uploaded PNG file for benefit template: ${benefitPngUrl}.`);
      return { image_url: benefitPngUrl, polotno_json: benefitJsonUrl };
    };

    // dimension infographic: JSON template
    const processDimension = async () => {
      console.log("Processing dimension infographic...");
      const dimensionJSON = JSON.parse(s3dimension).template;
      if (!dimensionJSON.template) {
        console.log("No 'template' found in dimension infographic, skipping...");
        return { image_url: "", polotno_json: "" }; 
      }
      const dimensionTemplateJSON = dimensionJSON.template;
      const dimensionKey = `${baseKey}_dimension_design_out`;
      const dimensionJsonUrl = `${process.env.S3_BUCKET_URL}/${dimensionKey}.json`;
      const dimensionPngUrl = `${process.env.S3_BUCKET_URL}/${dimensionKey}.png`;
      const dimensionJsonData = JSON.stringify(dimensionTemplateJSON);
      const dimensionPngBlob = await jsonToBlob(dimensionTemplateJSON, browser);
      if (!dimensionPngBlob || dimensionPngBlob.length === 0) {
        console.log(`Failed to generate PNG for dimension template: ${dimensionPngUrl}.`);
        return { image_url: "", polotno_json: "" };
      }
      await putObjectToS3(dimensionKey, dimensionJsonData, "json", "application/json");
      await putObjectToS3(dimensionKey, dimensionPngBlob, "png", "image/png");
      console.log(`Successfully uploaded JSON and PNG files for dimension template: ${dimensionJsonUrl}, ${dimensionPngUrl}.`);
      return { image_url: dimensionPngUrl, polotno_json: dimensionJsonUrl };
    };

    // lifestyle infographic: JPEG
    const processLifestyle = async () => {
      console.log("Processing lifestyle infographic: ", s3lifestyle);
      if (!isValidS3Url(s3lifestyle)) {
        console.log("Invalid S3 URL for lifestyle infographic, skipping...");
        return { image_url: "", polotno_json: "" };
      }
      const lifestyleKey = `${baseKey}_lifestyle_design_out`;
      const lifestyleJsonUrl = `${process.env.S3_BUCKET_URL}/${lifestyleKey}.json`;
      const lifestyleJsonStr = JSON.stringify(filledCanvasJSON(s3lifestyle));
      await putObjectToS3(lifestyleKey, lifestyleJsonStr, "json", "application/json");

      return { image_url: s3lifestyle, polotno_json: lifestyleJsonUrl };
    };
    
    // stock infographic: multipage JSON
    const processStock = async () => {
      console.log(`Processing stock infographic: ${s3stock}`);
      const stockTemplateJSON = await fetchJson(s3stock);
      if (!isValidS3Url(s3stock)) {
        console.log("Invalid S3 URL for stock infographic, skipping...");
        return [];
      }
      const stockKey = `${baseKey}_stock_design_out`;
      const stockImageBlobsAndJsons = await jsonToBlobs(stockTemplateJSON, stockKey, browser);

      return Promise.all(stockImageBlobsAndJsons.map(async ({ idx, json_str, png_blob }) => {
        const stockJsonUrl = `${process.env.S3_BUCKET_URL}/${idx}.json`;
        const stockPngUrl = `${process.env.S3_BUCKET_URL}/${idx}.png`;
        await Promise.all([
          putObjectToS3(idx, json_str, "json", "application/json"),
          putObjectToS3(idx, png_blob, "png", "image/png")
        ]);
        return { image_url: stockPngUrl, polotno_json: stockJsonUrl };
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

const fetchJson = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch from ${url}`);
    }
    return await response.json();
  } catch (err) {
    console.error(`Error fetching from ${url}:`, err);
    throw err;  
  }
};

const isValidS3Url = (url) => {
  const regex = /^https:\/\/(?:[a-z0-9-]+\.)+[a-z]{2,6}\/[a-zA-Z0-9\-_]+(?:\/[a-zA-Z0-9\-_]+)*$/;
  return regex.test(url);
};