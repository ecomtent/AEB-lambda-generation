const { putObjectToS3, dynamoDB } = require('../utils/aws_services');
const { jsonToDataURL } = require('../utils/image_utils');
const _ = require('lodash');
const axios = require('axios');
const sharp = require('sharp');

async function fetchBlob(url) {
    const response = await fetch(url);
    return response.blob();
}

const getImageDimensionsForCanvas = async (url) => {
    try {
        const response = await fetchBlob(url);
        const buffer = await response.arrayBuffer(); // Convert Blob to ArrayBuffer

        // Use sharp to get the image dimensions
        const image = sharp(Buffer.from(buffer)); // Convert ArrayBuffer to Buffer
        const metadata = await image.metadata();  // Get image metadata

        if (!metadata.width || !metadata.height) {
            throw new Error('Unable to get image dimensions');
        }

        const imageWidth = metadata.width;
        const imageHeight = metadata.height;
        const aspectRatio = imageWidth / imageHeight;

        const newWidth = (imageWidth >= imageHeight ? 1080 : 1080 * aspectRatio) * 0.75;
        const newHeight = (imageHeight >= imageWidth ? 1080 : 1080 / aspectRatio) * 0.75;
        const newPosX = (1080 - newWidth) / 2;
        const newPosY = ((1080 - newHeight) / 2) + 75;

        return [newWidth, newHeight, newPosX, newPosY ];
    } catch (error) {
        throw new Error(`Error processing image: ${error}`);
    }
};

function filledCanvasJSON(segmentedImageUrl) {
  return {
      "width": 1080,
      "height": 1080,
      "fonts": [],
      "pages": [
        {
          "id": "iDJt61VKrs",
          "children": [
            {
              "id": "DkYms5Q_P4",
              "type": "image",
              "name": "",
              "opacity": 1,
              "animations": [],
              "visible": true,
              "selectable": true,
              "removable": true,
              "alwaysOnTop": false,
              "showInExport": true,
              "x": 0,
              "y": 0,
              "width": 1080,
              "height": 1080,
              "rotation": 0,
              "blurEnabled": false,
              "blurRadius": 10,
              "brightnessEnabled": false,
              "brightness": 0,
              "sepiaEnabled": false,
              "grayscaleEnabled": false,
              "shadowEnabled": false,
              "shadowBlur": 5,
              "shadowOffsetX": 0,
              "shadowOffsetY": 0,
              "shadowColor": "black",
              "shadowOpacity": 1,
              "draggable": true,
              "resizable": true,
              "contentEditable": true,
              "styleEditable": true,
              "src": segmentedImageUrl,
              "cropX": 0,
              "cropY": 0,
              "cropWidth": 1,
              "cropHeight": 1,
              "cornerRadius": 0,
              "flipX": false,
              "flipY": false,
              "clipSrc": "",
              "borderColor": "black",
              "borderSize": 0,
              "keepRatio": false
            }
          ],
          "width": "auto",
          "height": "auto",
          "background": "white",
          "bleed": 0
        }
      ],
      "unit": "px",
      "dpi": 72
    };
}

exports.handler = async (event, context) => {
  const body = JSON.parse(event.body);  
  const { seller_id, listing_id, seller_email } = body;  
  if (!seller_id || !listing_id || !seller_email ) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Bad request - Missing required fields' })
  };
  }

  const Key = `images/${seller_email}/${listing_id}_${new Date().toISOString().trim()}_lifestyle_design_out`
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

      const prompt = data.Item.prompts.prompt
      const image_url = data.Item.segmented_image

      const dims = await getImageDimensionsForCanvas(image_url);
      const width = dims[0];
      const height = dims[1];
      const x = dims[2];
      const y = dims[3];

      const default_object = { "width": 1080, "height": 1080, "fonts": [], "pages": [ { "id": "iDJt61VKrs", "children": [ { "id": "DkYms5Q_P4", "type": "image", "name": "", "opacity": 1, "animations": [], "visible": true, "selectable": true, "removable": true, "alwaysOnTop": false, "showInExport": true, 
      "x": x, 
      "y": y, 
      "width": width, "height": height,
      "rotation": 0, "blurEnabled": false, "blurRadius": 10, "brightnessEnabled": false, "brightness": 0, "sepiaEnabled": false, "grayscaleEnabled": false, "shadowEnabled": false, "shadowBlur": 5, "shadowOffsetX": 0, "shadowOffsetY": 0, "shadowColor": "black", "shadowOpacity": 1, "draggable": true, "resizable": true, "contentEditable": true, "styleEditable": true, "src": image_url, "cropX": 0, "cropY": 0, "cropWidth": 1, "cropHeight": 0.9999999999999998, "cornerRadius": 0, "flipX": false, "flipY": false, "clipSrc": "", "borderColor": "black", "borderSize": 0, "keepRatio": false } ], "width": "auto", "height": "auto", "background": "white", "bleed": 0 } ], "unit": "px", "dpi": 72 };

      const imageURL = await jsonToDataURL(default_object);

      const params_gen_bg = {
          'user_email': seller_email,
          'user_id': seller_id,
          'image': "who cares",
          'matte': imageURL,
          'segmented_image': imageURL,
          'prompt': prompt,
          "num_images": 1,
          "keep_original_image_size": "False"
      };

      let generated_background = "";

      await axios.post(`${config.LISTING_GATEWAY}/generate-background-sagemaker`, params_gen_bg)
          .then((result) => {
              generated_background = result.data.image;
          }).catch((err) => {
              console.log(err);
              return {
                statusCode: 500,
                body: JSON.stringify({ message: 'Error generating lifestyle infographic', error: err.message })
            };
          });

      // generated_background is an s3Link to an image, first download , but switch the link to the pngUrl
  
      const response_png = await axios.get(generated_background, { responseType: 'arraybuffer' });
      const pngBlob = Buffer.from(response_png.data, 'binary');

      await putObjectToS3(Key, pngBlob, "png", "image/png");

      const image_JSON = filledCanvasJSON(generated_background);

      const json_str = JSON.stringify(image_JSON);
      const json_data = json_str;

      await putObjectToS3(Key, json_data, "json", "application/json");

      if (generated_background === "") {
          return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Failed to generate background', error: err.message })
        };
      }

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