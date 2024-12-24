const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');   
const { createInstance } = require('polotno-node/instance');

// Initialize these once outside the handler
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

module.exports = { jsonToDataURL, jsonToBlob, jsonToBlobs };