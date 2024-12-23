const axios = require('axios');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');   
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Initialize these once outside the handler
const s3Client = new S3Client({ region: 'us-east-1' });
chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

// Reusable browser instance
let browserInstance = null;

const polotnoKey = process.env.POLOTNO_KEY

// Initialize browser once and reuse
const getBrowser = async () => {
  if (!browserInstance || !browserInstance.isConnected()) {  
      browserInstance = await puppeteer.launch({
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
  }
  return browserInstance;
};

const { createInstance } = require('polotno-node/instance');

const jsonToDataURL = async (json) => {
  let instance = null;
  let segmented_image_url = "";
  try {
    if (!browser.isConnected()) {
      console.log('Browser disconnected, creating new instance...');
      browser = await getBrowser();
    }

    instance = await createInstance({
      key: polotnoKey,
      browser
    });
    
    segmented_image_url  = await instance.jsonToDataURL(json, { ignoreBackground: true });
    instance.close();
  } catch (err) {
    console.error("Error converting JSON to URL", err);
  }

  return segmented_image_url;
}

const jsonToBlob = async (json) => {
  let instance = null;
  let blob = "";
  try {
    if (!browser.isConnected()) {
      console.log('Browser disconnected, creating new instance...');
      browser = await getBrowser();
    }

    instance = await createInstance({
      key: polotnoKey,
      browser,
      useParallelPages: false,
    });
    
    blob = await instance.jsonToBlob(json, { mimeType: "image/jpg", assetLoadTimeout: 60000, skipFontError: true });
    instance.close();
  } catch (err) {
    console.error("Error converting JSON to Blob", err);
  }
  return blob;
};

const jsonToTransparentBlob = async (json) => {
  let instance = null;
  let blob = "";
  try {
    if (!browser.isConnected()) {
      console.log('Browser disconnected, creating new instance...');
      browser = await getBrowser();
    }

    instance = await createInstance({
      key: polotnoKey,
      browser
    });

    const segmented_image_url  = jsonToDataURL(json);
    // segmented_image_url = segmented_image_url.replace(/^data:image\/.+;base64,/, '');

    const response = await fetch(segmented_image_url);
    if (!response.ok) {
      throw new Error(`Failed to fetch the image: ${response.status} ${response.statusText}`);
    }
    blob = await response.blob();
    instance.close();
  } catch (err) {
    console.error("Error converting JSON to Transparent Blob", err);
  }
  return blob;
};

const jsonToBlobs = async (multipageTemplate, baseKey) => {
  const { width, height, fonts, pages, unit, dpi } = multipageTemplate;
  const imageBlobsAndJsons = [];

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
      const png_blob = await jsonToBlob(imageJson);
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

  return imageBlobsAndJsons;
};

const combineJsons = (jsonArray) => {
  if (!Array.isArray(jsonArray) || jsonArray.length === 0) {
    throw new Error('Input must be a non-empty array of JSON objects');
  }

  let combinedJson;
  try {
    combinedJson = JSON.parse(jsonArray[0]);
  } catch (e) {
    throw new Error('Error parsing the first JSON string');
  }

  for (let i = 1; i < jsonArray.length; i++) {
    let json;
    try {
      json = JSON.parse(jsonArray[i]);
    } catch (e) {
      throw new Error(`Error parsing JSON string at index ${i}`);
    }
    if (typeof json !== 'object' || json === null) {
      throw new Error(`Element at index ${i} must be a valid JSON object`);
    }

    // check for consistency in properties
    if (combinedJson.width !== json.width) {
      throw new Error(`Inconsistent width across JSON objects: ${combinedJson.width} vs ${json.width}`);
    }
    if (combinedJson.height !== json.height) {
      throw new Error(`Inconsistent height across JSON objects: ${combinedJson.height} vs ${json.height}`);
    }
    if (combinedJson.unit !== json.unit) {
      throw new Error(`Inconsistent unit across JSON objects: ${combinedJson.unit} vs ${json.unit}`);
    }
    if (combinedJson.dpi !== json.dpi) {
      throw new Error(`Inconsistent DPI across JSON objects: ${combinedJson.dpi} vs ${json.dpi}`);
    }
    // merge fonts if necessary
    const combinedFonts = new Set([...combinedJson.fonts, ...json.fonts]);
    combinedJson.fonts = Array.from(combinedFonts);

    combinedJson.pages = [...combinedJson.pages, ...json.pages];
  }

  return combinedJson;
};

module.exports = { jsonToDataURL, jsonToBlob , jsonToTransparentBlob, jsonToBlobs , combineJsons };