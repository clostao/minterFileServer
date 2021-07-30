var fs = require('fs');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/files/*', async function(req, res, next) {
  let filepath = req.path.replace("/files/", "").split("?")[0];
  filepath = path.join('./files/', filepath);
  let exists = await fs.promises.stat(filepath).then(() => true).catch(() => false);
  if (exists) {
    let stream = fs.createReadStream(filepath);
    stream.pipe(res);
    res.on('end', () => res.sendStatus(200));
    return;
  }
  res.sendStatus(404);
})

app.post('/files/*', async function(req, res, next) {
  let filepath = req.path.replace("/files/", "").split("?")[0];
  let folderPath = path.join('./files/', filepath.split('/').slice(0, -1).join('/'));
  await fs.promises.mkdir(folderPath, { recursive: true }).catch(e => e);
  filepath = path.join('./files/', filepath);
  let exists = await fs.promises.stat(filepath).then(e => true).catch(err => false);
  if (exists) {
    console.log("File already exists");
    return res.sendStatus(409);
  }
  let stream = fs.createWriteStream(filepath);
  req.pipe(stream);
  req.on('error', () => res.sendStatus(400));
  stream.on('error', () => res.sendStatus(500));
  req.on('end', (chnk) => {
    stream.end(chnk);
    res.sendStatus(200);
  });
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
