const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');   
const { createInstance } = require('polotno-node/instance');

const polotnoKey = process.env.POLOTNO_KEY

let browser;

// Initialize browser once and reuse
const getBrowser = async () => {
  if (!browser || !browser.isConnected()) {
    try {
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--no-zygote',
          '--single-process',
          '--disable-dev-shm-usage',  
          '--disable-gpu',            
          '--no-sandbox'              
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
      console.log("Browser launched successfully");
    } catch (err) {
      console.error('Error launching browser:', err);
      throw new Error('Failed to launch browser');
    }
  }
  return browser;
};

const jsonToDataURL = async (json, browser) => {
  let instance;
  let segmented_image_url = "";
  try {
    if (!browser || !browser.isConnected()) {
      browser = await getBrowser();
    }
    instance = await createInstance({
      key: polotnoKey,
      browser
    });

    segmented_image_url = await instance.jsonToDataURL(json, { ignoreBackground: true });
  } catch (err) {
    console.error('Error converting JSON to URL:', err);
    throw new Error('Failed to convert JSON to DataURL');
  } finally {
    if (instance) await instance.close();
  }
  return segmented_image_url;
};

const jsonToBlob = async (json, browser) => {
  let instance;
  try {
    if (!browser || !browser.isConnected()) {
      browser = await getBrowser();
    }
    instance = await createInstance({
      key: polotnoKey,
      browser,
      useParallelPages: false,
    });

    const blob = await instance.jsonToBlob(json, { 
      mimeType: 'image/jpg', 
      assetLoadTimeout: 30000,
      skipFontError: true 
    });

    return blob;
  } catch (err) {
    console.error('Error generating blob:', err);
    throw new Error('Failed to generate blob');
  } finally {
    if (instance) await instance.close();
  }
};

const jsonToBlobs = async (multipageTemplate, baseKey, browser) => {
  const { width, height, fonts, pages, unit, dpi } = multipageTemplate;
  const imageBlobsAndJsons = [];

  try {
    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      const imageJson = {
        width,
        height,
        fonts,
        pages: [page],
        unit,
        dpi
      };
  
      try {
        const png_blob = await jsonToBlob(imageJson, browser);
        const json_str = JSON.stringify(imageJson);
  
        imageBlobsAndJsons.push({
          idx: `${baseKey}_${index}`,
          png_blob,
          json_str
        });
      } catch (err) {
        console.error(`Error generating blob for index ${index}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Error launching browser:', err.message);
  }

  return imageBlobsAndJsons;
};

const filledCanvasJSON = (segmented_image) => {
  const defaultJson = {
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
              "src": segmented_image,
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

  return defaultJson;
}

module.exports = { jsonToDataURL, jsonToBlob, jsonToBlobs, filledCanvasJSON };