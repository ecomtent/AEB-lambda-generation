const { putObjectToS3, websocketNotifyClients, updateListing } = require('utils/aws_services');
const { jsonToBlob } = require('utils/image_utils');

exports.handler = async (event, context) => {
  console.log("Incoming event:", event);
  const { seller_id, listing_id, seller_email, s3benefit, s3dimension, s3lifestyle } = event;

  if (!seller_id || !listing_id || !seller_email || !s3benefit || !s3dimension || !s3lifestyle) {
    throw new Error('Bad request - Missing required fields');
  }

  const baseKey = `images/${seller_email}/${listing_id}_${new Date().toISOString()}`;

  try {
    console.log("S3 URLs for image set templates:", s3benefit, s3dimension, s3lifestyle);
    const templates = [
      { url: s3benefit, type: 'infographic' },
      { url: s3dimension, type: 'dimension' },
      { url: s3lifestyle, type: 'lifestyle' },
    ];
    const imageBlobsAndJsons = await Promise.all(
      templates.map(async ({ url, type }) => {
        const key = `${baseKey}_${type}_design_out`;
        const jsonUrl = `${process.env.S3_BUCKET_URL}/${key}.json`;
        const pngUrl = `${process.env.S3_BUCKET_URL}/${key}.png`;

        const imageSetTemplate = await fetch(url).then(response => response.json());
        const imageData = await jsonToBlob(imageSetTemplate);

        return { imageData, jsonUrl, pngUrl };
      })
    );

    // Uploading both JSON and PNG files to S3    
    await Promise.all(
      imageBlobsAndJsons.map(({ imageBlob, jsonUrl, pngUrl }) => {
        return Promise.all([
          putObjectToS3(jsonUrl, JSON.stringify(imageSetTemplate), "json", "application/json"),
          putObjectToS3(pngUrl, imageBlob, "jpg", "image/jpg"),
        ]);
      })
    );
    console.log("Successfully uploaded PNG and JSON files.");

    const combinedData = imageBlobsAndJsons.map(({ jsonUrl, pngUrl }) => ({
      image_url: pngUrl,
      polotno_json: jsonUrl
    }));

    const updateResult = await updateListing({
      seller_id,
      listing_id,
      listing_updates: { listing_images: combinedData }
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
  }
};