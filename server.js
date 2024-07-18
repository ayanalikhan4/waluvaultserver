const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const mime = require("mime-types");
const cors = require("cors");

const app = express();
const port = 3001;

app.use(cors());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const s3 = new AWS.S3({
  accessKeyId: process.env.NEXT_PUBLIC_DO_SPACES_KEY,
  secretAccessKey: process.env.NEXT_PUBLIC_DO_SPACES_SECRET,
  endpoint: new AWS.Endpoint("https://nyc3.digitaloceanspaces.com"),
});

app.post("/upload", upload.array("files", 20), (req, res) => {
  const files = req.files;
  const bucketName = req.body.bucketName;

  if (!bucketName) {
    return res.status(400).send({ error: "Bucket name is required" });
  }

  const uploadPromises = files.map((file) => {
    const contentType =
      mime.lookup(file.originalname) || "application/octet-stream";

    const params = {
      Bucket: bucketName, 
      Key: file.originalname,
      Body: file.buffer,
      ContentType: contentType,
      ACL: "public-read",
      ContentDisposition: "inline",
    };

    return s3.upload(params).promise();
  });

  Promise.all(uploadPromises)
    .then((results) => {
      const fileUrls = results.map((result) => result.Location);
      res.status(200).send({ urls: fileUrls });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send(err);
    });
});

app.get("/list-files", async (req, res) => {
  const bucketName = req.query.bucketName;

  if (!bucketName) {
    return res.status(400).send({ error: "Bucket name is required" });
  }

  const params = {
    Bucket: bucketName,
  };

  try {
    const data = await s3.listObjectsV2(params).promise();
    const files = data.Contents.map((file) => {
      return {
        Key: file.Key,
        URL: `https://${params.Bucket}.nyc3.digitaloceanspaces.com/${file.Key}`,
      };
    });
    res.status(200).send(files);
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});