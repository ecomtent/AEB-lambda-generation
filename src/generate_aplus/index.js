const { putObjectToS3, websocketNotifyClients, updateListing } = require('utils/aws_services');
const { jsonToBlobs, getBrowser, closeBrowser } = require('utils/image_utils');

exports.handler = async (event, context) => {
  console.log("Incoming event:", event);
  const { seller_id, listing_id, seller_email, s3url } = event;

  if (!seller_id || !listing_id || !seller_email || !s3url) {
    throw new Error('Bad request - Missing required fields');
  }

  const baseKey = `images/${seller_email}/${listing_id}_${new Date().toISOString()}_aplus_design_out`;

  try {
    const browser = await getBrowser();
    console.log("S3 URL for A+ infographic template:", s3url);
    const aplusTemplate = await (await fetch(s3url)).json();
    const imageBlobsAndJsons = await jsonToBlobs(aplusTemplate, baseKey, browser);

    const pageCount = Array.isArray(imageBlobsAndJsons) ? imageBlobsAndJsons.length : 1;
    const baseUrls = Array.from({ length: pageCount }, (_, i) => `${process.env.S3_BUCKET_URL}/${baseKey}_${i}`);
    const pngUrls = baseUrls.map(url => `${url}.png`);
    const jsonUrls = baseUrls.map(url => `${url}.json`);

    // Uploading both JSON and PNG files to S3
    await Promise.all([
      ...imageBlobsAndJsons.map(({ idx, json_str }) => putObjectToS3(idx, json_str, "json", "application/json")),
      ...imageBlobsAndJsons.map(({ idx, png_blob }) => putObjectToS3(idx, png_blob, "png", "image/png"))
    ]);

    console.log("Successfully uploaded PNG and JSON files.");
    console.log("Generated PNG URLs:", JSON.stringify(pngUrls, null, 2));
    console.log("Generated JSON URLs:", JSON.stringify(jsonUrls, null, 2));

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
      console.log(`Listing updated successfully for seller id ${seller_id} listing id ${listing_id}.`);
      const websocketResult = await websocketNotifyClients(seller_id, listing_id);
      if (websocketResult) {
        console.log('WebSocket notification sent successfully');
      } else {
        console.error('WebSocket notification failed');
      }
    } else {
      console.error('Listing update failed, skipping WebSocket notification');
    }

    return aplusData;

  } catch (err) {
    console.error("Unable to process the request:", err.message);
  } finally {
    await closeBrowser();
  }
};