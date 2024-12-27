const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');   
const { createInstance } = require('polotno-node/instance');

const polotnoKey = process.env.POLOTNO_KEY

// Initialize browser once and reuse
const getBrowser = async () => {
  try {
    const browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-zygote',
        '--single-process',
        '--disable-dev-shm-usage',  
        '--disable-gpu',            
        '--no-sandbox'              
      ],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    return browser;
  } catch (err) {
    console.error('Error launching browser:', err);
    throw new Error('Failed to launch browser');
  }
};

const jsonToDataURL = async (json) => {
  let browser;
  let instance;
  let segmented_image_url = "";
  try {
    browser = await getBrowser();
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
    if (browser) await browser.close();
  }
  return segmented_image_url;
};

const jsonToBlob = async (json) => {
  let browser;
  let instance;
  try {
    browser = await getBrowser();
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
    if (browser) await browser.close();
  }
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