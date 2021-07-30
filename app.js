const {format} = require('util');
const express = require('express');
const Multer = require('multer');

// By default, the client will authenticate using the service account file
// specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable and use
// the project specified by the GOOGLE_CLOUD_PROJECT environment variable. See
// https://github.com/GoogleCloudPlatform/google-cloud-node/blob/master/docs/authentication.md
// These environment variables are set automatically on Google App Engine
const {Storage} = require('@google-cloud/storage');

// Instantiate a storage client
const storage = new Storage();

const app = express();
app.set('view engine', 'pug');

// This middleware is available in Express v4.16.0 onwards
app.use(express.json());

// Multer is required to process file uploads and make them available via
// req.files.
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // no larger than 5mb, you can change as needed.
  },
});

// A bucket is a container for objects (files).
const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET || "molten-reserve-321412.appspot.com");

app.get('/files/*', async (req, res, next) => {
  try {
    let filepath = req.path.slice(1);
    const blob = bucket.file(filepath);

    if ((await blob.exists())[0]) {
      const stream = blob.createReadStream();
      stream.pipe(res);
      res.on('error', () => res.sendStatus(500));
      res.on('end', () => res.sendStatus(200));
    } else {
      res.sendStatus(404);
    }

  } catch (e) {
    res.sendStatus(500).end(e);
  }
});


// Process the file upload and upload to Google Cloud Storage.
app.post('/files/*', async (req, res, next) => {
  try {
    let filepath = req.path.slice(1);
    console.log(filepath);

    // Create a new blob in the bucket and upload the file data.
    const blob = bucket.file(filepath);
    if ((await blob.exists())[0]) {
      res.sendStatus(409);
      return;
    }
    const blobStream = blob.createWriteStream({
      resumable: false,
    });

    req.pipe(blobStream);

    blobStream.on('error', err => {
      next(err);
    });

    blobStream.on('finish', () => res.sendStatus(200));
  } catch (e) {
    res.sendStatus(500).end(e);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = app;