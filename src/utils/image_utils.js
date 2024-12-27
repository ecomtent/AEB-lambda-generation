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
    if (!browserInstance.isConnected()) {
      console.log('Browser disconnected, creating new instance...');
      browserInstance = await getBrowser();
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

const jsonToBlob = async (json, browser, retries = 3) => {
  let instance = null;
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
      try {
          // Create new browser instance if connection is lost
          if (!browser.isConnected()) {
              console.log('Browser disconnected, creating new instance...');
              browser = await getBrowser();
          }
          
          instance = await createInstance({
              key: polotnoKey,
              browser,
              useParallelPages: false,
          });
          
          const blob = await instance.jsonToBlob(json, { 
              mimeType: "image/jpg", 
              assetLoadTimeout: 30000,
              skipFontError: true 
          });

          return blob;
      } catch (err) {
          lastError = err;
          console.error(`Attempt ${attempt} failed:`, err);
          
          // Clean up the failed instance
          if (instance) {
              try {
                  await instance.close();
              } catch (closeErr) {
                  console.warn("Warning: Error while closing failed Polotno instance:", closeErr);
              }
          }
          
          // Wait before retrying
          if (attempt < retries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
      }
  }
  
  throw new Error(`Failed after ${retries} attempts. Last error: ${lastError.message}`);
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