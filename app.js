const {format} = require('util');
const express = require('express');
const cors = require('cors');
// By default, the client will authenticate using the service account file
// specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable and use
// the project specified by the GOOGLE_CLOUD_PROJECT environment variable. See
// https://github.com/GoogleCloudPlatform/google-cloud-node/blob/master/docs/authentication.md
// These environment variables are set automatically on Google App Engine
const {Storage} = require('@google-cloud/storage');

const app = express();

app.use(cors())

app.set('view engine', 'pug');

// This middleware is available in Express v4.16.0 onwards
app.use(express.json());
// A bucket is a container for objects (files).
let bucket, storage;

try {
  storage = new Storage();
  bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET || "nft-file-sever.appspot.com");
} catch (e) {
  console.error(e);
}



app.get('/nfts/*', async (req, res, next) => {
  try {
    let nftMetadata = req.path.slice(1);
    const blob = bucket.file(nftMetadata);

    if ((await blob.exists())[0]) {
      const stream = blob.createReadStream();
      stream.pipe(res);
      res.on('error', (e) => res.status(500).end(e.message));
      res.on('end', () => res.sendStatus(200));
    } else {
      res.sendStatus(404);
    }

  } catch (e) {
    console.log(e)
    res.status(500).end(e.message);
  }
});

app.get('/nft-resources/*', async (req, res, next) => {
  try {
    let nftMetadata = req.path.slice(1);
    const blob = bucket.file(nftMetadata);

    if ((await blob.exists())[0]) {
      const stream = blob.createReadStream();
      stream.pipe(res);
      res.setHeader('Content-Type', (await blob.getMetadata())[0].contentType)
      res.on('error', (e) => res.status(500).end(e.message));
      res.on('end', () => res.sendStatus(200));
    } else {
      res.sendStatus(404);
    }

  } catch (e) {
    console.log(e)
    res.status(500).end(e.message);
  }
});


// Process the file upload and upload to Google Cloud Storage.
app.post('/nfts/*', async (req, res, next) => {
  try {
    if (req.query.description === undefined || req.query.name === undefined) return res.status(404).end("Invalid parameters. Name and description should be provided.")

    // Path declarations
    let metadataPath = req.path.slice(1);
    let resourcePath = metadataPath.replace("nfts", "nft-resources");

    // Checking availability
    const resourceBlob = bucket.file(resourcePath);

    const metadataBlob = bucket.file(metadataPath);
    if ((await metadataBlob.exists())[0]) {
      res.sendStatus(409);
      return;
    }

    await metadataBlob.setMetadata({contentType: "application/json"}).catch(_ => null);
    await resourceBlob.setMetadata({contentType: req.headers['Content-Type']}).catch(_ => null);

    const blobStream = resourceBlob.createWriteStream({
      resumable: false,
    });

    // End of checking availability
    // Upload file

    req.pipe(blobStream);

    blobStream.on('error', e => {
      res.status(500).end(e.message);
    });

    blobStream.on('finish', async () => {
      let data = {
        description: req.query.description,
        name: req.query.name,
        imageType: req.header('Content-Type') || "image/jpeg",
        image: `https://nft-file-sever.appspot.com/${resourcePath}`
      };
      let saved = await metadataBlob.save(JSON.stringify(data)).then(() => true).catch(() => false);
      if (!saved) {
        res.sendStatus(503);
      } else  {
        res.setHeader('Content-Location', metadataPath);
        res.sendStatus(200);
      }
    });

  } catch (e) {
    res.status(500).end(e);
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = app;